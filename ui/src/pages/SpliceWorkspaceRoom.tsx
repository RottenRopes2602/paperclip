import { useMutation, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileText,
  Flag,
  Layers3,
  ListChecks,
  Map,
  Play,
  RefreshCw,
  ShieldAlert,
  Target,
  UserRound,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Navigate, useParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { MarkdownBody } from "@/components/MarkdownBody";
import {
  spliceApi,
  type SpliceWorkspaceRoomActor,
  type SpliceWorkspaceRoomData,
  type SpliceWorkspaceRoomGoal,
  type SpliceWorkspaceRoomProject,
  type SpliceWorkspaceRoomWorkItem,
} from "@/api/splice";
import { cn } from "@/lib/utils";

const PUZZLE_TESTBED_ID = "puzzle-game";
const WORKSPACE_ROOM_QUERY_ROOT = ["splice", "workspace-room", PUZZLE_TESTBED_ID] as const;

const stateStyles: Record<string, { dot: string; ring: string; label: string }> = {
  working: { dot: "bg-emerald-500", ring: "ring-emerald-500/30", label: "Working" },
  reviewing: { dot: "bg-sky-500", ring: "ring-sky-500/30", label: "Reviewing" },
  requested: { dot: "bg-amber-500", ring: "ring-amber-500/30", label: "Requested" },
  queued: { dot: "bg-stone-500", ring: "ring-border", label: "Queued" },
  present: { dot: "bg-indigo-500", ring: "ring-indigo-500/30", label: "Present" },
  away: { dot: "bg-muted-foreground/40", ring: "ring-border", label: "Away" },
  blocked: { dot: "bg-red-500", ring: "ring-red-500/30", label: "Blocked" },
  idle: { dot: "bg-muted-foreground/40", ring: "ring-border", label: "Idle" },
};

const bucketLabels: Record<string, string> = {
  active: "Now",
  review: "Review",
  todo: "Next",
  blocked: "Blocked",
  done: "Done",
};

const goalKindLabels: Record<string, string> = {
  mission: "Mission",
  vision: "Vision",
  objective: "Objective",
  key_result: "KR",
};

const navItems = [
  { href: "#puzzle-dashboard", label: "Dashboard", icon: Target },
  { href: "#puzzle-goals", label: "Goals", icon: ListChecks },
  { href: "#puzzle-live-room", label: "Live Room", icon: Map },
  { href: "#puzzle-work-board", label: "Work Board", icon: Layers3 },
  { href: "#puzzle-agents", label: "Agents", icon: Bot },
  { href: "#puzzle-activity", label: "Activity", icon: Activity },
  { href: "#puzzle-details", label: "Details", icon: FileText },
];

function formatAge(minutes: number | null | undefined): string {
  if (minutes == null) return "No file age";
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (60 * 24))}d`;
}

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function stateLabel(state: string): string {
  return stateStyles[state]?.label ?? state;
}

function goalKindLabel(kind: string): string {
  return goalKindLabels[kind] ?? kind.replace(/[-_]+/g, " ");
}

function compactAgentName(name: string, workspaceName?: string): string {
  const prefix = workspaceName ? new RegExp(`^${workspaceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i") : null;
  return prefix ? name.replace(prefix, "") : name;
}

