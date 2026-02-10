"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";
import type { File as PrismaFile } from "@prisma/client";

interface OrderFile {
  file: PrismaFile;
  createdAt: Date;
}

interface OrderFilesProps {
  orderId: string;
  files: OrderFile[];
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

const CATEGORY_LABELS: Record<string, string> = {
  CONTRACT: "Contract",
  INVOICE: "Invoice",
  BLUEPRINT: "Blueprint",
  PHOTO: "Photo",
  PERMIT: "Permit",
  OTHER: "Other",
};

// Helper to check if file is an image
const isImageFile = (mimeType: string): boolean => {
  return mimeType.startsWith("image/");
};

// Get file icon text based on mime type
const getFileIcon = (mimeType: string): string => {
  if (FILE_ICONS[mimeType]) return FILE_ICONS[mimeType];

  // Handle common types by extension pattern
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("word")) return "DOC";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "XLS";
  if (mimeType.includes("powerpoint") || mimeType.includes("presentation")) return "PPT";
  if (mimeType.includes("zip") || mimeType.includes("compressed")) return "ZIP";
  if (mimeType.includes("video")) return "VID";
  if (mimeType.includes("audio")) return "AUD";

  return "FILE";
};

export function OrderFiles({ orderId, files }: OrderFilesProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<PrismaFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Preview state
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<PrismaFile | null>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(selectedFiles)) {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("orderId", orderId);

        const response = await fetch("/api/files", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to upload file");
        }
      }

      addToast({
        title: "Files uploaded",
        description: `Successfully uploaded ${selectedFiles.length} file(s).`,
        variant: "success",
      });

      router.refresh();
    } catch (error) {
      addToast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload files",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDownload = async (fileId: string, filename: string) => {
    try {
      const response = await fetch(`/api/files/${fileId}`);
      if (!response.ok) throw new Error("Download failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      addToast({
        title: "Download failed",
        description: "Could not download the file.",
        variant: "destructive",
      });
    }
  };

  const confirmDelete = (file: PrismaFile) => {
    setFileToDelete(file);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!fileToDelete) return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/files/${fileToDelete.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete file");
      }

      addToast({
        title: "File deleted",
        description: `"${fileToDelete.filename}" has been deleted.`,
        variant: "success",
      });

      setDeleteDialogOpen(false);
      setFileToDelete(null);
      router.refresh();
    } catch (error) {
      addToast({
        title: "Delete failed",
        description: error instanceof Error ? error.message : "Failed to delete file",
        variant: "destructive",
      });
    } finally {
      setDeleting(false);
    }
  };

  const openPreview = (file: PrismaFile) => {
    setPreviewFile(file);
    setPreviewOpen(true);
  };

  const renderPreview = (file: PrismaFile) => {
    const fileUrl = `/api/files/${file.id}`;

    if (isImageFile(file.mimeType)) {
      return (
        <div className="flex justify-center">
          <img
            src={fileUrl}
            alt={file.filename}
            className="max-h-[60vh] max-w-full object-contain rounded"
          />
        </div>
      );
    }

    if (file.mimeType === "application/pdf") {
      return (
        <iframe
          src={fileUrl}
          className="w-full h-[60vh] rounded border"
          title={file.filename}
        />
      );
    }

    // For other file types, show file info and download prompt
    return (
      <div className="text-center py-8">
        <div className="flex h-20 w-20 mx-auto items-center justify-center rounded-lg bg-muted text-2xl font-bold mb-4">
          {getFileIcon(file.mimeType)}
        </div>
        <p className="text-muted-foreground mb-4">
          Preview is not available for this file type.
        </p>
        <Button onClick={() => handleDownload(file.id, file.filename)}>
          Download to View
        </Button>
      </div>
    );
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Files</CardTitle>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <Button
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              loading={uploading}
            >
              Upload Files
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No files uploaded yet</p>
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload your first file
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {files.map(({ file }) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {/* Thumbnail or Icon */}
                    {isImageFile(file.mimeType) ? (
                      <button
                        onClick={() => openPreview(file)}
                        className="flex h-10 w-10 items-center justify-center rounded overflow-hidden bg-muted hover:ring-2 hover:ring-primary transition-all"
                      >
                        <img
                          src={`/api/files/${file.id}`}
                          alt={file.filename}
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ) : (
                      <button
                        onClick={() => openPreview(file)}
                        className="flex h-10 w-10 items-center justify-center rounded bg-muted text-xs font-medium hover:ring-2 hover:ring-primary transition-all"
                      >
                        {getFileIcon(file.mimeType)}
                      </button>
                    )}
                    <div>
                      <p className="font-medium text-sm">{file.filename}</p>
                      <p className="text-xs text-muted-foreground">
                        {CATEGORY_LABELS[file.category]} &bull; {formatFileSize(file.size)} &bull;{" "}
                        {formatDate(file.createdAt)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {/* Preview Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openPreview(file)}
                      title="Preview"
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
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    </Button>
                    {/* Download Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(file.id, file.filename)}
                      title="Download"
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
                          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                        />
                      </svg>
                    </Button>
                    {/* Delete Button */}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => confirmDelete(file)}
                      title="Delete"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete File</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{fileToDelete?.filename}&quot;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              loading={deleting}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewFile?.filename}</DialogTitle>
            <DialogDescription>
              {previewFile && (
                <>
                  {CATEGORY_LABELS[previewFile.category]} &bull;{" "}
                  {formatFileSize(previewFile.size)} &bull;{" "}
                  {formatDate(previewFile.createdAt)}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          {previewFile && renderPreview(previewFile)}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPreviewOpen(false)}
            >
              Close
            </Button>
            {previewFile && (
              <Button onClick={() => handleDownload(previewFile.id, previewFile.filename)}>
                Download
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
