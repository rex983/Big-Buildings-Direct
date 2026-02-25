"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";

interface YearSelectorProps {
  currentYear: number;
  availableYears: number[];
}

export function YearSelector({ currentYear, availableYears }: YearSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleYearChange = (year: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("year", String(year));
    router.push(`/dashboard?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-1">
      {availableYears.map((year) => (
        <Button
          key={year}
          size="sm"
          variant={year === currentYear ? "default" : "outline"}
          onClick={() => handleYearChange(year)}
          className="h-8 px-3 text-sm"
        >
          {year}
        </Button>
      ))}
    </div>
  );
}
