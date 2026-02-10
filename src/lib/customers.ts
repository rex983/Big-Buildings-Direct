import { prisma } from "./prisma";
import bcrypt from "bcryptjs";
import crypto from "crypto";

/**
 * Find an existing Customer user by email, or create a new one.
 * Returns the user ID.
 */
export async function findOrCreateCustomer(
  email: string,
  name: string,
  phone?: string | null
): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();

  // Look for existing user with this email and Customer role
  const existing = await prisma.user.findFirst({
    where: {
      email: normalizedEmail,
      role: { name: "Customer" },
    },
    select: { id: true },
  });

  if (existing) {
    return existing.id;
  }

  // Check if a user with this email exists but with a different role
  const existingAnyRole = await prisma.user.findUnique({
    where: { email: normalizedEmail },
    select: { id: true },
  });

  if (existingAnyRole) {
    // Email already in use by a non-Customer user (e.g. Sales Rep) — return that ID
    return existingAnyRole.id;
  }

  // Create a new Customer user
  const customerRole = await prisma.role.findUnique({
    where: { name: "Customer" },
  });

  if (!customerRole) {
    throw new Error("Customer role not found. Please seed the database first.");
  }

  // Generate a random password — customers will use password reset to set theirs
  const randomPassword = crypto.randomBytes(18).toString("base64");
  const hashedPassword = await bcrypt.hash(randomPassword, 12);

  // Split name into first/last
  const nameParts = name.trim().split(/\s+/);
  const firstName = nameParts[0] || "Customer";
  const lastName = nameParts.slice(1).join(" ") || "";

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      password: hashedPassword,
      firstName,
      lastName,
      phone: phone || null,
      roleId: customerRole.id,
      isActive: true,
    },
  });

  return user.id;
}
