import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Goal, Issue, Project } from "@paperclipai/shared";
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
  Map,
  Play,
  RefreshCw,
  ShieldAlert,
  Target,
  UserRound,
} from "lucide-react";
import { Navigate, useParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { MarkdownBody } from "@/components/MarkdownBody";
import { EntityRow } from "@/components/EntityRow";
import { Identity } from "@/components/Identity";
import { MetricCard } from "@/components/MetricCard";
import { OkrTree } from "@/components/OkrTree";
import { PageTabBar } from "@/components/PageTabBar";
import { StatusBadge } from "@/components/StatusBadge";
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

type RoomTab = "dashboard" | "goals" | "projects" | "issues" | "agents" | "activity" | "details";

const roomTabs: Array<{ value: RoomTab; label: string }> = [
  { value: "dashboard", label: "Dashboard" },
  { value: "goals", label: "Goals" },
  { value: "projects", label: "Projects" },
  { value: "issues", label: "Issues" },
  { value: "agents", label: "Agents" },
  { value: "activity", label: "Activity" },
  { value: "details", label: "Details" },
];

const stateDot: Record<string, string> = {
  working: "bg-emerald-500",
  reviewing: "bg-sky-500",
  requested: "bg-amber-500",
  queued: "bg-stone-500",
  present: "bg-indigo-500",
  away: "bg-muted-foreground/40",
  blocked: "bg-red-500",
  idle: "bg-muted-foreground/40",
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

function compactAgentName(name: string, workspaceName?: string): string {
  const prefix = workspaceName ? new RegExp(`^${workspaceName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+`, "i") : null;
  return prefix ? name.replace(prefix, "") : name;
}

function bodyWithoutFileTitle(body: string | null | undefined): string | null {
  const cleaned = (body ?? "").replace(/^# .*(?:\r?\n)+/, "").trim();
  return cleaned || null;
}

function displayMarkdownBody(body: string | null | undefined): string | null {
  const cleaned = bodyWithoutFileTitle(body)?.replace(/<!--[\s\S]*?-->/g, "").trim();
  return cleaned || null;
}

function plainSummary(body: string | null | undefined, fallback: string): string {
  const cleaned = bodyWithoutFileTitle(body)
    ?.replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/[#*_>\-[\]()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return fallback;
  return cleaned.length > 160 ? `${cleaned.slice(0, 157)}...` : cleaned;
}

function SectionTitle({ title, aside }: { title: string; aside?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <h2 className="text-sm font-semibold tracking-wide">{title}</h2>
      {aside ? <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{aside}</span> : null}
    </div>
  );
}

function Dot({ state }: { state: string }) {
  return <span className={cn("h-2.5 w-2.5 rounded-full", stateDot[state] ?? stateDot.idle)} />;
}

function goalKindLabel(goal: SpliceWorkspaceRoomGoal): string {
  if (goal.kind === "key_result") return "Key Result";
  return goal.kind.replace(/[-_]+/g, " ");
}

function toPaperGoal(goal: SpliceWorkspaceRoomGoal, index: number): Goal {
  return {
    id: goal.slug,
    companyId: PUZZLE_TESTBED_ID,
    title: goal.name,
    description: displayMarkdownBody(goal.description),
    level: (goal.kind === "mission" || goal.kind === "vision" ? "company" : goal.level ?? "team") as Goal["level"],
    status: goal.status as Goal["status"],
    parentId: goal.parentGoalSlug,
    ownerAgentId: null,
    identifier: goal.identifier,
    sortOrder: index,
    kind: goal.kind as Goal["kind"],
    createdAt: new Date(index + 1),
    updatedAt: new Date(index + 1),
  };
}

function toPaperProject(project: SpliceWorkspaceRoomProject, index: number): Project {
  return {
    id: project.id,
    companyId: PUZZLE_TESTBED_ID,
    urlKey: project.id,
    goalId: null,
    goalIds: [],
    goals: [],
    name: project.title,
    description: project.description,
    status: project.status as Project["status"],
    leadAgentId: project.ownerSlug,
    targetDate: null,
    color: null,
    env: null,
    pauseReason: null,
    pausedAt: null,
    executionWorkspacePolicy: null,
    codebase: {
      workspaceId: null,
      repoUrl: null,
      repoRef: null,
      defaultRef: null,
      repoName: null,
      localFolder: null,
      managedFolder: "",
      effectiveLocalFolder: "",
      origin: "local_folder",
    },
    workspaces: [],
    primaryWorkspace: null,
    archivedAt: null,
    identifier: project.id,
    sortOrder: index,
    createdAt: new Date(index + 1),
    updatedAt: new Date(index + 1),
  } as Project;
}

function toPaperIssue(item: SpliceWorkspaceRoomWorkItem, index: number): Issue {
  return {
    id: item.id,
    companyId: PUZZLE_TESTBED_ID,
    projectId: item.projectSlug,
    projectWorkspaceId: null,
    goalId: null,
    parentId: null,
    title: item.title,
    description: item.description,
    status: item.status as Issue["status"],
    workMode: "agent" as Issue["workMode"],
    priority: (item.priority ?? "medium") as Issue["priority"],
    assigneeAgentId: item.ownerSlug,
    assigneeUserId: null,
    checkoutRunId: null,
    executionRunId: null,
    executionAgentNameKey: null,
    executionLockedAt: null,
    createdByAgentId: null,
    createdByUserId: null,
    issueNumber: index + 1,
    identifier: item.id,
    requestDepth: 0,
    billingCode: null,
    assigneeAdapterOverrides: null,
    executionWorkspaceId: null,
    executionWorkspacePreference: null,
    executionWorkspaceSettings: null,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    hiddenAt: null,
    createdAt: new Date(index + 1),
    updatedAt: new Date(index + 1),
  } as Issue;
}

function Header({ data, onRefresh, refreshing }: { data: SpliceWorkspaceRoomData; onRefresh: () => void; refreshing: boolean }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Puzzle Game</span>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">Isolated testbed</span>
        </div>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Puzzle Game</h1>
        <p className="mt-1 text-sm text-muted-foreground">PaperClip workspace surface backed by standard/samples/puzzle-game.</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} className="w-fit gap-1.5">
        <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
        Refresh
      </Button>
    </div>
  );
}

function DashboardTab({ data }: { data: SpliceWorkspaceRoomData }) {
  const issues = [...data.lanes.active, ...data.lanes.review, ...data.lanes.next, ...data.lanes.blocked];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-1 sm:gap-2 xl:grid-cols-4">
        <MetricCard icon={Bot} value={data.totals.activeAgents} label="Agents Enabled" description={`${data.totals.agents} total`} />
        <MetricCard icon={CircleDot} value={data.totals.activeIssues} label="Tasks In Progress" description={`${data.totals.issues} total issues`} />
        <MetricCard icon={Clock3} value={data.totals.reviewIssues} label="In Review" description={`${data.totals.todoIssues} queued next`} />
        <MetricCard icon={ShieldAlert} value={data.totals.blockedIssues} label="Blocked" description={`${data.totals.progress}% progress`} />
      </div>

      <RoomMap data={data} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <SectionTitle title="Recent Activity" />
          <ActivityList items={data.activity.slice(0, 8)} />
        </div>
        <div className="min-w-0 space-y-3">
          <SectionTitle title="Recent Tasks" />
          <WorkItemList items={issues.slice(0, 8)} empty="No tasks yet." />
        </div>
      </div>
    </div>
  );
}

function GoalsTab({ data, goals, projects, issues }: { data: SpliceWorkspaceRoomData; goals: Goal[]; projects: Project[]; issues: Issue[] }) {
  const standards = data.goals.filter((goal) => goal.kind === "mission" || goal.kind === "vision");
  const okrCount = goals.filter((goal) => goal.kind === "objective" || goal.kind === "key_result").length;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionTitle title="Mission · Vision" aside="PaperClip Goals" />
        {standards.length ? (
          <div className="border border-border">
            {standards.map((goal) => (
              <EntityRow
                key={goal.slug}
                title={goal.name}
                subtitle={plainSummary(goal.description, `${goalKindLabel(goal)} · ${goal.status}`)}
                leading={<Target className="h-4 w-4 text-muted-foreground" />}
                trailing={<StatusBadge status={goal.status} ns="goal" />}
              />
            ))}
          </div>
        ) : (
          <p className="border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">No Mission · Vision found.</p>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle title="OKR" aside={`${okrCount} items`} />
        <OkrTree goals={goals} projects={projects} issues={issues} />
      </section>
    </div>
  );
}

function ProjectsTab({ projects }: { projects: SpliceWorkspaceRoomProject[] }) {
  return (
    <div className="space-y-4">
      <SectionTitle title="Projects" aside={`${projects.length} active`} />
      <div className="border border-border">
        {projects.map((project) => (
          <EntityRow
            key={project.id}
            identifier={project.id}
            title={project.title}
            subtitle={plainSummary(project.description, `${project.ownerName} · ${project.issueTotal} issues`)}
            leading={<Flag className="h-4 w-4 text-muted-foreground" />}
            trailing={(
              <div className="flex items-center gap-3">
                <span className="hidden text-xs tabular-nums text-muted-foreground sm:inline">{project.progress}%</span>
                <StatusBadge status={project.status} ns="project" />
              </div>
            )}
          />
        ))}
      </div>
    </div>
  );
}

function IssuesTab({ data }: { data: SpliceWorkspaceRoomData }) {
  const lanes: Array<{ title: string; items: SpliceWorkspaceRoomWorkItem[] }> = [
    { title: "Now", items: data.lanes.active },
    { title: "Review", items: data.lanes.review },
    { title: "Next", items: data.lanes.next },
    { title: "Blocked", items: data.lanes.blocked },
  ];

  return (
    <div className="space-y-6">
      {lanes.map((lane) => (
        <section key={lane.title} className="space-y-3">
          <SectionTitle title={lane.title} aside={`${lane.items.length} issues`} />
          <WorkItemList items={lane.items} empty={`No ${lane.title.toLowerCase()} issues.`} />
        </section>
      ))}
    </div>
  );
}

function AgentsTab({
  data,
  runningAgentId,
  onRunAgent,
}: {
  data: SpliceWorkspaceRoomData;
  runningAgentId: string | null;
  onRunAgent: (agentId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <SectionTitle title="Agents" aside={`${data.agents.length} agents`} />
      <div className="border border-border">
        {data.agents.map((agent) => {
          const isRunning = runningAgentId === agent.id;
          return (
            <EntityRow
              key={agent.id}
              title={compactAgentName(agent.name, data.name)}
              subtitle={`${agent.role} · ${agent.currentWork[0]?.title ?? "No assigned work"}`}
              leading={(
                <>
                  <Dot state={agent.state} />
                  <Identity name={compactAgentName(agent.name, data.name)} initials={agent.initials} size="sm" />
                </>
              )}
              trailing={(
                <div className="flex items-center gap-2">
                  <span className="hidden text-xs text-muted-foreground sm:inline">{agent.state}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onRunAgent(agent.id)}
                    disabled={Boolean(runningAgentId)}
                    className="h-8 gap-1.5"
                  >
                    <Play className={cn("h-3.5 w-3.5", isRunning && "animate-pulse")} />
                    {isRunning ? "Queued" : "Wake"}
                  </Button>
                </div>
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

function ActivityTab({ data }: { data: SpliceWorkspaceRoomData }) {
  return (
    <div className="space-y-4">
      <SectionTitle title="Activity" aside={`${data.activity.length} events`} />
      <ActivityList items={data.activity} />

      <section className="space-y-3">
        <SectionTitle title="Run Queue" aside={`${data.requests.length} requests`} />
        <div className="border border-border">
          {data.requests.length ? data.requests.map((request) => (
            <EntityRow
              key={request.id}
              title={request.agentName}
              subtitle={request.note ?? "No note"}
              leading={<Activity className="h-4 w-4 text-muted-foreground" />}
              trailing={<StatusBadge status={request.status} />}
            />
          )) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">No queued agent runs.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function DetailsTab({ data }: { data: SpliceWorkspaceRoomData }) {
  const detailItems = [
    data.objective ? { id: data.objective.slug, title: data.objective.name, type: goalKindLabel(data.objective), body: data.objective.description } : null,
    ...data.projects.slice(0, 2).map((project) => ({ id: project.id, title: project.title, type: "Project", body: project.description })),
    ...data.lanes.review.slice(0, 2).map((issue) => ({ id: issue.id, title: issue.title, type: "Issue", body: issue.description })),
  ].filter((item): item is { id: string; title: string; type: string; body: string | null } => Boolean(item));

  return (
    <div className="space-y-4">
      <SectionTitle title="Details" aside="PaperClip bodies" />
      <div className="border border-border divide-y divide-border">
        {detailItems.map((item) => {
          const body = displayMarkdownBody(item.body);
          return (
            <article key={item.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.type}</p>
                </div>
              </div>
              {body ? (
                <MarkdownBody className="mt-3 text-sm text-muted-foreground prose-p:my-2 prose-ul:my-2 prose-li:my-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  {body}
                </MarkdownBody>
              ) : (
                <p className="mt-3 text-sm text-muted-foreground">No body found.</p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function WorkItemList({ items, empty }: { items: SpliceWorkspaceRoomWorkItem[]; empty: string }) {
  return (
    <div className="border border-border">
      {items.length ? items.map((item) => (
        <EntityRow
          key={`${item.type}:${item.id}`}
          identifier={item.id}
          title={item.title}
          subtitle={`${item.ownerName} · ${item.projectName || item.type}`}
          leading={<StatusBadge status={item.status} ns={item.type === "project" ? "project" : "issue"} />}
          trailing={<span className="text-xs text-muted-foreground">{formatAge(item.ageMin)}</span>}
        />
      )) : (
        <p className="px-4 py-4 text-sm text-muted-foreground">{empty}</p>
      )}
    </div>
  );
}

function ActivityList({ items }: { items: SpliceWorkspaceRoomData["activity"] }) {
  return (
    <div className="border border-border">
      {items.length ? items.map((item) => (
        <EntityRow
          key={`${item.type}:${item.id}`}
          title={item.title}
          subtitle={`${item.ownerName} · ${item.status}`}
          leading={item.type === "project" ? <Flag className="h-4 w-4 text-muted-foreground" /> : <CircleDot className="h-4 w-4 text-muted-foreground" />}
          trailing={<span className="text-xs text-muted-foreground">{formatAge(item.ageMin)}</span>}
        />
      )) : (
        <p className="px-4 py-4 text-sm text-muted-foreground">No activity yet.</p>
      )}
    </div>
  );
}

function RoomMap({ data }: { data: SpliceWorkspaceRoomData }) {
  return (
    <section className="space-y-3">
      <SectionTitle title="Workspace Room" aside="disk signal overlay" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
        <div
          className="relative h-[300px] overflow-hidden border border-border bg-muted/20"
          style={{
            backgroundImage:
              "linear-gradient(to right, hsl(var(--border) / 0.45) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border) / 0.45) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        >
          {data.room.zones.map((zone) => (
            <div
              key={zone.id}
              className="absolute min-w-24 -translate-x-1/2 -translate-y-1/2 border border-border bg-background/90 px-3 py-2"
              style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
            >
              <p className="text-xs font-semibold">{zone.label}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{formatNumber(zone.workCount)} work</p>
            </div>
          ))}
          {[...data.room.humans, ...data.room.agents].map((actor) => (
            <div
              key={actor.id}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${actor.x}%`, top: `${actor.y}%` }}
              title={`${actor.name} · ${actor.state}`}
            >
              <div className="flex flex-col items-center gap-1">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold shadow-sm">
                  {actor.initials}
                </span>
                <span className="max-w-24 truncate bg-background/95 px-1.5 py-0.5 text-[11px] shadow-sm">
                  {compactAgentName(actor.name, data.name)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="border border-border">
          {data.agents.slice(0, 5).map((agent) => (
            <EntityRow
              key={agent.id}
              title={compactAgentName(agent.name, data.name)}
              subtitle={agent.currentWork[0]?.title ?? "No assigned work"}
              leading={<Dot state={agent.state} />}
              trailing={<span className="text-xs text-muted-foreground">{agent.state}</span>}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export function SpliceWorkspaceRoom() {
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const [activeTab, setActiveTab] = useState<RoomTab>("dashboard");
  const roomQuery = useQuery({
    queryKey: WORKSPACE_ROOM_QUERY_ROOT,
    queryFn: () => spliceApi.workspaceRoom(PUZZLE_TESTBED_ID),
  });
  const runAgentMutation = useMutation({
    mutationFn: (agentId: string) => spliceApi.runWorkspaceRoomAgent(PUZZLE_TESTBED_ID, agentId),
    onSuccess: () => void roomQuery.refetch(),
  });

  const data = roomQuery.data;
  const paperGoals = useMemo(() => (data?.goals ?? []).map(toPaperGoal), [data?.goals]);
  const paperProjects = useMemo(() => (data?.projects ?? []).map(toPaperProject), [data?.projects]);
  const paperIssues = useMemo(
    () => [...(data?.lanes.active ?? []), ...(data?.lanes.review ?? []), ...(data?.lanes.next ?? []), ...(data?.lanes.blocked ?? [])]
      .map(toPaperIssue),
    [data?.lanes.active, data?.lanes.blocked, data?.lanes.next, data?.lanes.review],
  );

  if (workspaceId && workspaceId !== PUZZLE_TESTBED_ID) {
    return <Navigate to={`/splice/workspace-room/${PUZZLE_TESTBED_ID}`} replace />;
  }

  if (roomQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-80 animate-pulse rounded bg-muted" />
        <div className="grid gap-2 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />)}
        </div>
        <div className="h-[360px] animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (roomQuery.isError || !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4" />
          Could not load Puzzle Game
        </div>
        <p className="mt-2 text-red-800/80 dark:text-red-200/80">
          {roomQuery.error instanceof Error ? roomQuery.error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  const runningAgentId = runAgentMutation.isPending ? runAgentMutation.variables ?? null : null;

  return (
    <div className="space-y-6">
      <Header data={data} onRefresh={() => void roomQuery.refetch()} refreshing={roomQuery.isFetching} />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as RoomTab)}>
        <PageTabBar items={roomTabs} value={activeTab} onValueChange={(value) => setActiveTab(value as RoomTab)} align="start" />
      </Tabs>

      {activeTab === "dashboard" && <DashboardTab data={data} />}
      {activeTab === "goals" && <GoalsTab data={data} goals={paperGoals} projects={paperProjects} issues={paperIssues} />}
      {activeTab === "projects" && <ProjectsTab projects={data.projects} />}
      {activeTab === "issues" && <IssuesTab data={data} />}
      {activeTab === "agents" && (
        <AgentsTab
          data={data}
          runningAgentId={runningAgentId}
          onRunAgent={(agentId) => runAgentMutation.mutate(agentId)}
        />
      )}
      {activeTab === "activity" && <ActivityTab data={data} />}
      {activeTab === "details" && <DetailsTab data={data} />}

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" />You: {data.room.humans[0]?.state ?? "away"}</span>
        <span>Data source: {data.dataSource}</span>
      </div>
    </div>
  );
}
