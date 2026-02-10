export interface StorageFile {
  key: string;
  size: number;
  mimeType: string;
  url?: string;
}

export interface UploadOptions {
  mimeType: string;
  filename?: string;
  metadata?: Record<string, string>;
}

export interface UrlOptions {
  expiresIn?: number; // seconds
  download?: boolean;
  filename?: string;
}

export interface StorageAdapter {
  /**
   * Upload a file to storage
   */
  upload(key: string, data: Buffer, options: UploadOptions): Promise<StorageFile>;

  /**
   * Download a file from storage
   */
  download(key: string): Promise<Buffer>;

  /**
   * Get a URL to access the file
   */
  getUrl(key: string, options?: UrlOptions): Promise<string>;

  /**
   * Delete a file from storage
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a file exists
   */
  exists(key: string): Promise<boolean>;
}
