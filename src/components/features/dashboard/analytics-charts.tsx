"use client";

import * as React from "react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

// Colors for pie charts
const COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#a855f7", "#eab308", "#22c55e", "#0ea5e9",
];

interface SalesRepData {
  name: string;
  quantity: number;
  totalAmount: number;
}

interface StateData {
  state: string;
  quantity: number;
  totalAmount: number;
}

interface ManufacturerData {
  manufacturer: string;
  quantity: number;
  totalAmount: number;
}

interface AnalyticsData {
  salesRep: SalesRepData[];
  state: StateData[];
  manufacturer: ManufacturerData[];
}

type SortField = "name" | "quantity" | "totalAmount";
type SortDirection = "asc" | "desc";

interface SortState {
  field: SortField;
  direction: SortDirection;
}

interface DateRange {
  startDate: string;
  endDate: string;
}

interface AnalyticsChartsProps {
  title: string;
  apiEndpoint: string;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function SortIcon({ active, direction }: { active: boolean; direction: SortDirection }) {
  return (
    <span className={`inline-flex ml-1 ${active ? "text-foreground" : "text-muted-foreground/50"}`}>
      {direction === "asc" ? "▲" : "▼"}
    </span>
  );
}

function SortableHeader({
  label,
  field,
  currentSort,
  onSort,
  align = "left",
}: {
  label: string;
  field: SortField;
  currentSort: SortState;
  onSort: (field: SortField) => void;
  align?: "left" | "right";
}) {
  const isActive = currentSort.field === field;
  return (
    <th
      className={`${align === "right" ? "text-right" : "text-left"} px-4 py-2 font-medium cursor-pointer hover:bg-muted/50 select-none`}
      onClick={() => onSort(field)}
    >
      <span className="inline-flex items-center">
        {label}
        <SortIcon active={isActive} direction={isActive ? currentSort.direction : "desc"} />
      </span>
    </th>
  );
}

function useSortedData<T extends { quantity: number; totalAmount: number }>(
  data: T[],
  nameField: keyof T,
  initialSort: SortState = { field: "totalAmount", direction: "desc" }
) {
  const [sort, setSort] = React.useState<SortState>(initialSort);

  const handleSort = React.useCallback((field: SortField) => {
    setSort((prev) => ({
      field,
      direction: prev.field === field && prev.direction === "desc" ? "asc" : "desc",
    }));
  }, []);

  const sortedData = React.useMemo(() => {
    const sorted = [...data];
    sorted.sort((a, b) => {
      let aVal: string | number;
      let bVal: string | number;

      if (sort.field === "name") {
        aVal = String(a[nameField] ?? "").toLowerCase();
        bVal = String(b[nameField] ?? "").toLowerCase();
      } else if (sort.field === "quantity") {
        aVal = a.quantity;
        bVal = b.quantity;
      } else {
        aVal = a.totalAmount;
        bVal = b.totalAmount;
      }

      if (aVal < bVal) return sort.direction === "asc" ? -1 : 1;
      if (aVal > bVal) return sort.direction === "asc" ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [data, sort, nameField]);

  return { sortedData, sort, handleSort };
}

// Helper to format date for input
function formatDateForInput(date: Date): string {
  return date.toISOString().split("T")[0];
}

// Get preset date ranges
function getPresetRange(preset: string): DateRange {
  const now = new Date();

  switch (preset) {
    case "thisMonth": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      return { startDate: formatDateForInput(start), endDate: formatDateForInput(now) };
    }
    case "lastMonth": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { startDate: formatDateForInput(start), endDate: formatDateForInput(end) };
    }
    case "thisQuarter": {
      const quarter = Math.floor(now.getMonth() / 3);
      const start = new Date(now.getFullYear(), quarter * 3, 1);
      return { startDate: formatDateForInput(start), endDate: formatDateForInput(now) };
    }
    case "thisYear": {
      const start = new Date(now.getFullYear(), 0, 1);
      return { startDate: formatDateForInput(start), endDate: formatDateForInput(now) };
    }
    case "lastYear": {
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear() - 1, 11, 31);
      return { startDate: formatDateForInput(start), endDate: formatDateForInput(end) };
    }
    case "allTime":
    default:
      return { startDate: "", endDate: "" };
  }
}

// Debounce hook for delayed API calls
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = React.useState<T>(value);