function bodyWithoutFileTitle(body: string | null | undefined): string | null {
  const cleaned = (body ?? "").replace(/^# .*(?:\r?\n)+/, "").trim();
  return cleaned || null;
}

function StateDot({ state }: { state: string }) {
  const live = state === "working" || state === "reviewing" || state === "requested" || state === "present";
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {live ? <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", stateStyles[state]?.dot)} /> : null}
      <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", stateStyles[state]?.dot ?? stateStyles.idle.dot)} />
    </span>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  action,
}: {
  icon: LucideIcon;
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <h2 className="truncate text-sm font-semibold">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function Metric({
  icon: Icon,
  value,
  label,
  tone = "default",
}: {
  icon: LucideIcon;
  value: number;
  label: string;
  tone?: "default" | "green" | "amber" | "red";
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums">{formatNumber(value)}</p>
          <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{label}</p>
        </div>
        <Icon
          className={cn(
            "mt-1 h-4 w-4 shrink-0",
            tone === "green" && "text-emerald-600",
            tone === "amber" && "text-amber-600",
            tone === "red" && "text-red-600",
            tone === "default" && "text-muted-foreground",
          )}
        />
      </div>
    </div>
  );
}

function FeatureNav() {
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Puzzle Game testbed sections">
      {navItems.map(({ href, label, icon: Icon }) => (
        <a
          key={href}
          href={href}
          className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-muted-foreground transition hover:text-foreground"
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </a>
      ))}
    </nav>
  );
}

function StatusPill({ children, tone = "default" }: { children: ReactNode; tone?: "default" | "green" | "amber" | "red" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium",
        tone === "default" && "bg-muted text-muted-foreground",
        tone === "green" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
        tone === "amber" && "bg-amber-500/10 text-amber-700 dark:text-amber-300",
        tone === "red" && "bg-red-500/10 text-red-700 dark:text-red-300",
      )}
    >
      {children}
    </span>
  );
}

