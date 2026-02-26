"use client";

import { useState } from "react";

export function OrderProcessingLink({
  children,
}: {
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch("/api/auth/magic-link", { method: "POST" });
      const data = await res.json();

      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        console.error("No URL returned:", data);
      }
    } catch (err) {
      console.error("Failed to open Order Processing:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-1.5 text-primary hover:underline disabled:opacity-50"
    >
      {loading ? "Opening..." : children}
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
      </svg>
    </button>
  );
}
