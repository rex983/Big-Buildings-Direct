import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getInitials, formatDate } from "@/lib/utils";

interface SearchParams {
  search?: string;
  role?: string;
  status?: string;
}

async function getTeamMembers(searchParams: SearchParams) {
  const searchFilter = searchParams.search
    ? {
        OR: [
          { firstName: { contains: searchParams.search } },
          { lastName: { contains: searchParams.search } },
          { email: { contains: searchParams.search } },
        ],
      }
    : {};

  const roleFilter = searchParams.role
    ? { role: { id: searchParams.role } }
    : {};

  const statusFilter = searchParams.status
    ? { isActive: searchParams.status === "active" }
    : {};

  return prisma.user.findMany({
    where: {
      role: {
        name: { not: "Customer" },
      },
      ...searchFilter,
      ...roleFilter,
      ...statusFilter,
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      phone: true,
      avatar: true,
      isActive: true,
      createdAt: true,
      role: { select: { id: true, name: true } },
      _count: {
        select: { salesRepOrders: true },
      },
    },
    orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
  });
}

async function getRoles() {
  return prisma.role.findMany({
    where: { name: { not: "Customer" } },
    orderBy: { name: "asc" },
  });
}

export default async function TeamPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const user = session!.user;
  const isAdmin = user.roleName === "Admin";
  const canCreate = isAdmin || user.permissions.includes("users.create");

  const params = await searchParams;
  const [teamMembers, roles] = await Promise.all([
    getTeamMembers(params),
    getRoles(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Team</h1>
          <p className="text-muted-foreground">
            Manage your team members ({teamMembers.length} total)
          </p>
        </div>
        {canCreate && (
          <Link href="/team/new">
            <Button>Add Team Member</Button>
          </Link>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Team Members</CardTitle>
            <form className="flex items-center gap-2">
              <input
                type="text"
                name="search"
                placeholder="Search by name or email..."
                defaultValue={params.search}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-48"
              />
              <select
                name="role"
                defaultValue={params.role}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">All Roles</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </select>
              <select
                name="status"
                defaultValue={params.status}
                className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <Button type="submit" size="sm">
                Filter
              </Button>
              {(params.search || params.role || params.status) && (
                <Link href="/team">
                  <Button variant="ghost" size="sm">
                    Clear
                  </Button>
                </Link>
              )}
            </form>
          </div>
        </CardHeader>
        <CardContent>
          {teamMembers.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No team members found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {teamMembers.map((member) => (
                  <TableRow key={member.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <Link href={`/team/${member.id}`} className="flex items-center gap-3">
                        <Avatar
                          src={member.avatar}
                          fallback={getInitials(member.firstName, member.lastName)}
                          size="sm"
                        />
                        <span className="font-medium">
                          {member.firstName} {member.lastName}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      {member.phone || <span className="text-muted-foreground">-</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{member.role.name}</Badge>
                    </TableCell>
                    <TableCell>{member._count.salesRepOrders}</TableCell>
                    <TableCell>
                      <Badge variant={member.isActive ? "success" : "secondary"}>
                        {member.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(member.createdAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
