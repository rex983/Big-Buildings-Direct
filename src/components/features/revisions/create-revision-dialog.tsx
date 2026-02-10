"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";

interface OrderLookupResult {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  buildingType: string;
  buildingSize: string;
}

interface ManufacturerOption {
  id: string;
  name: string;
}

const changeInPriceOptions = [
  { value: "", label: "Select..." },
  { value: "Change In Deposit Total", label: "Change In Deposit Total" },
  { value: "No Change In Deposit Total", label: "No Change In Deposit Total" },
];

export function CreateRevisionDialog() {
  const router = useRouter();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  // Order lookup
  const [orderSearch, setOrderSearch] = useState("");
  const [searching, setSearching] = useState(false);
  const [matchedOrder, setMatchedOrder] = useState<OrderLookupResult | null>(null);
  const [orderError, setOrderError] = useState("");

  // Revision fields
  const [revisionDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [changeDescription, setChangeDescription] = useState("");
  const [changeInPrice, setChangeInPrice] = useState("");
  const [newTotalPrice, setNewTotalPrice] = useState("");

  // Manufacturer change
  const [changingManufacturer, setChangingManufacturer] = useState(false);
  const [newManufacturer, setNewManufacturer] = useState("");
  const [manufacturers, setManufacturers] = useState<ManufacturerOption[]>([]);

  // Revision fee
  const [chargeRevisionFee, setChargeRevisionFee] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("");

  // File upload
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchManufacturers = useCallback(async () => {
    try {
      const res = await fetch("/api/manufacturers?active=true");
      const data = await res.json();
      if (data.success) {
        setManufacturers(data.data);
      }
    } catch {
      // Silently fail — dropdown will just be empty
    }
  }, []);

  useEffect(() => {
    if (open && changingManufacturer && manufacturers.length === 0) {
      fetchManufacturers();
    }
  }, [open, changingManufacturer, manufacturers.length, fetchManufacturers]);

  const resetForm = () => {
    setOrderSearch("");
    setMatchedOrder(null);
    setOrderError("");
    setChangeDescription("");
    setChangeInPrice("");
    setNewTotalPrice("");
    setChangingManufacturer(false);
    setNewManufacturer("");
    setChargeRevisionFee(false);
    setPaymentMethod("");
    setSelectedFiles([]);
    setDragOver(false);
  };

  const handleOrderLookup = async () => {
    const trimmed = orderSearch.trim();
    if (!trimmed) {
      setOrderError("Please enter an order number");
      return;
    }

    setSearching(true);
    setOrderError("");
    setMatchedOrder(null);

    try {
      const response = await fetch(
        `/api/orders?search=${encodeURIComponent(trimmed)}&pageSize=5`
      );
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to search orders");
      }

      const orders = data.data?.items || [];
      const exact = orders.find(
        (o: { orderNumber: string }) =>
          o.orderNumber.toLowerCase() === trimmed.toLowerCase()
      );
      const match = exact || orders[0];

      if (!match) {
        setOrderError(`No order found matching "${trimmed}"`);
      } else {
        setMatchedOrder({
          id: match.id,
          orderNumber: match.orderNumber,
          customerName: match.customerName,
          customerEmail: match.customerEmail,
          buildingType: match.buildingType || "",
          buildingSize: match.buildingSize || "",
        });
      }
    } catch (error) {
      setOrderError(
        error instanceof Error ? error.message : "Failed to look up order"
      );
    } finally {
      setSearching(false);
    }
  };

  // File drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFiles = Array.from(e.dataTransfer.files);
    setSelectedFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      setSelectedFiles((prev) => [...prev, ...files]);
    }
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async (revisionId: string) => {
    for (const file of selectedFiles) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("revisionId", revisionId);
      formData.append("category", "OTHER");

      try {
        await fetch("/api/files", {
          method: "POST",
          body: formData,
        });
      } catch {
        // Log but don't block — revision is already created
        console.error(`Failed to upload file: ${file.name}`);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!matchedOrder) {
      addToast({
        title: "Error",
        description: "Please look up an order first",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/revisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: matchedOrder.id,
          revisionDate,
          changeDescription: changeDescription.trim() || undefined,
          changeInPrice: changeInPrice || undefined,
          newTotalPrice: newTotalPrice || undefined,
          changingManufacturer,
          newManufacturer: changingManufacturer ? newManufacturer || undefined : undefined,
          revisionFee: chargeRevisionFee ? 150 : undefined,
          paymentMethod: chargeRevisionFee ? paymentMethod || undefined : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create revision");
      }

      // Upload files after revision is created
      if (selectedFiles.length > 0) {
        await uploadFiles(data.data.id);
      }

      addToast({
        title: "Revision Created",
        description: `${data.data.revisionNumber} created for order ${matchedOrder.orderNumber}`,
        variant: "success",
      });

      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      addToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to create revision",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
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
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
          Create Revision
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Create Revision</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Order Lookup */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Order Number *</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={orderSearch}
                onChange={(e) => {
                  setOrderSearch(e.target.value);
                  setMatchedOrder(null);
                  setOrderError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleOrderLookup();
                  }
                }}
                placeholder="Enter order number (e.g. ORD-00123)"
                className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleOrderLookup}
                disabled={searching}
              >
                {searching ? "..." : "Look Up"}
              </Button>
            </div>
            {orderError && (
              <p className="text-sm text-red-600">{orderError}</p>
            )}
            {matchedOrder && (
              <div className="rounded-md border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-950/50 p-3">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  {matchedOrder.orderNumber}
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  {matchedOrder.customerName} &mdash; {matchedOrder.customerEmail}
                </p>
                {matchedOrder.buildingType && (
                  <p className="text-sm text-green-700 dark:text-green-300">
                    {matchedOrder.buildingType} {matchedOrder.buildingSize}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Revision fields (only shown after order is matched) */}
          {matchedOrder && (
            <>
              {/* Revision Date — Read-only */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Revision Date</label>
                <div className="w-full h-10 rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                  {new Date(revisionDate).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Change Description</label>
                <textarea
                  value={changeDescription}
                  onChange={(e) => setChangeDescription(e.target.value)}
                  placeholder="Describe the changes for this revision..."
                  rows={3}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Price Change</label>
                  <select
                    value={changeInPrice}
                    onChange={(e) => setChangeInPrice(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {changeInPriceOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">New Total Price</label>
                  <input
                    type="text"
                    value={newTotalPrice}
                    onChange={(e) => setNewTotalPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Changing Manufacturer */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Changing Manufacturer?</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="changingManufacturer"
                      checked={!changingManufacturer}
                      onChange={() => {
                        setChangingManufacturer(false);
                        setNewManufacturer("");
                      }}
                      className="accent-primary"
                    />
                    No
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="changingManufacturer"
                      checked={changingManufacturer}
                      onChange={() => setChangingManufacturer(true)}
                      className="accent-primary"
                    />
                    Yes
                  </label>
                </div>
                {changingManufacturer && (
                  <select
                    value={newManufacturer}
                    onChange={(e) => setNewManufacturer(e.target.value)}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">Select manufacturer...</option>
                    {manufacturers.map((m) => (
                      <option key={m.id} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Revision Fee */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Charge $150 Revision Fee?</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="revisionFee"
                      checked={!chargeRevisionFee}
                      onChange={() => setChargeRevisionFee(false)}
                      className="accent-primary"
                    />
                    No
                  </label>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input
                      type="radio"
                      name="revisionFee"
                      checked={chargeRevisionFee}
                      onChange={() => setChargeRevisionFee(true)}
                      className="accent-primary"
                    />
                    Yes
                  </label>
                </div>
                {chargeRevisionFee && (
                  <div className="rounded-md border border-input bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Revision Fee</span>
                      <span className="text-sm font-semibold">$150.00</span>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium">Payment Method</label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      >
                        <option value="">Select payment method...</option>
                        <option value="Credit Card">Credit Card</option>
                        <option value="ACH/Bank Transfer">ACH / Bank Transfer</option>
                        <option value="Check">Check</option>
                        <option value="Cash">Cash</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                )}
              </div>

              {/* File Upload Drop Zone */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Attachments</label>
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors
                    ${
                      dragOver
                        ? "border-primary bg-primary/5"
                        : "border-input hover:border-primary/50"
                    }
                  `}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <svg
                    className="mx-auto h-8 w-8 text-muted-foreground mb-2"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <p className="text-sm text-muted-foreground">
                    Drag & drop files here, or click to browse
                  </p>
                </div>

                {/* Selected files list */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-1">
                    {selectedFiles.map((file, index) => (
                      <div
                        key={`${file.name}-${index}`}
                        className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                      >
                        <span className="truncate mr-2">{file.name}</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(index);
                          }}
                          className="text-muted-foreground hover:text-destructive shrink-0"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setOpen(false);
                resetForm();
              }}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !matchedOrder}>
              {loading ? "Creating..." : "Create Revision"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
