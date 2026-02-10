"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/toast";
import { formatRelativeTime, getInitials } from "@/lib/utils";

interface MessageSender {
  id: string;
  firstName: string;
  lastName: string;
  avatar: string | null;
}

interface Message {
  id: string;
  content: string;
  createdAt: Date;
  sender: MessageSender;
}

interface CustomerOrderMessagesProps {
  orderId: string;
  messages: Message[];
}

export function CustomerOrderMessages({ orderId, messages }: CustomerOrderMessagesProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId,
          content: newMessage,
          isInternal: false,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send message");
      }

      setNewMessage("");
      addToast({
        title: "Message sent",
        description: "Our team will respond as soon as possible.",
        variant: "success",
      });

      router.refresh();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Messages</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Message input */}
        <div className="space-y-2">
          <Textarea
            placeholder="Send a message to our team..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            rows={3}
          />
          <div className="flex justify-end">
            <Button onClick={handleSend} loading={sending} disabled={!newMessage.trim()}>
              Send Message
            </Button>
          </div>
        </div>

        {/* Messages list */}
        {messages.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            No messages yet. Send a message to start a conversation.
          </p>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {messages.map((message) => (
              <div key={message.id} className="flex gap-3">
                <Avatar
                  fallback={getInitials(message.sender.firstName, message.sender.lastName)}
                  src={message.sender.avatar}
                  size="sm"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {message.sender.firstName} {message.sender.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(message.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm mt-1 whitespace-pre-wrap">{message.content}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