  React.useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function AnalyticsCharts({ title, apiEndpoint }: AnalyticsChartsProps) {
  const [data, setData] = React.useState<AnalyticsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [dateRange, setDateRange] = React.useState<DateRange>({ startDate: "", endDate: "" });
  const [activePreset, setActivePreset] = React.useState<string>("allTime");

  // Debounce date range to prevent rapid API calls
  const debouncedDateRange = useDebounce(dateRange, 300);

  const fetchAnalytics = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedDateRange.startDate) params.set("startDate", debouncedDateRange.startDate);
      if (debouncedDateRange.endDate) params.set("endDate", debouncedDateRange.endDate);

      const url = `${apiEndpoint}${params.toString() ? `?${params.toString()}` : ""}`;
      const response = await fetch(url);
      const result = await response.json();
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || "Failed to load analytics");
      }
    } catch {
      setError("Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [debouncedDateRange, apiEndpoint]);

  React.useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handlePresetChange = (preset: string) => {
    setActivePreset(preset);
    setDateRange(getPresetRange(preset));
  };

  const handleDateChange = (field: "startDate" | "endDate", value: string) => {
    setActivePreset("custom");
    setDateRange((prev) => ({ ...prev, [field]: value }));
  };

  const {
    sortedData: sortedSalesRep,
    sort: salesRepSort,
    handleSort: handleSalesRepSort,
  } = useSortedData(data?.salesRep || [], "name");

  const {
    sortedData: sortedState,
    sort: stateSort,
    handleSort: handleStateSort,
  } = useSortedData(data?.state || [], "state");

  const {
    sortedData: sortedManufacturer,
    sort: manufacturerSort,
    handleSort: handleManufacturerSort,
  } = useSortedData(data?.manufacturer || [], "manufacturer");

  if (loading) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">{title}</h2>
        <div className="grid gap-6 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <div className="h-4 bg-muted rounded animate-pulse w-32" />
              </CardHeader>
              <CardContent>
                <div className="h-64 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-semibold">{title}</h2>
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  // Calculate totals
  const salesRepTotals = data.salesRep.reduce(
    (acc, item) => ({ quantity: acc.quantity + item.quantity, totalAmount: acc.totalAmount + item.totalAmount }),
    { quantity: 0, totalAmount: 0 }
  );
  const stateTotals = data.state.reduce(
    (acc, item) => ({ quantity: acc.quantity + item.quantity, totalAmount: acc.totalAmount + item.totalAmount }),
    { quantity: 0, totalAmount: 0 }
  );
  const manufacturerTotals = data.manufacturer.reduce(
    (acc, item) => ({ quantity: acc.quantity + item.quantity, totalAmount: acc.totalAmount + item.totalAmount }),
    { quantity: 0, totalAmount: 0 }
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-xl font-semibold">{title}</h2>

        {/* Date Range Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="flex flex-wrap gap-1">
            {[
              { key: "allTime", label: "All Time" },
              { key: "thisMonth", label: "This Month" },
              { key: "lastMonth", label: "Last Month" },
              { key: "thisQuarter", label: "This Quarter" },
              { key: "thisYear", label: "This Year" },
              { key: "lastYear", label: "Last Year" },
            ].map((preset) => (
              <Button
                key={preset.key}
                variant={activePreset === preset.key ? "default" : "outline"}
                size="sm"
                onClick={() => handlePresetChange(preset.key)}
                className="text-xs h-8"
              >
                {preset.label}
              </Button>
            ))}
          </div>

          {/* Custom Date Inputs */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => handleDateChange("startDate", e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Start date"
            />
            <span className="text-muted-foreground text-sm">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => handleDateChange("endDate", e.target.value)}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="End date"
            />
          </div>
        </div>
      </div>

      {/* Date Range Display */}
      {(dateRange.startDate || dateRange.endDate) && (
        <p className="text-sm text-muted-foreground">
          Showing data {dateRange.startDate ? `from ${new Date(dateRange.startDate).toLocaleDateString()}` : ""}
          {dateRange.endDate ? ` to ${new Date(dateRange.endDate).toLocaleDateString()}` : ""}
        </p>
      )}

      {/* Tables */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales Rep Performance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sales Rep Performance</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur">
                  <tr className="border-b">
                    <SortableHeader
                      label="Sales Rep"
                      field="name"
                      currentSort={salesRepSort}
                      onSort={handleSalesRepSort}
                    />
                    <SortableHeader
                      label="Qty"
                      field="quantity"
                      currentSort={salesRepSort}
                      onSort={handleSalesRepSort}
                      align="right"
                    />
                    <SortableHeader
                      label="Total"
                      field="totalAmount"
                      currentSort={salesRepSort}
                      onSort={handleSalesRepSort}
                      align="right"
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedSalesRep.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                        No data available
                      </td>
                    </tr>
                  ) : (
                    <>
                      {sortedSalesRep.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-2">{item.name}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatNumber(item.quantity)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(item.totalAmount)}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/50 font-medium">
                        <td className="px-4 py-2">Total ({data.salesRep.length})</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatNumber(salesRepTotals.quantity)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(salesRepTotals.totalAmount)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* State Performance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sales by State</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur">
                  <tr className="border-b">
                    <SortableHeader
                      label="State"
                      field="name"
                      currentSort={stateSort}
                      onSort={handleStateSort}
                    />
                    <SortableHeader
                      label="Qty"
                      field="quantity"
                      currentSort={stateSort}
                      onSort={handleStateSort}
                      align="right"
                    />
                    <SortableHeader
                      label="Total"
                      field="totalAmount"
                      currentSort={stateSort}
                      onSort={handleStateSort}
                      align="right"
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedState.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                        No data available
                      </td>
                    </tr>
                  ) : (
                    <>
                      {sortedState.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-2">{item.state}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatNumber(item.quantity)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(item.totalAmount)}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/50 font-medium">
                        <td className="px-4 py-2">Total ({data.state.length})</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatNumber(stateTotals.quantity)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(stateTotals.totalAmount)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Manufacturer Performance */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sales by Manufacturer</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-96 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-muted/95 backdrop-blur">
                  <tr className="border-b">
                    <SortableHeader
                      label="Manufacturer"
                      field="name"
                      currentSort={manufacturerSort}
                      onSort={handleManufacturerSort}
                    />
                    <SortableHeader
                      label="Qty"
                      field="quantity"
                      currentSort={manufacturerSort}
                      onSort={handleManufacturerSort}
                      align="right"
                    />
                    <SortableHeader
                      label="Total"
                      field="totalAmount"
                      currentSort={manufacturerSort}
                      onSort={handleManufacturerSort}
                      align="right"
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedManufacturer.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                        No data available
                      </td>
                    </tr>
                  ) : (
                    <>
                      {sortedManufacturer.map((item, index) => (
                        <tr key={index} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-2">{item.manufacturer}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatNumber(item.quantity)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(item.totalAmount)}</td>
                        </tr>
                      ))}
                      <tr className="bg-muted/50 font-medium">
                        <td className="px-4 py-2">Total ({data.manufacturer.length})</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatNumber(manufacturerTotals.quantity)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(manufacturerTotals.totalAmount)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pie Charts */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sales Rep Pie Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Sales Rep Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {data.salesRep.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.salesRep.slice(0, 10).map((item) => ({
                      name: item.name,
                      value: item.totalAmount,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      (percent ?? 0) > 0.05 && name ? `${name.split(" ")[0]} ${((percent ?? 0) * 100).toFixed(0)}%` : ""
                    }
                    labelLine={false}
                  >
                    {data.salesRep.slice(0, 10).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value) || 0)}
                    contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {data.salesRep.length > 10 && (
              <p className="text-xs text-muted-foreground text-center mt-2">Showing top 10 of {data.salesRep.length}</p>
            )}
          </CardContent>
        </Card>

        {/* State Pie Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">State Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {data.state.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.state.slice(0, 10).map((item) => ({
                      name: item.state,
                      value: item.totalAmount,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      (percent ?? 0) > 0.05 && name ? `${name} ${((percent ?? 0) * 100).toFixed(0)}%` : ""
                    }
                    labelLine={false}
                  >
                    {data.state.slice(0, 10).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value) || 0)}
                    contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {data.state.length > 10 && (
              <p className="text-xs text-muted-foreground text-center mt-2">Showing top 10 of {data.state.length}</p>
            )}
          </CardContent>
        </Card>

        {/* Manufacturer Pie Chart */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Manufacturer Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            {data.manufacturer.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={data.manufacturer.slice(0, 10).map((item) => ({
                      name: item.manufacturer,
                      value: item.totalAmount,
                    }))}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }: { name?: string; percent?: number }) =>
                      (percent ?? 0) > 0.05 && name ? `${name.length > 10 ? name.slice(0, 10) + "..." : name} ${((percent ?? 0) * 100).toFixed(0)}%` : ""
                    }
                    labelLine={false}
                  >
                    {data.manufacturer.slice(0, 10).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value) || 0)}
                    contentStyle={{ backgroundColor: "hsl(var(--background))", border: "1px solid hsl(var(--border))" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
            {data.manufacturer.length > 10 && (
              <p className="text-xs text-muted-foreground text-center mt-2">Showing top 10 of {data.manufacturer.length}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
