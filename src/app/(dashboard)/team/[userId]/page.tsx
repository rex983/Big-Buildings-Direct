import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { getInitials, formatDate } from "@/lib/utils";

async function getUser(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: true,
      _count: {
        select: { salesRepOrders: true },
      },
    },
  });
}

async function getRoles() {
  return prisma.role.findMany({
    where: {
      name: { not: "Customer" }, // Don't allow assigning Customer role to team members
    },
    orderBy: { name: "asc" },
  });
}

async function updateUserDetails(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session || session.user.roleName !== "Admin") {
    throw new Error("Unauthorized - Admin access required");
  }

  const userId = formData.get("userId") as string;
  const firstName = (formData.get("firstName") as string)?.trim();
  const lastName = (formData.get("lastName") as string)?.trim();
  const email = (formData.get("email") as string)?.trim().toLowerCase();
  const phone = (formData.get("phone") as string)?.trim() || null;

  if (!userId || !firstName || !lastName || !email) {
    throw new Error("Missing required fields");
  }

  // Verify the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Check if email is being changed and if it's already in use
  if (email !== user.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      throw new Error("Email already in use");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { firstName, lastName, email, phone },
  });

  revalidatePath(`/team/${userId}`);
  revalidatePath("/team");
}

async function updateUserRole(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session || session.user.roleName !== "Admin") {
    throw new Error("Unauthorized");
  }

  const userId = formData.get("userId") as string;
  const roleId = formData.get("roleId") as string;

  if (!userId || !roleId) {
    throw new Error("Missing required fields");
  }

  // Verify the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Don't allow changing the last admin's role
  if (user.role.name === "Admin") {
    const adminCount = await prisma.user.count({
      where: { role: { name: "Admin" } },
    });
    const newRole = await prisma.role.findUnique({ where: { id: roleId } });
    if (adminCount <= 1 && newRole?.name !== "Admin") {
      throw new Error("Cannot remove the last admin");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { roleId },
  });

  revalidatePath(`/team/${userId}`);
  revalidatePath("/team");
}

async function updateUserStatus(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const currentUserRole = session.user.roleName;
  const isAdmin = currentUserRole === "Admin";
  const isManager = currentUserRole === "Manager";

  // Only admins and managers can update status
  if (!isAdmin && !isManager) {
    throw new Error("Unauthorized");
  }

  const userId = formData.get("userId") as string;
  const isActive = formData.get("isActive") === "true";

  if (!userId) {
    throw new Error("Missing required fields");
  }

  // Verify the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Managers can only activate/deactivate Sales Reps
  if (isManager && !isAdmin) {
    if (user.role.name !== "Sales Rep") {
      throw new Error("Managers can only activate/deactivate Sales Reps");
    }
  }

  // Don't allow deactivating the last admin
  if (user.role.name === "Admin" && !isActive) {
    const activeAdminCount = await prisma.user.count({
      where: { role: { name: "Admin" }, isActive: true },
    });
    if (activeAdminCount <= 1) {
      throw new Error("Cannot deactivate the last admin");
    }
  }

  await prisma.user.update({
    where: { id: userId },
    data: { isActive },
  });

  revalidatePath(`/team/${userId}`);
  revalidatePath("/team");
}

async function updateUserAssignment(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session) {
    throw new Error("Unauthorized");
  }

  const currentUserRole = session.user.roleName;
  if (currentUserRole !== "Admin" && currentUserRole !== "Manager") {
    throw new Error("Unauthorized - Admin or Manager access required");
  }

  const userId = formData.get("userId") as string;
  const office = (formData.get("office") as string) || null;
  const department = (formData.get("department") as string) || null;

  if (!userId) {
    throw new Error("Missing required fields");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error("User not found");
  }

  await prisma.user.update({
    where: { id: userId },
    data: { office, department },
  });

  revalidatePath(`/team/${userId}`);
  revalidatePath("/team");
}

async function deleteUser(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session || session.user.roleName !== "Admin") {
    throw new Error("Unauthorized - Admin access required");
  }

  const userId = formData.get("userId") as string;

  if (!userId) {
    throw new Error("Missing required fields");
  }

  // Verify the user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { role: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Don't allow deleting the last admin
  if (user.role.name === "Admin") {
    const adminCount = await prisma.user.count({
      where: { role: { name: "Admin" } },
    });
    if (adminCount <= 1) {
      throw new Error("Cannot delete the last admin");
    }
  }

  // Don't allow deleting yourself
  if (user.id === session.user.id) {
    throw new Error("Cannot delete your own account");
  }

  // Delete the user (this will cascade delete related records if configured)
  await prisma.user.delete({
    where: { id: userId },
  });

  revalidatePath("/team");
  redirect("/team");
}

