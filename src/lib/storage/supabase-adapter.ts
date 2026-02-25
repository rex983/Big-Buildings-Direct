import { supabaseAdmin } from "../supabase";
import type { StorageAdapter, StorageFile, UploadOptions, UrlOptions } from "./types";

const BUCKET = "uploads";

export class SupabaseStorageAdapter implements StorageAdapter {
  async upload(key: string, data: Buffer, options: UploadOptions): Promise<StorageFile> {
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(key, data, {
        contentType: options.mimeType,
        upsert: true,
      });

    if (error) {
      throw new Error(`Supabase upload failed: ${error.message}`);
    }

    return {
      key,
      size: data.length,
      mimeType: options.mimeType,
    };
  }

  async download(key: string): Promise<Buffer> {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(key);

    if (error || !data) {
      throw new Error(`Supabase download failed: ${error?.message ?? "No data returned"}`);
    }

    const arrayBuffer = await data.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async getUrl(key: string, options?: UrlOptions): Promise<string> {
    const expiresIn = options?.expiresIn ?? 3600;

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(key, expiresIn, {
        download: options?.download ? (options.filename ?? true) : undefined,
      });

    if (error || !data?.signedUrl) {
      throw new Error(`Supabase signed URL failed: ${error?.message ?? "No URL returned"}`);
    }

    return data.signedUrl;
  }

  async delete(key: string): Promise<void> {
    const { error } = await supabaseAdmin.storage
      .from(BUCKET)
      .remove([key]);

    if (error) {
      throw new Error(`Supabase delete failed: ${error.message}`);
    }
  }

  async exists(key: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(key);

    if (error || !data) {
      return false;
    }
    return true;
  }
}
