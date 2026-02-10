"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MonthSelectorProps {
  month: number;
  year: number;
  tab: string;
}

export function MonthSelector({ month, year, tab }: MonthSelectorProps) {
  const router = useRouter();

  const navigate = (newMonth: number, newYear: number) => {
    const params = new URLSearchParams();
    params.set("tab", tab);
    params.set("month", String(newMonth));
    params.set("year", String(newYear));
    router.push(`/pay?${params.toString()}`);
  };

  const handlePrev = () => {
    if (month === 1) {
      navigate(12, year - 1);
    } else {
      navigate(month - 1, year);
    }
  };

  const handleNext = () => {
    if (month === 12) {
      navigate(1, year + 1);
    } else {
      navigate(month + 1, year);
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button variant="outline" size="sm" onClick={handlePrev}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </Button>
      <span className="text-lg font-semibold min-w-[180px] text-center">
        {MONTH_NAMES[month - 1]} {year}
      </span>
      <Button variant="outline" size="sm" onClick={handleNext}>
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Button>
    </div>
  );
}
