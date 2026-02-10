import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import Link from "next/link";
import bcrypt from "bcryptjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

async function getRoles() {
  return prisma.role.findMany({
    where: { name: { not: "Customer" } },
    orderBy: { name: "asc" },
  });
}

async function createUser(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session || session.user.roleName !== "Admin") {
    throw new Error("Unauthorized - Admin access required");
  }

  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const password = formData.get("password") as string;
  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const phone = (formData.get("phone") as string)?.trim() || null;
  const roleId = formData.get("roleId") as string;

  // Validation
  if (!email || !password || !firstName || !lastName || !roleId) {
    throw new Error("All required fields must be filled");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters");
  }

  // Check if email already exists
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new Error("Email already in use");
  }

  // Verify role exists
  const role = await prisma.role.findUnique({
    where: { id: roleId },
  });

  if (!role) {
    throw new Error("Invalid role selected");
  }

  // Hash password and create user
  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
      roleId,
      isActive: true,
    },
  });

  revalidatePath("/team");
  redirect("/team");
}

export default async function NewTeamMemberPage() {
  const session = await auth();
  const user = session!.user;

  // Only admins can create users
  if (user.roleName !== "Admin") {
    redirect("/team");
  }

  const roles = await getRoles();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/team">
          <Button variant="ghost" size="sm">
            &larr; Back to Team
          </Button>
        </Link>
        <h1 className="text-3xl font-bold">Add Team Member</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>New User Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createUser} className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  name="firstName"
                  required
                  placeholder="John"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  name="lastName"
                  required
                  placeholder="Doe"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                required
                placeholder="john.doe@bigbuildingsdirect.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password *</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                minLength={8}
                placeholder="Minimum 8 characters"
              />
              <p className="text-xs text-muted-foreground">
                User can change their password after logging in
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="roleId">Role *</Label>
              <select
                id="roleId"
                name="roleId"
                required
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Select a role...</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} - {role.description}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit">Create User</Button>
              <Link href="/team">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