function DashboardPanel({ data }: { data: SpliceWorkspaceRoomData }) {
  const objectiveName = data.objective?.name ?? "No active objective";
  const objectiveBody = bodyWithoutFileTitle(data.objective?.description);
  const krCount = data.goals.filter((goal) => goal.kind === "key_result").length;
  const attentionCount = data.totals.reviewIssues + data.totals.blockedIssues + data.totals.requests;

  return (
    <section id="puzzle-dashboard" className="scroll-mt-6 rounded-lg border border-border bg-card">
      <SectionHeader icon={Target} title="Dashboard" />
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusPill tone="green">Puzzle-only</StatusPill>
            <StatusPill>{data.mode}</StatusPill>
          </div>
          <h3 className="mt-3 text-xl font-semibold">{objectiveName}</h3>
          {objectiveBody ? (
            <MarkdownBody className="mt-3 text-sm text-muted-foreground prose-p:my-2 prose-ul:my-2 prose-li:my-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
              {objectiveBody}
            </MarkdownBody>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">No objective body found.</p>
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
          <div className="rounded-md border border-border bg-background px-3 py-2">
            <p className="text-lg font-semibold tabular-nums">{formatNumber(krCount)}</p>
            <p className="text-xs text-muted-foreground">Key Results</p>
          </div>
          <div className="rounded-md border border-border bg-background px-3 py-2">
            <p className="text-lg font-semibold tabular-nums">{formatNumber(data.totals.progress)}%</p>
            <p className="text-xs text-muted-foreground">Work Progress</p>
          </div>
          <div className="rounded-md border border-border bg-background px-3 py-2">
            <p className="text-lg font-semibold tabular-nums">{formatNumber(attentionCount)}</p>
            <p className="text-xs text-muted-foreground">Needs Attention</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function GoalCard({ goal }: { goal: SpliceWorkspaceRoomGoal }) {
  const tone = goal.status === "active" ? "green" : goal.status === "blocked" ? "red" : "default";
  const body = bodyWithoutFileTitle(goal.description);
  return (
    <div className="rounded-md border border-border bg-background px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{goal.name}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {goalKindLabel(goal.kind)}{goal.identifier ? ` · ${goal.identifier}` : ""}
          </p>
        </div>
        <StatusPill tone={tone}>{goal.status}</StatusPill>
      </div>
      {body ? (
        <MarkdownBody className="mt-3 line-clamp-5 text-xs text-muted-foreground prose-p:my-1 prose-ul:my-1 prose-li:my-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
          {body}
        </MarkdownBody>
      ) : null}
    </div>
  );
}

function GoalsPanel({ goals }: { goals: SpliceWorkspaceRoomGoal[] }) {
  const foundation = goals.filter((goal) => goal.kind === "mission" || goal.kind === "vision" || goal.kind === "objective");
  const keyResults = goals.filter((goal) => goal.kind === "key_result");

  return (
    <section id="puzzle-goals" className="scroll-mt-6 rounded-lg border border-border bg-card">
      <SectionHeader icon={ListChecks} title="Goals" />
      <div className="grid gap-3 p-4 xl:grid-cols-2">
        <div className="grid gap-3">
          {foundation.length ? foundation.map((goal) => <GoalCard key={goal.slug} goal={goal} />) : (
            <p className="text-sm text-muted-foreground">No mission, vision, or objective found.</p>
          )}
        </div>
        <div className="grid gap-3">
          {keyResults.length ? keyResults.map((goal) => <GoalCard key={goal.slug} goal={goal} />) : (
            <p className="text-sm text-muted-foreground">No key results found.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function ActorToken({ actor, workspaceName }: { actor: SpliceWorkspaceRoomActor; workspaceName?: string }) {
  const style = stateStyles[actor.state] ?? stateStyles.idle;
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${actor.x}%`, top: `${actor.y}%` }}
      title={`${actor.name} · ${stateLabel(actor.state)}`}
    >
      <div className="group relative flex flex-col items-center gap-1">
        <div
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full border border-background bg-card text-xs font-semibold shadow-sm ring-4",
            style.ring,
          )}
        >
          {actor.initials}
        </div>
        <span className="max-w-24 truncate rounded bg-background/95 px-1.5 py-0.5 text-[11px] font-medium shadow-sm">
          {compactAgentName(actor.name, workspaceName)}
        </span>
      </div>
    </div>
  );
}

function RoomMap({
  agents,
  humans,
  zones,
  workspaceName,
}: {
  agents: SpliceWorkspaceRoomActor[];
  humans: SpliceWorkspaceRoomActor[];
  zones: Array<{ id: string; label: string; x: number; y: number; workCount: number }>;
  workspaceName?: string;
}) {
  return (
    <section id="puzzle-live-room" className="min-w-0 scroll-mt-6 rounded-lg border border-border bg-card xl:col-span-3">
      <SectionHeader
        icon={Map}
        title="Live Room"
        action={(
          <div className="hidden items-center gap-3 text-xs text-muted-foreground sm:flex">
            <span className="inline-flex items-center gap-1.5"><StateDot state="working" />Working</span>
            <span className="inline-flex items-center gap-1.5"><StateDot state="requested" />Requested</span>
          </div>
        )}
      />
      <div
        className="relative h-[420px] overflow-hidden bg-muted/20"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--border) / 0.45) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.45) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      >
        {zones.map((zone) => (
          <div
            key={zone.id}
            className="absolute min-w-24 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-border bg-background/80 px-3 py-2 shadow-sm"
            style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
          >
            <p className="text-xs font-semibold">{zone.label}</p>
            <p className="mt-0.5 text-[11px] text-muted-foreground">{formatNumber(zone.workCount)} work</p>
          </div>
        ))}
        {humans.map((actor) => (
          <ActorToken key={actor.id} actor={actor} workspaceName={workspaceName} />
        ))}
        {agents.map((actor) => (
          <ActorToken key={actor.id} actor={actor} workspaceName={workspaceName} />
        ))}
      </div>
    </section>
  );
}

function WorkItemRow({ item }: { item: SpliceWorkspaceRoomWorkItem }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{item.title}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.ownerName} · {item.projectName || item.type}</p>
        </div>
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
          {formatAge(item.ageMin)}
        </span>
      </div>
    </div>
  );
}

function WorkLane({ title, items, empty }: { title: string; items: SpliceWorkspaceRoomWorkItem[]; empty: string }) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="space-y-2 p-3">
        {items.length ? items.map((item) => <WorkItemRow key={`${item.type}:${item.id}`} item={item} />) : (
          <p className="px-1 py-2 text-sm text-muted-foreground">{empty}</p>
        )}
      </div>
    </section>
  );
}

function ProjectRow({ project }: { project: SpliceWorkspaceRoomProject }) {
  return (
    <div className="rounded-md border border-border bg-background px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{project.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {project.ownerName} · {bucketLabels[project.bucket] ?? project.status}
          </p>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{project.progress}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-foreground" style={{ width: `${Math.min(100, Math.max(0, project.progress))}%` }} />
      </div>
      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span>{project.issueTotal} issues</span>
        <span>{project.issueCounts.review} review</span>
        <span>{project.issueCounts.todo} next</span>
      </div>
    </div>
  );
}

function AgentRoster({
  agents,
  workspaceName,
  onRunAgent,
  runningAgentId,
}: {
  agents: SpliceWorkspaceRoomActor[];
  workspaceName?: string;
  onRunAgent: (agentId: string) => void;
  runningAgentId: string | null;
}) {
  return (
    <section id="puzzle-agents" className="min-w-0 scroll-mt-6 rounded-lg border border-border bg-card">
      <SectionHeader icon={Bot} title="Agents" />
      <div className="divide-y divide-border">
        {agents.map((agent) => {
          const isRunning = runningAgentId === agent.id;
          return (
            <div key={agent.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <div className="flex min-w-0 items-center gap-2">
                  <StateDot state={agent.state} />
                  <p className="truncate text-sm font-medium">{compactAgentName(agent.name, workspaceName)}</p>
                </div>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {agent.role} · {stateLabel(agent.state)} · {agent.currentWork[0]?.title ?? "No assigned work"}
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRunAgent(agent.id)}
                disabled={Boolean(runningAgentId)}
                className="h-8 shrink-0 gap-1.5"
              >
                <Play className={cn("h-3.5 w-3.5", isRunning && "animate-pulse")} />
                {isRunning ? "Queued" : "Wake"}
              </Button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ProjectsPanel({ projects }: { projects: SpliceWorkspaceRoomProject[] }) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card">
      <SectionHeader icon={Flag} title="Projects" />
      <div className="space-y-2 p-3">
        {projects.length ? projects.map((project) => <ProjectRow key={project.id} project={project} />) : (
          <p className="px-1 py-2 text-sm text-muted-foreground">No projects found.</p>
        )}
      </div>
    </section>
  );
}

function WorkBoard({ data }: { data: SpliceWorkspaceRoomData }) {
  return (
    <section id="puzzle-work-board" className="scroll-mt-6 space-y-3">
      <div className="flex min-w-0 items-center gap-2">
        <Layers3 className="h-4 w-4 shrink-0 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Work Board</h2>
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-4">
        <WorkLane title="Now" items={data.lanes.active} empty="No active work" />
        <WorkLane title="Review" items={data.lanes.review} empty="No review work" />
        <WorkLane title="Next" items={data.lanes.next} empty="No queued work" />
        <WorkLane title="Blocked" items={data.lanes.blocked} empty="No blocked work" />
      </div>
    </section>
  );
}

function ActivityPanel({ items }: { items: SpliceWorkspaceRoomData["activity"] }) {
  return (
    <section id="puzzle-activity" className="min-w-0 scroll-mt-6 rounded-lg border border-border bg-card">
      <SectionHeader icon={Activity} title="Activity" />
      <div className="divide-y divide-border">
        {items.length ? items.map((item) => (
          <div key={`${item.type}:${item.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{item.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{item.ownerName} · {item.status}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">{formatAge(item.ageMin)}</span>
          </div>
        )) : (
          <p className="px-4 py-4 text-sm text-muted-foreground">No activity found.</p>
        )}
      </div>
    </section>
  );
}

function DetailPanel({ data }: { data: SpliceWorkspaceRoomData }) {
  const detailItems = [
    data.objective ? { id: data.objective.slug, title: data.objective.name, body: data.objective.description } : null,
    data.projects[0] ? { id: data.projects[0].id, title: data.projects[0].title, body: data.projects[0].description } : null,
    data.lanes.review[0] ? { id: data.lanes.review[0].id, title: data.lanes.review[0].title, body: data.lanes.review[0].description } : null,
    data.lanes.next[0] ? { id: data.lanes.next[0].id, title: data.lanes.next[0].title, body: data.lanes.next[0].description } : null,
  ].filter((item): item is { id: string; title: string; body: string | null } => Boolean(item));

  return (
    <section id="puzzle-details" className="scroll-mt-6 rounded-lg border border-border bg-card">
      <SectionHeader icon={FileText} title="Details" />
      <div className="grid gap-3 p-4 xl:grid-cols-2">
        {detailItems.length ? detailItems.map((item) => {
          const body = bodyWithoutFileTitle(item.body);
          return (
            <article key={item.id} className="rounded-md border border-border bg-background px-3 py-3">
              <h3 className="text-sm font-semibold">{item.title}</h3>
              {body ? (
                <MarkdownBody className="mt-2 text-sm text-muted-foreground prose-p:my-2 prose-ul:my-2 prose-li:my-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  {body}
                </MarkdownBody>
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">No body found.</p>
              )}
            </article>
          );
        }) : (
          <p className="text-sm text-muted-foreground">No detail bodies found.</p>
        )}
      </div>
    </section>
  );
}

export function SpliceWorkspaceRoom() {
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const roomQuery = useQuery({
    queryKey: WORKSPACE_ROOM_QUERY_ROOT,
    queryFn: () => spliceApi.workspaceRoom(PUZZLE_TESTBED_ID),
  });
  const runAgentMutation = useMutation({
    mutationFn: (agentId: string) => spliceApi.runWorkspaceRoomAgent(PUZZLE_TESTBED_ID, agentId),
    onSuccess: () => void roomQuery.refetch(),
  });

  if (workspaceId && workspaceId !== PUZZLE_TESTBED_ID) {
    return <Navigate to={`/splice/workspace-room/${PUZZLE_TESTBED_ID}`} replace />;
  }

  const data = roomQuery.data;
  const runningAgentId = runAgentMutation.isPending ? runAgentMutation.variables ?? null : null;

  if (roomQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-80 animate-pulse rounded bg-muted" />
        <div className="grid gap-3 md:grid-cols-6">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />)}
        </div>
        <div className="h-[420px] animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (roomQuery.isError || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4" />
          Could not load Puzzle Game Testbed
        </div>
        <p className="mt-2 text-red-800/80 dark:text-red-200/80">
          {roomQuery.error instanceof Error ? roomQuery.error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Splice Lab</p>
          <h1 className="mt-1 text-2xl font-semibold sm:text-3xl">Puzzle Game Testbed</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">standard/samples/puzzle-game</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void roomQuery.refetch()}
          disabled={roomQuery.isFetching}
          className="w-fit gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", roomQuery.isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      <FeatureNav />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric icon={Layers3} value={data.totals.activeProjects} label="Active Projects" />
        <Metric icon={CircleDot} value={data.totals.activeIssues} label="In Progress" tone="green" />
        <Metric icon={Clock3} value={data.totals.reviewIssues} label="In Review" tone="amber" />
        <Metric icon={CheckCircle2} value={data.totals.progress} label="Progress %" />
        <Metric icon={Bot} value={data.totals.activeAgents} label="Active Agents" tone="green" />
        <Metric icon={ShieldAlert} value={data.totals.blockedIssues} label="Blocked" tone={data.totals.blockedIssues ? "red" : "default"} />
      </div>

      <DashboardPanel data={data} />
      <GoalsPanel goals={data.goals} />

      <div className="grid min-w-0 gap-5 xl:grid-cols-5">
        <RoomMap
          agents={data.room.agents}
          humans={data.room.humans}
          zones={data.room.zones}
          workspaceName={data.name}
        />
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <ProjectsPanel projects={data.projects} />
          <AgentRoster
            agents={data.agents}
            workspaceName={data.name}
            runningAgentId={runningAgentId}
            onRunAgent={(agentId) => runAgentMutation.mutate(agentId)}
          />
        </div>
      </div>

      <WorkBoard data={data} />

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <ActivityPanel items={data.activity} />
        <section className="min-w-0 rounded-lg border border-border bg-card">
          <SectionHeader icon={Zap} title="Run Queue" />
          <div className="space-y-2 p-4">
            {data.requests.length ? data.requests.map((request) => (
              <div key={request.id} className="rounded-md border border-border bg-background px-3 py-2">
                <p className="truncate text-sm font-medium">{request.agentName}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{request.status} · {request.note ?? "No note"}</p>
              </div>
            )) : (
              <p className="text-sm text-muted-foreground">No queued agent runs.</p>
            )}
          </div>
        </section>
      </div>

      <DetailPanel data={data} />

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />You: {data.room.humans[0]?.state ?? "away"}</span>
        <span>Puzzle Game only</span>
      </div>
    </div>
  );
}
