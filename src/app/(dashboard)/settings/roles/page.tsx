import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

async function getRoles() {
  return prisma.role.findMany({
    include: {
      permissions: {
        include: { permission: true },
      },
      _count: {
        select: { users: true },
      },
    },
    orderBy: { name: "asc" },
  });
}

export default async function RolesPage() {
  const session = await auth();
  const user = session!.user;
  const isAdmin = user.roleName === "Admin";
  const canCreate = isAdmin || user.permissions.includes("roles.create");

  const roles = await getRoles();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Roles & Permissions</h1>
          <p className="text-muted-foreground">
            Manage user roles and their access permissions
          </p>
        </div>
        {canCreate && (
          <Link href="/settings/roles/new">
            <Button>Create Role</Button>
          </Link>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {roles.map((role) => (
          <Link key={role.id} href={`/settings/roles/${role.id}`}>
            <Card className="h-full hover:bg-muted/50 transition-colors cursor-pointer">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{role.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    {role.isSystem && (
                      <Badge variant="secondary">System</Badge>
                    )}
                    <Badge variant="outline">{role._count.users} users</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  {role.description || "No description"}
                </p>
                <div className="flex flex-wrap gap-1">
                  {role.permissions.slice(0, 5).map(({ permission }) => (
                    <Badge key={permission.id} variant="outline" className="text-xs">
                      {permission.name}
                    </Badge>
                  ))}
                  {role.permissions.length > 5 && (
                    <Badge variant="outline" className="text-xs">
                      +{role.permissions.length - 5} more
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
