import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Download,
  EllipsisVertical,
  Filter,
  LineChart,
  Plus,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  WandSparkles,
  X,
} from "lucide-react";
import type { ComponentType, FormEvent, ReactNode } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PageHeaderActionButton } from "@magic-admin-v2/components/page-header-action-button"
import { FilterControlField } from "@magic-admin-v2/components/filter-control-field";
import { FilterSheet } from "@magic-admin-v2/components/filter-sheet";
import { ListPagination } from "@magic-admin-v2/components/list-pagination";
import { PageHeader } from "@magic-admin-v2/components/page-header";
import { Badge } from "@magic-admin-v2/components/ui/badge";
import { Button } from "@magic-admin-v2/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@magic-admin-v2/components/ui/alert-dialog";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@magic-admin-v2/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@magic-admin-v2/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@magic-admin-v2/components/ui/dialog";
import { Input } from "@magic-admin-v2/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@magic-admin-v2/components/ui/select";
import { Separator } from "@magic-admin-v2/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@magic-admin-v2/components/ui/sheet";
import { Switch } from "@magic-admin-v2/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@magic-admin-v2/components/ui/table";
import { Textarea } from "@magic-admin-v2/components/ui/textarea";
import { useTranslation } from "react-i18next";
import { IntlLocale } from "@magic-admin-v2/i18n/resources";
import { cn } from "@magic-admin-v2/utils/cn";

const metrics = [
  {
    title: "Active Agents",
    value: "128",
    previous: "112",
    change: 14.3,
    icon: Sparkles,
  },
  {
    title: "Runs Today",
    value: "24.8k",
    previous: "21.1k",
    change: 17.5,
    icon: Activity,
  },
  {
    title: "Avg. Latency",
    value: "1.24s",
    previous: "1.38s",
    change: -10.1,
    icon: LineChart,
  },
  {
    title: "Active Users",
    value: "8,421",
    previous: "7,980",
    change: 5.5,
    icon: Users,
  },
];

const activities = [
  {
    title: "Knowledge sync completed",
    description: "Product FAQ collection indexed 1,284 chunks.",
    status: "Done",
    time: "2m ago",
  },
  {
    title: "Workflow published",
    description: "Support triage v3 moved to production.",
    status: "Live",
    time: "18m ago",
  },
  {
    title: "Tool permission review",
    description: "Slack connector requires admin approval.",
    status: "Pending",
    time: "42m ago",
  },
];

const agents = [
  {
    name: "Support Triage",
    owner: "Operations",
    model: "GPT-4.1",
    status: "Live",
    runs: "12,420",
    cost: "$421.80",
  },
  {
    name: "Invoice Extractor",
    owner: "Finance",
    model: "Claude Sonnet",
    status: "Review",
    runs: "4,221",
    cost: "$138.40",
  },
  {
    name: "Sales Assistant",
    owner: "Revenue",
    model: "GPT-4.1 mini",
    status: "Draft",
    runs: "892",
    cost: "$26.12",
  },
  {
    name: "Policy Checker",
    owner: "Legal",
    model: "Gemini Pro",
    status: "Paused",
    runs: "1,460",
    cost: "$54.03",
  },
  {
    name: "Release Notes",
    owner: "Product",
    model: "GPT-4.1",
    status: "Live",
    runs: "6,021",
    cost: "$205.91",
  },
];

type ExampleAgent = (typeof agents)[number];

const statusOptions = ["All", "Live", "Review", "Draft", "Paused"];

const settingsNavItems = [
  {
    value: "general",
    title: "General",
    icon: Settings2,
  },
  {
    value: "security",
    title: "Security",
    icon: ShieldCheck,
  },
  {
    value: "automation",
    title: "Automation",
    icon: WandSparkles,
  },
];

