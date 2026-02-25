"use client";

import { SessionProvider } from "next-auth/react";
import { ToastProvider } from "@/components/ui/toast";
import { ThemeProvider } from "@/contexts/theme-context";
import { TestModeProvider } from "@/contexts/test-mode-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <TestModeProvider>
          <ToastProvider>{children}</ToastProvider>
        </TestModeProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
