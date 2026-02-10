import { PDFDocument, rgb } from "pdf-lib";
import { v4 as uuidv4 } from "uuid";

export interface SigningDetails {
  signatureData: string; // Base64 PNG
  signerIp: string;
  signerAgent: string;
  signedAt: Date;
}

export function generateSigningToken(): string {
  return uuidv4();
}

export function getSigningUrl(token: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${baseUrl}/sign/${token}`;
}

export async function embedSignatureInPdf(
  pdfBuffer: Buffer,
  signatureBase64: string,
  options?: {
    page?: number;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    addTimestamp?: boolean;
    timestampText?: string;
  }
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBuffer);
  const pages = pdfDoc.getPages();

  // Default to last page if not specified
  const pageIndex = options?.page ?? pages.length - 1;
  const page = pages[pageIndex];

  // Extract the base64 data (remove data URL prefix if present)
  const base64Data = signatureBase64.includes(",")
    ? signatureBase64.split(",")[1]
    : signatureBase64;

  // Convert base64 to buffer
  const signatureBuffer = Buffer.from(base64Data, "base64");

  // Embed the signature image
  const signatureImage = await pdfDoc.embedPng(signatureBuffer);

  // Calculate dimensions (maintain aspect ratio)
  const maxWidth = options?.width ?? 200;
  const maxHeight = options?.height ?? 50;
  const aspectRatio = signatureImage.width / signatureImage.height;

  let width = maxWidth;
  let height = width / aspectRatio;

  if (height > maxHeight) {
    height = maxHeight;
    width = height * aspectRatio;
  }

  // Position (default to bottom-right of page with margin)
  const { width: pageWidth, height: pageHeight } = page.getSize();
  const x = options?.x ?? pageWidth - width - 50;
  const y = options?.y ?? 100;

  // Draw signature
  page.drawImage(signatureImage, {
    x,
    y,
    width,
    height,
  });

  // Add timestamp if requested
  if (options?.addTimestamp !== false) {
    const timestamp = options?.timestampText ?? `Signed: ${new Date().toISOString()}`;
    page.drawText(timestamp, {
      x,
      y: y - 15,
      size: 8,
      color: rgb(0.4, 0.4, 0.4),
    });
  }

  // Save and return
  const signedPdfBytes = await pdfDoc.save();
  return Buffer.from(signedPdfBytes);
}

// Validate signature data (basic checks)
export function isValidSignatureData(signatureData: string): boolean {
  if (!signatureData) return false;

  // Check if it's a valid base64 string or data URL
  const base64Regex = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/;
  const pureBase64Regex = /^[A-Za-z0-9+/]+=*$/;

  return base64Regex.test(signatureData) || pureBase64Regex.test(signatureData);
}

// Create audit trail entry
export function createSigningAuditTrail(details: SigningDetails): string {
  return JSON.stringify({
    signedAt: details.signedAt.toISOString(),
    signerIp: details.signerIp,
    signerAgent: details.signerAgent,
    signatureHash: hashSignature(details.signatureData),
  });
}

// Simple hash for signature verification
function hashSignature(signatureData: string): string {
  let hash = 0;
  for (let i = 0; i < signatureData.length; i++) {
    const char = signatureData.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16);
}
