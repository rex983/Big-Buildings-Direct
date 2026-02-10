"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
  isInternal: boolean;
  createdAt: Date;
  sender: MessageSender;
  parentId: string | null;
}

interface OrderMessagesProps {
  orderId: string;
  messages: Message[];
  canViewInternal: boolean;
}

export function OrderMessages({ orderId, messages, canViewInternal }: OrderMessagesProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const [replyingTo, setReplyingTo] = useState<Message | null>(null);

  const filteredMessages = messages.filter(
    (msg) => !msg.isInternal || canViewInternal
  );

  // Group messages into threads: top-level messages and their replies
  const topLevelMessages = filteredMessages.filter((msg) => !msg.parentId);
  const repliesByParentId = filteredMessages.reduce((acc, msg) => {
    if (msg.parentId) {
      if (!acc[msg.parentId]) {
        acc[msg.parentId] = [];
      }
      acc[msg.parentId].push(msg);
    }
    return acc;
  }, {} as Record<string, Message[]>);

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
          isInternal,
          parentId: replyingTo?.id,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send message");
      }

      setNewMessage("");
      setReplyingTo(null);
      addToast({
        title: replyingTo ? "Reply sent" : "Message sent",
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

  const handleReply = (message: Message) => {
    setReplyingTo(message);
  };

  const cancelReply = () => {
    setReplyingTo(null);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Messages</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Message input */}
        <div className="space-y-2">
          {replyingTo && (
            <div className="flex items-center justify-between bg-muted/50 rounded-md p-2 text-sm">
              <span className="text-muted-foreground">
                Replying to{" "}
                <span className="font-medium text-foreground">
                  {replyingTo.sender.firstName} {replyingTo.sender.lastName}
                </span>
                : {replyingTo.content.slice(0, 50)}
                {replyingTo.content.length > 50 ? "..." : ""}
              </span>
              <button
                type="button"
                onClick={cancelReply}
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          )}
          <Textarea
            placeholder={replyingTo ? "Type your reply..." : "Type your message..."}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            rows={3}
          />
          <div className="flex items-center justify-between">
            {canViewInternal && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded border-input"
                />
                Internal message (staff only)
              </label>
            )}
            <Button onClick={handleSend} loading={sending} disabled={!newMessage.trim()}>
              {replyingTo ? "Send Reply" : "Send Message"}
            </Button>
          </div>
        </div>

        {/* Messages list */}
        {filteredMessages.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No messages yet</p>
        ) : (
          <div className="space-y-4 max-h-[400px] overflow-y-auto">
            {topLevelMessages.map((message) => (
              <div key={message.id} className="space-y-3">
                {/* Top-level message */}
                <div className="flex gap-3">
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
                      {message.isInternal && (
                        <Badge variant="secondary" className="text-xs">
                          Internal
                        </Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(message.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-wrap">{message.content}</p>
                    <button
                      type="button"
                      onClick={() => handleReply(message)}
                      className="text-xs text-muted-foreground hover:text-foreground mt-1"
                    >
                      Reply
                    </button>
                  </div>
                </div>
                {/* Replies */}
                {repliesByParentId[message.id]?.map((reply) => (
                  <div key={reply.id} className="flex gap-3 ml-8 pl-3 border-l-2 border-muted">
                    <Avatar
                      fallback={getInitials(reply.sender.firstName, reply.sender.lastName)}
                      src={reply.sender.avatar}
                      size="sm"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">
                          {reply.sender.firstName} {reply.sender.lastName}
                        </span>
                        {reply.isInternal && (
                          <Badge variant="secondary" className="text-xs">
                            Internal
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(reply.createdAt)}
                        </span>
                      </div>
                      <p className="text-sm mt-1 whitespace-pre-wrap">{reply.content}</p>
                      <button
                        type="button"
                        onClick={() => handleReply(message)}
                        className="text-xs text-muted-foreground hover:text-foreground mt-1"
                      >
                        Reply
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
