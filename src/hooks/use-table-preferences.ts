"use client";

import { useState, useEffect, useCallback } from "react";
import {
  STORAGE_KEY,
  type TablePreferences,
  getDefaultPreferences,
  COLUMNS,
} from "@/components/features/orders/orders-table-columns";

function loadPreferences(): TablePreferences {
  if (typeof window === "undefined") return getDefaultPreferences();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultPreferences();
    const parsed = JSON.parse(raw) as TablePreferences;
    // Validate that all current column IDs are present (handles column additions/removals)
    const defaultIds = COLUMNS.map((c) => c.id);
    const storedIds = new Set(parsed.columnOrder);
    const allPresent = defaultIds.every((id) => storedIds.has(id));
    const noExtras = parsed.columnOrder.every((id) => defaultIds.includes(id));
    if (!allPresent || !noExtras) return getDefaultPreferences();
    return parsed;
  } catch {
    return getDefaultPreferences();
  }
}

function savePreferences(prefs: TablePreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

export function useTablePreferences() {
  const [prefs, setPrefs] = useState<TablePreferences>(getDefaultPreferences);

  // Hydrate from localStorage after mount
  useEffect(() => {
    setPrefs(loadPreferences());
  }, []);

  const setColumnOrder = useCallback((order: string[]) => {
    setPrefs((prev) => {
      const next = { ...prev, columnOrder: order };
      savePreferences(next);
      return next;
    });
  }, []);

  const setColumnWidth = useCallback((columnId: string, width: number) => {
    setPrefs((prev) => {
      const next = {
        ...prev,
        columnWidths: { ...prev.columnWidths, [columnId]: width },
      };
      savePreferences(next);
      return next;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    const defaults = getDefaultPreferences();
    setPrefs(defaults);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { prefs, setColumnOrder, setColumnWidth, resetPreferences };
}
