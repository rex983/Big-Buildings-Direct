"use client";

import * as React from "react";

interface TestModeContextValue {
  isTestMode: boolean;
  enableTestMode: () => void;
  disableTestMode: () => void;
  toggleTestMode: () => void;
}

const TestModeContext = React.createContext<TestModeContextValue | null>(null);

const COOKIE_NAME = "bbd-test-mode";

function setTestModeCookie(enabled: boolean) {
  if (enabled) {
    document.cookie = `${COOKIE_NAME}=true;path=/;max-age=86400;samesite=strict`;
  } else {
    document.cookie = `${COOKIE_NAME}=;path=/;max-age=0`;
  }
}

function getTestModeCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((c) => c.trim().startsWith(`${COOKIE_NAME}=true`));
}

export function TestModeProvider({ children }: { children: React.ReactNode }) {
  const [isTestMode, setIsTestMode] = React.useState(false);

  React.useEffect(() => {
    setIsTestMode(getTestModeCookie());
  }, []);

  const enableTestMode = React.useCallback(() => {
    setIsTestMode(true);
    setTestModeCookie(true);
  }, []);

  const disableTestMode = React.useCallback(() => {
    setIsTestMode(false);
    setTestModeCookie(false);
  }, []);

  const toggleTestMode = React.useCallback(() => {
    setIsTestMode((prev) => {
      const next = !prev;
      setTestModeCookie(next);
      return next;
    });
  }, []);

  return (
    <TestModeContext.Provider value={{ isTestMode, enableTestMode, disableTestMode, toggleTestMode }}>
      {children}
    </TestModeContext.Provider>
  );
}

export function useTestMode() {
  const context = React.useContext(TestModeContext);
  if (!context) {
    throw new Error("useTestMode must be used within a TestModeProvider");
  }
  return context;
}
