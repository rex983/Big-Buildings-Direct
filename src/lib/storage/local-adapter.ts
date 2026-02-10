import fs from "fs/promises";
import path from "path";
import type { StorageAdapter, StorageFile, UploadOptions, UrlOptions } from "./types";

export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor(basePath?: string) {
    this.basePath = basePath || process.env.UPLOAD_DIR || "./uploads";
  }

  private getFullPath(key: string): string {
    return path.join(this.basePath, key);
  }

  async upload(key: string, data: Buffer, options: UploadOptions): Promise<StorageFile> {
    const fullPath = this.getFullPath(key);
    const dir = path.dirname(fullPath);

    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });

    // Write file
    await fs.writeFile(fullPath, data);

    return {
      key,
      size: data.length,
      mimeType: options.mimeType,
    };
  }

  async download(key: string): Promise<Buffer> {
    const fullPath = this.getFullPath(key);
    return fs.readFile(fullPath);
  }

  async getUrl(key: string, options?: UrlOptions): Promise<string> {
    // For local storage, return an API route URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const params = new URLSearchParams();

    if (options?.download) {
      params.set("download", "true");
    }
    if (options?.filename) {
      params.set("filename", options.filename);
    }

    const queryString = params.toString();
    return `${baseUrl}/api/files/${encodeURIComponent(key)}${queryString ? `?${queryString}` : ""}`;
  }

  async delete(key: string): Promise<void> {
    const fullPath = this.getFullPath(key);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      // Ignore if file doesn't exist
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  async exists(key: string): Promise<boolean> {
    const fullPath = this.getFullPath(key);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }
}
