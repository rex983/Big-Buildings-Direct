"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { formatRelativeTime } from "@/lib/utils";

interface Note {
  id: string;
  content: string;
  isInternal: boolean;
  createdAt: Date;
  author: { id: string; firstName: string; lastName: string };
}

interface TicketNotesProps {
  ticketId: string;
  notes: Note[];
  canEdit: boolean;
}

export function TicketNotes({ ticketId, notes, canEdit }: TicketNotesProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!content.trim()) {
      addToast({
        title: "Error",
        description: "Note content is required",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/tickets/${ticketId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim(),
          isInternal,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add note");
      }

      addToast({
        title: "Note Added",
        description: "Your note has been added to the ticket",
        variant: "success",
      });

      setContent("");
      setIsInternal(false);
      setShowForm(false);
      router.refresh();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add note",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Notes ({notes.length})</CardTitle>
        {canEdit && !showForm && (
          <Button size="sm" onClick={() => setShowForm(true)}>
            Add Note
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Note Form */}
        {showForm && canEdit && (
          <form onSubmit={handleSubmit} className="border rounded-lg p-4 bg-muted/30 space-y-3">
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your note here..."
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              autoFocus
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isInternal}
                  onChange={(e) => setIsInternal(e.target.checked)}
                  className="rounded"
                />
                Internal note (not visible to customer)
              </label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    setContent("");
                    setIsInternal(false);
                  }}
                  disabled={loading}
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? "Adding..." : "Add Note"}
                </Button>
              </div>
            </div>
          </form>
        )}

        {/* Notes List */}
        {notes.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">No notes yet</p>
        ) : (
          <div className="space-y-3">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`border rounded-lg p-4 ${
                  note.isInternal ? "bg-amber-50 border-amber-200" : "bg-background"
                }`}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">
                      {note.author.firstName} {note.author.lastName}
                    </span>
                    {note.isInternal && (
                      <Badge variant="warning" className="text-xs">
                        Internal
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatRelativeTime(note.createdAt)}
                  </span>
                </div>
                <p className="text-sm whitespace-pre-wrap">{note.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