export function ExampleDashboardPage() {
  return (
    <ExamplePageShell
      actions={
        <PageHeaderActionButton>
          <Plus className="size-4" />
          New agent
        </PageHeaderActionButton>
      }
      descriptionKey="nav.desc.exampleDashboard"
      titleKey="nav.item.exampleDashboard"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.title} {...metric} />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card className="@container/card border-border/50 bg-gradient-to-br from-violet-500/5 via-background to-background">
          <CardHeader>
            <CardTitle>Run volume</CardTitle>
            <CardDescription>Token and tool-call activity for the last 30 days.</CardDescription>
            <CardAction>
              <Select defaultValue="30d">
                <SelectTrigger className="min-w-36" aria-label="Select range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="30d">Last 30 days</SelectItem>
                  <SelectItem value="90d">Last 90 days</SelectItem>
                </SelectContent>
              </Select>
            </CardAction>
          </CardHeader>
          <CardContent>
            <div className="flex h-[260px] items-end gap-2 rounded-lg border border-border/50 bg-background/60 p-4">
              {Array.from({ length: 24 }, (_, index) => {
                const height = 28 + ((index * 19) % 96);
                return (
                  <div
                    aria-hidden="true"
                    className="flex min-w-0 flex-1 items-end"
                    key={index}
                  >
                    <div
                      className="w-full rounded-t bg-primary/80"
                      style={{ height }}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Operational events from the current workspace.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {activities.map((item) => (
              <div className="flex gap-3" key={item.title}>
                <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted">
                  <Clock3 className="size-4 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{item.title}</p>
                    <StatusBadge status={item.status} />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.description}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{item.time}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </ExamplePageShell>
  );
}

export function ExampleListPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [mobileStatusDraft, setMobileStatusDraft] = useState("All");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [items, setItems] = useState<ExampleAgent[]>(agents);
  const [detailTarget, setDetailTarget] = useState<ExampleAgent | null>(null);
  const [editTarget, setEditTarget] = useState<ExampleAgent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ExampleAgent | null>(null);
  const [editDraft, setEditDraft] = useState<ExampleAgent | null>(null);
  const filteredAgents = useMemo(
    () =>
      items.filter((agent) => {
        const matchesQuery = `${agent.name} ${agent.owner} ${agent.model}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesStatus = status === "All" || agent.status === status;
        return matchesQuery && matchesStatus;
      }),
    [items, query, status],
  );

  function openEdit(agent: ExampleAgent) {
    setEditTarget(agent);
    setEditDraft(agent);
  }

  function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editTarget || !editDraft) {
      return;
    }

    setItems((currentItems) =>
      currentItems.map((agent) => (agent.name === editTarget.name ? editDraft : agent)),
    );
    setDetailTarget((currentTarget) =>
      currentTarget?.name === editTarget.name ? editDraft : currentTarget,
    );
    setEditTarget(null);
    setEditDraft(null);
    toast.success("Agent updated");
  }

  function deleteAgent() {
    if (!deleteTarget) {
      return;
    }

    setItems((currentItems) => currentItems.filter((agent) => agent.name !== deleteTarget.name));
    setDetailTarget((currentTarget) =>
      currentTarget?.name === deleteTarget.name ? null : currentTarget,
    );
    setDeleteTarget(null);
    toast.success("Agent deleted");
  }

  function handleFilterSheetOpenChange(open: boolean) {
    setIsFilterSheetOpen(open);

    if (open) {
      setMobileStatusDraft(status);
    }
  }

  function applyMobileFilters() {
    setStatus(mobileStatusDraft);
    setIsFilterSheetOpen(false);
  }

  return (
    <ExamplePageShell
      actions={
        <PageHeaderActionButton>
          <Plus className="size-4" />
          Create
        </PageHeaderActionButton>
      }
      descriptionKey="nav.desc.exampleList"
      titleKey="nav.item.exampleList"
    >
      <div className="space-y-4">
        <ExampleSearchToolbar
          actions={
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Download className="size-4" />
                  Export
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem>Export as CSV</DropdownMenuItem>
                <DropdownMenuItem>Export as JSON</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          }
          isFilterSheetOpen={isFilterSheetOpen}
          mobileStatusDraft={mobileStatusDraft}
          onApplyMobileFilters={applyMobileFilters}
          onFilterSheetOpenChange={handleFilterSheetOpenChange}
          onMobileStatusDraftChange={setMobileStatusDraft}
          onQueryChange={setQuery}
          onResetMobileFilters={() => setMobileStatusDraft("All")}
          onStatusChange={setStatus}
          query={query}
          status={status}
        />

        <div className="overflow-hidden rounded-lg border border-border/50 bg-background">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Agent</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Model</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Runs</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAgents.map((agent) => (
                <TableRow key={agent.name}>
                  <TableCell>
                    <div className="font-medium">{agent.name}</div>
                    <div className="text-xs text-muted-foreground">Production workspace</div>
                  </TableCell>
                  <TableCell>{agent.owner}</TableCell>
                  <TableCell>{agent.model}</TableCell>
                  <TableCell>
                    <StatusBadge status={agent.status} />
                  </TableCell>
                  <TableCell className="text-right font-medium">{agent.runs}</TableCell>
                  <TableCell className="text-right">{agent.cost}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="icon-sm" variant="ghost">
                          <EllipsisVertical className="size-4" />
                          <span className="sr-only">Open row actions</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setDetailTarget(agent)}>
                          View details
                        </DropdownMenuItem>
                        <DropdownMenuItem onSelect={() => openEdit(agent)}>Edit</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onSelect={() => setDeleteTarget(agent)}
                        >
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {filteredAgents.length === 0 ? (
                <TableRow>
                  <TableCell className="h-24 text-center text-muted-foreground" colSpan={7}>
                    No agents found.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>

        <ListPagination onPageChange={() => undefined} page={1} pageSize={20} total={items.length} />
      </div>

      <Sheet
        onOpenChange={(open) => {
          if (!open) {
            setDetailTarget(null);
          }
        }}
        open={Boolean(detailTarget)}
      >
        {detailTarget ? (
          <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b p-6 pr-12">
              <SheetTitle>{detailTarget.name}</SheetTitle>
              <SheetDescription>{detailTarget.owner}</SheetDescription>
            </SheetHeader>
            <div className="faded-bottom min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
              <div className="grid gap-4">
                <DescriptionItem label="Model" value={detailTarget.model} />
                <DescriptionItem label="Status" value={detailTarget.status} />
                <DescriptionItem label="Runs" value={detailTarget.runs} />
                <DescriptionItem label="Cost" value={detailTarget.cost} />
              </div>
              <div className="space-y-4">
                {activities.map((item) => (
                  <ActivityRow key={item.title} {...item} />
                ))}
              </div>
            </div>
            <SheetFooter className="flex-row border-t p-6">
              <Button className="flex-1" onClick={() => openEdit(detailTarget)}>
                Edit
              </Button>
              <Button
                className="flex-1"
                onClick={() => setDeleteTarget(detailTarget)}
                variant="outline"
              >
                Delete
              </Button>
            </SheetFooter>
          </SheetContent>
        ) : null}
      </Sheet>

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setEditTarget(null);
            setEditDraft(null);
          }
        }}
        open={Boolean(editDraft)}
      >
        {editDraft ? (
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit agent</DialogTitle>
              <DialogDescription>Update row fields and keep the table state in sync.</DialogDescription>
            </DialogHeader>
            <form className="grid gap-4" onSubmit={saveEdit}>
            <Field label="Name">
              <Input
                onChange={(event) =>
                  setEditDraft((currentDraft) =>
                    currentDraft ? { ...currentDraft, name: event.target.value } : currentDraft,
                  )
                }
                required
                value={editDraft.name}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Owner">
                <Input
                  onChange={(event) =>
                    setEditDraft((currentDraft) =>
                      currentDraft ? { ...currentDraft, owner: event.target.value } : currentDraft,
                    )
                  }
                  required
                  value={editDraft.owner}
                />
              </Field>
              <Field label="Status">
                <Select
                  onValueChange={(nextStatus) =>
                    setEditDraft((currentDraft) =>
                      currentDraft ? { ...currentDraft, status: nextStatus } : currentDraft,
                    )
                  }
                  value={editDraft.status}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions
                      .filter((item) => item !== "All")
                      .map((item) => (
                        <SelectItem key={item} value={item}>
                          {item}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Model">
              <Input
                onChange={(event) =>
                  setEditDraft((currentDraft) =>
                    currentDraft ? { ...currentDraft, model: event.target.value } : currentDraft,
                  )
                }
                required
                value={editDraft.model}
              />
            </Field>
            <DialogFooter className="pt-2">
              <Button
                onClick={() => {
                  setEditTarget(null);
                  setEditDraft(null);
                }}
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
              <Button type="submit">Save changes</Button>
            </DialogFooter>
          </form>
          </DialogContent>
        ) : null}
      </Dialog>

      <AlertDialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
          }
        }}
        open={Boolean(deleteTarget)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this agent?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.name} will be removed from this example table.`
                : "This row will be removed from this example table."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteAgent}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ExamplePageShell>
  );
}

export function ExampleCardGridPage() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("All");
  const [mobileStatusDraft, setMobileStatusDraft] = useState("All");
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<ExampleAgent | null>(null);
  const filteredAgents = useMemo(
    () =>
      agents.filter((agent) => {
        const matchesQuery = `${agent.name} ${agent.owner} ${agent.model}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesStatus = status === "All" || agent.status === status;
        return matchesQuery && matchesStatus;
      }),
    [query, status],
  );

  function handleFilterSheetOpenChange(open: boolean) {
    setIsFilterSheetOpen(open);

    if (open) {
      setMobileStatusDraft(status);
    }
  }

  function applyMobileFilters() {
    setStatus(mobileStatusDraft);
    setIsFilterSheetOpen(false);
  }

  return (
    <ExamplePageShell
      actions={
        <PageHeaderActionButton>
          <Plus className="size-4" />
          Create
        </PageHeaderActionButton>
      }
      descriptionKey="nav.desc.exampleCards"
      titleKey="nav.item.exampleCards"
    >
      <div className="space-y-4">
        <ExampleSearchToolbar
          actions={
            <Button className="shrink-0" variant="outline">
              <Download className="size-4" />
              Export
            </Button>
          }
          isFilterSheetOpen={isFilterSheetOpen}
          mobileStatusDraft={mobileStatusDraft}
          onApplyMobileFilters={applyMobileFilters}
          onFilterSheetOpenChange={handleFilterSheetOpenChange}
          onMobileStatusDraftChange={setMobileStatusDraft}
          onQueryChange={setQuery}
          onResetMobileFilters={() => setMobileStatusDraft("All")}
          onStatusChange={setStatus}
          query={query}
          status={status}
        />

        {filteredAgents.length ? (
          <div className="space-y-3">
            {filteredAgents.map((agent) => (
              <Card className="overflow-hidden border-border/50" key={agent.name}>
                <CardContent className="p-0">
                  <div className="flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-md border bg-background">
                        <Sparkles className="size-5 text-muted-foreground" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 space-y-1">
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                          <h2 className="truncate text-base font-semibold">{agent.name}</h2>
                          <StatusBadge status={agent.status} />
                        </div>
                        <p className="truncate text-sm text-muted-foreground">
                          {agent.owner} workspace
                        </p>
                      </div>
                    </div>
                    <div className="grid min-w-0 gap-3 sm:grid-cols-4 md:w-[520px]">
                      <DescriptionItem label="Model" value={agent.model} />
                      <DescriptionItem label="Runs" value={agent.runs} />
                      <DescriptionItem label="Cost" value={agent.cost} />
                      <DescriptionItem label="Runtime" value="Production" />
                    </div>
                    <div className="flex shrink-0 items-center gap-2 md:justify-end">
                      <Button onClick={() => setDetailTarget(agent)} size="sm" variant="outline">
                        View
                      </Button>
                      <Button
                        onClick={() => toast.success(`${agent.name} queued for review`)}
                        size="sm"
                      >
                        Review
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t bg-muted/20 px-4 py-3">
                    <Clock3 className="size-4 shrink-0 text-muted-foreground" />
                    <p className="min-w-0 truncate text-sm text-muted-foreground">
                      Last run completed with indexed knowledge and tool-call tracing.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
            <div className="flex size-12 items-center justify-center rounded-lg border bg-background shadow-sm">
              <Search className="size-5 text-muted-foreground" />
            </div>
            <h2 className="mt-6 text-xl font-semibold">No matching cards</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">
              Adjust the search term or status filter to bring cards back into view.
            </p>
          </div>
        )}

        <div className="px-1 text-sm text-muted-foreground">
          {filteredAgents.length} of {agents.length} card(s) shown.
        </div>
      </div>

      <Sheet
        onOpenChange={(open) => {
          if (!open) {
            setDetailTarget(null);
          }
        }}
        open={Boolean(detailTarget)}
      >
        {detailTarget ? (
          <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
            <SheetHeader className="border-b p-6 pr-12">
              <SheetTitle>{detailTarget.name}</SheetTitle>
              <SheetDescription>{detailTarget.owner}</SheetDescription>
            </SheetHeader>
            <div className="faded-bottom min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
              <div className="grid gap-3">
                <DescriptionItem label="Model" value={detailTarget.model} />
                <DescriptionItem label="Status" value={detailTarget.status} />
                <DescriptionItem label="Runs" value={detailTarget.runs} />
                <DescriptionItem label="Cost" value={detailTarget.cost} />
              </div>
              <div className="space-y-4">
                {activities.map((item) => (
                  <ActivityRow key={item.title} {...item} />
                ))}
              </div>
            </div>
            <SheetFooter className="flex-row border-t p-6">
              <Button className="flex-1">Open full page</Button>
              <Button className="flex-1" variant="outline">
                Edit
              </Button>
            </SheetFooter>
          </SheetContent>
        ) : null}
      </Sheet>
    </ExamplePageShell>
  );
}

function ExampleSearchToolbar({
  actions,
  isFilterSheetOpen,
  mobileStatusDraft,
  onApplyMobileFilters,
  onFilterSheetOpenChange,
  onMobileStatusDraftChange,
  onQueryChange,
  onResetMobileFilters,
  onStatusChange,
  query,
  status,
}: {
  actions?: ReactNode;
  isFilterSheetOpen: boolean;
  mobileStatusDraft: string;
  onApplyMobileFilters: () => void;
  onFilterSheetOpenChange: (open: boolean) => void;
  onMobileStatusDraftChange: (value: string) => void;
  onQueryChange: (value: string) => void;
  onResetMobileFilters: () => void;
  onStatusChange: (value: string) => void;
  query: string;
  status: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 gap-2 md:flex-wrap md:items-center">
          <FilterControlField
            className="min-w-0 flex-1 md:flex-none md:w-[340px] xl:w-[420px]"
            label="Agent"
          >
            <div className="relative min-w-0">
              <Search
                aria-hidden="true"
                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                aria-label="Agent"
                className="pl-9 pr-9"
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search by agent, owner, or model"
                value={query}
              />
              {query ? (
                <button
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 inline-flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => onQueryChange("")}
                  type="button"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </FilterControlField>

          <div className="hidden flex-wrap items-center gap-2 md:flex">
            <ExampleStatusFilter onStatusChange={onStatusChange} status={status} />
          </div>

          <div className="shrink-0 self-end md:hidden">
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label="Filters"
              onClick={() => onFilterSheetOpenChange(true)}
            >
              <Filter className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>

      <FilterSheet
        applyLabel="Apply filters"
        onApply={onApplyMobileFilters}
        onOpenChange={onFilterSheetOpenChange}
        onReset={onResetMobileFilters}
        open={isFilterSheetOpen}
        presentation="mobile-only"
        resetLabel="Reset"
        title="Filters"
        description="Choose conditions and apply them to the list."
      >
        <ExampleStatusFilter
          onStatusChange={onMobileStatusDraftChange}
          status={mobileStatusDraft}
          variant="sheet"
        />
      </FilterSheet>
    </div>
  );
}

function ExampleStatusFilter({
  onStatusChange,
  status,
  variant = "inline",
}: {
  onStatusChange: (value: string) => void;
  status: string;
  variant?: "inline" | "sheet";
}) {
  const triggerClassName = variant === "sheet" ? "w-full" : "w-fit max-w-full";

  return (
    <FilterControlField className={variant === "sheet" ? "w-full" : "w-fit"} label="Status">
      <Select onValueChange={onStatusChange} value={status}>
        <SelectTrigger aria-label="Status" className={triggerClassName}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((item) => (
            <SelectItem key={item} value={item}>
              {item}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterControlField>
  );
}

function ExamplePageShell({
  actions,
  children,
  className,
  contentClassName,
  descriptionKey,
  titleKey,
}: {
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  descriptionKey: string;
  titleKey: string;
}) {
  const { t } = useTranslation();

  return (
    <div className={cn("-m-4 px-4 py-6 lg:px-6", className)}>
      <PageHeader title={t(titleKey)} description={t(descriptionKey)} actions={actions} />
      <Separator className="my-4 lg:my-6" />
      <div className={cn("mt-2 space-y-6 pb-6", contentClassName)}>{children}</div>
    </div>
  );
}

export function ExampleSingleColumnFormPage() {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setSubmitting(false);
    toast.success("Draft saved");
  }

  return (
    <ExamplePageShell
      descriptionKey="nav.desc.exampleFormSingle"
      titleKey="nav.item.exampleFormSingle"
    >
      <form className="w-full space-y-6" onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Single-column request form</CardTitle>
            <CardDescription>
              Use this shape for focused create/edit tasks with a linear reading order.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Request title" description="Keep it brief and action-oriented.">
              <Input placeholder="Review agent publishing workflow" required />
            </Field>
            <Field label="Category">
              <Select defaultValue="workflow">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="workflow">Workflow</SelectItem>
                  <SelectItem value="knowledge">Knowledge</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Description" description="Describe the expected result and constraints.">
              <Textarea placeholder="Summarize the current issue, desired outcome, and any approval requirements..." />
            </Field>
            <div className="flex flex-col-reverse gap-2 border-t pt-5 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={submitting} type="submit">
                {submitting ? "Submitting..." : "Submit request"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </ExamplePageShell>
  );
}

export function ExampleMultiColumnFormPage() {
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    setSubmitting(false);
    toast.success("Draft saved");
  }

  return (
    <ExamplePageShell
      descriptionKey="nav.desc.exampleFormMulti"
      titleKey="nav.item.exampleFormMulti"
    >
      <form className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]" onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Agent profile</CardTitle>
            <CardDescription>Basic fields used by create and edit forms.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Name" description="Use a short, recognizable name.">
              <Input placeholder="Support Triage" required />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Owner">
                <Select defaultValue="operations">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="finance">Finance</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Runtime">
                <Select defaultValue="production">
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="production">Production</SelectItem>
                    <SelectItem value="staging">Staging</SelectItem>
                    <SelectItem value="sandbox">Sandbox</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field
              label="System instruction"
              description="Keep it focused on role, boundaries, and escalation rules."
            >
              <Textarea placeholder="You are a support triage agent. Classify incoming requests and route urgent items..." />
            </Field>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Publishing</CardTitle>
              <CardDescription>Side panel pattern for scoped options.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleRow
                description="Allow production users to access this agent."
                label="Available to users"
              />
              <ToggleRow
                description="Require an admin review before each release."
                label="Approval required"
              />
              <Button className="w-full" disabled={submitting} type="submit">
                {submitting ? "Saving..." : "Save draft"}
              </Button>
              <Button className="w-full" type="button" variant="outline">
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </ExamplePageShell>
  );
}

export function ExampleDetailPage() {
  return (
    <ExamplePageShell
      actions={
        <div className="flex items-center gap-2">
          <PageHeaderActionButton variant="outline">
            <Download className="size-4" />
            Export
          </PageHeaderActionButton>
          <PageHeaderActionButton>
            <ArrowUpRight className="size-4" />
            Open run
          </PageHeaderActionButton>
        </div>
      }
      descriptionKey="nav.desc.exampleDetail"
      titleKey="nav.item.exampleDetail"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle>Support Triage</CardTitle>
                <StatusBadge status="Live" />
              </div>
              <CardDescription>
                Production agent for classifying inbound requests, routing urgent issues, and
                collecting handoff context.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-3">
              <DetailStat label="Runs today" value="12,420" />
              <DetailStat label="Success rate" value="99.2%" />
              <DetailStat label="Average latency" value="1.24s" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Configuration</CardTitle>
              <CardDescription>Grouped read-only fields for core resource attributes.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <DescriptionItem label="Owner" value="Operations" />
              <DescriptionItem label="Runtime" value="Production" />
              <DescriptionItem label="Model" value="GPT-4.1" />
              <DescriptionItem label="Knowledge" value="Product FAQ, Policy Center" />
              <DescriptionItem label="Created by" value="Maya Chen" />
              <DescriptionItem label="Last published" value="Today at 09:41" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent activity</CardTitle>
              <CardDescription>Timeline pattern for audits, state changes, and comments.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {activities.map((item) => (
                <ActivityRow key={item.title} {...item} />
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
              <CardDescription>Side panel for high-value summary and actions.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleRow
                description="Allow production users to access this resource."
                label="Available"
              />
              <ToggleRow description="Notify owners when a run fails." label="Failure alerts" />
              <Button className="w-full">Review deployment</Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Related resources</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {["Support workflow", "Product FAQ", "Slack escalation"].map((item) => (
                <div className="flex items-center justify-between rounded-lg border p-3" key={item}>
                  <span className="text-sm font-medium">{item}</span>
                  <ArrowUpRight className="size-4 text-muted-foreground" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </ExamplePageShell>
  );
}

export function ExampleDetailEditPage() {
  const [editing, setEditing] = useState(true);

  return (
    <ExamplePageShell
      actions={
        <div className="flex items-center gap-2">
          <PageHeaderActionButton onClick={() => setEditing(false)} variant="outline">
            <X className="size-4" aria-hidden="true" />
            Cancel
          </PageHeaderActionButton>
          <PageHeaderActionButton onClick={() => toast.success("Changes saved")}>
            <CheckCircle2 className="size-4" />
            Save changes
          </PageHeaderActionButton>
        </div>
      }
      descriptionKey="nav.desc.exampleDetailEdit"
      titleKey="nav.item.exampleDetailEdit"
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Editable profile</CardTitle>
            <CardDescription>Use sectioned forms when a detail page supports updates.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field label="Name">
              <Input defaultValue="Support Triage" disabled={!editing} />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Owner">
                <Select defaultValue="operations" disabled={!editing}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="operations">Operations</SelectItem>
                    <SelectItem value="product">Product</SelectItem>
                    <SelectItem value="revenue">Revenue</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select defaultValue="live" disabled={!editing}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="live">Live</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="System instruction">
              <Textarea
                defaultValue="Classify inbound requests, collect context, and escalate urgent issues."
                disabled={!editing}
              />
            </Field>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Editing state</CardTitle>
              <CardDescription>Show clear affordances for view and edit modes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ToggleRow description="Permit changes to this resource." label="Edit mode" />
              <Button className="w-full" onClick={() => setEditing((value) => !value)}>
                {editing ? "Switch to read-only" : "Switch to edit mode"}
              </Button>
            </CardContent>
          </Card>

          <Card className="border-destructive/30">
            <CardHeader>
              <CardTitle>Danger zone</CardTitle>
              <CardDescription>Destructive actions stay isolated and confirmed.</CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button className="w-full" variant="destructive">
                    Archive resource
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archive this resource?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action removes the resource from active navigation and can affect
                      production users.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => toast.success("Resource archived")}>
                      Archive
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </ExamplePageShell>
  );
}

export function ExampleEmptyStatePage() {
  return (
    <ExamplePageShell
      actions={
        <PageHeaderActionButton>
          <Plus className="size-4" />
          Create resource
        </PageHeaderActionButton>
      }
      descriptionKey="nav.desc.exampleEmpty"
      titleKey="nav.item.exampleEmpty"
    >
      <div className="flex min-h-[420px] flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 px-6 text-center">
        <div className="flex size-12 items-center justify-center rounded-lg border bg-background shadow-sm">
          <Sparkles className="size-5 text-muted-foreground" />
        </div>
        <h2 className="mt-6 text-xl font-semibold">No resources yet</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          Create the first resource or import a starter configuration to populate this workspace.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button>
            <Plus className="size-4" />
            Create resource
          </Button>
          <Button variant="outline">
            <Download className="size-4" />
            Import template
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {["Start from scratch", "Import data", "Invite a teammate"].map((item) => (
          <Card key={item}>
            <CardHeader>
              <CardTitle>{item}</CardTitle>
              <CardDescription>Secondary entry points keep empty pages useful.</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>
    </ExamplePageShell>
  );
}

export function ExampleWizardPage() {
  const [step, setStep] = useState(0);
  const steps = ["Basics", "Configuration", "Review"];
  const isLastStep = step === steps.length - 1;

  return (
    <ExamplePageShell
      descriptionKey="nav.desc.exampleWizard"
      titleKey="nav.item.exampleWizard"
    >
      <div className="grid gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <Card>
          <CardContent className="space-y-2">
            {steps.map((item, index) => (
              <button
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm",
                  index === step ? "bg-muted font-medium" : "text-muted-foreground",
                )}
                key={item}
                onClick={() => setStep(index)}
                type="button"
              >
                <span
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border text-xs",
                    index <= step && "border-primary bg-primary text-primary-foreground",
                  )}
                >
                  {index + 1}
                </span>
                {item}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{steps[step]}</CardTitle>
            <CardDescription>Persist progress between steps and keep actions stable.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {step === 0 ? (
              <>
                <Field label="Resource name">
                  <Input placeholder="Support assistant" />
                </Field>
                <Field label="Description">
                  <Textarea placeholder="Describe the purpose and owners for this resource..." />
                </Field>
              </>
            ) : null}
            {step === 1 ? (
              <>
                <Field label="Runtime">
                  <Select defaultValue="production">
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="production">Production</SelectItem>
                      <SelectItem value="staging">Staging</SelectItem>
                      <SelectItem value="sandbox">Sandbox</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <ToggleRow description="Require review before publishing." label="Approval gate" />
              </>
            ) : null}
            {step === 2 ? (
              <div className="space-y-3 rounded-lg border p-4">
                <DescriptionItem label="Name" value="Support assistant" />
                <DescriptionItem label="Runtime" value="Production" />
                <DescriptionItem label="Approval" value="Required" />
              </div>
            ) : null}
          </CardContent>
          <CardFooter className="justify-between border-t pt-6">
            <Button disabled={step === 0} onClick={() => setStep((value) => value - 1)} variant="outline">
              Back
            </Button>
            <Button
              onClick={() => {
                if (isLastStep) {
                  toast.success("Resource created");
                  return;
                }
                setStep((value) => value + 1);
              }}
            >
              {isLastStep ? "Create resource" : "Continue"}
            </Button>
          </CardFooter>
        </Card>
      </div>
    </ExamplePageShell>
  );
}

export function ExampleDialogFormPage() {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function submitDialog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    await new Promise((resolve) => setTimeout(resolve, 500));
    setSubmitting(false);
    setOpen(false);
    toast.success("Dialog form saved");
  }

  return (
    <ExamplePageShell
      actions={
        <PageHeaderActionButton onClick={() => setOpen(true)}>
          <Plus className="size-4" />
          Open dialog
        </PageHeaderActionButton>
      }
      descriptionKey="nav.desc.exampleDialogForm"
      titleKey="nav.item.exampleDialogForm"
    >
      <Card>
        <CardHeader>
          <CardTitle>Resources</CardTitle>
          <CardDescription>Open a compact form without leaving the current page.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {agents.slice(0, 3).map((agent) => (
            <div className="flex items-center justify-between rounded-lg border p-3" key={agent.name}>
              <div>
                <div className="text-sm font-medium">{agent.name}</div>
                <div className="text-sm text-muted-foreground">{agent.owner}</div>
              </div>
              <Button onClick={() => setOpen(true)} variant="outline">
                Edit
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create resource</DialogTitle>
            <DialogDescription>
              Dialog forms should stay short and keep submission state visible.
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4" onSubmit={submitDialog}>
            <Field label="Name">
              <Input placeholder="Release notes assistant" required />
            </Field>
            <Field label="Owner">
              <Select defaultValue="product">
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="product">Product</SelectItem>
                  <SelectItem value="operations">Operations</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <DialogFooter className="pt-2">
              <Button onClick={() => setOpen(false)} type="button" variant="outline">
                Cancel
              </Button>
              <Button disabled={submitting} type="submit">
                {submitting ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ExamplePageShell>
  );
}

export function ExampleSheetDetailPage() {
  const [selectedAgent, setSelectedAgent] = useState(agents[0]);
  const [open, setOpen] = useState(true);

  return (
    <ExamplePageShell
      actions={
        <PageHeaderActionButton onClick={() => setOpen(true)} variant="outline">
          <ArrowUpRight className="size-4" aria-hidden="true" />
          Open detail
        </PageHeaderActionButton>
      }
      descriptionKey="nav.desc.exampleSheetDetail"
      titleKey="nav.item.exampleSheetDetail"
    >
      <div className="overflow-hidden rounded-lg border border-border/50 bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Agent</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Runs</TableHead>
              <TableHead className="w-24 text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {agents.map((agent) => (
              <TableRow key={agent.name}>
                <TableCell className="font-medium">{agent.name}</TableCell>
                <TableCell>{agent.owner}</TableCell>
                <TableCell>
                  <StatusBadge status={agent.status} />
                </TableCell>
                <TableCell className="text-right">{agent.runs}</TableCell>
                <TableCell className="text-right">
                  <Button
                    onClick={() => {
                      setSelectedAgent(agent);
                      setOpen(true);
                    }}
                    size="sm"
                    variant="outline"
                  >
                    View
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Sheet onOpenChange={setOpen} open={open}>
        <SheetContent className="w-full gap-0 p-0 sm:max-w-md">
          <SheetHeader className="border-b p-6 pr-12">
            <SheetTitle>{selectedAgent.name}</SheetTitle>
            <SheetDescription>{selectedAgent.owner}</SheetDescription>
          </SheetHeader>
          <div className="faded-bottom min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            <div className="grid gap-3">
              <DescriptionItem label="Model" value={selectedAgent.model} />
              <DescriptionItem label="Status" value={selectedAgent.status} />
              <DescriptionItem label="Runs" value={selectedAgent.runs} />
              <DescriptionItem label="Cost" value={selectedAgent.cost} />
            </div>
            <div className="space-y-4">
              {activities.map((item) => (
                <ActivityRow key={item.title} {...item} />
              ))}
            </div>
          </div>
          <SheetFooter className="flex-row border-t p-6">
            <Button className="flex-1">Open full page</Button>
            <Button className="flex-1" variant="outline">
              Edit
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </ExamplePageShell>
  );
}

export function ExampleSettingsPage() {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState(settingsNavItems[0]?.value ?? "general");
  const activeItem =
    settingsNavItems.find((item) => item.value === activeSection) ?? settingsNavItems[0];
  const ActiveIcon = activeItem.icon;

  return (
    <div className="-m-4 flex h-[calc(100vh-4rem)] flex-col px-4 py-6 lg:px-6">
      <div className="shrink-0">
        <PageHeader
          title={t("nav.item.exampleSettings")}
          description={t("nav.desc.exampleSettings")}
        />
        <Separator className="my-4 lg:my-6" />

        <div className="md:hidden">
          <Select value={activeSection} onValueChange={setActiveSection}>
            <SelectTrigger className="w-full">
              <SelectValue>
                <ActiveIcon className="size-4" />
                {activeItem.title}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {settingsNavItems.map((item) => {
                const Icon = item.icon;
                return (
                  <SelectItem key={item.value} value={item.value}>
                    <Icon className="size-4" />
                    {item.title}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 gap-12">
        <aside className="hidden shrink-0 md:block md:w-52">
          <nav className="flex flex-col space-y-1">
            {settingsNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.value === activeSection;

              return (
                <Button
                  className={cn(
                    "justify-start gap-2",
                    isActive
                      ? "bg-muted hover:bg-muted"
                      : "hover:bg-transparent hover:underline",
                  )}
                  key={item.value}
                  onClick={() => setActiveSection(item.value)}
                  type="button"
                  variant="ghost"
                >
                  <Icon className="size-4" />
                  {item.title}
                </Button>
              );
            })}
          </nav>
        </aside>

        <div className="faded-bottom -mx-1 min-h-0 flex-1 overflow-y-auto px-1 pb-10 pt-1">
          {activeSection === "general" ? (
          <SettingsSection
            description="Use this section pattern for account, workspace, or platform settings."
            title="General preferences"
          >
            <Field label="Workspace name">
              <Input defaultValue="Magic Workspace" />
            </Field>
            <Field label="Default language">
              <Select defaultValue={IntlLocale.ZhCN}>
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={IntlLocale.ZhCN}>简体中文</SelectItem>
                  <SelectItem value={IntlLocale.EnUS}>English</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <ToggleRow
              description="Show compact density in data-heavy pages."
              label="Compact interface"
            />
          </SettingsSection>
          ) : null}

          {activeSection === "security" ? (
          <SettingsSection
            description="Security settings use the same section shell and field row rhythm."
            title="Security"
          >
            <ToggleRow
              description="Require a second factor for sensitive configuration changes."
              label="Require step-up verification"
            />
            <ToggleRow
              description="Hide API keys and model credentials by default."
              label="Mask sensitive values"
            />
          </SettingsSection>
          ) : null}

          {activeSection === "automation" ? (
          <SettingsSection
            description="Automation controls demonstrate toggles, selects, and save actions."
            title="Automation"
          >
            <Field label="Default run mode">
              <Select defaultValue="supervised">
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="supervised">Supervised</SelectItem>
                  <SelectItem value="automatic">Automatic</SelectItem>
                  <SelectItem value="manual">Manual only</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <ToggleRow
              description="Send a digest when long-running tasks complete."
              label="Completion digest"
            />
          </SettingsSection>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  previous,
  change,
  icon: Icon,
}: {
  title: string;
  value: string;
  previous: string;
  change: number;
  icon: ComponentType<{ className?: string }>;
}) {
  const positive = change >= 0;

  return (
    <Card className="border">
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <Icon className="size-6 text-muted-foreground" />
          <Badge
            className={cn(
              "gap-1 rounded-full border px-2 py-0.5",
              positive
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-red-200 bg-red-50 text-red-700",
            )}
            variant="outline"
          >
            {positive ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {positive ? "+" : ""}
            {change}%
          </Badge>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <div className="text-2xl font-bold">{value}</div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>from {previous}</span>
            <ArrowUpRight className="size-3" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DetailStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-background p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold">{value}</div>
    </div>
  );
}

function DescriptionItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="text-sm font-medium">{value}</div>
    </div>
  );
}

function ActivityRow({
  description,
  status,
  time,
  title,
}: {
  description: string;
  status: string;
  time: string;
  title: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="mt-1 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted">
        <Clock3 className="size-4 text-muted-foreground" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{title}</p>
          <StatusBadge status={status} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        <p className="mt-2 text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const className =
    status === "Live" || status === "Done"
      ? "border-green-200 bg-green-50 text-green-700"
      : status === "Review" || status === "Pending"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : status === "Paused"
          ? "border-red-200 bg-red-50 text-red-700"
          : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <Badge className={cn("gap-1 rounded-full", className)} variant="outline">
      {status === "Live" || status === "Done" ? <CheckCircle2 className="size-3" /> : null}
      {status}
    </Badge>
  );
}

function Field({
  children,
  description,
  label,
}: {
  children: ReactNode;
  description?: string;
  label: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {description ? <span className="text-sm text-muted-foreground">{description}</span> : null}
    </label>
  );
}

function ToggleRow({ description, label }: { description: string; label: string }) {
  const [checked, setChecked] = useState(true);

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <Switch checked={checked} onCheckedChange={setChecked} />
    </div>
  );
}

function SettingsSection({
  children,
  description,
  title,
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <div className="flex h-full flex-col pt-6">
      <div className="shrink-0">
        <h3 className="text-lg font-medium">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="my-4 h-px bg-border" />
      </div>
      <form
        className="w-full space-y-6 pb-12"
        onSubmit={(event) => {
          event.preventDefault();
          toast.success(`${title} saved`);
        }}
      >
        {children}
        <div className="flex flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-end">
          <Button type="reset" variant="outline">
            Reset
          </Button>
          <Button type="submit">Save changes</Button>
        </div>
      </form>
    </div>
  );
}
