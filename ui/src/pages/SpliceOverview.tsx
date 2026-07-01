import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link as RouterLink } from "react-router-dom";
import {
  Activity,
  AlertTriangle,
  Bot,
  Boxes,
  ExternalLink,
  GitBranch,
  Loader2,
  Map,
  Play,
  RefreshCw,
  ShieldAlert,
  Terminal,
  Users,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { spliceApi, type SpliceWorkspace, type SpliceWorkspaceAgent } from "@/api/splice";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { cn } from "@/lib/utils";

const OVERVIEW_QUERY_KEY = ["splice", "overview"] as const;

const stateStyles: Record<string, string> = {
  running: "bg-emerald-500",
  requested: "bg-amber-500",
  launched: "bg-blue-500",
  error: "bg-red-500",
  blocked: "bg-red-500",
  stale: "bg-orange-500",
  idle: "bg-muted-foreground/40",
};

const stateLabels: Record<string, string> = {
  running: "Running",
  requested: "Requested",
  launched: "Launched",
  error: "Error",
  blocked: "Blocked",
  stale: "Stale",
  idle: "Idle",
};

function formatAge(minutes: number | null | undefined): string {
  if (minutes == null) return "No recent commit";
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${Math.round(minutes)}m ago`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h ago`;
  return `${Math.round(minutes / (60 * 24))}d ago`;
}

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function StatusDot({ state }: { state: string }) {
  const live = state === "running" || state === "requested" || state === "launched";
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {live ? (
        <span className={cn("absolute inline-flex h-full w-full animate-pulse rounded-full opacity-70", stateStyles[state])} />
      ) : null}
      <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", stateStyles[state] ?? stateStyles.idle)} />
    </span>
  );
}

