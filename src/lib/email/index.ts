import { Resend } from "resend";

// Initialize Resend only if API key is available
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const fromAddress = process.env.EMAIL_FROM || "noreply@bigbuildingsdirect.com";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<SendEmailResult> {
  try {
    // Check if API key is configured
    if (!resend) {
      console.warn("RESEND_API_KEY not configured, skipping email send");
      return {
        success: true,
        messageId: "dev-mode-skip",
      };
    }

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
      replyTo: options.replyTo,
    });

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    return {
      success: true,
      messageId: data?.id,
    };
  } catch (error) {
    console.error("Email send error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// Email templates
export function getSigningRequestEmail(params: {
  customerName: string;
  documentTitle: string;
  signingUrl: string;
  companyName?: string;
}): { subject: string; html: string; text: string } {
  const companyName = params.companyName || "Big Buildings Direct";

  return {
    subject: `Please sign: ${params.documentTitle}`,
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Document Signing Request</title>
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h1 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px;">Document Ready for Signing</h1>
            <p style="margin: 0 0 15px 0;">Hello ${params.customerName},</p>
            <p style="margin: 0 0 15px 0;">A document from <strong>${companyName}</strong> requires your signature:</p>
            <p style="margin: 0 0 25px 0; font-size: 18px; font-weight: 600; color: #1a1a1a;">${params.documentTitle}</p>
            <a href="${params.signingUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">Review & Sign Document</a>
          </div>
          <p style="color: #666; font-size: 14px;">If you have any questions, please contact us.</p>
          <p style="color: #666; font-size: 14px;">Thank you,<br>${companyName}</p>
        </body>
      </html>
    `,
    text: `
Document Ready for Signing

Hello ${params.customerName},

A document from ${companyName} requires your signature:
${params.documentTitle}

Please visit the following link to review and sign the document:
${params.signingUrl}

If you have any questions, please contact us.

Thank you,
${companyName}
    `.trim(),
  };
}

export function getWelcomeEmail(params: {
  firstName: string;
  loginUrl: string;
  temporaryPassword?: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: "Welcome to Big Buildings Direct",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h1 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px;">Welcome to Big Buildings Direct!</h1>
            <p style="margin: 0 0 15px 0;">Hello ${params.firstName},</p>
            <p style="margin: 0 0 15px 0;">Your account has been created. You can now access your customer portal to:</p>
            <ul style="margin: 0 0 20px 0; padding-left: 20px;">
              <li>View your order status and history</li>
              <li>Download documents and files</li>
              <li>Communicate with our team</li>
              <li>Sign contracts electronically</li>
            </ul>
            ${params.temporaryPassword ? `<p style="margin: 0 0 15px 0; background: #fff3cd; padding: 10px; border-radius: 4px;">Your temporary password is: <strong>${params.temporaryPassword}</strong><br>Please change it after logging in.</p>` : ""}
            <a href="${params.loginUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">Access Your Portal</a>
          </div>
          <p style="color: #666; font-size: 14px;">If you have any questions, don't hesitate to reach out.</p>
          <p style="color: #666; font-size: 14px;">Best regards,<br>Big Buildings Direct</p>
        </body>
      </html>
    `,
    text: `
Welcome to Big Buildings Direct!

Hello ${params.firstName},

Your account has been created. You can now access your customer portal to:
- View your order status and history
- Download documents and files
- Communicate with our team
- Sign contracts electronically

${params.temporaryPassword ? `Your temporary password is: ${params.temporaryPassword}\nPlease change it after logging in.\n` : ""}
Access your portal: ${params.loginUrl}

If you have any questions, don't hesitate to reach out.

Best regards,
Big Buildings Direct
    `.trim(),
  };
}

export function getPasswordResetEmail(params: {
  firstName: string;
  resetUrl: string;
}): { subject: string; html: string; text: string } {
  return {
    subject: "Reset Your Password - Big Buildings Direct",
    html: `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: #f8f9fa; border-radius: 8px; padding: 30px; margin-bottom: 20px;">
            <h1 style="color: #1a1a1a; margin: 0 0 20px 0; font-size: 24px;">Reset Your Password</h1>
            <p style="margin: 0 0 15px 0;">Hello ${params.firstName},</p>
            <p style="margin: 0 0 15px 0;">We received a request to reset your password. Click the button below to create a new password:</p>
            <a href="${params.resetUrl}" style="display: inline-block; background: #2563eb; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">Reset Password</a>
            <p style="margin: 20px 0 0 0; color: #666; font-size: 14px;">This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.</p>
          </div>
          <p style="color: #666; font-size: 14px;">Best regards,<br>Big Buildings Direct</p>
        </body>
      </html>
    `,
    text: `
Reset Your Password

Hello ${params.firstName},

We received a request to reset your password. Visit the following link to create a new password:
${params.resetUrl}

This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.

Best regards,
Big Buildings Direct
    `.trim(),
  };
}
