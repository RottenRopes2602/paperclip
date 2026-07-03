import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Goal, Issue, Project } from "@paperclipai/shared";
import {
  Activity,
  AlertTriangle,
  Bot,
  CircleDot,
  Clock3,
  FileText,
  Flag,
  FolderOpen,
  History,
  LayoutDashboard,
  Play,
  RefreshCw,
  Search,
  ShieldAlert,
  SquarePen,
  Target,
  type LucideIcon,
} from "lucide-react";
import { Navigate, useParams } from "@/lib/router";
import { Button } from "@/components/ui/button";
import { BreadcrumbBar } from "@/components/BreadcrumbBar";
import { CompanyPatternIcon } from "@/components/CompanyPatternIcon";
import { MarkdownBody } from "@/components/MarkdownBody";
import { EntityRow } from "@/components/EntityRow";
import { Identity } from "@/components/Identity";
import { MetricCard } from "@/components/MetricCard";
import { MissionVisionCards } from "@/components/MissionVisionCards";
import { OkrTree } from "@/components/OkrTree";
import { PageSkeleton } from "@/components/PageSkeleton";
import { SidebarSection } from "@/components/SidebarSection";
import { StatusBadge } from "@/components/StatusBadge";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useSidebar } from "@/context/SidebarContext";
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

const roomTabs: Array<{ value: RoomTab; label: string; icon: LucideIcon }> = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "goals", label: "Goals", icon: Target },
  { value: "projects", label: "Projects", icon: FolderOpen },
  { value: "issues", label: "Issues", icon: CircleDot },
  { value: "agents", label: "Agents", icon: Bot },
  { value: "activity", label: "Activity", icon: History },
  { value: "details", label: "Details", icon: FileText },
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

function roomTabLabel(tab: RoomTab): string {
  return roomTabs.find((item) => item.value === tab)?.label ?? "Dashboard";
}

function PuzzleSidebarNavItem({
  activeTab,
  item,
  liveCount,
  onSelect,
  textBadge,
}: {
  activeTab: RoomTab;
  item: { value: RoomTab; label: string; icon: LucideIcon };
  liveCount?: number;
  onSelect: (tab: RoomTab) => void;
  textBadge?: string;
}) {
  const Icon = item.icon;
  const active = activeTab === item.value;
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={() => onSelect(item.value)}
      className={cn(
        "flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] font-medium transition-colors",
        active ? "bg-accent text-foreground" : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
      )}
    >
      <span className="relative shrink-0">
        <Icon className="h-4 w-4" />
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {textBadge ? (
        <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
          {textBadge}
        </span>
      ) : null}
      {liveCount != null && liveCount > 0 ? (
        <span className="ml-auto flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500" />
          </span>
          <span className="text-[11px] font-medium text-blue-600 dark:text-blue-400">{liveCount} live</span>
        </span>
      ) : null}
    </button>
  );
}

function PuzzleSidebarMiniItem({
  title,
  subtitle,
  onSelect,
}: {
  title: string;
  subtitle?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="w-full px-3 py-1.5 text-left transition-colors hover:bg-accent/50"
    >
      <p className="truncate text-[13px] font-medium text-foreground/80">{title}</p>
      {subtitle ? <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{subtitle}</p> : null}
    </button>
  );
}

