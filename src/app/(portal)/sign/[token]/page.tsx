import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SignaturePad } from "@/components/features/documents/signature-pad";

async function getDocumentByToken(token: string) {
  // Update viewed status
  const document = await prisma.document.findUnique({
    where: { signingToken: token },
    include: {
      file: true,
      order: {
        select: {
          orderNumber: true,
          customerName: true,
        },
      },
    },
  });

  if (!document) return null;

  // Mark as viewed if not already
  if (document.status === "SENT") {
    await prisma.document.update({
      where: { id: document.id },
      data: {
        status: "VIEWED",
        viewedAt: new Date(),
      },
    });
  }

  return document;
}

export default async function SignDocumentPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const document = await getDocumentByToken(token);

  if (!document) {
    notFound();
  }

  if (document.status === "SIGNED") {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="rounded-full bg-green-100 w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <svg
            className="h-8 w-8 text-green-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Document Already Signed</h1>
        <p className="text-muted-foreground">
          This document was signed on{" "}
          {document.signedAt?.toLocaleDateString()}
        </p>
      </div>
    );
  }

  if (document.status === "EXPIRED") {
    return (
      <div className="max-w-2xl mx-auto text-center py-12">
        <div className="rounded-full bg-yellow-100 w-16 h-16 flex items-center justify-center mx-auto mb-4">
          <svg
            className="h-8 w-8 text-yellow-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-bold mb-2">Link Expired</h1>
        <p className="text-muted-foreground">
          This signing link has expired. Please contact us for a new link.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sign Document</h1>
        <p className="text-muted-foreground">
          Please review and sign the document below
        </p>
      </div>

      <div className="bg-card border rounded-lg p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Document:</span>
            <p className="font-medium">{document.title}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Order:</span>
            <p className="font-medium">{document.order.orderNumber}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Recipient:</span>
            <p className="font-medium">{document.order.customerName}</p>
          </div>
        </div>
      </div>

      {/* PDF Preview */}
      <div className="bg-card border rounded-lg overflow-hidden">
        <div className="bg-muted px-4 py-2 border-b">
          <p className="text-sm font-medium">{document.file.filename}</p>
        </div>
        <div className="h-[600px]">
          <iframe
            src={`/api/files/${document.file.id}`}
            className="w-full h-full"
            title="Document Preview"
          />
        </div>
      </div>

      {/* Signature Section */}
      <SignaturePad
        documentId={document.id}
        signingToken={token}
      />
    </div>
  );
}
