import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/utils";
import { BstPipelineCards } from "@/components/features/orders/bst-pipeline-cards";
import { StatusSelect } from "@/components/features/orders/status-select";
import { WcStageSections } from "@/components/features/orders/wc-stage-sections";
import { BstTabs } from "@/components/features/orders/bst-tabs";
import { PipelineOrderActions } from "@/components/features/orders/pipeline-order-actions";
import {
  TicketStatusBadge,
  TicketPriorityBadge,
  TicketTypeBadge,
  CreateTicketByOrderDialog,
} from "@/components/features/tickets";
import { CreateRevisionDialog } from "@/components/features/revisions";
import { CancelOrderByLookupDialog } from "@/components/features/orders";
import {
  getManufacturerOrders,
  getBstStageCounts,
  getWcStageOrders,
  getTickets,
  getTicketStats,
  getRevisionsForBst,
  getRevisionStats,
  getCancelledOrders,
  getCancellationStats,
  getTabCounts,
  getBstStageLabel,
  wcStatusOptions,
  lppStatusOptions,
  ticketStatuses,
  ticketTypes,
} from "@/lib/queries/bst";

interface SearchParams {
  // Shared
  tab?: string;
  // Pipeline
  page?: string;
  search?: string;
  bstStage?: string;
  // Tickets
  tpage?: string;
  tsearch?: string;
  tstatus?: string;
  ttype?: string;
  tpriority?: string;
  assignedToMe?: string;
  // Revisions
  rpage?: string;
  rsearch?: string;
  rchangeType?: string;
  // Cancellations
  cpage?: string;
  csearch?: string;
}

function StatusIndicator({ completed, label }: { completed: boolean; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5" title={label}>
      {completed ? (
        <svg className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ) : (
        <svg className="h-5 w-5 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="12" cy="12" r="9" />
        </svg>
      )}
    </div>
  );
}

function getTicketPriorityRowClass(priority: string): string {
  switch (priority) {
    case "URGENT":
      return "bg-red-50 dark:bg-red-950/40 hover:bg-red-100/80 dark:hover:bg-red-900/40 border-l-4 border-l-red-500";
    case "HIGH":
      return "bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100/80 dark:hover:bg-amber-900/40 border-l-4 border-l-amber-500";
    default:
      return "";
  }
}

