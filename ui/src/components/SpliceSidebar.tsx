import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Beaker,
  Building2,
  DoorOpen,
  Globe2,
  Map,
} from "lucide-react";
import { useLocation } from "react-router-dom";
import { spliceApi, type SpliceWorkspace } from "@/api/splice";
import { SidebarNavItem } from "./SidebarNavItem";
import { SidebarSection } from "./SidebarSection";
import { cn } from "../lib/utils";

const SPLICE_SIDEBAR_QUERY_KEY = ["splice", "sidebar-overview"] as const;
const SPLICE_TESTBED_QUERY_KEY = ["splice", "sidebar-testbed", "puzzle-game"] as const;

const stateStyles: Record<string, string> = {
  running: "bg-emerald-500",
  requested: "bg-amber-500",
  launched: "bg-blue-500",
  blocked: "bg-red-500",
  stale: "bg-orange-500",
  idle: "bg-muted-foreground/40",
};

function formatCount(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function StateDot({ state }: { state: string }) {
  return (
    <span
      className={cn(
        "h-2 w-2 shrink-0 rounded-full",
        stateStyles[state] ?? stateStyles.idle,
      )}
    />
  );
}

function WorkspaceSignal({ workspace }: { workspace: SpliceWorkspace }) {
  return (
    <div className="flex min-w-0 items-center gap-2 px-3 py-2 text-[13px] font-medium text-foreground/80">
      <StateDot state={workspace.state} />
      <span className="truncate">{workspace.name}</span>
      {workspace.liveRuns > 0 || workspace.runningAgents > 0 ? (
        <span className="ml-auto shrink-0 rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          live
        </span>
      ) : null}
    </div>
  );
}

export function SpliceSidebar() {
  const location = useLocation();
  const isPuzzleTestbed = location.pathname === "/splice/workspace-room/puzzle-game";
  const overviewQuery = useQuery({
    queryKey: SPLICE_SIDEBAR_QUERY_KEY,
    queryFn: spliceApi.overview,
    enabled: !isPuzzleTestbed,
  });
  const testbedQuery = useQuery({
    queryKey: SPLICE_TESTBED_QUERY_KEY,
    queryFn: () => spliceApi.workspaceRoom("puzzle-game"),
    enabled: isPuzzleTestbed,
  });
  const totals = overviewQuery.data?.totals;
  const workspaces = overviewQuery.data?.companies ?? [];
  const testbed = testbedQuery.data;

  return (
    <aside className="flex h-full min-h-0 w-full flex-col border-r border-border bg-background">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground text-background">
          <Globe2 className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">Splice</p>
          <p className="truncate text-[11px] text-muted-foreground">workspace control plane</p>
        </div>
      </div>

      <nav className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-3 py-3 scrollbar-auto-hide">
        <div className="flex flex-col gap-0.5">
          <SidebarNavItem to="/splice" global end label="Entrance" icon={DoorOpen} />
          <SidebarNavItem to="/splice/workspaces" global label="Workspace Map" icon={Globe2} />
          <SidebarNavItem to="/splice/workspace-room/puzzle-game" global label="Puzzle Testbed" icon={Beaker} />
        </div>

        {isPuzzleTestbed ? (
          <div className="rounded-md border border-border bg-card px-3 py-3">
            <div className="flex items-center gap-2">
              <Beaker className="h-4 w-4 text-muted-foreground" />
              <p className="truncate text-sm font-semibold">Puzzle Game</p>
            </div>
            <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
              Single-workspace testbed before rollout
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-md bg-muted/50 px-2.5 py-2">
                <p className="text-base font-semibold tabular-nums">{formatCount(testbed?.totals.projects)}</p>
                <p className="truncate text-[11px] text-muted-foreground">Projects</p>
              </div>
              <div className="rounded-md bg-muted/50 px-2.5 py-2">
                <p className="text-base font-semibold tabular-nums">{formatCount(testbed?.totals.issues)}</p>
                <p className="truncate text-[11px] text-muted-foreground">Issues</p>
              </div>
              <div className="rounded-md bg-muted/50 px-2.5 py-2">
                <p className="text-base font-semibold tabular-nums">{formatCount(testbed?.totals.agents)}</p>
                <p className="truncate text-[11px] text-muted-foreground">Agents</p>
              </div>
              <div className="rounded-md bg-muted/50 px-2.5 py-2">
                <p className="text-base font-semibold tabular-nums">{formatCount(testbed?.totals.progress)}%</p>
                <p className="truncate text-[11px] text-muted-foreground">Progress</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-base font-semibold tabular-nums">{formatCount(totals?.workspaces)}</p>
              <p className="truncate text-[11px] text-muted-foreground">Workspaces</p>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-base font-semibold tabular-nums">{formatCount(totals?.sessions)}</p>
              <p className="truncate text-[11px] text-muted-foreground">Sessions</p>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-base font-semibold tabular-nums">{formatCount(totals?.agents)}</p>
              <p className="truncate text-[11px] text-muted-foreground">Agents</p>
            </div>
            <div className="rounded-md bg-muted/50 px-3 py-2">
              <p className="text-base font-semibold tabular-nums">{formatCount(totals?.blocked)}</p>
              <p className="truncate text-[11px] text-muted-foreground">Blocked</p>
            </div>
          </div>
        )}

        {isPuzzleTestbed ? (
          <SidebarSection label="Puzzle Testbed">
            {testbedQuery.isError ? (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Could not load puzzle testbed
              </div>
            ) : null}
            <SidebarNavItem to="/splice/workspace-room/puzzle-game" global label="Live Room" icon={Map} />
            <SidebarNavItem to="/splice/workspaces" global label="Workspace Map" icon={Globe2} />
          </SidebarSection>
        ) : (
          <SidebarSection label="Workspaces">
            {overviewQuery.isError ? (
              <div className="flex items-center gap-2 px-3 py-2 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" />
                Could not load workspaces
              </div>
            ) : null}
            {overviewQuery.isLoading ? (
              <div className="space-y-1 px-3 py-1">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-7 animate-pulse rounded bg-muted" />
                ))}
              </div>
            ) : workspaces.length ? (
              <div className="flex flex-col gap-0.5">
                {workspaces.map((workspace) => (
                  <WorkspaceSignal key={workspace.id} workspace={workspace} />
                ))}
              </div>
            ) : (
              <div className="px-3 py-2 text-xs text-muted-foreground">No workspaces</div>
            )}
          </SidebarSection>
        )}

        <div className="mt-auto rounded-md border border-border bg-card px-3 py-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <p className="truncate text-xs font-medium">Scope: Splice</p>
          </div>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
            Disk-first signals only
          </p>
        </div>
      </nav>
    </aside>
  );
}
