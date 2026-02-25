"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
}

const SUGGESTED_QUESTIONS = [
  "How many active orders do we have right now?",
  "Show me cancellations this year with reasons",
  "Which sales rep has the most revenue?",
  "What is the deposit collection rate?",
  "Show open tickets by priority",
  "Compare monthly order totals for this year",
];

function renderMarkdown(text: string) {
  // Simple markdown rendering via regex
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inTable = false;
  let tableRows: string[][] = [];
  let tableAlign: string[] = [];
  let listItems: string[] = [];
  let inList = false;
  let listOrdered = false;

  const flushList = () => {
    if (!inList) return;
    const items = listItems.map((item, i) => <li key={i} dangerouslySetInnerHTML={{ __html: inlineMarkdown(item) }} />);
    if (listOrdered) {
      elements.push(<ol key={elements.length} className="list-decimal list-inside my-2 space-y-1">{items}</ol>);
    } else {
      elements.push(<ul key={elements.length} className="list-disc list-inside my-2 space-y-1">{items}</ul>);
    }
    listItems = [];
    inList = false;
  };

  const flushTable = () => {
    if (!inTable) return;
    elements.push(
      <div key={elements.length} className="overflow-x-auto my-2">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr>
              {tableRows[0]?.map((cell, i) => (
                <th
                  key={i}
                  className="border border-border px-3 py-1.5 bg-muted font-medium text-left"
                  style={{ textAlign: (tableAlign[i] as CanvasTextAlign) || "left" }}
                >
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableRows.slice(1).map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? "" : "bg-muted/50"}>
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className="border border-border px-3 py-1.5"
                    style={{ textAlign: (tableAlign[ci] as CanvasTextAlign) || "left" }}
                    dangerouslySetInnerHTML={{ __html: inlineMarkdown(cell) }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
    tableAlign = [];
    inTable = false;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Table row
    if (line.trim().startsWith("|") && line.trim().endsWith("|")) {
      flushList();
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());

      // Check if next line is separator
      if (!inTable && i + 1 < lines.length && /^\|[\s:|-]+\|$/.test(lines[i + 1].trim())) {
        inTable = true;
        tableRows = [cells];
        // Parse alignment from separator
        const sepCells = lines[i + 1].split("|").slice(1, -1);
        tableAlign = sepCells.map((c) => {
          const t = c.trim();
          if (t.startsWith(":") && t.endsWith(":")) return "center";
          if (t.endsWith(":")) return "right";
          return "left";
        });
        i++; // skip separator
        continue;
      }

      if (inTable) {
        tableRows.push(cells);
        continue;
      }
    } else if (inTable) {
      flushTable();
    }

    // List items
    const ulMatch = line.match(/^(\s*)[-*]\s+(.*)/);
    const olMatch = line.match(/^(\s*)\d+\.\s+(.*)/);
    if (ulMatch || olMatch) {
      if (!inList || (ulMatch && listOrdered) || (olMatch && !listOrdered)) {
        flushList();
        inList = true;
        listOrdered = !!olMatch;
      }
      listItems.push((ulMatch || olMatch)![2]);
      continue;
    } else if (inList) {
      flushList();
    }

    // Headings
    const h3Match = line.match(/^###\s+(.*)/);
    if (h3Match) {
      elements.push(<h3 key={elements.length} className="font-semibold text-base mt-3 mb-1">{h3Match[1]}</h3>);
      continue;
    }
    const h2Match = line.match(/^##\s+(.*)/);
    if (h2Match) {
      elements.push(<h2 key={elements.length} className="font-semibold text-lg mt-3 mb-1">{h2Match[1]}</h2>);
      continue;
    }
    const h1Match = line.match(/^#\s+(.*)/);
    if (h1Match) {
      elements.push(<h1 key={elements.length} className="font-bold text-xl mt-3 mb-1">{h1Match[1]}</h1>);
      continue;
    }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      elements.push(<hr key={elements.length} className="my-3 border-border" />);
      continue;
    }

    // Empty line
    if (line.trim() === "") {
      elements.push(<div key={elements.length} className="h-2" />);
      continue;
    }

    // Regular paragraph
    elements.push(
      <p key={elements.length} className="my-0.5" dangerouslySetInnerHTML={{ __html: inlineMarkdown(line) }} />
    );
  }

  flushList();
  flushTable();

  return <>{elements}</>;
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-sm">$1</code>');
}

export default function AiAgentPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [activeTools, setActiveTools] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (status === "authenticated") {
      const role = session?.user?.roleName;
      if (role !== "Admin" && role !== "Manager") {
        router.replace("/dashboard");
      }
    }
  }, [status, session, router]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, activeTools]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Message = { role: "user", content: text.trim() };
      const newMessages = [...messages, userMsg];
      setMessages(newMessages);
      setInput("");
      setIsLoading(true);
      setActiveTools([]);

      try {
        const res = await fetch("/api/ai-agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Request failed" }));
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: `Error: ${err.error || "Something went wrong"}` },
          ]);
          return;
        }

        const reader = res.body?.getReader();
        if (!reader) return;

        const decoder = new TextDecoder();
        let assistantContent = "";
        const toolsUsed: string[] = [];
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const dataLine = line.trim();
            if (!dataLine.startsWith("data: ")) continue;

            try {
              const data = JSON.parse(dataLine.slice(6));

              if (data.type === "tool") {
                if (!toolsUsed.includes(data.tool)) toolsUsed.push(data.tool);
                setActiveTools([...toolsUsed]);
              } else if (data.type === "text") {
                assistantContent += data.content;
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  if (last?.role === "assistant") {
                    copy[copy.length - 1] = { ...last, content: assistantContent, tools: toolsUsed };
                  } else {
                    copy.push({ role: "assistant", content: assistantContent, tools: toolsUsed });
                  }
                  return copy;
                });
              } else if (data.type === "error") {
                assistantContent += `\n\nError: ${data.content}`;
                setMessages((prev) => {
                  const copy = [...prev];
                  const last = copy[copy.length - 1];
                  if (last?.role === "assistant") {
                    copy[copy.length - 1] = { ...last, content: assistantContent };
                  } else {
                    copy.push({ role: "assistant", content: assistantContent });
                  }
                  return copy;
                });
              }
            } catch {
              // skip malformed events
            }
          }
        }

        // If we never got any text, add a placeholder
        if (!assistantContent) {
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role !== "assistant") {
              return [...prev, { role: "assistant", content: "No response generated.", tools: toolsUsed }];
            }
            return prev;
          });
        }
      } catch (err) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `Error: ${err instanceof Error ? err.message : "Network error"}`,
          },
        ]);
      } finally {
        setIsLoading(false);
        setActiveTools([]);
        inputRef.current?.focus();
      }
    },
    [messages, isLoading]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const role = session?.user?.roleName;
  if (role !== "Admin" && role !== "Manager") return null;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b">
        <div>
          <h1 className="text-2xl font-bold">AI Agent</h1>
          <p className="text-sm text-muted-foreground">
            Ask questions about orders, sales, tickets, pay, and more
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5 rounded-lg hover:bg-accent"
          >
            Clear chat
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 mb-4">
              <svg className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold mb-2">Ask me anything about your data</h2>
            <p className="text-sm text-muted-foreground mb-6 max-w-md">
              I can query orders, revenue, cancellations, tickets, pay data, and more. Try one of these:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg w-full">
              {SUGGESTED_QUESTIONS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-left text-sm px-3 py-2 rounded-lg border hover:bg-accent hover:text-accent-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-3",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border"
                )}
              >
                {msg.tools && msg.tools.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {msg.tools.map((tool) => (
                      <span
                        key={tool}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary"
                      >
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                        </svg>
                        {tool}
                      </span>
                    ))}
                  </div>
                )}
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm max-w-none dark:prose-invert">
                    {renderMarkdown(msg.content)}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}

        {/* Tool progress indicator */}
        {isLoading && activeTools.length > 0 && !messages[messages.length - 1]?.content && (
          <div className="flex justify-start">
            <div className="bg-card border rounded-xl px-4 py-3">
              <div className="flex flex-wrap gap-1.5 mb-2">
                {activeTools.map((tool) => (
                  <span
                    key={tool}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary animate-pulse"
                  >
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                    </svg>
                    {tool}
                  </span>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">Querying data...</p>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && activeTools.length === 0 && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-card border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="flex gap-1">
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                Thinking...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t px-6 py-4">
        <div className="flex items-end gap-2 max-w-4xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about orders, revenue, cancellations, tickets..."
            rows={1}
            className="flex-1 resize-none rounded-xl border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring max-h-32"
            style={{ minHeight: "44px" }}
            disabled={isLoading}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className={cn(
              "shrink-0 rounded-xl px-4 py-3 text-sm font-medium transition-colors",
              input.trim() && !isLoading
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5"
              />
            </svg>
          </button>
        </div>
        <p className="text-xs text-muted-foreground text-center mt-2">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
