import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { GoogleGenerativeAI, type Part } from "@google/generative-ai";
import { aiToolDeclarations, executeAiTool } from "@/lib/ai-tools";

const SYSTEM_PROMPT = `You are an analytics assistant for Big Buildings Direct, a company that sells and installs metal buildings/carports. You have access to query tools to look up real data from the database.

## Available Data
- **Orders**: order number, customer name/email/phone, building type/size, delivery state, pricing (subtotal, deposit), payment status, order status (draft, pending_payment, sent_for_signature, signed, ready_for_manufacturer, cancelled), sales person, manufacturer, dates (created_at, sent_for_signature_at, signed_at, paid_at, ready_for_manufacturer_at, cancelled_at)
- **Order Stats**: aggregate counts and revenue grouped by status, month, salesRep, buildingType, or state
- **Change Orders**: modifications to existing orders — reason, deposit changes (total diff, deposit diff), status (draft, pending_signature, signed, cancelled), signed/cancelled dates
- **Tickets**: BST workflow tickets (welcome calls, LPP, building updates) with status, priority, assignee
- **Users**: team members with roles (Admin, Manager, Sales Rep, BST, Customer), office (Marion/Harbor), department
- **Pay Data**: monthly pay ledgers with buildings sold, commissions, bonuses, salary, deductions
- **Deposit Status**: deposit/payment tracking across orders — payment type, payment status (paid, manually_approved, pending, unpaid), paid date
- **Cancellations**: cancelled orders with cancel reason, cancelled date, cancelled by email, sales person
- **Customers**: customer profiles with order counts

## Response Guidelines
- Always query data before answering — never guess or make up numbers
- Use multiple tool calls when needed to fully answer a question
- Format responses clearly with markdown: use **bold** for emphasis, tables for comparisons, lists for enumerations
- When showing financial data, format as currency (e.g., $12,345.67)
- When dates are ambiguous, clarify the range you used
- If a query returns no results, say so clearly and suggest alternate filters
- Keep responses concise but thorough
- When asked about "this year" use the current year, "last month" means the previous calendar month, etc.
- Today's date: ${new Date().toISOString().split("T")[0]}`;

const MAX_TOOL_ROUNDS = 8;

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth();

    if (user.roleName !== "Admin" && user.roleName !== "Manager") {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages } = await request.json();
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return new Response(JSON.stringify({ error: "Messages are required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: SYSTEM_PROMPT,
      tools: [{ functionDeclarations: aiToolDeclarations }],
    });

    // Build conversation history for Gemini
    const history = messages.slice(0, -1).map((m: { role: string; content: string }) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.content }],
    }));

    const lastMessage = messages[messages.length - 1].content;

    const chat = model.startChat({ history });

    // SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          let result = await chat.sendMessage(lastMessage);
          let response = result.response;
          let toolRound = 0;

          // Agentic loop: keep going while there are tool calls
          while (toolRound < MAX_TOOL_ROUNDS) {
            const candidate = response.candidates?.[0];
            if (!candidate) break;

            const parts = candidate.content?.parts || [];
            const functionCalls = parts.filter((p) => p.functionCall);

            if (functionCalls.length === 0) break;

            // Execute each tool call
            const toolResponses: Part[] = [];

            for (const part of functionCalls) {
              const { name, args } = part.functionCall!;
              send({ type: "tool", tool: name });

              try {
                const toolResult = await executeAiTool(name, (args as Record<string, unknown>) || {});
                toolResponses.push({
                  functionResponse: {
                    name,
                    response: toolResult as object,
                  },
                });
              } catch (err) {
                toolResponses.push({
                  functionResponse: {
                    name,
                    response: { error: err instanceof Error ? err.message : "Tool execution failed" },
                  },
                });
              }
            }

            // Feed tool results back to Gemini
            result = await chat.sendMessage(toolResponses);
            response = result.response;
            toolRound++;
          }

          // Stream the final text response
          const text = response.text();
          if (text) {
            // Stream in chunks for a smoother feel
            const chunkSize = 20;
            for (let i = 0; i < text.length; i += chunkSize) {
              send({ type: "text", content: text.slice(i, i + chunkSize) });
            }
          }

          send({ type: "done" });
        } catch (err) {
          console.error("AI agent stream error:", err);
          const errMsg = err instanceof Error ? err.message : String(err);
          let userMessage = "An unexpected error occurred. Please try again.";
          if (errMsg.includes("429") || errMsg.includes("quota") || errMsg.includes("Too Many Requests")) {
            userMessage = "The AI service rate limit has been exceeded. Please wait a minute and try again. If this persists, the API key may need to be upgraded from the free tier.";
          } else if (errMsg.includes("401") || errMsg.includes("API_KEY_INVALID") || errMsg.includes("PERMISSION_DENIED")) {
            userMessage = "The Gemini API key is invalid or has been revoked. Please check the GEMINI_API_KEY in your environment settings.";
          }
          send({
            type: "error",
            content: userMessage,
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("POST /api/ai-agent error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