export default async function SuccessTeamPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await auth();
  const user = session!.user;

  const allowedRoles = ["Admin", "Manager", "BST"];
  if (!allowedRoles.includes(user.roleName)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const activeTab = params.tab || "pipeline";

  // Always fetch tab counts for badges
  const tabCounts = await getTabCounts(user.id);

  // Permission check for editing BST status
  const canEditBstStatus =
    user.roleName === "Admin" ||
    user.roleName === "Manager" ||
    user.roleName === "BST";

  // ============ Conditional Data Fetching ============

  let pipelineData;
  let stageCounts;
  let wcStageOrders;
  let ticketData;
  let ticketStats;
  let revisionData;
  let revisionStats;
  let cancellationData;
  let cancellationStats;

  if (activeTab === "pipeline") {
    [pipelineData, stageCounts, wcStageOrders] = await Promise.all([
      getManufacturerOrders(params),
      getBstStageCounts(),
      getWcStageOrders(),
    ]);
  } else if (activeTab === "tickets") {
    [ticketData, ticketStats] = await Promise.all([
      getTickets(params, user.id),
      getTicketStats(user.id),
    ]);
  } else if (activeTab === "revisions") {
    [revisionData, revisionStats] = await Promise.all([
      getRevisionsForBst(params),
      getRevisionStats(),
    ]);
  } else if (activeTab === "cancellations") {
    [cancellationData, cancellationStats] = await Promise.all([
      getCancelledOrders(params),
      getCancellationStats(),
    ]);
  }

  // ============ Pipeline Tab Content ============

  const isWcStage = !params.bstStage || ["stmPending", "wcPending", "noContactMade"].includes(params.bstStage);
  const isLppStage = params.bstStage && ["wcDoneLpp", "readyToInstall"].includes(params.bstStage);

  const pipelineContent = (
    <div className="space-y-6 mt-4">
      {stageCounts && (
        <Card>
          <CardContent className="pt-6">
            <BstPipelineCards
              counts={stageCounts}
              activeStage={params.bstStage}
            />
          </CardContent>
        </Card>
      )}

      {wcStageOrders && isWcStage && !params.search && (
        <WcStageSections
          stmPendingOrders={wcStageOrders.stmPendingOrders}
          wcPendingOrders={wcStageOrders.wcPendingOrders}
          noContactMadeOrders={wcStageOrders.noContactMadeOrders}
          canEdit={canEditBstStatus}
        />
      )}

      {pipelineData && (isLppStage || params.search) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>
                {params.search ? (
                  <>Search Results</>
                ) : params.bstStage === "wcDoneLpp" ? (
                  <>Stage 4: WC Done, LP&P Pending</>
                ) : params.bstStage === "readyToInstall" ? (
                  <>Stage 5: Ready to Install</>
                ) : (
                  "Orders"
                )}
              </CardTitle>
              <form className="flex items-center gap-2">
                <input
                  type="text"
                  name="search"
                  placeholder="Search orders..."
                  defaultValue={params.search}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
                {params.bstStage && (
                  <input type="hidden" name="bstStage" value={params.bstStage} />
                )}
                <Button type="submit" size="sm">
                  Search
                </Button>
                {(params.search || params.bstStage) && (
                  <Link href="/success-team">
                    <Button type="button" variant="outline" size="sm">
                      Clear
                    </Button>
                  </Link>
                )}
              </form>
            </div>
          </CardHeader>
          <CardContent>
            {pipelineData.orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No orders found
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Building</TableHead>
                      <TableHead>Installer</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>WC Status</TableHead>
                      <TableHead>LP&P</TableHead>
                      <TableHead>Sales Rep</TableHead>
                      <TableHead>Sent Date</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pipelineData.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          {order.orderNumber}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{order.customerName}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.customerEmail}
                            </p>
                            {order.customerPhone && (
                              <p className="text-sm text-muted-foreground">
                                {order.customerPhone}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{order.buildingType}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.buildingSize}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {order.installer || (
                            <span className="text-muted-foreground">Not assigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`
                              inline-flex items-center rounded-full px-2 py-1 text-xs font-medium
                              ${getBstStageLabel(order.wcStatus, order.lppStatus) === "Ready"
                                ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                                : getBstStageLabel(order.wcStatus, order.lppStatus) === "No Contact"
                                ? "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300"
                                : getBstStageLabel(order.wcStatus, order.lppStatus) === "LP&P"
                                ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                                : getBstStageLabel(order.wcStatus, order.lppStatus) === "WC Pending"
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                              }
                            `}
                          >
                            {getBstStageLabel(order.wcStatus, order.lppStatus)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusSelect
                            orderId={order.id}
                            field="wcStatus"
                            value={order.wcStatus}
                            options={wcStatusOptions}
                            canEdit={canEditBstStatus}
                            label="Welcome Call Status"
                          />
                        </TableCell>
                        <TableCell>
                          <StatusSelect
                            orderId={order.id}
                            field="lppStatus"
                            value={order.lppStatus}
                            options={lppStatusOptions}
                            canEdit={canEditBstStatus}
                            label="Land, Pad & Permit Status"
                          />
                        </TableCell>
                        <TableCell>
                          {order.salesRep ? (
                            <span className="text-sm">
                              {order.salesRep.firstName} {order.salesRep.lastName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.sentToManufacturerDate
                            ? formatDate(order.sentToManufacturerDate)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <PipelineOrderActions
                            orderId={order.id}
                            orderNumber={order.orderNumber}
                            customerName={order.customerName}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {pipelineData.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(pipelineData.page - 1) * 20 + 1} to {Math.min(pipelineData.page * 20, pipelineData.total)} of{" "}
                      {pipelineData.total} orders
                    </p>
                    <div className="flex gap-2">
                      {pipelineData.page > 1 && (
                        <Link
                          href={`/success-team?page=${pipelineData.page - 1}&search=${params.search || ""}&bstStage=${params.bstStage || ""}`}
                        >
                          <Button variant="outline" size="sm">
                            Previous
                          </Button>
                        </Link>
                      )}
                      {pipelineData.page < pipelineData.totalPages && (
                        <Link
                          href={`/success-team?page=${pipelineData.page + 1}&search=${params.search || ""}&bstStage=${params.bstStage || ""}`}
                        >
                          <Button variant="outline" size="sm">
                            Next
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ============ Tickets Tab Content ============

  const ticketsContent = (
    <div className="space-y-6 mt-4">
      {ticketStats && (
        <div className="grid gap-4 md:grid-cols-4">
          <Link href="/success-team?tab=tickets&tstatus=OPEN">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Open
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{ticketStats.open}</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/success-team?tab=tickets&tstatus=IN_PROGRESS">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  In Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{ticketStats.inProgress}</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/success-team?tab=tickets&tstatus=PENDING">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pending
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-600 dark:text-gray-400">{ticketStats.pending}</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/success-team?tab=tickets&assignedToMe=true">
            <Card className="hover:border-primary/50 transition-colors cursor-pointer">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Assigned to Me
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{ticketStats.assignedToMe}</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      )}

      {ticketData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>All Tickets</CardTitle>
                <CreateTicketByOrderDialog />
              </div>
              <form className="flex items-center gap-2 flex-wrap">
                <input type="hidden" name="tab" value="tickets" />
                <input
                  type="text"
                  name="tsearch"
                  placeholder="Search tickets..."
                  defaultValue={params.tsearch}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                />
                <select
                  name="tstatus"
                  defaultValue={params.tstatus}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {ticketStatuses.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <select
                  name="ttype"
                  defaultValue={params.ttype}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  {ticketTypes.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm">
                  Filter
                </Button>
                {(params.tsearch || params.tstatus || params.ttype || params.assignedToMe) && (
                  <Link href="/success-team?tab=tickets">
                    <Button type="button" variant="outline" size="sm">
                      Clear
                    </Button>
                  </Link>
                )}
              </form>
            </div>
          </CardHeader>
          <CardContent>
            {ticketData.tickets.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No tickets found
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticket #</TableHead>
                      <TableHead>Subject</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Assigned To</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ticketData.tickets.map((ticket) => (
                      <TableRow key={ticket.id} className={getTicketPriorityRowClass(ticket.priority)}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/tickets/${ticket.id}`}
                            className="hover:underline text-primary"
                          >
                            {ticket.ticketNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            <p className="truncate">{ticket.subject}</p>
                            {ticket._count.notes > 0 && (
                              <span className="text-xs text-muted-foreground">
                                {ticket._count.notes} note{ticket._count.notes !== 1 ? "s" : ""}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <Link
                              href={`/orders/${ticket.order.id}`}
                              className="hover:underline text-primary"
                            >
                              {ticket.order.orderNumber}
                            </Link>
                            <p className="text-sm text-muted-foreground">
                              {ticket.order.customerName}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <TicketTypeBadge type={ticket.type} size="sm" />
                        </TableCell>
                        <TableCell>
                          <TicketStatusBadge status={ticket.status} size="sm" />
                        </TableCell>
                        <TableCell>
                          <TicketPriorityBadge priority={ticket.priority} size="sm" />
                        </TableCell>
                        <TableCell>
                          {ticket.assignedTo ? (
                            <span className="text-sm">
                              {ticket.assignedTo.firstName} {ticket.assignedTo.lastName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-sm">Unassigned</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {formatRelativeTime(ticket.createdAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <Link href={`/tickets/${ticket.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {ticketData.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(ticketData.page - 1) * 20 + 1} to {Math.min(ticketData.page * 20, ticketData.total)} of{" "}
                      {ticketData.total} tickets
                    </p>
                    <div className="flex gap-2">
                      {ticketData.page > 1 && (
                        <Link
                          href={`/success-team?tab=tickets&tpage=${ticketData.page - 1}&tsearch=${params.tsearch || ""}&tstatus=${params.tstatus || ""}&ttype=${params.ttype || ""}`}
                        >
                          <Button variant="outline" size="sm">
                            Previous
                          </Button>
                        </Link>
                      )}
                      {ticketData.page < ticketData.totalPages && (
                        <Link
                          href={`/success-team?tab=tickets&tpage=${ticketData.page + 1}&tsearch=${params.tsearch || ""}&tstatus=${params.tstatus || ""}&ttype=${params.ttype || ""}`}
                        >
                          <Button variant="outline" size="sm">
                            Next
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ============ Revisions Tab Content ============

  const revisionsContent = (
    <div className="space-y-6 mt-4">
      {revisionStats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Revisions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{revisionStats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Price Changes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{revisionStats.withPriceChange}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Manufacturer Changes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{revisionStats.withManufacturerChange}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {revisionData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>All Revisions</CardTitle>
                <CreateRevisionDialog />
              </div>
              <form className="flex items-center gap-2">
                <input type="hidden" name="tab" value="revisions" />
                <input
                  type="text"
                  name="rsearch"
                  placeholder="Search order #, customer, notes..."
                  defaultValue={params.rsearch}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-64"
                />
                <select
                  name="rchangeType"
                  defaultValue={params.rchangeType}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                >
                  <option value="">All Types</option>
                  <option value="Change In Deposit Total">Price Changed</option>
                  <option value="No Change In Deposit Total">No Price Change</option>
                </select>
                <Button type="submit" size="sm">
                  Filter
                </Button>
                {(params.rsearch || params.rchangeType) && (
                  <Link href="/success-team?tab=revisions">
                    <Button type="button" variant="outline" size="sm">
                      Clear
                    </Button>
                  </Link>
                )}
              </form>
            </div>
          </CardHeader>
          <CardContent>
            {revisionData.revisions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No revisions found
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Revision</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-center">Deposit</TableHead>
                      <TableHead className="text-center">Sent to Customer</TableHead>
                      <TableHead className="text-center">Signed</TableHead>
                      <TableHead className="text-center">Sent to Mfr</TableHead>
                      <TableHead>Price Change</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {revisionData.revisions.map((revision) => (
                      <TableRow key={revision.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/orders/${revision.order.id}`}
                            className="hover:underline text-primary"
                          >
                            {revision.order.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{revision.order.customerName}</p>
                            <p className="text-sm text-muted-foreground">
                              {revision.order.customerEmail}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{revision.revisionNumber}</Badge>
                        </TableCell>
                        <TableCell>{formatDate(revision.revisionDate)}</TableCell>
                        <TableCell className="text-center">
                          <StatusIndicator
                            completed={revision.depositCharge?.toLowerCase().includes("accepted") ?? false}
                            label="Deposit Collected"
                          />
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusIndicator completed={revision.sentToCustomer} label="Sent to Customer" />
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusIndicator completed={revision.customerSigned} label="Customer Signed" />
                        </TableCell>
                        <TableCell className="text-center">
                          <StatusIndicator completed={revision.sentToManufacturer} label="Sent to Manufacturer" />
                        </TableCell>
                        <TableCell>
                          {revision.depositDiff ? (
                            <span
                              className={
                                Number(revision.depositDiff) >= 0
                                  ? "text-green-600 dark:text-green-400"
                                  : "text-red-600 dark:text-red-400"
                              }
                            >
                              {Number(revision.depositDiff) >= 0 ? "+" : ""}
                              {formatCurrency(revision.depositDiff.toString())}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={`/revisions/${revision.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {revisionData.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(revisionData.page - 1) * 20 + 1} to {Math.min(revisionData.page * 20, revisionData.total)} of{" "}
                      {revisionData.total} revisions
                    </p>
                    <div className="flex gap-2">
                      {revisionData.page > 1 && (
                        <Link
                          href={`/success-team?tab=revisions&rpage=${revisionData.page - 1}&rsearch=${params.rsearch || ""}&rchangeType=${params.rchangeType || ""}`}
                        >
                          <Button variant="outline" size="sm">
                            Previous
                          </Button>
                        </Link>
                      )}
                      {revisionData.page < revisionData.totalPages && (
                        <Link
                          href={`/success-team?tab=revisions&rpage=${revisionData.page + 1}&rsearch=${params.rsearch || ""}&rchangeType=${params.rchangeType || ""}`}
                        >
                          <Button variant="outline" size="sm">
                            Next
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ============ Cancellations Tab Content ============

  const cancellationsContent = (
    <div className="space-y-6 mt-4">
      {cancellationStats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Cancelled
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{cancellationStats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cancelled This Month
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-orange-600 dark:text-orange-400">{cancellationStats.thisMonth}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cancelled This Week
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{cancellationStats.thisWeek}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {cancellationData && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle>Cancelled Orders</CardTitle>
                <CancelOrderByLookupDialog />
              </div>
              <form className="flex items-center gap-2">
                <input type="hidden" name="tab" value="cancellations" />
                <input
                  type="text"
                  name="csearch"
                  placeholder="Search order #, customer, reason..."
                  defaultValue={params.csearch}
                  className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm w-64"
                />
                <Button type="submit" size="sm">
                  Search
                </Button>
                {params.csearch && (
                  <Link href="/success-team?tab=cancellations">
                    <Button type="button" variant="outline" size="sm">
                      Clear
                    </Button>
                  </Link>
                )}
              </form>
            </div>
          </CardHeader>
          <CardContent>
            {cancellationData.orders.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                No cancelled orders found
              </p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order #</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Building</TableHead>
                      <TableHead>Installer</TableHead>
                      <TableHead>Cancel Date</TableHead>
                      <TableHead>Cancel Reason</TableHead>
                      <TableHead>Sales Rep</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cancellationData.orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          <Link
                            href={`/orders/${order.id}`}
                            className="hover:underline text-primary"
                          >
                            {order.orderNumber}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{order.customerName}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.customerEmail}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p>{order.buildingType}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.buildingSize}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {order.installer || (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {order.cancelledAt
                            ? formatDate(order.cancelledAt)
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="max-w-[200px]">
                            <p className="truncate text-sm">
                              {order.cancelReason || (
                                <span className="text-muted-foreground">No reason provided</span>
                              )}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {order.salesRep ? (
                            <span className="text-sm">
                              {order.salesRep.firstName} {order.salesRep.lastName}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Link href={`/orders/${order.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {cancellationData.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {(cancellationData.page - 1) * 20 + 1} to {Math.min(cancellationData.page * 20, cancellationData.total)} of{" "}
                      {cancellationData.total} cancelled orders
                    </p>
                    <div className="flex gap-2">
                      {cancellationData.page > 1 && (
                        <Link
                          href={`/success-team?tab=cancellations&cpage=${cancellationData.page - 1}&csearch=${params.csearch || ""}`}
                        >
                          <Button variant="outline" size="sm">
                            Previous
                          </Button>
                        </Link>
                      )}
                      {cancellationData.page < cancellationData.totalPages && (
                        <Link
                          href={`/success-team?tab=cancellations&cpage=${cancellationData.page + 1}&csearch=${params.csearch || ""}`}
                        >
                          <Button variant="outline" size="sm">
                            Next
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );

  // ============ Render ============

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Success Team</h1>
        <p className="text-muted-foreground">
          Orders sent to manufacturer - manage fulfillment and customer success
        </p>
      </div>

      <BstTabs
        pipelineContent={pipelineContent}
        ticketsContent={ticketsContent}
        revisionsContent={revisionsContent}
        cancellationsContent={cancellationsContent}
        defaultTab={activeTab}
        tabCounts={tabCounts}
      />
    </div>
  );
}
