import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Beaker,
  Boxes,
  ChevronRight,
  CircleDot,
  FlaskConical,
  Globe2,
  Layers3,
  ShieldAlert,
  Users,
  type LucideIcon,
} from "lucide-react";
import { spliceApi } from "@/api/splice";
import { cn } from "@/lib/utils";

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function Stat({ icon: Icon, label, value, tone = "default" }: {
  icon: LucideIcon;
  label: string;
  value: number | null | undefined;
  tone?: "default" | "green" | "amber" | "red";
}) {
  return (
    <div className="min-w-0 rounded-md bg-background/70 px-3 py-2">
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "h-3.5 w-3.5 shrink-0",
            tone === "green" && "text-emerald-600",
            tone === "amber" && "text-amber-600",
            tone === "red" && "text-red-600",
            tone === "default" && "text-muted-foreground",
          )}
        />
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
      </div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{formatNumber(value)}</p>
    </div>
  );
}

function EntrancePanel({
  to,
  eyebrow,
  title,
  description,
  icon: Icon,
  children,
  tone,
}: {
  to: string;
  eyebrow: string;
  title: string;
  description: string;
  icon: LucideIcon;
  children: ReactNode;
  tone: "map" | "testbed";
}) {
  return (
    <RouterLink
      to={to}
      className={cn(
        "group flex min-h-[420px] min-w-0 flex-col justify-between rounded-lg border p-5 transition-colors",
        tone === "map"
          ? "border-border bg-card hover:border-sky-300 hover:bg-sky-50/40 dark:hover:border-sky-900 dark:hover:bg-sky-950/20"
          : "border-border bg-card hover:border-amber-300 hover:bg-amber-50/50 dark:hover:border-amber-900 dark:hover:bg-amber-950/20",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">{eyebrow}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">{title}</h1>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-muted">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </span>
        </div>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">{description}</p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {children}
        </div>
      </div>
      <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-4">
        <span className="text-sm font-medium">Enter</span>
        <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </RouterLink>
  );
}

export function SpliceEntrance() {
  const overviewQuery = useQuery({
    queryKey: ["splice", "entrance", "overview"],
    queryFn: spliceApi.overview,
  });
  const puzzleQuery = useQuery({
    queryKey: ["splice", "entrance", "puzzle-game"],
    queryFn: () => spliceApi.workspaceRoom("puzzle-game"),
  });

  const overview = overviewQuery.data;
  const puzzle = puzzleQuery.data;

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <div className="mb-5 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Splice Entry</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">Choose a Space</h1>
      </div>

      <div className="grid flex-1 gap-4 xl:grid-cols-2">
        <EntrancePanel
          to="/splice/workspaces"
          eyebrow="Left Door"
          title="Existing Workspaces"
          description="All current workspace folders in one read-only map."
          icon={Globe2}
          tone="map"
        >
          <Stat icon={Boxes} label="Workspaces" value={overview?.totals.workspaces} />
          <Stat icon={Users} label="Agents" value={overview?.totals.agents} />
          <Stat icon={CircleDot} label="Running" value={overview?.totals.runningAgents} tone="green" />
          <Stat icon={ShieldAlert} label="Blocked" value={overview?.totals.blocked} tone={overview?.totals.blocked ? "red" : "default"} />
        </EntrancePanel>

        <EntrancePanel
          to="/splice/workspace-room/puzzle-game"
          eyebrow="Right Door"
          title="Puzzle Game Testbed"
          description="One isolated pilot workspace for developing the standard before rollout."
          icon={FlaskConical}
          tone="testbed"
        >
          <Stat icon={Layers3} label="Projects" value={puzzle?.totals.projects} />
          <Stat icon={CircleDot} label="Issues" value={puzzle?.totals.issues} />
          <Stat icon={Beaker} label="Agents" value={puzzle?.totals.agents} tone="amber" />
          <Stat icon={ShieldAlert} label="Blocked" value={puzzle?.totals.blockedIssues} tone={puzzle?.totals.blockedIssues ? "red" : "default"} />
        </EntrancePanel>
      </div>
    </div>
  );
}