function PuzzleSidebar({
  activeTab,
  data,
  onTabChange,
}: {
  activeTab: RoomTab;
  data: SpliceWorkspaceRoomData;
  onTabChange: (tab: RoomTab) => void;
}) {
  const { isMobile, sidebarOpen, setSidebarOpen } = useSidebar();
  const activeRuns = data.requests.filter((request) => request.status === "requested" || request.status === "launched").length;
  const selectTab = (tab: RoomTab) => {
    onTabChange(tab);
    if (isMobile) setSidebarOpen(false);
  };

  const dashboardItem = roomTabs.find((item) => item.value === "dashboard")!;
  const issueItem = roomTabs.find((item) => item.value === "issues")!;
  const goalItem = roomTabs.find((item) => item.value === "goals")!;
  const projectItem = roomTabs.find((item) => item.value === "projects")!;
  const agentItem = roomTabs.find((item) => item.value === "agents")!;
  const activityItem = roomTabs.find((item) => item.value === "activity")!;
  const detailItem = roomTabs.find((item) => item.value === "details")!;

  return (
    <>
      {isMobile && sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
          aria-label="Close sidebar"
        />
      ) : null}
      <aside
        className={cn(
          "w-60 shrink-0 border-r border-border bg-background",
          "flex h-full min-h-0 flex-col",
          isMobile
            ? cn(
                "fixed inset-y-0 left-0 z-50 pt-[env(safe-area-inset-top)] transition-transform duration-100 ease-out",
                sidebarOpen ? "translate-x-0" : "-translate-x-full",
              )
            : "hidden md:flex",
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-2 px-3">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1">
            <CompanyPatternIcon companyName={data.name} className="h-7 w-7 shrink-0 rounded-md" />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{data.name}</p>
              <p className="truncate text-[11px] text-muted-foreground">PZ · sample workspace</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground"
            aria-label="Search disabled in Puzzle Game testbed"
            disabled
          >
            <Search className="h-4 w-4" />
          </button>
        </div>

        <nav className="scrollbar-auto-hide flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-2">
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              disabled
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-muted-foreground/60"
            >
              <SquarePen className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">New Issue</span>
              <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                Read-only
              </span>
            </button>
            <PuzzleSidebarNavItem activeTab={activeTab} item={dashboardItem} liveCount={activeRuns} onSelect={selectTab} />
          </div>

          <SidebarSection label="Work">
            <PuzzleSidebarNavItem activeTab={activeTab} item={issueItem} onSelect={selectTab} />
            <PuzzleSidebarNavItem activeTab={activeTab} item={goalItem} onSelect={selectTab} />
          </SidebarSection>

          <SidebarSection label="Projects">
            <PuzzleSidebarNavItem activeTab={activeTab} item={projectItem} onSelect={selectTab} textBadge={`${data.projects.length}`} />
            {data.projects.slice(0, 5).map((project) => (
              <PuzzleSidebarMiniItem
                key={project.id}
                title={project.title}
                subtitle={project.id}
                onSelect={() => selectTab("projects")}
              />
            ))}
          </SidebarSection>

          <SidebarSection label="Agents">
            <PuzzleSidebarNavItem activeTab={activeTab} item={agentItem} onSelect={selectTab} textBadge={`${data.agents.length}`} />
            {data.agents.slice(0, 5).map((agent) => (
              <PuzzleSidebarMiniItem
                key={agent.id}
                title={compactAgentName(agent.name, data.name)}
                subtitle={agent.state}
                onSelect={() => selectTab("agents")}
              />
            ))}
          </SidebarSection>

          <SidebarSection label="Company">
            <PuzzleSidebarNavItem activeTab={activeTab} item={activityItem} onSelect={selectTab} />
            <PuzzleSidebarNavItem activeTab={activeTab} item={detailItem} onSelect={selectTab} />
          </SidebarSection>
        </nav>

        <div className="border-t border-border px-3 py-3 text-[11px] text-muted-foreground">
          <p className="truncate">{data.dataSource}</p>
        </div>
      </aside>
    </>
  );
}

function PuzzleWorkspaceShell({
  activeTab,
  children,
  data,
  onRefresh,
  onTabChange,
  refreshing,
}: {
  activeTab: RoomTab;
  children: ReactNode;
  data: SpliceWorkspaceRoomData;
  onRefresh: () => void;
  onTabChange: (tab: RoomTab) => void;
  refreshing: boolean;
}) {
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: roomTabLabel(activeTab) }]);
  }, [activeTab, setBreadcrumbs]);

  return (
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to Main Content
      </a>
      <PuzzleSidebar activeTab={activeTab} data={data} onTabChange={onTabChange} />
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <BreadcrumbBar scope="splice" />
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto p-4 outline-none md:p-6">
          <div className="space-y-6">
            <div className="flex items-center justify-end">
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} className="w-fit gap-1.5">
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                Refresh
              </Button>
            </div>
            {children}
          </div>
        </main>
      </div>
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

function GoalsTab({ goals, projects, issues }: { goals: Goal[]; projects: Project[]; issues: Issue[] }) {
  const okrCount = goals.filter((goal) => goal.kind === "objective" || goal.kind === "key_result").length;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionTitle title="Mission · Vision" aside="absolute standards" />
        <MissionVisionCards goals={goals} goalLink={() => null} />
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
      <SectionTitle title="Workspace Room" aside="sample workspace map" />
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
    return <PageSkeleton variant="dashboard" />;
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
    <PuzzleWorkspaceShell
      data={data}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      onRefresh={() => void roomQuery.refetch()}
      refreshing={roomQuery.isFetching}
    >
      {activeTab === "dashboard" && <DashboardTab data={data} />}
      {activeTab === "goals" && <GoalsTab goals={paperGoals} projects={paperProjects} issues={paperIssues} />}
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
    </PuzzleWorkspaceShell>
  );
}
