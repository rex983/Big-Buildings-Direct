"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
  errors: { row: number; orderNumber: string; error: string }[];
}

export function OrderChangeImportButton() {
  const router = useRouter();
  const { addToast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/order-changes/import", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Import failed");
      }

      setResult(data.data);

      if (data.data.imported > 0) {
        addToast({
          title: "Import Complete",
          description: `Successfully imported ${data.data.imported} order change(s).`,
          variant: "success",
        });
        router.refresh();
      }
    } catch (error) {
      addToast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to import CSV",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleClose = () => {
    setDialogOpen(false);
    setResult(null);
  };

  return (
    <>
      <Button onClick={() => setDialogOpen(true)}>
        <svg
          className="h-4 w-4 mr-2"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        Import CSV
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Import Order Changes</DialogTitle>
            <DialogDescription>
              Upload a CSV file exported from the Order Change spreadsheet to import
              records into the system.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                disabled={importing}
              />
              <div className="space-y-2">
                <svg
                  className="h-12 w-12 mx-auto text-muted-foreground"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <p className="text-muted-foreground">
                  {importing ? "Importing..." : "Click to select a CSV file"}
                </p>
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={importing}
                  loading={importing}
                >
                  {importing ? "Importing..." : "Select File"}
                </Button>
              </div>
            </div>

            {result && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-2xl font-bold">{result.total}</p>
                    <p className="text-sm text-muted-foreground">Total Rows</p>
                  </div>
                  <div className="p-3 bg-green-50 rounded-lg">
                    <p className="text-2xl font-bold text-green-600">{result.imported}</p>
                    <p className="text-sm text-muted-foreground">Imported</p>
                  </div>
                  <div className="p-3 bg-amber-50 rounded-lg">
                    <p className="text-2xl font-bold text-amber-600">{result.skipped}</p>
                    <p className="text-sm text-muted-foreground">Skipped</p>
                  </div>
                </div>

                {result.errors.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-red-600">
                      Errors ({result.errors.length}):
                    </p>
                    <div className="max-h-40 overflow-y-auto border rounded p-2 text-sm">
                      {result.errors.slice(0, 20).map((err, i) => (
                        <div key={i} className="py-1 border-b last:border-0">
                          <span className="font-medium">Row {err.row}</span>
                          {err.orderNumber && (
                            <span className="text-muted-foreground">
                              {" "}
                              (Order #{err.orderNumber})
                            </span>
                          )}
                          : {err.error}
                        </div>
                      ))}
                      {result.errors.length > 20 && (
                        <p className="text-muted-foreground pt-2">
                          ...and {result.errors.length - 20} more errors
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Expected CSV columns:</p>
              <p>
                Order Number, Date of Change, Sales rep, Order Form Name, Manufacturer,
                Old Order Total, New Order Total, Old Deposit Total, New Deposit Total,
                Order Total Difference, Deposit difference, Additional Notes, Uploads,
                Change Type, Deposit Charged, Sabrina Process, Updated numbers in New Sale,
                Rex Process, Cust Email
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleClose}>
              {result ? "Close" : "Cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