function MetricPanel({
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
    <div className="rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{formatNumber(value)}</p>
          <p className="mt-1 truncate text-sm font-medium text-muted-foreground">{label}</p>
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

function AgentPill({ agent }: { agent: SpliceWorkspaceAgent }) {
  return (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-border bg-background px-2 py-1 text-xs">
      <StatusDot state={agent.status} />
      <span className="truncate font-medium">{agent.name}</span>
      <span className="hidden shrink-0 text-muted-foreground sm:inline">{agent.role}</span>
    </span>
  );
}

function WorkspaceRow({
  workspace,
  launching,
  onRun,
}: {
  workspace: SpliceWorkspace;
  launching: boolean;
  onRun: (workspace: SpliceWorkspace, agent: SpliceWorkspaceAgent) => void;
}) {
  const agent = workspace.primaryAgent;
  const visibleAgents = workspace.agents.slice(0, 5);
  const hiddenAgentCount = Math.max(0, workspace.agentCount - visibleAgents.length);

  return (
    <article className="rounded-lg border border-border bg-card px-4 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <StatusDot state={workspace.state} />
            <RouterLink
              to={`/${workspace.prefix}/dashboard`}
              className="truncate text-base font-semibold text-foreground hover:underline"
            >
              {workspace.name}
            </RouterLink>
            <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {stateLabels[workspace.state] ?? workspace.state}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{workspace.prefix}</span>
            <span>{formatAge(workspace.lastActivityMin)}</span>
            {workspace.path ? <span className="hidden max-w-[420px] truncate font-mono md:inline">{workspace.path}</span> : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => agent && onRun(workspace, agent)}
            disabled={!agent || launching}
            className="gap-1.5"
          >
            {launching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Run
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <RouterLink to={`/workspace-room/${encodeURIComponent(workspace.id)}`}>
              <Map className="h-3.5 w-3.5" />
              Room
            </RouterLink>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <RouterLink to={`/${workspace.prefix}/agents/all`}>
              <Bot className="h-3.5 w-3.5" />
              Agents
            </RouterLink>
          </Button>
          <Button asChild variant="ghost" size="icon-sm" title="Open dashboard">
            <RouterLink to={`/${workspace.prefix}/dashboard`}>
              <ExternalLink className="h-3.5 w-3.5" />
            </RouterLink>
          </Button>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4 xl:grid-cols-7">
        <Signal label="Active" value={workspace.activeReal} />
        <Signal label="Projects" value={workspace.projectsActive} detail={`${workspace.projectsTotal} total`} />
        <Signal label="Issues" value={workspace.issuesActive} />
        <Signal label="Cards" value={workspace.cardsOpen} />
        <Signal label="Agents" value={workspace.agentCount} detail={`${workspace.runningAgents} running`} />
        <Signal label="Sessions" value={workspace.sessions} />
        <Signal label="Blocked" value={workspace.blocked} tone={workspace.blocked > 0 ? "red" : "default"} />
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {visibleAgents.length ? visibleAgents.map((item) => <AgentPill key={item.id} agent={item} />) : (
          <span className="text-sm text-muted-foreground">No configured agents</span>
        )}
        {hiddenAgentCount > 0 ? (
          <span className="inline-flex items-center rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
            +{hiddenAgentCount}
          </span>
        ) : null}
      </div>
    </article>
  );
}

function Signal({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: number;
  detail?: string;
  tone?: "default" | "red";
}) {
  return (
    <div className="min-w-0 rounded-md bg-muted/40 px-3 py-2">
      <p className={cn("text-lg font-semibold tabular-nums", tone === "red" && "text-red-600")}>{formatNumber(value)}</p>
      <p className="truncate text-xs text-muted-foreground">
        {label}
        {detail ? <span className="hidden sm:inline"> · {detail}</span> : null}
      </p>
    </div>
  );
}

export function SpliceOverview() {
  const queryClient = useQueryClient();
  const { setBreadcrumbs } = useBreadcrumbs();
  const overviewQuery = useQuery({
    queryKey: OVERVIEW_QUERY_KEY,
    queryFn: spliceApi.overview,
    refetchInterval: 5_000,
  });
  const runAgentMutation = useMutation({
    mutationFn: ({ companyId, agentId }: { companyId: string; agentId: string }) =>
      spliceApi.runAgent(companyId, agentId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
    },
  });
  const dispatchRunnerMutation = useMutation({
    mutationFn: spliceApi.dispatchRunner,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: OVERVIEW_QUERY_KEY });
    },
  });

  const data = overviewQuery.data;
  const totals = data?.totals;
  const launchingKey = runAgentMutation.variables
    ? `${runAgentMutation.variables.companyId}:${runAgentMutation.variables.agentId}`
    : null;

  useEffect(() => {
    setBreadcrumbs([{ label: "Workspace Overview" }]);
  }, [setBreadcrumbs]);

  if (overviewQuery.isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 w-72 animate-pulse rounded bg-muted" />
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="h-40 animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (overviewQuery.isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-200">
        <div className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4" />
          Could not load Splice overview
        </div>
        <p className="mt-2 text-red-800/80 dark:text-red-200/80">
          {overviewQuery.error instanceof Error ? overviewQuery.error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Splice</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Workspace Overview</h1>
          <p className="mt-1 text-sm text-muted-foreground">{data?.dataSource}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => void overviewQuery.refetch()}
          disabled={overviewQuery.isFetching}
          className="w-fit gap-1.5"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", overviewQuery.isFetching && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {runAgentMutation.isError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {runAgentMutation.error instanceof Error ? runAgentMutation.error.message : "Run request failed"}
        </div>
      ) : null}

      {dispatchRunnerMutation.isError ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {dispatchRunnerMutation.error instanceof Error ? dispatchRunnerMutation.error.message : "Runner dispatch failed"}
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-card px-4 py-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
              <Terminal className="h-4 w-4 text-muted-foreground" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium">Runner</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {formatNumber(data?.runner.pending ?? 0)} pending · {formatNumber(data?.runner.launched ?? 0)} launched · {formatNumber(data?.runner.failed ?? 0)} failed
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            disabled={!data?.runner.canDispatch || dispatchRunnerMutation.isPending}
            onClick={() => dispatchRunnerMutation.mutate()}
            className="w-fit gap-1.5"
          >
            {dispatchRunnerMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            Dispatch Queue
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <MetricPanel icon={Boxes} value={totals?.workspaces ?? 0} label="Workspaces" />
        <MetricPanel icon={Users} value={totals?.agents ?? 0} label="Agents" />
        <MetricPanel icon={Activity} value={totals?.runningAgents ?? 0} label="Running" tone="green" />
        <MetricPanel icon={Play} value={totals?.requestedAgents ?? 0} label="Requested" tone="amber" />
        <MetricPanel icon={GitBranch} value={totals?.sessions ?? 0} label="Sessions" />
        <MetricPanel icon={ShieldAlert} value={totals?.blocked ?? 0} label="Blocked" tone={totals?.blocked ? "red" : "default"} />
      </div>

      <div className="space-y-3">
        {(data?.companies ?? []).map((workspace) => {
          const key = workspace.primaryAgent ? `${workspace.id}:${workspace.primaryAgent.id}` : null;
          return (
            <WorkspaceRow
              key={workspace.id}
              workspace={workspace}
              launching={runAgentMutation.isPending && launchingKey === key}
              onRun={(item, agent) => runAgentMutation.mutate({ companyId: item.id, agentId: agent.id })}
            />
          );
        })}
      </div>
    </div>
  );
}
