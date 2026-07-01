import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock3,
  Flag,
  Layers3,
  Map,
  Play,
  RefreshCw,
  ShieldAlert,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { spliceApi, type SpliceWorkspaceRoomActor, type SpliceWorkspaceRoomProject, type SpliceWorkspaceRoomWorkItem } from "@/api/splice";
import { cn } from "@/lib/utils";

const WORKSPACE_ROOM_QUERY_ROOT = ["splice", "workspace-room"] as const;

const stateStyles: Record<string, { dot: string; ring: string; label: string }> = {
  working: { dot: "bg-emerald-500", ring: "ring-emerald-500/30", label: "Working" },
  reviewing: { dot: "bg-sky-500", ring: "ring-sky-500/30", label: "Reviewing" },
  requested: { dot: "bg-amber-500", ring: "ring-amber-500/30", label: "Requested" },
  queued: { dot: "bg-stone-500", ring: "ring-stone-500/30", label: "Queued" },
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

function compactAgentName(name: string, workspaceName?: string): string {
  const prefix = workspaceName ? new RegExp(`^${workspaceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i") : null;
  return prefix ? name.replace(prefix, "") : name;
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
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{formatNumber(value)}</p>
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

function ActorToken({ actor, workspaceName, onRun, launching }: { actor: SpliceWorkspaceRoomActor; workspaceName?: string; onRun?: (actor: SpliceWorkspaceRoomActor) => void; launching?: boolean }) {
  const style = stateStyles[actor.state] ?? stateStyles.idle;
  return (
    <div
      className="absolute -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${actor.x}%`, top: `${actor.y}%` }}
      title={`${actor.name} · ${stateLabel(actor.state)}`}
    >
      <div className="group relative flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => onRun?.(actor)}
          disabled={!onRun || launching}
          className={cn(
            "flex h-12 w-12 items-center justify-center rounded-full border border-background bg-card text-xs font-semibold shadow-sm ring-4 transition-transform group-hover:scale-105",
            style.ring,
            onRun && "cursor-pointer",
          )}
          aria-label={`${actor.name} ${stateLabel(actor.state)}`}
        >
          {launching ? <RefreshCw className="h-4 w-4 animate-spin" /> : actor.initials}
        </button>
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
  onRun,
  launchingAgentId,
}: {
  agents: SpliceWorkspaceRoomActor[];
  humans: SpliceWorkspaceRoomActor[];
  zones: Array<{ id: string; label: string; x: number; y: number; workCount: number }>;
  workspaceName?: string;
  onRun: (actor: SpliceWorkspaceRoomActor) => void;
  launchingAgentId: string | null;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card xl:col-span-3">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Map className="h-4 w-4 shrink-0 text-muted-foreground" />
          <h2 className="truncate text-sm font-semibold">Live Room</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5"><StateDot state="working" />Working</span>
          <span className="inline-flex items-center gap-1.5"><StateDot state="requested" />Requested</span>
        </div>
      </div>
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
          <ActorToken
            key={actor.id}
            actor={actor}
            workspaceName={workspaceName}
            onRun={onRun}
            launching={launchingAgentId === actor.id}
          />
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
        <h2 className="text-sm font-semibold">{title}</h2>
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
  onRun,
  launchingAgentId,
}: {
  agents: SpliceWorkspaceRoomActor[];
  workspaceName?: string;
  onRun: (actor: SpliceWorkspaceRoomActor) => void;
  launchingAgentId: string | null;
}) {
  return (
    <section className="min-w-0 rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h2 className="text-sm font-semibold">Agents</h2>
      </div>
      <div className="divide-y divide-border">
        {agents.map((agent) => (
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
              size="sm"
              variant="outline"
              className="shrink-0 gap-1.5"
              disabled={launchingAgentId === agent.id || agent.state === "requested"}
              onClick={() => onRun(agent)}
            >
              {launchingAgentId === agent.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run
            </Button>
          </div>
        ))}
      </div>
    </section>
  );
}

export function SpliceWorkspaceRoom() {
  const { workspaceId = "puzzle-game" } = useParams<{ workspaceId?: string }>();
  const queryClient = useQueryClient();
  const queryKey = [...WORKSPACE_ROOM_QUERY_ROOT, workspaceId] as const;
  const roomQuery = useQuery({
    queryKey,
    queryFn: () => spliceApi.workspaceRoom(workspaceId),
    refetchInterval: 5_000,
  });
  const runAgentMutation = useMutation({
    mutationFn: (agentId: string) => spliceApi.runWorkspaceRoomAgent(workspaceId, agentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  const data = roomQuery.data;
  const launchingAgentId = runAgentMutation.isPending ? runAgentMutation.variables ?? null : null;

  const runAgent = (actor: SpliceWorkspaceRoomActor) => {
    runAgentMutation.mutate(actor.id);
  };

  if (roomQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-80 animate-pulse rounded bg-muted" />
        <div className="grid gap-3 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />)}
        </div>
        <div className="h-[420px] animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (roomQuery.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4" />
          Could not load Workspace Room
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
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{data?.name ?? "Workspace"} Live Room</h1>
          <p className="mt-1 truncate text-sm text-muted-foreground">{data?.shortPath}</p>
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

      {runAgentMutation.isError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {runAgentMutation.error instanceof Error ? runAgentMutation.error.message : "Run request failed"}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <Metric icon={Layers3} value={data?.totals.activeProjects ?? 0} label="Active Projects" />
        <Metric icon={CircleDot} value={data?.totals.activeIssues ?? 0} label="In Progress" tone="green" />
        <Metric icon={Clock3} value={data?.totals.reviewIssues ?? 0} label="In Review" tone="amber" />
        <Metric icon={CheckCircle2} value={data?.totals.progress ?? 0} label="Progress %" />
        <Metric icon={Bot} value={data?.totals.activeAgents ?? 0} label="Active Agents" tone="green" />
        <Metric icon={ShieldAlert} value={data?.totals.blockedIssues ?? 0} label="Blocked" tone={data?.totals.blockedIssues ? "red" : "default"} />
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-5">
        <RoomMap
          agents={data?.room.agents ?? []}
          humans={data?.room.humans ?? []}
          zones={data?.room.zones ?? []}
          workspaceName={data?.name}
          onRun={runAgent}
          launchingAgentId={launchingAgentId}
        />
        <div className="min-w-0 space-y-5 xl:col-span-2">
          <section className="min-w-0 rounded-lg border border-border bg-card">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <Flag className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Projects</h2>
            </div>
            <div className="space-y-2 p-3">
              {(data?.projects ?? []).map((project) => <ProjectRow key={project.id} project={project} />)}
            </div>
          </section>
          <AgentRoster agents={data?.agents ?? []} workspaceName={data?.name} onRun={runAgent} launchingAgentId={launchingAgentId} />
        </div>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <WorkLane title="Now" items={data?.lanes.active ?? []} empty="No active work" />
        <WorkLane title="Review" items={data?.lanes.review ?? []} empty="No review work" />
        <WorkLane title="Next" items={data?.lanes.next ?? []} empty="No queued work" />
      </div>

      <section className="min-w-0 rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold">Recent File Activity</h2>
        </div>
        <div className="divide-y divide-border">
          {(data?.activity ?? []).map((item) => (
            <div key={`${item.type}:${item.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{item.ownerName} · {item.status}</p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{formatAge(item.ageMin)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />You: {data?.room.humans[0]?.state ?? "away"}</span>
        <span>{data?.dataSource}</span>
      </div>
    </div>
  );
}
