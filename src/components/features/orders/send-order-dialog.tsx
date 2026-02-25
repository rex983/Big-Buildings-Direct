"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/utils";
import type { File as PrismaFile } from "@prisma/client";

interface OrderFile {
  file: PrismaFile;
  createdAt: Date;
}

interface SendOrderDialogProps {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  files: OrderFile[];
  sentToCustomer: boolean;
  sentToCustomerDate: Date | null;
  customerSigned: boolean;
  customerSignedDate: Date | null;
  sentToManufacturer: boolean;
  sentToManufacturerDate: Date | null;
  depositCollected: boolean;
  esignOrderId: string | null;
}

const FILE_ICONS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/gif": "GIF",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
  "application/vnd.ms-excel": "XLS",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
  "text/plain": "TXT",
  "text/csv": "CSV",
};

const getFileIcon = (mimeType: string): string => {
  if (FILE_ICONS[mimeType]) return FILE_ICONS[mimeType];
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("word")) return "DOC";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "XLS";
  return "FILE";
};

const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function SendOrderDialog({
  orderId,
  orderNumber,
  customerName,
  customerEmail,
  files,
  sentToCustomer,
  sentToCustomerDate,
  customerSigned,
  customerSignedDate,
  sentToManufacturer,
  sentToManufacturerDate,
  depositCollected,
  esignOrderId,
}: SendOrderDialogProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [open, setOpen] = useState(false);
  const [sendingToCustomer, setSendingToCustomer] = useState(false);
  const [sendingToManufacturer, setSendingToManufacturer] = useState(false);
  const [sendingEsign, setSendingEsign] = useState(false);
  const [refreshingStatus, setRefreshingStatus] = useState(false);
  const [esignStatus, setEsignStatus] = useState<{
    esignRequested?: boolean;
    esignSent?: boolean;
    customerSigned?: boolean;
    depositCollected?: boolean;
    lastEvent?: { type: string; status: string; createdAt: string } | null;
  } | null>(null);

  const canSendToManufacturer = depositCollected && customerSigned;

  const handleSendToCustomer = async () => {
    setSendingToCustomer(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "sentToCustomer", value: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send to customer");
      }

      addToast({
        title: "Sent to Customer",
        description: `Order #${orderNumber} has been marked as sent to customer`,
        variant: "success",
      });

      setOpen(false);
      router.refresh();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send to customer",
        variant: "destructive",
      });
    } finally {
      setSendingToCustomer(false);
    }
  };

  const hasPdfFiles = files.some(
    ({ file }) => file.mimeType === "application/pdf"
  );

  const handleSendEsign = async () => {
    setSendingEsign(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/esign/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send for processing");
      }

      addToast({
        title: "Sent for Processing",
        description: `Order #${orderNumber} has been sent for processing`,
        variant: "success",
      });

      setOpen(false);
      router.refresh();
    } catch (error) {
      addToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to send for processing",
        variant: "destructive",
      });
    } finally {
      setSendingEsign(false);
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshingStatus(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/esign/status`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to refresh status");
      }

      setEsignStatus(data.data);
      router.refresh();
    } catch (error) {
      addToast({
        title: "Error",
        description:
          error instanceof Error ? error.message : "Failed to refresh status",
        variant: "destructive",
      });
    } finally {
      setRefreshingStatus(false);
    }
  };

  const handleSendToManufacturer = async () => {
    setSendingToManufacturer(true);
    try {
      const response = await fetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "sentToManufacturer", value: true }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send to manufacturer");
      }

      addToast({
        title: "Sent to Manufacturer",
        description: `Order #${orderNumber} has been marked as sent to manufacturer`,
        variant: "success",
      });

      setOpen(false);
      router.refresh();
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send to manufacturer",
        variant: "destructive",
      });
    } finally {
      setSendingToManufacturer(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">Send Order</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>Send Order #{orderNumber}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Send order to {customerName} ({customerEmail})
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* Order Files */}
          <div>
            <h4 className="text-sm font-medium mb-2">Order Files</h4>
            {files.length === 0 ? (
              <div className="rounded-md border border-dashed p-4 text-center">
                <p className="text-sm text-muted-foreground">No files attached</p>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto rounded-md border divide-y">
                {files.map(({ file }) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-muted text-xs font-medium">
                        {getFileIcon(file.mimeType)}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{file.filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/api/files/${file.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline shrink-0 ml-2"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Cards */}
          <div className="grid grid-cols-2 gap-4">
            {/* Send to Customer */}
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="text-sm font-medium">Send to Customer</h4>
              <div className="flex flex-wrap gap-1.5">
                {sentToCustomer ? (
                  <Badge variant="success">
                    Sent {sentToCustomerDate && formatDate(sentToCustomerDate)}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Not Sent</Badge>
                )}
                {customerSigned ? (
                  <Badge variant="success">
                    Signed {customerSignedDate && formatDate(customerSignedDate)}
                  </Badge>
                ) : (
                  <Badge variant="secondary">Unsigned</Badge>
                )}
              </div>
              {sentToCustomer ? (
                <Badge variant="info" className="w-full justify-center py-1.5">
                  Already Sent
                </Badge>
              ) : (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleSendToCustomer}
                  disabled={sendingToCustomer}
                >
                  {sendingToCustomer ? "Sending..." : "Send to Customer"}
                </Button>
              )}
              {sentToCustomer && !customerSigned ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Awaiting customer signature
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={handleRefreshStatus}
                    disabled={refreshingStatus}
                  >
                    {refreshingStatus ? "Refreshing..." : "Refresh Status"}
                  </Button>
                  {esignStatus?.lastEvent && (
                    <p className="text-xs text-muted-foreground">
                      Last update: {esignStatus.lastEvent.type.replace(/_/g, " ")}
                    </p>
                  )}
                </div>
              ) : !sentToCustomer ? (
                hasPdfFiles ? (
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full"
                    onClick={handleSendEsign}
                    disabled={sendingEsign}
                  >
                    {sendingEsign ? "Sending..." : "Send for Processing"}
                  </Button>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Upload a PDF to enable processing
                  </p>
                )
              ) : null}
            </div>

            {/* Send to Manufacturer */}
            <div className="rounded-lg border p-4 space-y-3">
              <h4 className="text-sm font-medium">Send to Manufacturer</h4>
              <div className="flex flex-wrap gap-1.5">
                {depositCollected ? (
                  <Badge variant="success">Deposit Collected</Badge>
                ) : (
                  <Badge variant="warning">Deposit Pending</Badge>
                )}
                {customerSigned ? (
                  <Badge variant="success">Customer Signed</Badge>
                ) : (
                  <Badge variant="warning">Customer Pending</Badge>
                )}
              </div>
              {sentToManufacturer ? (
                <Badge variant="info" className="w-full justify-center py-1.5">
                  Already Sent {sentToManufacturerDate && formatDate(sentToManufacturerDate)}
                </Badge>
              ) : (
                <Button
                  size="sm"
                  className="w-full"
                  onClick={handleSendToManufacturer}
                  disabled={sendingToManufacturer || !canSendToManufacturer}
                >
                  {sendingToManufacturer ? "Sending..." : "Send to Manufacturer"}
                </Button>
              )}
              {!sentToManufacturer && !canSendToManufacturer && (
                <p className="text-xs text-muted-foreground">
                  Requires deposit collected and customer signed
                </p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