export default async function UserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const session = await auth();
  const currentUser = session!.user;
  const isAdmin = currentUser.roleName === "Admin";
  const isManager = currentUser.roleName === "Manager";

  const { userId } = await params;
  const [user, roles] = await Promise.all([getUser(userId), getRoles()]);

  if (!user) {
    notFound();
  }

  // Check if current user can manage this user's status
  const canManageStatus = isAdmin || (isManager && user.role.name === "Sales Rep");
  const canDelete = isAdmin && user.id !== currentUser.id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/team">
            <Button variant="ghost" size="sm">
              &larr; Back to Team
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">
            {user.firstName} {user.lastName}
          </h1>
          {!user.isActive && <Badge variant="secondary">Inactive</Badge>}
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* User Info Card - Editable for Admins */}
        <Card>
          <CardHeader>
            <CardTitle>User Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isAdmin ? (
              <form action={updateUserDetails} className="space-y-4">
                <input type="hidden" name="userId" value={user.id} />

                <div className="flex items-center gap-4 pb-4">
                  <Avatar
                    src={user.avatar}
                    fallback={getInitials(user.firstName, user.lastName)}
                    size="xl"
                  />
                  <div className="flex-1">
                    <Badge variant="outline">{user.role.name}</Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {user._count.salesRepOrders} orders
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      name="firstName"
                      defaultValue={user.firstName}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      name="lastName"
                      defaultValue={user.lastName}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={user.email}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={user.phone || ""}
                    placeholder="Enter phone number"
                  />
                </div>

                <div className="grid gap-2 pt-4 border-t text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Office</span>
                    <span>{user.office || "None"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department</span>
                    <span>{user.department || "None"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Joined</span>
                    <span>{formatDate(user.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={user.isActive ? "success" : "secondary"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>

                <Button type="submit" className="w-full">
                  Save Changes
                </Button>
              </form>
            ) : (
              <>
                <div className="flex items-center gap-4">
                  <Avatar
                    src={user.avatar}
                    fallback={getInitials(user.firstName, user.lastName)}
                    size="xl"
                  />
                  <div>
                    <p className="text-lg font-medium">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-muted-foreground">{user.email}</p>
                    {user.phone && (
                      <p className="text-sm text-muted-foreground">{user.phone}</p>
                    )}
                  </div>
                </div>

                <div className="grid gap-2 pt-4 border-t">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Current Role</span>
                    <Badge variant="outline">{user.role.name}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Office</span>
                    <span>{user.office || "None"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Department</span>
                    <span>{user.department || "None"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Orders</span>
                    <span>{user._count.salesRepOrders}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Joined</span>
                    <span>{formatDate(user.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <Badge variant={user.isActive ? "success" : "secondary"}>
                      {user.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Role Assignment Card - Admin Only */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Role Assignment</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateUserRole} className="space-y-4">
                <input type="hidden" name="userId" value={user.id} />

                <div className="space-y-2">
                  <Label htmlFor="roleId">Assign Role</Label>
                  <select
                    id="roleId"
                    name="roleId"
                    defaultValue={user.roleId}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.name} - {role.description}
                      </option>
                    ))}
                  </select>
                </div>

                <Button type="submit" className="w-full">
                  Update Role
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Office & Department Card - Admin or Manager */}
        {(isAdmin || isManager) && (
          <Card>
            <CardHeader>
              <CardTitle>Office & Department</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={updateUserAssignment} className="space-y-4">
                <input type="hidden" name="userId" value={user.id} />

                <div className="space-y-2">
                  <Label htmlFor="office">Office Location</Label>
                  <select
                    id="office"
                    name="office"
                    defaultValue={user.office || ""}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">No office assigned</option>
                    <option value="Marion Office">Marion Office</option>
                    <option value="Harbor Office">Harbor Office</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  <select
                    id="department"
                    name="department"
                    defaultValue={user.department || ""}
                    className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    <option value="">No department assigned</option>
                    <option value="Sales">Sales</option>
                    <option value="Operations">Operations</option>
                    <option value="BST">BST</option>
                    <option value="R&D">R&D</option>
                    <option value="Management">Management</option>
                  </select>
                </div>

                <Button type="submit" className="w-full">
                  Update Assignment
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Account Management Card - Admin or Manager (for Sales Reps) */}
        {canManageStatus && (
          <Card>
            <CardHeader>
              <CardTitle>Account Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h4 className="font-medium mb-2">Account Status</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {user.isActive
                    ? "This user can log in and access the system."
                    : "This user cannot log in until reactivated."}
                </p>
                <form action={updateUserStatus}>
                  <input type="hidden" name="userId" value={user.id} />
                  <input
                    type="hidden"
                    name="isActive"
                    value={user.isActive ? "false" : "true"}
                  />
                  <Button
                    type="submit"
                    variant={user.isActive ? "destructive" : "default"}
                    className="w-full"
                  >
                    {user.isActive ? "Deactivate User" : "Activate User"}
                  </Button>
                </form>
              </div>

              {canDelete && (
                <div className="pt-6 border-t">
                  <h4 className="font-medium mb-2 text-destructive">Danger Zone</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Permanently delete this user. This action cannot be undone.
                    Consider deactivating instead.
                  </p>
                  <form action={deleteUser}>
                    <input type="hidden" name="userId" value={user.id} />
                    <Button
                      type="submit"
                      variant="destructive"
                      className="w-full"
                    >
                      Delete User Permanently
                    </Button>
                  </form>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Role Permissions Card */}
        <Card className={(isAdmin || canManageStatus) ? "md:col-span-2" : ""}>
          <CardHeader>
            <CardTitle>Role Permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">{user.role.name}</h4>
                <p className="text-sm text-muted-foreground mb-4">
                  {user.role.description}
                </p>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>
                  This user has the <strong>{user.role.name}</strong> role.
                  {user.role.name === "Sales Rep" && (
                    <span className="block mt-2">
                      Sales Reps can create and manage their own orders. Once an order is sent to manufacturer,
                      it appears as &quot;Completed&quot; in their view.
                    </span>
                  )}
                  {user.role.name === "BST" && (
                    <span className="block mt-2">
                      Building Success Team members handle post-sale customer success and order fulfillment.
                    </span>
                  )}
                  {user.role.name === "Manager" && (
                    <span className="block mt-2">
                      Managers have full access to orders, users, and communications.
                    </span>
                  )}
                  {user.role.name === "R&D" && (
                    <span className="block mt-2">
                      R&amp;D members have view-only access for research and analysis.
                    </span>
                  )}
                  {user.role.name === "Admin" && (
                    <span className="block mt-2">
                      Admins have full access to all features including system settings and role management.
                    </span>
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
