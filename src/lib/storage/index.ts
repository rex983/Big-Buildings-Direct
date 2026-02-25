import type { StorageAdapter } from "./types";
import { LocalStorageAdapter } from "./local-adapter";
import { S3StorageAdapter } from "./s3-adapter";
import { SupabaseStorageAdapter } from "./supabase-adapter";

export type { StorageAdapter, StorageFile, UploadOptions, UrlOptions } from "./types";
export { LocalStorageAdapter } from "./local-adapter";
export { S3StorageAdapter } from "./s3-adapter";
export { SupabaseStorageAdapter } from "./supabase-adapter";

let storageInstance: StorageAdapter | null = null;

export function getStorage(): StorageAdapter {
  if (storageInstance) {
    return storageInstance;
  }

  const adapterType = process.env.STORAGE_ADAPTER || "local";

  switch (adapterType) {
    case "supabase":
      storageInstance = new SupabaseStorageAdapter();
      break;
    case "s3":
      storageInstance = new S3StorageAdapter();
      break;
    case "local":
    default:
      storageInstance = new LocalStorageAdapter();
      break;
  }

  return storageInstance;
}

// Helper to generate a unique storage key
export function generateStorageKey(filename: string): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  const ext = filename.split(".").pop() || "";
  const safeName = filename
    .replace(/\.[^/.]+$/, "") // Remove extension
    .replace(/[^a-zA-Z0-9]/g, "-") // Replace special chars
    .substring(0, 50); // Limit length

  return `${timestamp}-${random}-${safeName}${ext ? `.${ext}` : ""}`;
}
