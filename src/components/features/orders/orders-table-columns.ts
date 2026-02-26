export interface ColumnDef {
  id: string;
  label: string;
  defaultWidth: number;
  minWidth: number;
  align: "left" | "center" | "right";
}

export const COLUMNS: ColumnDef[] = [
  { id: "orderNumber", label: "Order #", defaultWidth: 130, minWidth: 80, align: "left" },
  { id: "dateSold", label: "Date Sold", defaultWidth: 110, minWidth: 80, align: "left" },
  { id: "customer", label: "Customer", defaultWidth: 180, minWidth: 100, align: "left" },
  { id: "state", label: "State", defaultWidth: 70, minWidth: 50, align: "left" },
  { id: "salesRep", label: "Sales Rep", defaultWidth: 120, minWidth: 80, align: "left" },
  { id: "total", label: "Total", defaultWidth: 100, minWidth: 70, align: "right" },
  { id: "deposit", label: "Deposit", defaultWidth: 100, minWidth: 70, align: "right" },
  { id: "payment", label: "Payment", defaultWidth: 110, minWidth: 80, align: "center" },
  { id: "sentToCustomer", label: "Sent to Customer", defaultWidth: 130, minWidth: 90, align: "center" },
  { id: "signed", label: "Signed", defaultWidth: 100, minWidth: 70, align: "center" },
  { id: "sentToMfr", label: "Sent to Mfr", defaultWidth: 110, minWidth: 80, align: "center" },
  { id: "created", label: "Created", defaultWidth: 110, minWidth: 80, align: "left" },
];

export const ACTIONS_COLUMN: ColumnDef = {
  id: "actions",
  label: "",
  defaultWidth: 70,
  minWidth: 60,
  align: "center",
};

export const STORAGE_KEY = "bbd-orders-table-prefs";

export interface TablePreferences {
  columnOrder: string[];
  columnWidths: Record<string, number>;
  hiddenColumns: string[];
}

export function getDefaultPreferences(): TablePreferences {
  return {
    columnOrder: COLUMNS.map((c) => c.id),
    columnWidths: Object.fromEntries(
      [...COLUMNS, ACTIONS_COLUMN].map((c) => [c.id, c.defaultWidth])
    ),
    hiddenColumns: [],
  };
}
