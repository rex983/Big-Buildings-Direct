"use client";

import * as React from "react";
import { SalaryTable } from "./salary-table";
import { OfficeTierEditor } from "./office-tier-editor";

interface TierData {
  type: "BUILDINGS_SOLD" | "ORDER_TOTAL";
  minValue: string;
  maxValue: string;
  bonusAmount: string;
  bonusType: "FLAT" | "PERCENTAGE";
}

interface SalaryRep {
  id: string;
  firstName: string;
  lastName: string;
  salary: string;
  cancellationDeduction: string;
  buildingsSold: number;
  totalOrderAmount: string;
}

interface OfficePaySectionProps {
  office: string;
  reps: SalaryRep[];
  initialTiers: TierData[];
  month: number;
  year: number;
  canEdit: boolean;
}

export function OfficePaySection({
  office,
  reps,
  initialTiers,
  month,
  year,
  canEdit,
}: OfficePaySectionProps) {
  const [tiers, setTiers] = React.useState<TierData[]>(initialTiers);

  return (
    <>
      <SalaryTable
        reps={reps}
        tiers={tiers}
        month={month}
        year={year}
        canEdit={canEdit}
      />
      <OfficeTierEditor
        office={office}
        month={month}
        year={year}
        initialTiers={initialTiers}
        canEdit={canEdit}
        onTiersSaved={setTiers}
      />
    </>
  );
}
