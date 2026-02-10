"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

interface SignaturePadProps {
  documentId: string;
  signingToken: string;
}

export function SignaturePad({ documentId, signingToken }: SignaturePadProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [signing, setSigning] = useState(false);
  const [agreed, setAgreed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set up canvas
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Fill with white background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      };
    }

    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    const coords = getCoordinates(e);
    if (!coords) return;

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    setIsDrawing(true);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing) return;

    const coords = getCoordinates(e);
    if (!coords) return;

    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    setHasSignature(true);
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasSignature(false);
  };

  const handleSign = async () => {
    if (!hasSignature || !agreed) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    setSigning(true);
    try {
      const signatureData = canvas.toDataURL("image/png");

      const response = await fetch(`/api/documents/${documentId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signatureData,
          signingToken,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to sign document");
      }

      addToast({
        title: "Document signed successfully",
        description: "Thank you for signing the document.",
        variant: "success",
      });

      // Refresh to show signed state
      router.refresh();
    } catch (error) {
      addToast({
        title: "Signing failed",
        description: error instanceof Error ? error.message : "Failed to sign document",
        variant: "destructive",
      });
    } finally {
      setSigning(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your Signature</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Draw your signature in the box below using your mouse or finger.
        </p>

        {/* Signature Canvas */}
        <div className="border-2 border-dashed rounded-lg p-2 bg-white">
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            className="w-full h-auto cursor-crosshair touch-none"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </div>

        <div className="flex justify-end">
          <Button variant="outline" onClick={clearSignature}>
            Clear
          </Button>
        </div>

        {/* Agreement checkbox */}
        <label className="flex items-start gap-3 p-4 border rounded-lg">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1 rounded border-input"
          />
          <span className="text-sm">
            By checking this box, I agree that the signature above is my electronic
            signature and I intend to sign this document electronically. I understand
            that my electronic signature has the same legal effect as a handwritten
            signature.
          </span>
        </label>

        {/* Sign button */}
        <Button
          className="w-full"
          size="lg"
          onClick={handleSign}
          loading={signing}
          disabled={!hasSignature || !agreed}
        >
          Sign Document
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Your signature will be securely embedded in the document.
          An audit trail including timestamp and IP address will be recorded.
        </p>
      </CardContent>
    </Card>
  );
}
