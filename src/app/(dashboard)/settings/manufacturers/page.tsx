"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";

interface Manufacturer {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

export default function ManufacturersPage() {
  const { addToast } = useToast();
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchManufacturers = useCallback(async () => {
    try {
      const res = await fetch("/api/manufacturers");
      const data = await res.json();
      if (data.success) {
        setManufacturers(data.data);
      }
    } catch {
      addToast({ title: "Error", description: "Failed to load manufacturers", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchManufacturers();
  }, [fetchManufacturers]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed) return;

    setAdding(true);
    try {
      const res = await fetch("/api/manufacturers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create manufacturer");

      addToast({ title: "Success", description: `"${trimmed}" added`, variant: "success" });
      setNewName("");
      fetchManufacturers();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add manufacturer",
        variant: "destructive",
      });
    } finally {
      setAdding(false);
    }
  };

  const handleToggleActive = async (manufacturer: Manufacturer) => {
    try {
      const res = await fetch(`/api/manufacturers/${manufacturer.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !manufacturer.isActive }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update manufacturer");

      fetchManufacturers();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update manufacturer",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (manufacturer: Manufacturer) => {
    if (deletingId === manufacturer.id) {
      // Confirmed — actually delete
      try {
        const res = await fetch(`/api/manufacturers/${manufacturer.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to delete manufacturer");

        addToast({ title: "Deleted", description: `"${manufacturer.name}" removed`, variant: "success" });
        fetchManufacturers();
      } catch (error) {
        addToast({
          title: "Error",
          description: error instanceof Error ? error.message : "Failed to delete manufacturer",
          variant: "destructive",
        });
      } finally {
        setDeletingId(null);
      }
    } else {
      setDeletingId(manufacturer.id);
      // Auto-cancel confirmation after 3s
      setTimeout(() => setDeletingId((prev) => (prev === manufacturer.id ? null : prev)), 3000);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Manufacturers</h1>
        <p className="text-muted-foreground">
          Manage the list of manufacturers available for revisions
        </p>
      </div>

      {/* Add manufacturer form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Add Manufacturer</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Manufacturer name"
              className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button type="submit" disabled={adding || !newName.trim()}>
              {adding ? "Adding..." : "Add"}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Manufacturers table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">Loading...</div>
          ) : manufacturers.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              No manufacturers yet. Add one above.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left p-3 text-sm font-medium">Name</th>
                    <th className="text-left p-3 text-sm font-medium">Status</th>
                    <th className="text-left p-3 text-sm font-medium">Created</th>
                    <th className="text-right p-3 text-sm font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {manufacturers.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="p-3 text-sm font-medium">{m.name}</td>
                      <td className="p-3">
                        <Badge variant={m.isActive ? "default" : "secondary"}>
                          {m.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">
                        {new Date(m.createdAt).toLocaleDateString()}
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(m)}
                          >
                            {m.isActive ? "Deactivate" : "Activate"}
                          </Button>
                          <Button
                            variant={deletingId === m.id ? "destructive" : "outline"}
                            size="sm"
                            onClick={() => handleDelete(m)}
                          >
                            {deletingId === m.id ? "Confirm?" : "Delete"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
