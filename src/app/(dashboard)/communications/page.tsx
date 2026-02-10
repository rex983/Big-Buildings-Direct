import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar } from "@/components/ui/avatar";
import { formatRelativeTime, getInitials } from "@/lib/utils";

interface SearchParams {
  search?: string;
  tab?: string;
}

async function getRecentMessages(canViewAll: boolean, userId: string, search?: string) {
  const baseWhere = canViewAll
    ? {}
    : {
        order: {
          OR: [{ salesRepId: userId }, { customerId: userId }],
        },
      };

  const searchFilter = search
    ? {
        OR: [
          { content: { contains: search } },
          { order: { orderNumber: { contains: search } } },
          { order: { customerName: { contains: search } } },
          { sender: { firstName: { contains: search } } },
          { sender: { lastName: { contains: search } } },
        ],
      }
    : {};

  return prisma.message.findMany({
    where: { ...baseWhere, ...searchFilter },
    include: {
      sender: { select: { firstName: true, lastName: true, avatar: true } },
      order: { select: { orderNumber: true, customerName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

async function getRecentEmails(canViewAll: boolean, userId: string, search?: string) {
  const baseWhere = canViewAll
    ? {}
    : {
        OR: [{ sentById: userId }, { order: { salesRepId: userId } }],
      };

  const searchFilter = search
    ? {
        OR: [
          { subject: { contains: search } },
          { toAddress: { contains: search } },
          { order: { orderNumber: { contains: search } } },
          { order: { customerName: { contains: search } } },
        ],
      }
    : {};

  return prisma.email.findMany({
    where: { ...baseWhere, ...searchFilter },
    include: {
      order: { select: { orderNumber: true, customerName: true } },
      sentBy: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const user = session!.user;
  const isAdmin = user.roleName === "Admin";
  const canViewAll = isAdmin || user.permissions.includes("orders.view_all");

  const params = await searchParams;
  const [messages, emails] = await Promise.all([
    getRecentMessages(canViewAll, user.id, params.search),
    getRecentEmails(canViewAll, user.id, params.search),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Communications</h1>
          <p className="text-muted-foreground">
            View messages and emails across all orders
          </p>
        </div>
        <form className="flex items-center gap-2">
          <input
            type="text"
            name="search"
            placeholder="Search messages, emails, orders..."
            defaultValue={params.search}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-64"
          />
          <Button type="submit" size="sm">
            Search
          </Button>
          {params.search && (
            <Link href="/communications">
              <Button variant="ghost" size="sm">
                Clear
              </Button>
            </Link>
          )}
        </form>
      </div>

      <Tabs defaultValue={params.tab || "messages"}>
        <TabsList>
          <TabsTrigger value="messages">Messages ({messages.length})</TabsTrigger>
          <TabsTrigger value="emails">Emails ({emails.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="messages">
          <Card>
            <CardHeader>
              <CardTitle>Recent Messages</CardTitle>
            </CardHeader>
            <CardContent>
              {messages.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No messages found
                </p>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <Link
                      key={message.id}
                      href={`/orders/${message.orderId}`}
                      className="flex gap-4 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Avatar
                        src={message.sender.avatar}
                        fallback={getInitials(
                          message.sender.firstName,
                          message.sender.lastName
                        )}
                        size="sm"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">
                              {message.sender.firstName} {message.sender.lastName}
                            </span>
                            {message.isInternal && (
                              <Badge variant="secondary" className="text-xs">
                                Internal
                              </Badge>
                            )}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeTime(message.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate mt-1">
                          {message.content}
                        </p>
                        <p className="text-xs text-primary mt-2">
                          {message.order.orderNumber} - {message.order.customerName}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="emails">
          <Card>
            <CardHeader>
              <CardTitle>Recent Emails</CardTitle>
            </CardHeader>
            <CardContent>
              {emails.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No emails found
                </p>
              ) : (
                <div className="space-y-4">
                  {emails.map((email) => (
                    <div
                      key={email.id}
                      className="flex items-start justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={
                              email.direction === "INBOUND" ? "info" : "secondary"
                            }
                            className="text-xs"
                          >
                            {email.direction}
                          </Badge>
                          <Badge
                            variant={
                              email.status === "DELIVERED" || email.status === "OPENED"
                                ? "success"
                                : email.status === "FAILED" || email.status === "BOUNCED"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className="text-xs"
                          >
                            {email.status}
                          </Badge>
                        </div>
                        <p className="font-medium text-sm mt-2">{email.subject}</p>
                        <p className="text-sm text-muted-foreground">
                          To: {email.toAddress}
                        </p>
                        {email.order && (
                          <Link
                            href={`/orders/${email.orderId}`}
                            className="text-xs text-primary mt-2 inline-block hover:underline"
                          >
                            {email.order.orderNumber} - {email.order.customerName}
                          </Link>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeTime(email.createdAt)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
