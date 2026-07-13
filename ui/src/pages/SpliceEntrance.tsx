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
import { spliceApi, type SpliceTestWorkspaceSummary } from "@/api/splice";
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
  const testWorkspacesQuery = useQuery({
    queryKey: ["splice", "entrance", "test-workspaces"],
    queryFn: spliceApi.testWorkspaces,
  });

  const overview = overviewQuery.data;
  const testWorkspaces = testWorkspacesQuery.data?.workspaces ?? [];

  return (
    <div className="flex min-h-[calc(100dvh-4rem)] flex-col">
      <div className="mb-5 min-w-0">
        <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Splice 입구</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">들어갈 공간 선택</h1>
      </div>

      <div className="grid flex-1 gap-4 xl:grid-cols-2">
        <EntrancePanel
          to="/splice/workspaces"
          eyebrow="왼쪽 입구"
          title="기존 워크스페이스"
          description="현재 등록된 여러 워크스페이스를 읽기 전용으로 살펴봅니다."
          icon={Globe2}
          tone="map"
        >
          <Stat icon={Boxes} label="워크스페이스" value={overview?.totals.workspaces} />
          <Stat icon={Users} label="에이전트" value={overview?.totals.agents} />
          <Stat icon={CircleDot} label="실행 중" value={overview?.totals.runningAgents} tone="green" />
          <Stat icon={ShieldAlert} label="막힘" value={overview?.totals.blocked} tone={overview?.totals.blocked ? "red" : "default"} />
        </EntrancePanel>

        <TestWorkspacePanel workspaces={testWorkspaces} loading={testWorkspacesQuery.isLoading} />
      </div>
    </div>
  );
}

function TestWorkspacePanel({ workspaces, loading }: { workspaces: SpliceTestWorkspaceSummary[]; loading: boolean }) {
  return (
    <section className="flex min-h-[420px] min-w-0 flex-col rounded-lg border border-border bg-card p-5">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">오른쪽 입구</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight md:text-4xl">테스트 프로젝트</h1>
          </div>
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-amber-50 dark:bg-amber-950/20">
            <FlaskConical className="h-5 w-5 text-amber-600" />
          </span>
        </div>
        <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground">
          표준화 전에 실제로 운영해보는 프로젝트를 고릅니다. 각 프로젝트는 자기 폴더와 업무 신호를 따로 읽습니다.
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {loading ? <div className="border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">테스트 프로젝트를 읽는 중...</div> : null}
        {!loading && !workspaces.length ? <div className="border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">연결된 테스트 프로젝트가 없습니다.</div> : null}
        {workspaces.map((workspace) => <TestWorkspaceCard key={workspace.id} workspace={workspace} />)}
      </div>

      <div className="mt-auto border-t border-border pt-4 text-xs text-muted-foreground">
        테스트 프로젝트는 기존 워크스페이스 지도와 분리되어 운영됩니다.
      </div>
    </section>
  );
}

function TestWorkspaceCard({ workspace }: { workspace: SpliceTestWorkspaceSummary }) {
  const stats = workspace.totals;
  const className = cn(
    "group min-w-0 rounded-md border p-4 transition-colors",
    workspace.available
      ? "border-border bg-background hover:border-amber-300 hover:bg-amber-50/50 dark:hover:border-amber-900 dark:hover:bg-amber-950/20"
      : "border-dashed border-border bg-muted/30 opacity-70",
  );
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-lg font-semibold">{workspace.name}</p>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{workspace.path}</p>
        </div>
        <span className={cn("shrink-0 rounded-full px-2 py-1 text-[11px] font-medium", workspace.available ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-muted text-muted-foreground")}>
          {workspace.available ? "연결됨" : "폴더 없음"}
        </span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat icon={Layers3} label="프로젝트" value={stats?.projects} />
        <Stat icon={CircleDot} label="이슈" value={stats?.issues} />
        <Stat icon={Beaker} label="에이전트" value={stats?.agents} tone="amber" />
        <Stat icon={ShieldAlert} label="막힘" value={stats?.blockedIssues} tone={stats?.blockedIssues ? "red" : "default"} />
      </div>
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs font-medium">
        <span>{workspace.available ? "테스트 방 들어가기" : "연결 설정 필요"}</span>
        {workspace.available ? <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /> : null}
      </div>
    </>
  );

  return workspace.available ? <RouterLink to={`/splice/workspace-room/${encodeURIComponent(workspace.id)}`} className={className}>{content}</RouterLink> : <div className={className}>{content}</div>;
}
