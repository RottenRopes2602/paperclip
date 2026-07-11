import { useCallback, useEffect, useMemo, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Goal, Issue, Project } from "@paperclipai/shared";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  CircleDot,
  Clock3,
  FileText,
  Flag,
  FolderOpen,
  GitBranch,
  GitCommit,
  History,
  Inbox,
  Layers,
  LayoutDashboard,
  MessageSquare,
  Play,
  RefreshCw,
  Repeat2,
  Rocket,
  Search,
  Send,
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
import { StatusBadge } from "@/components/StatusBadge";
import { useBreadcrumbs } from "@/context/BreadcrumbContext";
import { useSidebar } from "@/context/SidebarContext";
import {
  spliceApi,
  type SpliceAgentConsoleData,
  type SpliceAgentMessage,
  type SpliceAgentRunRequest,
  type SpliceExecutionLane,
  type SpliceInboxItem,
  type SpliceOfficeApprovalsData,
  type SpliceOfficeInboxData,
  type SpliceOfficeRoutinesData,
  type SpliceOfficeTimelineData,
  type SpliceOfficeTimelineEvent,
  type SpliceReview,
  type SpliceRunDetailData,
  type SpliceRunMonitorData,
  type SpliceRunRuntime,
  type SpliceWorkOrder,
  type SpliceWorkOrdersData,
  type SpliceWorkProduct,
  type SpliceWorkThreadComment,
  type SpliceWorkspaceRoomActor,
  type SpliceWorkspaceRoomData,
  type SpliceWorkspaceRoomGoal,
  type SpliceWorkspaceRoomProject,
  type SpliceWorkspaceRoomWorkItem,
} from "@/api/splice";
import { cn } from "@/lib/utils";

const PUZZLE_TESTBED_ID = "puzzle-game";
const WORKSPACE_ROOM_QUERY_ROOT = ["splice", "workspace-room", PUZZLE_TESTBED_ID] as const;

type RoomTab = "dashboard" | "inbox" | "lanes" | "runs" | "intake" | "goals" | "projects" | "issues" | "desk" | "reviews" | "approvals" | "routines" | "agents" | "comms" | "activity" | "details";
type WorkItemRef = Pick<SpliceWorkspaceRoomWorkItem, "id" | "type">;
type WorkThreadCommentInput = { itemType: string; itemId: string; body: string; wakeAgent?: boolean; sourceRunRequestId?: string | null };

const roomTabs: Array<{ value: RoomTab; label: string; icon: LucideIcon }> = [
  { value: "dashboard", label: "관제", icon: LayoutDashboard },
  { value: "inbox", label: "신호함", icon: Inbox },
  { value: "lanes", label: "작업 사본", icon: GitBranch },
  { value: "runs", label: "실행 현황", icon: Rocket },
  { value: "intake", label: "업무 접수", icon: SquarePen },
  { value: "goals", label: "목표", icon: Target },
  { value: "projects", label: "프로젝트", icon: FolderOpen },
  { value: "issues", label: "이슈", icon: CircleDot },
  { value: "desk", label: "업무 책상", icon: SquarePen },
  { value: "reviews", label: "검수", icon: ShieldAlert },
  { value: "approvals", label: "승인", icon: CheckCircle2 },
  { value: "routines", label: "루틴", icon: Repeat2 },
  { value: "agents", label: "에이전트", icon: Bot },
  { value: "comms", label: "대화", icon: MessageSquare },
  { value: "activity", label: "활동", icon: History },
  { value: "details", label: "상세", icon: FileText },
];

type RoomNavigationGroup = "observe" | "execute" | "work" | "history";

const roomNavigationGroups: Array<{
  value: RoomNavigationGroup;
  label: string;
  icon: LucideIcon;
  defaultTab: RoomTab;
  tabs: RoomTab[];
  advancedTabs: RoomTab[];
}> = [
  { value: "observe", label: "관제", icon: LayoutDashboard, defaultTab: "dashboard", tabs: ["dashboard", "inbox"], advancedTabs: [] },
  { value: "execute", label: "실행", icon: Rocket, defaultTab: "lanes", tabs: ["lanes", "runs", "agents"], advancedTabs: ["comms", "routines"] },
  { value: "work", label: "업무", icon: CircleDot, defaultTab: "issues", tabs: ["issues", "projects", "reviews", "goals"], advancedTabs: ["desk", "intake", "approvals"] },
  { value: "history", label: "기록", icon: History, defaultTab: "activity", tabs: ["activity", "details"], advancedTabs: [] },
];

function roomNavigationGroupForTab(tab: RoomTab): RoomNavigationGroup {
  return roomNavigationGroups.find((group) => group.tabs.includes(tab) || group.advancedTabs.includes(tab))?.value ?? "observe";
}

const stateDot: Record<string, string> = {
  working: "bg-emerald-500",
  assigned: "bg-indigo-500",
  reviewing: "bg-sky-500",
  requested: "bg-amber-500",
  queued: "bg-stone-500",
  present: "bg-indigo-500",
  away: "bg-muted-foreground/40",
  blocked: "bg-red-500",
  idle: "bg-muted-foreground/40",
};

const actorStateTone: Record<string, string> = {
  working: "border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  assigned: "border-indigo-500/45 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200",
  reviewing: "border-sky-500/45 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  requested: "border-amber-500/45 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  queued: "border-stone-500/35 bg-stone-500/10 text-stone-700 dark:text-stone-200",
  present: "border-indigo-500/45 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200",
  away: "border-border bg-muted/50 text-muted-foreground",
  blocked: "border-red-500/45 bg-red-500/10 text-red-700 dark:text-red-200",
  idle: "border-border bg-muted/50 text-muted-foreground",
};

function koStatusLabel(value: string | null | undefined): string {
  const key = String(value ?? "").toLowerCase();
  const labels: Record<string, string> = {
    working: "실제 실행",
    assigned: "업무 배정",
    reviewing: "검수 중",
    requested: "요청됨",
    queued: "대기",
    present: "자리 있음",
    away: "자리 비움",
    blocked: "막힘",
    idle: "대기",
    open: "열림",
    active: "진행 중",
    in_progress: "진행 중",
    review: "검토",
    done: "완료",
    failed: "실패",
    ready: "준비 완료",
    launch_ready: "실행 준비",
    launched: "실행됨",
    running: "실행 중",
    exited: "종료됨",
    stale: "응답 없음",
    terminal: "종료",
    noop: "변경 없음",
    verdict_seen: "결과 확인",
    changes_requested: "수정 요청",
    approved: "승인됨",
    rejected: "반려",
    cancelled: "취소",
    low: "낮음",
    medium: "보통",
    high: "높음",
    urgent: "긴급",
    approval: "승인",
    work_order: "접수 업무",
    message: "메시지",
    run: "실행",
    agent_action: "에이전트 조치",
    branch_change: "브랜치 변경",
    release: "배포",
    scope_change: "범위 변경",
    external_effect: "외부 영향",
  };
  return labels[key] ?? key.replace(/_/g, " ");
}

const spritePalettes = [
  { skin: "#f2c9a5", hair: "#27211f", shirt: "#2f7dd3", accent: "#9ad1ff", pants: "#24304a", desk: "#273447", deskTop: "#3f5870" },
  { skin: "#d7a47c", hair: "#16171a", shirt: "#2f9e77", accent: "#9be6c4", pants: "#233c34", desk: "#263b35", deskTop: "#3e5d50" },
  { skin: "#f0b894", hair: "#5b3425", shirt: "#d97706", accent: "#ffd18a", pants: "#3d2d25", desk: "#3d3328", deskTop: "#6b4d32" },
  { skin: "#c99673", hair: "#2d251f", shirt: "#7c5cff", accent: "#c7b8ff", pants: "#2b2947", desk: "#332d4a", deskTop: "#52427c" },
  { skin: "#f1d2b7", hair: "#3a2a24", shirt: "#d43f5e", accent: "#ffb3c1", pants: "#422636", desk: "#442a34", deskTop: "#713a50" },
  { skin: "#b98563", hair: "#1f1f1f", shirt: "#14a6a6", accent: "#9bf2f2", pants: "#1f3b42", desk: "#233d43", deskTop: "#3b6870" },
];

const laneStateClass: Record<string, string> = {
  active: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  ahead: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  dirty: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  idle: "border-border bg-muted/40 text-muted-foreground",
  queued: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  running: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  stale: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300",
};

function formatAge(minutes: number | null | undefined): string {
  if (minutes == null) return "기록 없음";
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${Math.round(minutes)}분`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}시간`;
  return `${Math.round(minutes / (60 * 24))}일`;
}

function formatIsoAge(value: string | null | undefined): string {
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time)) return "신호 없음";
  return formatAge((Date.now() - time) / 60000);
}

const runtimeTone: Record<string, string> = {
  queued: "border-stone-500/40 bg-stone-500/10 text-stone-600 dark:text-stone-300",
  ready: "border-sky-500/40 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  launched: "border-blue-500/40 bg-blue-500/10 text-blue-600 dark:text-blue-300",
  running: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  exited: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  stale: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300",
  terminal: "border-border bg-muted/45 text-muted-foreground",
  done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  failed: "border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300",
  blocked: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  noop: "border-stone-500/40 bg-stone-500/10 text-stone-600 dark:text-stone-300",
  verdict_seen: "border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300",
};

function runtimeLabel(runtime: SpliceRunRuntime | null | undefined, status: string): string {
  if (runtime?.verdict?.label) return runtime.verdict.label;
  if (runtime?.stale) return "프로세스 종료";
  if (runtime?.state) return koStatusLabel(runtime.state);
  return koStatusLabel(status);
}

function RunRuntimePill({
  runtime,
  status,
}: {
  runtime?: SpliceRunRuntime | null;
  status: string;
}) {
  const state = runtime?.stale ? "stale" : runtime?.state ?? status;
  const label = runtimeLabel(runtime, status);
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
      runtimeTone[state] ?? runtimeTone.terminal,
    )}>
      {label}
    </span>
  );
}

function formatIsoSchedule(value: string | null | undefined): string {
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time)) return "일정 없음";
  const minutes = Math.round((time - Date.now()) / 60000);
  if (minutes <= 0) return "지금 실행";
  if (minutes < 60) return `${minutes}분 후`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}시간 후`;
  return `${Math.round(minutes / (60 * 24))}일 후`;
}

function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat("en-US").format(value ?? 0);
}

function formatBytes(value: number | null | undefined): string {
  const bytes = value ?? 0;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

function LaneStatePill({ state }: { state: string }) {
  const labels: Record<string, string> = {
    active: "최근 활동",
    ahead: "푸시 대기",
    dirty: "수정 중",
    idle: "대기",
    queued: "실행 대기",
    running: "실행 중",
    stale: "오래됨",
  };
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
      laneStateClass[state] ?? laneStateClass.idle,
    )}>
      {labels[state] ?? state.replace(/_/g, " ")}
    </span>
  );
}

function laneIcon(lane: SpliceExecutionLane): LucideIcon {
  if (lane.kind === "main") return Layers;
  if (lane.kind === "codex" || lane.kind === "agent") return Bot;
  if (lane.kind === "claude" || lane.kind === "conductor") return Activity;
  return GitBranch;
}

function Dot({ state }: { state: string }) {
  return <span className={cn("h-2.5 w-2.5 rounded-full", stateDot[state] ?? stateDot.idle)} />;
}

function textHash(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
  }
  return Math.abs(hash);
}

function roomPercent(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : 50));
}

function actorPalette(actor: SpliceWorkspaceRoomActor) {
  if (actor.slug === "you" || actor.role === "operator") return spritePalettes[3];
  return spritePalettes[textHash(`${actor.slug}-${actor.role}`) % spritePalettes.length];
}

function actorWorkLine(actor: SpliceWorkspaceRoomActor): string {
  const current = actor.currentWork[0]?.title;
  if (current) return current;
  if (actor.session) return `${actor.session.branch} · ${actor.session.dirty} dirty`;
  if (actor.request) return "실행 요청됨";
  return actor.state === "away" ? "자리 비움" : "업무 대기";
}

function actorRoomLine(actor: SpliceWorkspaceRoomActor): string {
  const counts = [
    actor.activeCount ? `진행 ${actor.activeCount}` : null,
    actor.reviewCount ? `검수 ${actor.reviewCount}` : null,
    actor.queuedCount ? `대기 ${actor.queuedCount}` : null,
  ].filter(Boolean);
  if (counts.length) return counts.join(" · ");
  if (actor.session) return `${actor.session.branch} · 변경 ${actor.session.dirty}`;
  if (actor.request) return "실행 요청됨";
  return actor.state === "away" ? "활성 작업 사본 없음" : "대기 중";
}

function actorStateLabel(actor: SpliceWorkspaceRoomActor): string {
  if (actor.state === "working") return "실행 중";
  if (actor.state === "assigned") return "업무 배정";
  if (actor.state === "reviewing") return "검수 중";
  if (actor.state === "requested") return "실행 대기";
  if (actor.state === "blocked") return "막힘";
  if (actor.state === "present") return "자리 있음";
  if (actor.state === "away") return "자리 비움";
  return actor.state.replace(/[-_]+/g, " ");
}

function actorOfficePosition(actor: SpliceWorkspaceRoomActor, slotIndex: number) {
  if (actor.slug === "you" || actor.role === "operator") return { x: 17, y: 73 };
  const seats: Record<string, Array<{ x: number; y: number }>> = {
    strategy: [
      { x: 22, y: 31 },
      { x: 31, y: 31 },
    ],
    design: [
      { x: 32, y: 46 },
      { x: 42, y: 59 },
      { x: 28, y: 61 },
    ],
    build: [
      { x: 55, y: 54 },
      { x: 58, y: 69 },
    ],
    review: [
      { x: 72, y: 39 },
      { x: 82, y: 59 },
      { x: 72, y: 68 },
    ],
    backlog: [
      { x: 32, y: 73 },
      { x: 31, y: 83 },
    ],
    blocked: [
      { x: 82, y: 76 },
    ],
    done: [
      { x: 55, y: 82 },
    ],
  };
  const zoneSeats = seats[actor.zone] ?? [{ x: actor.x, y: actor.y }];
  return zoneSeats[slotIndex % zoneSeats.length];
}

function PixelGrid({
  rows,
  colors,
  pixel = 4,
  className,
}: {
  rows: string[];
  colors: Record<string, string>;
  pixel?: number;
  className?: string;
}) {
  const width = Math.max(...rows.map((row) => row.length));
  const cells = rows.flatMap((row, y) =>
    row.padEnd(width, " ").split("").map((key, x) => ({
      key: `${y}-${x}`,
      color: colors[key] ?? "transparent",
    })),
  );

  return (
    <div
      className={cn("grid shrink-0", className)}
      style={{
        gridTemplateColumns: `repeat(${width}, ${pixel}px)`,
        gridAutoRows: `${pixel}px`,
        imageRendering: "pixelated",
      }}
      aria-hidden="true"
    >
      {cells.map((cell) => (
        <span key={cell.key} className="block" style={{ backgroundColor: cell.color }} />
      ))}
    </div>
  );
}

function actorPixelColors(actor: SpliceWorkspaceRoomActor) {
  const palette = actorPalette(actor);
  return {
    o: "#101014",
    h: palette.hair,
    s: palette.skin,
    t: palette.shirt,
    a: palette.accent,
    p: palette.pants,
    d: palette.desk,
    D: palette.deskTop,
    m: "#0b1017",
    l: palette.accent,
    k: "#050507",
    w: "rgba(255,255,255,0.72)",
    g: actor.state === "blocked" ? "#ef4444" : actor.state === "reviewing" ? "#38bdf8" : actor.state === "requested" ? "#f59e0b" : actor.state === "assigned" ? "#818cf8" : "#10b981",
  };
}

function PixelAvatar({ actor }: { actor: SpliceWorkspaceRoomActor }) {
  const rows = [
    "      oooooo      ",
    "     ohhhhho     ",
    "     ohsssho     ",
    "    ohswwsho     ",
    "    ohssssho     ",
    "     osssso      ",
    "      ottto      ",
    "    ootttttoo    ",
    "   osstaaattso   ",
    "   ossttttttso   ",
    "      tttt       ",
    "      p  p       ",
    "     pp  pp      ",
    "    opp  ppo     ",
  ];

  return (
    <div className="absolute bottom-[34px] left-1/2 z-30 -translate-x-1/2">
      <PixelGrid rows={rows} colors={actorPixelColors(actor)} pixel={4} />
    </div>
  );
}

function Workstation({ actor }: { actor: SpliceWorkspaceRoomActor }) {
  const active = actor.state === "working" || actor.state === "reviewing" || actor.state === "requested";
  const rows = [
    "        oooooooooo        ",
    "        ommmmmmmmo        ",
    "        omlglllmo        ",
    "        omlllllmo        ",
    "          oooooo         ",
    "           oooo          ",
    "   oDDDDDDDDDDDDDDDDo    ",
    "   odDDDDDDDDDDDDDDdo    ",
    "   oddddddddddddddddo    ",
    "     od          do      ",
    "     od          do      ",
  ];

  return (
    <div className={cn("absolute inset-x-0 bottom-0 z-20 flex justify-center", active ? "brightness-110" : "")}>
      <PixelGrid rows={rows} colors={actorPixelColors(actor)} pixel={4} />
    </div>
  );
}

function PixelRoomProp({ kind, className }: { kind: "terminal" | "board"; className?: string }) {
  const colors = {
    o: "#101014",
    b: "#1b2230",
    B: "#2e3c54",
    g: "#20d18f",
    w: "#c8f7ff",
    y: "#f2c14e",
    r: "#e25555",
  };
  const rows = kind === "terminal"
    ? [
      "  oooooooooooo  ",
      "  obbbbbbbbbbo  ",
      "  obgggggggbbo  ",
      "  obbbbbbbbbbo  ",
      "    oooooooo    ",
      "     oooooo     ",
    ]
    : [
      "oooooooooooooo",
      "owwwwwwwwwwwo",
      "owgywwwwryywo",
      "owwwwwwwwwwwo",
      "oooooooooooooo",
    ];

  return (
    <div className={cn("absolute z-0 opacity-90", className)}>
      <PixelGrid rows={rows} colors={colors} pixel={4} />
    </div>
  );
}

function OfficeRoom({ label, className }: { label: string; className: string }) {
  return (
    <div className={cn(
      "absolute z-0 border-4 border-[#25313b] bg-[#111821]/78 shadow-[5px_5px_0_rgba(0,0,0,0.45)]",
      className,
    )}>
      <div className="absolute left-2 top-2 border-2 border-black bg-[#162536] px-2 py-1 font-mono text-[10px] font-bold uppercase leading-none text-cyan-100 shadow-[2px_2px_0_rgba(0,0,0,0.45)]">
        {label}
      </div>
    </div>
  );
}

function PixelFurniture({
  kind,
  className,
}: {
  kind: "meeting" | "desk-island" | "desk" | "server" | "shelf" | "plant";
  className?: string;
}) {
  if (kind === "plant") {
    return (
      <div className={cn("absolute z-0", className)} aria-hidden="true">
        <div className="mx-auto h-3 w-3 bg-emerald-500 shadow-[-4px_4px_0_#1f7a4c,4px_4px_0_#1f7a4c]" />
        <div className="mx-auto h-4 w-4 border-2 border-black bg-[#7c4a2d]" />
      </div>
    );
  }

  const shared = "absolute z-0 border-4 border-black shadow-[4px_4px_0_rgba(0,0,0,0.45)]";
  const classes = {
    meeting: "h-16 w-28 bg-[#5f4935] before:absolute before:left-3 before:top-3 before:h-2 before:w-20 before:bg-[#9b7652] after:absolute after:bottom-2 after:left-5 after:h-2 after:w-14 after:bg-black/35",
    "desk-island": "h-20 w-36 bg-[#263748] before:absolute before:left-4 before:top-4 before:h-4 before:w-24 before:bg-[#3c5a74] after:absolute after:bottom-3 after:left-8 after:h-3 after:w-20 after:bg-black/30",
    desk: "h-14 w-24 bg-[#283b4e] before:absolute before:left-4 before:top-3 before:h-3 before:w-14 before:bg-[#4f7390] after:absolute after:bottom-2 after:left-5 after:h-2 after:w-14 after:bg-black/35",
    server: "h-24 w-12 bg-[#141820] before:absolute before:left-2 before:top-3 before:h-2 before:w-6 before:bg-emerald-400 after:absolute after:left-2 after:top-9 after:h-2 after:w-7 after:bg-sky-400",
    shelf: "h-16 w-28 bg-[#2d241c] before:absolute before:left-2 before:top-4 before:h-2 before:w-20 before:bg-[#806246] after:absolute after:left-2 after:bottom-4 after:h-2 after:w-20 after:bg-[#806246]",
  } satisfies Record<Exclude<typeof kind, "plant">, string>;

  return <div className={cn(shared, classes[kind], className)} aria-hidden="true" />;
}

function OfficeLayout() {
  return (
    <>
      <div className="absolute inset-3 z-0 border-4 border-[#293640] shadow-[inset_0_0_0_4px_rgba(0,0,0,0.35)]" />
      <div className="absolute left-[4%] right-[4%] top-[12%] z-0 h-1 bg-[#293640]" />
      <div className="absolute left-[4%] right-[4%] bottom-[22%] z-0 h-1 bg-[#293640]" />
      <div className="absolute bottom-[22%] left-[25%] top-[12%] z-0 w-1 bg-[#293640]" />
      <div className="absolute bottom-[22%] left-[48%] top-[12%] z-0 w-1 bg-[#293640]" />
      <div className="absolute bottom-[22%] right-[24%] top-[12%] z-0 w-1 bg-[#293640]" />
      <OfficeRoom label="회의" className="left-[5%] top-[5%] h-[27%] w-[24%]" />
      <OfficeRoom label="설계" className="left-[27%] top-[16%] h-[41%] w-[22%]" />
      <OfficeRoom label="구현" className="left-[50%] top-[16%] h-[48%] w-[24%]" />
      <OfficeRoom label="검토" className="right-[5%] top-[16%] h-[48%] w-[20%]" />
      <OfficeRoom label="운영자" className="bottom-[5%] left-[5%] h-[22%] w-[25%]" />
      <OfficeRoom label="출시" className="bottom-[5%] left-[37%] h-[22%] w-[22%]" />
      <OfficeRoom label="인프라" className="bottom-[5%] right-[5%] h-[22%] w-[26%]" />
      <PixelFurniture kind="meeting" className="left-[11%] top-[18%]" />
      <PixelFurniture kind="desk-island" className="left-[31%] top-[35%]" />
      <PixelFurniture kind="desk" className="left-[55%] top-[39%]" />
      <PixelFurniture kind="desk" className="right-[9%] top-[31%]" />
      <PixelFurniture kind="desk" className="left-[10%] bottom-[9%]" />
      <PixelFurniture kind="shelf" className="left-[42%] bottom-[10%]" />
      <PixelFurniture kind="server" className="right-[11%] bottom-[9%]" />
      <PixelFurniture kind="plant" className="left-[3%] bottom-[30%]" />
      <PixelFurniture kind="plant" className="right-[3%] top-[7%]" />
      <PixelRoomProp kind="board" className="left-[7%] top-[9%]" />
      <PixelRoomProp kind="terminal" className="right-[13%] bottom-[33%]" />
    </>
  );
}

function OfficeWorkProductStack({ count, onClick }: { count: number; onClick: () => void }) {
  if (count <= 0) return null;
  const sheets = Array.from({ length: Math.min(5, count) });

  return (
    <button
      type="button"
      onClick={onClick}
      title={`산출물 ${count}개`}
      className="absolute bottom-[23%] left-[39%] z-10 h-20 w-28 border-4 border-black bg-[#151b22] shadow-[5px_5px_0_rgba(0,0,0,0.5)] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-300"
    >
      <div className="absolute inset-x-3 bottom-4 h-5 border-2 border-black bg-[#5b4631] shadow-[3px_3px_0_rgba(0,0,0,0.45)]" />
      {sheets.map((_, index) => (
        <span
          key={index}
          className="absolute h-7 w-10 border-2 border-black bg-[#e8f1dc] shadow-[2px_2px_0_rgba(0,0,0,0.38)]"
          style={{
            left: `${18 + index * 8}px`,
            bottom: `${30 + index * 3}px`,
          }}
        >
          <span className="absolute left-1 top-2 h-0.5 w-6 bg-[#7ca2a8]" />
          <span className="absolute left-1 top-4 h-0.5 w-5 bg-[#b4865c]" />
        </span>
      ))}
      <span className="absolute -right-3 -top-3 border-2 border-black bg-emerald-400 px-2 py-1 font-mono text-[11px] font-black leading-none text-black shadow-[2px_2px_0_rgba(0,0,0,0.5)]">
        {count}
      </span>
    </button>
  );
}

function workOrderOfficePosition(order: SpliceWorkOrder, index: number) {
  const slots: Record<string, Array<{ x: number; y: number }>> = {
    requested: [
      { x: 15, y: 40 },
      { x: 23, y: 48 },
    ],
    queued: [
      { x: 33, y: 24 },
      { x: 42, y: 35 },
      { x: 33, y: 54 },
    ],
    in_progress: [
      { x: 55, y: 30 },
      { x: 64, y: 47 },
      { x: 58, y: 63 },
    ],
    review: [
      { x: 80, y: 28 },
      { x: 84, y: 48 },
    ],
    blocked: [
      { x: 86, y: 68 },
      { x: 78, y: 74 },
    ],
    failed: [
      { x: 86, y: 68 },
      { x: 78, y: 74 },
    ],
    done: [
      { x: 48, y: 80 },
      { x: 57, y: 80 },
    ],
  };
  const statusSlots = slots[order.status] ?? slots.queued;
  return statusSlots[index % statusSlots.length];
}

function workOrderMarkerTone(order: SpliceWorkOrder): string {
  if (order.status === "blocked" || order.status === "failed") return "bg-red-300";
  if (order.status === "review") return "bg-sky-300";
  if (order.status === "in_progress") return "bg-emerald-300";
  if (order.status === "done") return "bg-lime-300";
  if (order.priority === "urgent" || order.priority === "high") return "bg-amber-300";
  return "bg-[#e7d57a]";
}

function OfficeWorkOrderMarker({
  data,
  index,
  order,
  onOpen,
}: {
  data: SpliceWorkspaceRoomData;
  index: number;
  order: SpliceWorkOrder;
  onOpen: () => void;
}) {
  const position = workOrderOfficePosition(order, index);
  const left = roomPercent(position.x, 8, 92);
  const top = roomPercent(position.y, 18, 84);
  return (
    <button
      type="button"
      onClick={onOpen}
      title={`${order.title} · ${order.status}`}
      className={cn(
        "absolute z-10 w-28 -translate-x-1/2 -translate-y-1/2 border-4 border-black px-2 py-1.5 text-left font-mono text-black shadow-[4px_4px_0_rgba(0,0,0,0.55)] transition-transform hover:-translate-y-[54%] hover:brightness-110 focus:outline-none focus:ring-2 focus:ring-cyan-300",
        workOrderMarkerTone(order),
      )}
      style={{ left: `${left}%`, top: `${top}%` }}
      aria-label={`업무 열기 ${order.title}`}
    >
      <span className="flex items-center justify-between gap-1 text-[8px] font-black uppercase leading-none">
        <span>업무</span>
        <span>{order.priority}</span>
      </span>
      <span className="mt-1 line-clamp-2 text-[10px] font-black leading-tight">{order.title}</span>
      <span className="mt-1 block truncate text-[9px] font-bold uppercase leading-none">
        {order.agentName ? compactAgentName(order.agentName, data.name) : order.projectName ?? "미배정"}
      </span>
    </button>
  );
}

function OfficeMapHotspot({
  className,
  count,
  icon: Icon,
  label,
  onClick,
  tone,
}: {
  className?: string;
  count: number;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone: "cyan" | "amber" | "red" | "green";
}) {
  const toneClass = {
    amber: "bg-amber-300 text-black",
    cyan: "bg-cyan-300 text-black",
    green: "bg-emerald-300 text-black",
    red: "bg-red-300 text-black",
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute z-20 flex items-center gap-2 border-4 border-black px-2 py-1 font-mono text-[10px] font-black uppercase leading-none shadow-[4px_4px_0_rgba(0,0,0,0.55)] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-300",
        toneClass,
        className,
      )}
      aria-label={`${label} 열기`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span>{label}</span>
      <span className="border-2 border-black bg-black px-1 text-white">{formatNumber(count)}</span>
    </button>
  );
}

function RoomActorSprite({
  active,
  actor,
  onSelect,
  workspaceName,
  slotIndex,
}: {
  active?: boolean;
  actor: SpliceWorkspaceRoomActor;
  onSelect?: () => void;
  workspaceName: string;
  slotIndex: number;
}) {
  const label = compactAgentName(actor.name, workspaceName);
  const position = actorOfficePosition(actor, slotIndex);
  const left = roomPercent(position.x, 12, 88);
  const top = roomPercent(position.y, 22, 84);
  const tone = actorStateTone[actor.state] ?? actorStateTone.idle;
  const workLine = actorWorkLine(actor);
  const roomLine = actorRoomLine(actor);

  return (
    <button
      type="button"
      data-testid="room-actor-sprite"
      onClick={onSelect}
      className={cn(
        "absolute z-20 flex w-32 -translate-x-1/2 -translate-y-1/2 scale-[0.72] flex-col items-center transition-transform focus:outline-none focus:ring-2 focus:ring-cyan-300 sm:scale-[0.82] md:scale-100",
        active ? "brightness-125" : "hover:-translate-y-[52%] hover:brightness-110",
      )}
      style={{ left: `${left}%`, top: `${top}%` }}
      title={`${actor.name} · ${actor.state} · ${workLine}`}
      aria-label={`${label} 책상 · ${actorStateLabel(actor)} · ${workLine}`}
    >
      <div className="relative h-[92px] w-32">
        <Workstation actor={actor} />
        <PixelAvatar actor={actor} />
        <span className={cn(
          "absolute right-3 top-4 z-30 h-3 w-3 border-2 border-black shadow-[2px_2px_0_rgba(0,0,0,0.55)]",
          stateDot[actor.state] ?? stateDot.idle,
        )} />
        {(actor.request || actor.state === "requested") ? (
          <span className="absolute -right-2 top-0 z-40 border-2 border-black bg-amber-300 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase leading-none text-black shadow-[2px_2px_0_rgba(0,0,0,0.55)]">
            wake
          </span>
        ) : null}
        {actor.currentWork.length > 1 ? (
          <span className="absolute -left-2 top-1 z-40 border-2 border-black bg-cyan-200 px-1.5 py-0.5 font-mono text-[9px] font-black uppercase leading-none text-black shadow-[2px_2px_0_rgba(0,0,0,0.55)]">
            {actor.currentWork.length} work
          </span>
        ) : null}
      </div>
      <div className={cn(
        "hidden w-full border-2 px-2 py-1 font-mono shadow-[3px_3px_0_rgba(0,0,0,0.55)] sm:block",
        active ? "border-cyan-300 bg-cyan-300/15 text-cyan-100" : tone,
      )}>
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[10px] font-bold uppercase leading-none">{label}</span>
          <span className="shrink-0 text-[9px] uppercase leading-none opacity-85">{actorStateLabel(actor)}</span>
        </div>
        <p className="mt-1 truncate text-[9px] uppercase leading-none opacity-85">{roomLine}</p>
      </div>
    </button>
  );
}

function goalKindLabel(goal: SpliceWorkspaceRoomGoal): string {
  if (goal.kind === "key_result") return "핵심 결과";
  if (goal.kind === "mission") return "미션";
  if (goal.kind === "vision") return "비전";
  if (goal.kind === "objective") return "목표";
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
  return roomTabs.find((item) => item.value === tab)?.label ?? "관제";
}

function PuzzleSidebar({
  activeTab,
  data,
  runActiveCount,
  onTabChange,
}: {
  activeTab: RoomTab;
  data: SpliceWorkspaceRoomData;
  runActiveCount: number;
  onTabChange: (tab: RoomTab) => void;
}) {
  const { isMobile, sidebarOpen, setSidebarOpen } = useSidebar();
  const compactDesktop = typeof window !== "undefined" && window.innerWidth >= 640;
  const mobileLayout = isMobile && !compactDesktop;
  const selectTab = (tab: RoomTab) => {
    onTabChange(tab);
    if (mobileLayout) setSidebarOpen(false);
  };

  const activeGroup = roomNavigationGroupForTab(activeTab);

  return (
    <>
      {mobileLayout && sidebarOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
          aria-label="사이드바 닫기"
        />
      ) : null}
      <aside
        className={cn(
          "w-[156px] shrink-0 border-r border-border bg-background",
          "flex h-full min-h-0 flex-col",
          mobileLayout
            ? cn(
                "fixed inset-y-0 left-0 z-50 pt-[env(safe-area-inset-top)] transition-transform duration-100 ease-out",
                sidebarOpen ? "translate-x-0" : "-translate-x-full",
              )
            : "hidden sm:flex",
        )}
      >
        <div className="flex h-[70px] shrink-0 items-center px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{data.name}</p>
            <p className="mt-1 truncate text-[11px] text-muted-foreground">관찰 전용</p>
          </div>
        </div>

        <nav aria-label="Splice 주요 탐색" className="scrollbar-auto-hide flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2.5 py-2">
          {roomNavigationGroups.map((group) => {
            const Icon = group.icon;
            const active = activeGroup === group.value;
            return (
              <button
                key={group.value}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => selectTab(group.defaultTab)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-left text-[13px] font-medium transition-colors",
                  active ? "bg-[#339cf4] text-white hover:bg-[#339cf4]" : "text-muted-foreground hover:bg-[#eef6ff] hover:text-[#2586d4]",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{group.label}</span>
                {group.value === "execute" && runActiveCount > 0 ? <span className="text-[11px] text-blue-600 dark:text-blue-400">{runActiveCount} 가동</span> : null}
              </button>
            );
          })}
        </nav>

        <div className="border-t border-border px-5 py-3 text-[11px] leading-4 text-muted-foreground">
          <p>입력 기능은 기본 화면에서 숨김</p>
        </div>
      </aside>
    </>
  );
}

function RoomContextualTabs({ activeTab, onTabChange }: { activeTab: RoomTab; onTabChange: (tab: RoomTab) => void }) {
  const group = roomNavigationGroups.find((item) => item.value === roomNavigationGroupForTab(activeTab))!;
  const renderTab = (tab: RoomTab) => {
    const item = roomTabs.find((candidate) => candidate.value === tab)!;
    const Icon = item.icon;
    return (
      <button
        key={tab}
        type="button"
        onClick={() => onTabChange(tab)}
        aria-current={activeTab === tab ? "page" : undefined}
        className={cn(
          "inline-flex h-8 shrink-0 items-center gap-1.5 border-b-2 px-1 text-xs font-medium transition-colors",
          activeTab === tab ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
        )}
      >
        <Icon className="h-3.5 w-3.5" />
        {item.label}
      </button>
    );
  };

  return (
    <section aria-label={`${group.label} 보조 탐색`} className="border-b border-border">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-3 overflow-x-auto">
          <span className="shrink-0 text-sm font-semibold">{group.label}</span>
          <div className="flex min-w-0 items-center gap-3">{group.tabs.map(renderTab)}</div>
        </div>
        {group.advancedTabs.length ? (
          <details className="relative shrink-0 border-l border-border pl-3 pr-1">
            <summary className="cursor-pointer list-none whitespace-nowrap rounded-md border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground">고급 운영 도구</summary>
            <div className="absolute right-0 z-10 mt-1 flex min-w-36 flex-col border border-border bg-background p-1 shadow-md">
              {group.advancedTabs.map((tab) => {
                const item = roomTabs.find((candidate) => candidate.value === tab)!;
                const Icon = item.icon;
                return (
                  <button key={tab} type="button" onClick={() => onTabChange(tab)} className="flex items-center gap-2 px-2 py-2 text-left text-xs hover:bg-accent">
                    <Icon className="h-3.5 w-3.5" />
                    {item.label}
                  </button>
                );
              })}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}

function PuzzleWorkspaceShell({
  approvalPendingCount,
  activeTab,
  children,
  data,
  inboxOpenCount,
  runActiveCount,
  routineDueCount,
  workOrderOpenCount,
  onRefresh,
  onTabChange,
  refreshing,
}: {
  approvalPendingCount: number;
  activeTab: RoomTab;
  children: ReactNode;
  data: SpliceWorkspaceRoomData;
  inboxOpenCount: number;
  runActiveCount: number;
  routineDueCount: number;
  workOrderOpenCount: number;
  onRefresh: () => void;
  onTabChange: (tab: RoomTab) => void;
  refreshing: boolean;
}) {
  const { setBreadcrumbs } = useBreadcrumbs();

  useEffect(() => {
    setBreadcrumbs([{ label: roomTabLabel(activeTab) }]);
  }, [activeTab, setBreadcrumbs]);

  return (
    <div
      className="splice-observer-light flex h-full min-h-0 bg-background text-foreground"
      style={{
        "--background": "#ffffff",
        "--foreground": "#181a1f",
        "--card": "#f4f5f7",
        "--card-foreground": "#181a1f",
        "--popover": "#ffffff",
        "--popover-foreground": "#181a1f",
        "--primary": "#339cf4",
        "--primary-foreground": "#ffffff",
        "--secondary": "#f4f5f7",
        "--secondary-foreground": "#181a1f",
        "--muted": "#f4f5f7",
        "--muted-foreground": "#858991",
        "--accent": "#eaf5ff",
        "--accent-foreground": "#2586d4",
        "--border": "#e5e7eb",
        "--input": "#e5e7eb",
        "--ring": "#339cf4",
        "--sidebar": "#ffffff",
        "--sidebar-foreground": "#181a1f",
        "--sidebar-primary": "#339cf4",
        "--sidebar-primary-foreground": "#ffffff",
        "--sidebar-accent": "#eaf5ff",
        "--sidebar-accent-foreground": "#2586d4",
        "--sidebar-border": "#e5e7eb",
        "--sidebar-ring": "#339cf4",
      } as CSSProperties}
    >
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        본문으로 건너뛰기
      </a>
      <PuzzleSidebar
        activeTab={activeTab}
        data={data}
        runActiveCount={runActiveCount}
        onTabChange={onTabChange}
      />
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {activeTab !== "dashboard" ? <BreadcrumbBar scope="splice" /> : null}
        <main id="main-content" tabIndex={-1} className="flex-1 overflow-auto p-[18px] outline-none">
          <div className="space-y-6">
            {activeTab !== "dashboard" ? <RoomContextualTabs activeTab={activeTab} onTabChange={onTabChange} /> : null}
            {activeTab !== "dashboard" ? <div className="flex items-center justify-end">
              <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing} className="w-fit gap-1.5">
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
                새로고침
              </Button>
            </div> : null}
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

type OfficeFlowEntry = {
  id: string;
  title: string;
  subtitle: string;
  status?: string | null;
  onOpen: () => void;
};

type OfficeFlowStage = {
  key: string;
  title: string;
  value: number;
  subtitle: string;
  icon: LucideIcon;
  entries: OfficeFlowEntry[];
  onOpen: () => void;
};

function isOpenOfficeStatus(status: string | null | undefined): boolean {
  return !["done", "approved", "rejected", "cancelled", "noop"].includes(String(status || ""));
}

function OfficeFlowBoard({
  approvals,
  data,
  messages,
  onOpenRun,
  onOpenTab,
  onOpenWorkOrder,
  onOpenWorkItem,
  reviews,
  runs,
  workOrders,
  workProducts,
}: {
  approvals: SpliceOfficeApprovalsData | null;
  data: SpliceWorkspaceRoomData;
  messages: SpliceAgentMessage[];
  onOpenRun: (runId: string) => void;
  onOpenTab: (tab: RoomTab) => void;
  onOpenWorkOrder: (workOrderId: string) => void;
  onOpenWorkItem: (item: WorkItemRef) => void;
  reviews: SpliceReview[];
  runs: SpliceRunMonitorData | null;
  workOrders: SpliceWorkOrdersData | null;
  workProducts: SpliceWorkProduct[];
}) {
  const monitorRuns = runs?.runs ?? data.requests;
  const activeRunStatuses = new Set(["requested", "launch_ready", "launched"]);
  const terminalRunStatuses = new Set(["done", "failed", "blocked", "noop", "cancelled"]);
  const activeRuns = monitorRuns.filter((run) => !run.expired && activeRunStatuses.has(String(run.status)));
  const terminalRuns = monitorRuns.filter((run) => terminalRunStatuses.has(String(run.status)));
  const orders = workOrders?.workOrders ?? [];
  const openOrders = orders.filter((order) => isOpenOfficeStatus(order.status));
  const blockedOrders = orders.filter((order) => ["blocked", "failed"].includes(String(order.status)));
  const activeMessages = messages.filter((message) => isOpenOfficeStatus(message.status));
  const activeWork = [...data.lanes.active, ...data.lanes.review, ...data.lanes.blocked];
  const pendingReviews = reviews.filter((review) => review.status === "requested");
  const pendingApprovals = approvals?.approvals.filter((approval) => approval.status === "requested") ?? [];
  const doneCount = orders.filter((order) => order.status === "done").length + terminalRuns.filter((run) => run.status === "done").length + workProducts.length;

  const openOrderEntry = (order: SpliceWorkOrder): OfficeFlowEntry => ({
    id: order.id,
    title: order.title,
      subtitle: order.agentName ? compactAgentName(order.agentName, data.name) : order.projectName ?? "미배정",
    status: order.status,
    onOpen: () => onOpenWorkOrder(order.id),
  });

  const stages: OfficeFlowStage[] = [
    {
      key: "intake",
      title: "업무 접수",
      value: openOrders.length,
      subtitle: `${workOrders?.counts.queued ?? 0} 대기 · ${blockedOrders.length} 막힘`,
      icon: SquarePen,
      entries: openOrders.slice(0, 2).map(openOrderEntry),
      onOpen: () => onOpenTab("intake"),
    },
    {
      key: "comms",
      title: "대화",
      value: activeMessages.length,
      subtitle: `전체 ${messages.length}개 메시지`,
      icon: MessageSquare,
      entries: activeMessages.slice(0, 2).map((message) => ({
        id: message.id,
        title: compactAgentName(message.agentName, data.name),
        subtitle: message.body,
        status: message.status,
        onOpen: () => {
          if (message.runRequestId) {
            onOpenRun(message.runRequestId);
            return;
          }
          onOpenTab("comms");
        },
      })),
      onOpen: () => onOpenTab("comms"),
    },
    {
      key: "runs",
      title: "실행",
      value: activeRuns.length,
      subtitle: `${terminalRuns.length} 종료 · 전체 ${monitorRuns.length}`,
      icon: Rocket,
      entries: activeRuns.slice(0, 2).map((run) => ({
        id: run.id,
        title: compactAgentName(run.agentName, data.name),
        subtitle: run.note ?? run.launch?.outPath ?? "깨우기 요청",
        status: run.status,
        onOpen: () => onOpenRun(run.id),
      })),
      onOpen: () => onOpenTab("runs"),
    },
    {
      key: "work",
      title: "업무 책상",
      value: activeWork.length,
      subtitle: `산출물 ${workProducts.length}개`,
      icon: FolderOpen,
      entries: activeWork.slice(0, 2).map((item) => ({
        id: workItemKey(item),
        title: item.title,
        subtitle: `${item.ownerName} · ${item.projectName}`,
        status: item.status,
        onOpen: () => onOpenWorkItem(item),
      })),
      onOpen: () => onOpenTab("desk"),
    },
    {
      key: "review",
      title: "검수",
      value: pendingReviews.length + pendingApprovals.length,
      subtitle: `검수 ${pendingReviews.length} · 승인 ${pendingApprovals.length}`,
      icon: ShieldAlert,
      entries: [
        ...pendingReviews.slice(0, 1).map((review) => ({
          id: review.id,
          title: review.title,
          subtitle: review.itemTitle,
          status: review.status,
          onOpen: () => onOpenTab("reviews"),
        })),
        ...pendingApprovals.slice(0, 1).map((approval) => ({
          id: approval.id,
          title: approval.title,
          subtitle: approval.agentName ? compactAgentName(approval.agentName, data.name) : approval.kind,
          status: approval.status,
          onOpen: () => onOpenTab("approvals"),
        })),
      ],
      onOpen: () => onOpenTab("reviews"),
    },
    {
      key: "done",
      title: "완료",
      value: doneCount,
      subtitle: `${workProducts.length} work products`,
      icon: CheckCircle2,
      entries: [
        ...workProducts.slice(0, 1).map((product) => {
          const target = workItemRefFromTarget(product.itemType, product.itemId);
          return {
            id: product.id,
            title: product.title,
            subtitle: product.agentName ? compactAgentName(product.agentName, data.name) : product.itemTitle,
            status: product.status,
            onOpen: () => target ? onOpenWorkItem(target) : onOpenTab("desk"),
          };
        }),
        ...terminalRuns.slice(0, 1).map((run) => ({
          id: run.id,
          title: compactAgentName(run.agentName, data.name),
          subtitle: run.note ?? "종료된 실행",
          status: run.status,
          onOpen: () => onOpenRun(run.id),
        })),
      ],
      onOpen: () => onOpenTab("activity"),
    },
  ];

  return (
    <section className="space-y-3">
      <SectionTitle title="업무 흐름" aside={`실행 ${activeRuns.length} · 열린 업무 ${openOrders.length}`} />
      <div className="grid gap-2 md:grid-cols-2 2xl:grid-cols-6">
        {stages.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <section key={stage.key} className="min-w-0 border border-border bg-background">
              <button
                type="button"
                onClick={stage.onOpen}
                className="flex w-full items-start justify-between gap-3 border-b border-border px-3 py-3 text-left transition-colors hover:bg-accent/50"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-sm font-semibold">{stage.title}</span>
                  </span>
                  <span className="mt-1 block truncate text-xs text-muted-foreground">{stage.subtitle}</span>
                </span>
                <span className="shrink-0 text-2xl font-semibold tabular-nums">{formatNumber(stage.value)}</span>
              </button>
              <div className="min-h-[112px]">
                {stage.entries.length ? stage.entries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={entry.onOpen}
                    className="flex min-h-14 w-full items-center gap-2 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-muted/60"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">{entry.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{entry.subtitle}</span>
                    </span>
                    {entry.status ? <StatusBadge status={entry.status} /> : null}
                  </button>
                )) : (
                  <p className="px-3 py-4 text-xs text-muted-foreground">비어 있음</p>
                )}
              </div>
              {index < stages.length - 1 ? (
                <div className="hidden border-t border-border px-3 py-2 text-muted-foreground 2xl:flex 2xl:justify-end">
                  <ArrowRight className="h-4 w-4" />
                </div>
              ) : null}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function DashboardTab({
  agentConsole,
  approvals,
  data,
  dispatchingRunner,
  focusedAgentId,
  inbox,
  messages,
  onDispatchRunner,
  onFocusAgent,
  onOpenWorkItem,
  onOpenRun,
  onOpenTab,
  onOpenWorkOrder,
  onRunAgent,
  onSend,
  routines,
  runs,
  reviews,
  runningAgentId,
  runnerNotice,
  sendingAgentId,
  workOrders,
  workProducts,
}: {
  agentConsole: SpliceAgentConsoleData | null;
  approvals: SpliceOfficeApprovalsData | null;
  data: SpliceWorkspaceRoomData;
  dispatchingRunner: boolean;
  focusedAgentId: string | null;
  inbox: SpliceOfficeInboxData | null;
  messages: SpliceAgentMessage[];
  onDispatchRunner: (dryRun: boolean) => void;
  onFocusAgent: (agentId: string) => void;
  onOpenWorkItem: (item: WorkItemRef) => void;
  onOpenRun: (runId: string) => void;
  onOpenTab: (tab: RoomTab) => void;
  onOpenWorkOrder: (workOrderId: string) => void;
  onRunAgent: (agentId: string) => void;
  onSend: (agentId: string, body: string) => void;
  routines: SpliceOfficeRoutinesData | null;
  runs: SpliceRunMonitorData | null;
  reviews: SpliceReview[];
  runningAgentId: string | null;
  runnerNotice: string | null;
  sendingAgentId: string | null;
  workOrders: SpliceWorkOrdersData | null;
  workProducts: SpliceWorkProduct[];
}) {
  const issues = [...data.lanes.active, ...data.lanes.review, ...data.lanes.next, ...data.lanes.blocked];

  return (
    <div className="space-y-6">
      <RoomMap
        approvals={approvals}
        data={data}
        dispatchingRunner={dispatchingRunner}
        focusedAgentId={focusedAgentId}
        inbox={inbox}
        onDispatchRunner={onDispatchRunner}
        onFocusAgent={onFocusAgent}
        onOpenWorkItem={onOpenWorkItem}
        onOpenRun={onOpenRun}
        onOpenTab={onOpenTab}
        onOpenWorkOrder={onOpenWorkOrder}
        onRunAgent={onRunAgent}
        onSend={onSend}
        routines={routines}
        runnerNotice={runnerNotice}
        runningAgentId={runningAgentId}
        runs={runs}
        sendingAgentId={sendingAgentId}
        workOrders={workOrders}
        workProducts={workProducts}
      />

      <details className="border border-border bg-background">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
          세부 현황 펼치기
        </summary>
        <div className="space-y-6 border-t border-border p-4">
      <OfficeActionQueue
        approvals={approvals}
        data={data}
        inbox={inbox}
        onOpenRun={onOpenRun}
        onOpenTab={onOpenTab}
        onOpenWorkItem={onOpenWorkItem}
        onOpenWorkOrder={onOpenWorkOrder}
        reviews={reviews}
        routines={routines}
        runs={runs}
        workOrders={workOrders}
      />

      <OfficeAgentDock
        agentConsole={agentConsole}
        data={data}
        focusedAgentId={focusedAgentId}
        messages={messages}
        onFocusAgent={onFocusAgent}
        onOpenTab={onOpenTab}
        onRunAgent={onRunAgent}
        onSend={onSend}
        runningAgentId={runningAgentId}
        sendingAgentId={sendingAgentId}
      />

      <div className="grid grid-cols-2 gap-1 sm:gap-2 xl:grid-cols-4">
        <MetricCard icon={Bot} value={data.totals.runningAgents ?? data.totals.activeAgents} label="실제 가동 역할" description={`업무 배정 ${data.totals.assignedAgents ?? 0}`} />
        <MetricCard icon={CircleDot} value={data.totals.activeIssues} label="진행 업무" description={`전체 이슈 ${data.totals.issues}`} />
        <MetricCard icon={Clock3} value={data.totals.reviewIssues} label="검수 중" description={`다음 대기 ${data.totals.todoIssues}`} />
        <MetricCard icon={ShieldAlert} value={data.totals.blockedIssues} label="막힘" description={`진척 ${data.totals.progress}%`} />
      </div>

      <OfficeFlowBoard
        approvals={approvals}
        data={data}
        messages={messages}
        onOpenRun={onOpenRun}
        onOpenTab={onOpenTab}
        onOpenWorkOrder={onOpenWorkOrder}
        onOpenWorkItem={onOpenWorkItem}
        reviews={reviews}
        runs={runs}
        workOrders={workOrders}
        workProducts={workProducts}
      />

      <ExecutionLanesPanel data={data} limit={3} />

      <OfficeRunsSummary data={data} runs={runs} />

      <OfficeWorkOrdersSummary data={data} onOpenWorkOrder={onOpenWorkOrder} workOrders={workOrders} />

      <OfficeInboxSummary inbox={inbox} />

      <OfficeApprovalsSummary approvals={approvals} data={data} />

      <OfficeRoutinesSummary data={data} routines={routines} />

      <OfficeSignalPanel data={data} messages={messages} />

      <RunQueueBoard
        data={data}
        dispatchingRunner={dispatchingRunner}
        onDispatchRunner={onDispatchRunner}
        runnerNotice={runnerNotice}
      />

      <ReviewGateSummary data={data} reviews={reviews} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="min-w-0 space-y-3">
          <SectionTitle title="최근 활동" />
          <ActivityList items={data.activity.slice(0, 8)} />
        </div>
        <div className="min-w-0 space-y-3">
          <SectionTitle title="최근 업무" />
          <WorkItemList items={issues.slice(0, 8)} empty="아직 업무가 없습니다." />
        </div>
      </div>
        </div>
      </details>
    </div>
  );
}

type OfficeActionEntry = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  severity: "high" | "medium" | "low";
  source: string;
  icon: LucideIcon;
  onOpen: () => void;
};

function actionSeverityClass(severity: OfficeActionEntry["severity"]): string {
  if (severity === "high") return "border-red-500/40 bg-red-500/10";
  if (severity === "medium") return "border-amber-500/40 bg-amber-500/10";
  return "border-border bg-background";
}

function OfficeActionQueue({
  approvals,
  data,
  inbox,
  onOpenRun,
  onOpenTab,
  onOpenWorkItem,
  onOpenWorkOrder,
  reviews,
  routines,
  runs,
  workOrders,
}: {
  approvals: SpliceOfficeApprovalsData | null;
  data: SpliceWorkspaceRoomData;
  inbox: SpliceOfficeInboxData | null;
  onOpenRun: (runId: string) => void;
  onOpenTab: (tab: RoomTab) => void;
  onOpenWorkItem: (item: WorkItemRef) => void;
  onOpenWorkOrder: (workOrderId: string) => void;
  reviews: SpliceReview[];
  routines: SpliceOfficeRoutinesData | null;
  runs: SpliceRunMonitorData | null;
  workOrders: SpliceWorkOrdersData | null;
}) {
  const openInboxItems = inbox?.items.filter((item) => item.inboxStatus === "open") ?? [];
  const pendingApprovals = approvals?.approvals.filter((approval) => approval.status === "requested" || approval.status === "changes_requested") ?? [];
  const pendingReviews = reviews.filter((review) => review.status === "requested");
  const monitorRuns = runs?.runs ?? data.requests;
  const blockedRuns = monitorRuns.filter((run) => run.status === "blocked" || run.status === "failed");
  const blockedOrders = workOrders?.workOrders.filter((order) => order.status === "blocked" || order.status === "failed") ?? [];
  const dueRoutines = routines?.routines.filter((routine) => routine.due) ?? [];

  const openInboxTarget = (item: SpliceInboxItem) => {
    const targetWorkItem = workItemRefFromTarget(item.targetType, item.targetId);
    const targetRunId = runIdFromTarget(item.targetType, item.targetId);
    const targetWorkOrderId = workOrderIdFromTarget(item.targetType, item.targetId);
    const targetTab = roomTabs.some((tab) => tab.value === item.targetTab) ? item.targetTab as RoomTab : "inbox";
    if (targetWorkItem) {
      onOpenWorkItem(targetWorkItem);
      return;
    }
    if (targetRunId) {
      onOpenRun(targetRunId);
      return;
    }
    if (targetWorkOrderId) {
      onOpenWorkOrder(targetWorkOrderId);
      return;
    }
    onOpenTab(targetTab);
  };

  const entries: OfficeActionEntry[] = [
    ...blockedRuns.slice(0, 3).map((run) => ({
      id: `run:${run.id}`,
      title: compactAgentName(run.agentName, data.name),
      subtitle: run.error ?? run.note ?? "운영자 확인이 필요한 실행",
      status: run.status,
      severity: "high" as const,
      source: "run",
      icon: Rocket,
      onOpen: () => onOpenRun(run.id),
    })),
    ...blockedOrders.slice(0, 3).map((order) => ({
      id: `work-order:${order.id}`,
      title: order.title,
      subtitle: `${order.agentName ? compactAgentName(order.agentName, data.name) : "미배정"} · ${order.projectName ?? "프로젝트 없음"}`,
      status: order.status,
      severity: "high" as const,
      source: "work order",
      icon: SquarePen,
      onOpen: () => onOpenWorkOrder(order.id),
    })),
    ...pendingApprovals.slice(0, 3).map((approval) => ({
      id: `approval:${approval.id}`,
      title: approval.title,
      subtitle: `${approval.agentName ? compactAgentName(approval.agentName, data.name) : "operator"} · ${approval.kind}`,
      status: approval.status,
      severity: "medium" as const,
      source: "approval",
      icon: CheckCircle2,
      onOpen: () => onOpenTab("approvals"),
    })),
    ...pendingReviews.slice(0, 3).map((review) => ({
      id: `review:${review.id}`,
      title: review.title,
      subtitle: `${review.itemTitle} · ${review.reviewerAgentName ? compactAgentName(review.reviewerAgentName, data.name) : "검수자 미배정"}`,
      status: review.status,
      severity: "medium" as const,
      source: "review",
      icon: ShieldAlert,
      onOpen: () => onOpenTab("reviews"),
    })),
    ...dueRoutines.slice(0, 2).map((routine) => ({
      id: `routine:${routine.id}`,
      title: compactAgentName(routine.agentName, data.name),
      subtitle: `${routine.cadenceLabel} · ${routine.title}`,
      status: routine.state,
      severity: "medium" as const,
      source: "routine",
      icon: Repeat2,
      onOpen: () => onOpenTab("routines"),
    })),
    ...openInboxItems.slice(0, 4).map((item) => ({
      id: `inbox:${item.id}`,
      title: item.title,
      subtitle: item.subtitle,
      status: item.sourceStatus,
      severity: item.severity === "high" ? "high" as const : item.severity === "medium" ? "medium" as const : "low" as const,
      source: item.kind,
      icon: Inbox,
      onOpen: () => openInboxTarget(item),
    })),
  ];
  const visibleEntries = entries.slice(0, 8);
  const highCount = entries.filter((entry) => entry.severity === "high").length;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle title="우선 처리" aside={`열림 ${entries.length} · 긴급 ${highCount}`} />
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenTab("inbox")} className="h-8 gap-1.5 self-start sm:self-auto">
          <Inbox className="h-3.5 w-3.5" />
          Inbox
        </Button>
      </div>
      <div className="grid gap-2 xl:grid-cols-4">
        {visibleEntries.length ? visibleEntries.map((entry) => {
          const Icon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={entry.onOpen}
              className={cn(
                "min-w-0 border px-3 py-3 text-left transition-colors hover:bg-accent/50",
                actionSeverityClass(entry.severity),
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex min-w-0 items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{entry.title}</span>
                    <span className="mt-1 block line-clamp-2 text-xs text-muted-foreground">{entry.subtitle}</span>
                  </span>
                </span>
                <StatusBadge status={entry.status} />
              </div>
              <span className="mt-2 inline-flex text-[11px] uppercase tracking-wider text-muted-foreground">{entry.source}</span>
            </button>
          );
        }) : (
          <p className="border border-border px-4 py-4 text-sm text-muted-foreground xl:col-span-4">대기 중인 운영자 조치가 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function OfficeRunsSummary({ data, runs }: { data: SpliceWorkspaceRoomData; runs: SpliceRunMonitorData | null }) {
  const monitorRuns = runs?.runs ?? data.requests;
  const activeStatuses = new Set(["requested", "launch_ready", "launched"]);
  const activeRuns = monitorRuns
    .filter((run) => !run.expired && activeStatuses.has(String(run.status)))
    .slice(0, 5);
  const visibleRuns = activeRuns.length ? activeRuns : monitorRuns.slice(0, 5);
  const fallbackCounts = {
    total: monitorRuns.length,
    active: activeRuns.filter((run) => run.status === "launched").length,
    requested: activeRuns.filter((run) => run.status === "requested").length,
    launchReady: monitorRuns.filter((run) => run.status === "launch_ready").length,
    launched: monitorRuns.filter((run) => run.status === "launched").length,
    done: monitorRuns.filter((run) => run.status === "done").length,
    failed: monitorRuns.filter((run) => run.status === "failed").length,
    blocked: monitorRuns.filter((run) => run.status === "blocked").length,
    noop: monitorRuns.filter((run) => run.status === "noop").length,
    cancelled: monitorRuns.filter((run) => run.status === "cancelled").length,
    expired: monitorRuns.filter((run) => run.expired).length,
    terminal: monitorRuns.filter((run) => ["done", "failed", "blocked", "noop", "cancelled"].includes(String(run.status))).length,
  };
  const counts = runs?.counts ?? fallbackCounts;

  return (
    <section className="space-y-3">
      <SectionTitle title="실행 현황" aside={`가동 ${counts.active} · 전체 ${counts.total}`} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard icon={Rocket} value={counts.active} label="실제 실행" description={`${counts.requested} 대기`} />
          <MetricCard icon={Clock3} value={counts.launchReady} label="실행 준비" description="러너 수거 대기" />
          <MetricCard icon={History} value={counts.expired} label="만료 기록" description="실시간 집계 제외" />
          <MetricCard icon={ShieldAlert} value={counts.failed} label="실패" description={`${counts.blocked} 막힘 · ${counts.noop} 무작업`} />
        </div>
        <div className="min-w-0 border border-border">
          {visibleRuns.length ? visibleRuns.map((run) => (
            <EntityRow
              key={run.id}
              title={compactAgentName(run.agentName, data.name)}
              subtitle={run.note ?? run.launch?.outPath ?? "깨우기 요청"}
              leading={<Rocket className="h-4 w-4 text-muted-foreground" />}
              trailing={(
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <RunRuntimePill runtime={run.runtime} status={run.status} />
                  <StatusBadge status={run.expired ? "expired" : run.status} />
                </div>
              )}
            />
          )) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">아직 실행 요청이 없습니다.</p>
          )}
          </div>
        </div>
    </section>
  );
}

function OfficeWorkOrdersSummary({
  data,
  onOpenWorkOrder,
  workOrders,
}: {
  data: SpliceWorkspaceRoomData;
  onOpenWorkOrder: (workOrderId: string) => void;
  workOrders: SpliceWorkOrdersData | null;
}) {
  const visibleOrders = workOrders?.workOrders.slice(0, 5) ?? [];
  return (
    <section className="space-y-3">
      <SectionTitle title="업무 접수" aside={`열림 ${workOrders?.counts.open ?? 0} · 대기 ${workOrders?.counts.queued ?? 0}`} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard icon={SquarePen} value={workOrders?.counts.open ?? 0} label="열림" description={`전체 ${workOrders?.counts.total ?? 0}건`} />
          <MetricCard icon={Rocket} value={workOrders?.counts.queued ?? 0} label="대기" description="에이전트 깨우기 연결" />
          <MetricCard icon={Activity} value={workOrders?.counts.inProgress ?? 0} label="진행" description="진행 중" />
          <MetricCard icon={ShieldAlert} value={workOrders?.counts.blocked ?? 0} label="막힘" description={`완료 ${workOrders?.counts.done ?? 0}건`} />
        </div>
        <div className="min-w-0 border border-border">
          {visibleOrders.length ? visibleOrders.map((workOrder) => (
            <EntityRow
              key={workOrder.id}
              title={workOrder.title}
              subtitle={`${workOrder.agentName ? compactAgentName(workOrder.agentName, data.name) : "미배정"} · ${koStatusLabel(workOrder.priority)}`}
              leading={<SquarePen className="h-4 w-4 text-muted-foreground" />}
              trailing={<StatusBadge status={workOrder.status} />}
              onClick={() => onOpenWorkOrder(workOrder.id)}
            />
          )) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">아직 접수된 업무가 없습니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function OfficeInboxSummary({ inbox }: { inbox: SpliceOfficeInboxData | null }) {
  const openItems = inbox?.items.filter((item) => item.inboxStatus === "open").slice(0, 5) ?? [];
  return (
    <section className="space-y-3">
      <SectionTitle title="사무실 신호함" aside={`열림 ${inbox?.counts.open ?? 0}`} />
      <div className="border border-border">
        {openItems.length ? openItems.map((item) => (
          <EntityRow
            key={item.id}
            title={item.title}
            subtitle={`${koStatusLabel(item.kind)} · ${item.subtitle}`}
            leading={<Inbox className="h-4 w-4 text-muted-foreground" />}
            trailing={<StatusBadge status={item.sourceStatus} />}
          />
        )) : (
          <p className="px-4 py-4 text-sm text-muted-foreground">열린 신호가 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function OfficeApprovalsSummary({ approvals, data }: { approvals: SpliceOfficeApprovalsData | null; data: SpliceWorkspaceRoomData }) {
  const approvalItems = approvals?.approvals ?? [];
  const pendingItems = approvalItems
    .filter((approval) => approval.status === "requested" || approval.status === "changes_requested")
    .slice(0, 5);
  const visibleItems = pendingItems.length ? pendingItems : approvalItems.slice(0, 5);

  return (
    <section className="space-y-3">
      <SectionTitle
        title="사무실 승인"
        aside={`대기 ${approvals?.counts.pending ?? 0} · 승인 ${approvals?.counts.approved ?? 0}`}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard icon={CheckCircle2} value={approvals?.counts.pending ?? 0} label="대기" description="운영자 확인 필요" />
          <MetricCard icon={Activity} value={approvals?.counts.total ?? 0} label="요청" description="승인 기록" />
          <MetricCard icon={ShieldAlert} value={approvals?.counts.changesRequested ?? 0} label="수정 요청" description="되돌려 보냄" />
          <MetricCard icon={CheckCircle2} value={approvals?.counts.approved ?? 0} label="승인" description="실행 가능" />
        </div>
        <div className="min-w-0 border border-border">
          {visibleItems.length ? visibleItems.map((approval) => (
            <EntityRow
              key={approval.id}
              title={approval.title}
              subtitle={`${approval.agentName ? compactAgentName(approval.agentName, data.name) : "운영자"} · ${koStatusLabel(approval.kind)}`}
              leading={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
              trailing={<StatusBadge status={approval.status} />}
            />
          )) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">아직 승인 요청이 없습니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function OfficeRoutinesSummary({ data, routines }: { data: SpliceWorkspaceRoomData; routines: SpliceOfficeRoutinesData | null }) {
  const routineItems = routines?.routines ?? [];
  const dueItems = routineItems
    .filter((routine) => routine.due)
    .sort((a, b) => Date.parse(a.nextRunAt || "") - Date.parse(b.nextRunAt || ""))
    .slice(0, 5);
  const visibleItems = dueItems.length ? dueItems : routineItems.slice(0, 5);

  return (
    <section className="space-y-3">
      <SectionTitle
        title="사무실 루틴"
        aside={`활성 ${routines?.counts.enabled ?? 0} · 실행 시점 ${routines?.counts.due ?? 0}`}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard icon={Repeat2} value={routines?.counts.enabled ?? 0} label="활성" description={`루틴 ${routines?.counts.total ?? 0}개`} />
          <MetricCard icon={Clock3} value={routines?.counts.due ?? 0} label="지금 실행" description="깨울 준비됨" />
          <MetricCard icon={Activity} value={routines?.counts.runs ?? 0} label="루틴 실행" description="수동 깨우기" />
          <MetricCard icon={ShieldAlert} value={routines?.counts.paused ?? 0} label="일시 정지" description="일정 없음" />
        </div>
        <div className="min-w-0 border border-border">
          {visibleItems.length ? visibleItems.map((routine) => (
            <EntityRow
              key={routine.id}
              title={compactAgentName(routine.agentName, data.name)}
              subtitle={`${routine.cadenceLabel} · 다음 ${formatIsoSchedule(routine.nextRunAt)}`}
              leading={<Repeat2 className="h-4 w-4 text-muted-foreground" />}
              trailing={<StatusBadge status={routine.state} />}
            />
          )) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">아직 오피스 루틴이 없습니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function OfficeSignalPanel({ data, messages }: { data: SpliceWorkspaceRoomData; messages: SpliceAgentMessage[] }) {
  const activeRequests = data.requests
    .filter((request) => request.status === "requested" || request.status === "launch_ready" || request.status === "launched")
    .slice(0, 4);
  const recentMessages = messages.slice(0, 4);

  return (
    <section className="space-y-3">
      <SectionTitle title="사무실 신호" aside={`메시지 ${recentMessages.length} · 호출 ${activeRequests.length}`} />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="min-w-0 border border-border">
          {recentMessages.length ? recentMessages.map((message) => (
            <EntityRow
              key={message.id}
              title={compactAgentName(message.agentName, data.name)}
              subtitle={message.body.length > 120 ? `${message.body.slice(0, 117)}...` : message.body}
              leading={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
              trailing={<span className="text-xs text-muted-foreground">{formatIsoAge(message.createdAt)}</span>}
            />
          )) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">아직 오피스 메시지가 없습니다.</p>
          )}
        </div>
        <div className="min-w-0 border border-border">
          {activeRequests.length ? activeRequests.map((request) => (
            <EntityRow
              key={request.id}
              title={compactAgentName(request.agentName, data.name)}
              subtitle={request.note ?? "깨우기 요청"}
              leading={<Activity className="h-4 w-4 text-muted-foreground" />}
              trailing={<StatusBadge status={request.status} />}
            />
          )) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">활성 깨우기 요청이 없습니다.</p>
          )}
        </div>
      </div>
    </section>
  );
}

type RoomConsoleAgent = SpliceWorkspaceRoomActor & {
  requests: SpliceAgentRunRequest[];
  messages: SpliceAgentMessage[];
  workOrders: SpliceWorkOrder[];
  lastEventAt: string | null;
};

function runRequestsForActor(
  requests: SpliceAgentRunRequest[],
  actor: SpliceWorkspaceRoomActor,
): SpliceAgentRunRequest[] {
  const matched = requests.filter((request) =>
    request.agentId === actor.id ||
    request.agentId === actor.slug ||
    request.agentName === actor.name
  );
  if (actor.request && !matched.some((request) => request.id === actor.request?.id)) {
    return [actor.request, ...matched];
  }
  return matched;
}

function roomConsoleAgents(
  data: SpliceWorkspaceRoomData,
  agentConsole: SpliceAgentConsoleData | null,
  messages: SpliceAgentMessage[],
): RoomConsoleAgent[] {
  if (agentConsole?.agents.length) return agentConsole.agents;

  return data.agents.map((agent) => ({
    ...agent,
    requests: runRequestsForActor(data.requests, agent),
    messages: messages.filter((message) =>
      message.agentId === agent.id ||
      message.agentId === agent.slug ||
      message.agentName === agent.name
    ),
    workOrders: [],
    lastEventAt: agent.request?.updatedAt ?? agent.request?.requestedAt ?? null,
  }));
}

function OfficeAgentDock({
  agentConsole,
  data,
  focusedAgentId,
  messages,
  onFocusAgent,
  onOpenTab,
  onRunAgent,
  onSend,
  runningAgentId,
  sendingAgentId,
}: {
  agentConsole: SpliceAgentConsoleData | null;
  data: SpliceWorkspaceRoomData;
  focusedAgentId: string | null;
  messages: SpliceAgentMessage[];
  onFocusAgent: (agentId: string) => void;
  onOpenTab: (tab: RoomTab) => void;
  onRunAgent: (agentId: string) => void;
  onSend: (agentId: string, body: string) => void;
  runningAgentId: string | null;
  sendingAgentId: string | null;
}) {
  const consoleAgents = useMemo(
    () => roomConsoleAgents(data, agentConsole, messages),
    [agentConsole, data, messages],
  );
  const [selectedAgentId, setSelectedAgentId] = useState(consoleAgents[0]?.id ?? "");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!consoleAgents.length) return;
    const focusedAgent = focusedAgentId
      ? consoleAgents.find((agent) => agent.id === focusedAgentId || agent.slug === focusedAgentId)
      : null;
    if (focusedAgent && focusedAgent.id !== selectedAgentId) {
      setSelectedAgentId(focusedAgent.id);
      return;
    }
    if (!selectedAgentId || !consoleAgents.some((agent) => agent.id === selectedAgentId)) {
      const nextId = focusedAgent?.id ?? consoleAgents[0].id;
      setSelectedAgentId(nextId);
      onFocusAgent(nextId);
    }
  }, [consoleAgents, focusedAgentId, onFocusAgent, selectedAgentId]);

  const selectedAgent = consoleAgents.find((agent) => agent.id === selectedAgentId) ?? consoleAgents[0] ?? null;
  const activeStatuses = new Set(["requested", "launch_ready", "launched"]);
  const selectedRequests = selectedAgent?.requests ?? [];
  const selectedMessages = selectedAgent?.messages ?? [];
  const selectedWorkOrders = selectedAgent?.workOrders ?? [];
  const activeRequestCount = selectedRequests.filter((request) => activeStatuses.has(String(request.status))).length;
  const isRunning = Boolean(selectedAgent && runningAgentId === selectedAgent.id);
  const isSending = Boolean(selectedAgent && sendingAgentId === selectedAgent.id);

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!selectedAgent || !body || isSending) return;
    setDraft("");
    onSend(selectedAgent.id, body);
  };

  if (!selectedAgent) {
    return (
      <section className="space-y-3">
        <SectionTitle title="에이전트 대화" aside="책상 0" />
        <p className="border border-border px-4 py-4 text-sm text-muted-foreground">에이전트를 찾을 수 없습니다.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle title="에이전트 대화" aside={`책상 ${consoleAgents.length} · 메시지 ${messages.length}`} />
        <Button type="button" variant="outline" size="sm" onClick={() => onOpenTab("comms")} className="h-8 gap-1.5 self-start sm:self-auto">
          <MessageSquare className="h-3.5 w-3.5" />
          Comms
        </Button>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-1">
          {consoleAgents.slice(0, 6).map((agent) => {
            const active = agent.id === selectedAgent.id;
            const pending = agent.requests.filter((request) => activeStatuses.has(String(request.status))).length;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  setSelectedAgentId(agent.id);
                  onFocusAgent(agent.id);
                }}
                className={cn(
                  "min-w-0 border px-3 py-3 text-left transition-colors",
                  active ? "border-ring bg-muted" : "border-border bg-background hover:bg-muted/60",
                )}
              >
                <div className="flex items-start gap-3">
                  <Identity name={compactAgentName(agent.name, data.name)} initials={agent.initials} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Dot state={agent.state} />
                      <p className="min-w-0 truncate text-sm font-semibold">{compactAgentName(agent.name, data.name)}</p>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{agent.role} · {agent.zone}</p>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-0.5">{agent.currentWork.length} work</span>
                      <span className="rounded-full bg-muted px-2 py-0.5">{agent.workOrders.length} orders</span>
                      <span className="rounded-full bg-muted px-2 py-0.5">{agent.messages.length} msg</span>
                      {pending ? <span className="rounded-full bg-muted px-2 py-0.5">{pending} wake</span> : null}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="min-w-0 border border-border">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <Identity name={compactAgentName(selectedAgent.name, data.name)} initials={selectedAgent.initials} size="default" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-base font-semibold">{compactAgentName(selectedAgent.name, data.name)}</h3>
                  <StatusBadge status={selectedAgent.state} />
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  {selectedAgent.workOrders[0]?.title ?? selectedAgent.currentWork[0]?.title ?? "배정 업무 없음"}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRunAgent(selectedAgent.id)}
              disabled={Boolean(runningAgentId)}
              className="h-8 gap-1.5 self-start lg:self-auto"
            >
              <Play className={cn("h-3.5 w-3.5", isRunning && "animate-pulse")} />
              {isRunning ? "대기" : "깨우기"}
            </Button>
          </div>

          <div className="grid gap-0 border-b border-border md:grid-cols-[minmax(0,1fr)_300px]">
            <form className="min-w-0 border-b border-border px-4 py-4 md:border-b-0 md:border-r" onSubmit={submitMessage}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">지시</p>
                <span className="text-xs text-muted-foreground">{activeRequestCount} active wakes</span>
              </div>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-24 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                placeholder={`${compactAgentName(selectedAgent.name, data.name)}에게 메시지`}
                disabled={isSending}
              />
              <div className="mt-3 flex justify-end">
                <Button type="submit" disabled={!draft.trim() || isSending} className="gap-1.5">
                  <Send className={cn("h-3.5 w-3.5", isSending && "animate-pulse")} />
                  {isSending ? "보내는 중" : "보내고 깨우기"}
                </Button>
              </div>
            </form>

            <div className="min-w-0">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">최근 실행</p>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {selectedRequests.length ? selectedRequests.slice(0, 5).map((request) => (
                  <article key={request.id} className="border-b border-border px-4 py-3 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={request.status} />
                      <RunRuntimePill runtime={request.runtime} status={request.status} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{request.note ?? "깨우기 요청"}</p>
                  </article>
                )) : (
                  <p className="px-4 py-4 text-sm text-muted-foreground">아직 실행 기록이 없습니다.</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">최근 메시지</p>
            </div>
            <div className="grid max-h-72 gap-px overflow-y-auto bg-border md:grid-cols-2">
              {selectedMessages.length ? selectedMessages.slice(0, 6).map((message) => (
                <article key={message.id} className="min-w-0 bg-background px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <p className="truncate text-xs font-medium">{message.author}</p>
                      {message.kind === "reply" ? <StatusBadge status="reply" /> : null}
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatIsoAge(message.createdAt)}</span>
                  </div>
                  <p className="mt-2 line-clamp-3 text-sm leading-5 text-foreground/90">{message.body}</p>
                  {message.workOrderTitle ? (
                    <p className="mt-2 truncate text-[11px] text-muted-foreground">{message.workOrderTitle}</p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <StatusBadge status={message.status} />
                    {message.workOrderId ? <span className="truncate font-mono">{message.workOrderId}</span> : null}
                  </div>
                </article>
              )) : (
                <p className="bg-background px-4 py-4 text-sm text-muted-foreground md:col-span-2">아직 메시지가 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function RunQueueBoard({
  data,
  dispatchingRunner,
  onDispatchRunner,
  runnerNotice,
}: {
  data: SpliceWorkspaceRoomData;
  dispatchingRunner: boolean;
  onDispatchRunner: (dryRun: boolean) => void;
  runnerNotice: string | null;
}) {
  const columns = [
    {
      id: "queued",
      title: "대기",
      items: data.requests.filter((request) => request.status === "requested" || request.status === "launch_ready"),
    },
    {
      id: "launched",
      title: "실행 중",
      items: data.requests.filter((request) => request.status === "launched"),
    },
    {
      id: "failed",
      title: "실패",
      items: data.requests.filter((request) => request.status === "failed"),
    },
  ];
  const pendingCount = columns[0].items.length;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionTitle title="러너 보드" aside={`요청 ${formatNumber(data.requests.length)}`} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDispatchRunner(true)}
            disabled={dispatchingRunner || pendingCount === 0}
            className="h-8 gap-1.5"
          >
            <Activity className={cn("h-3.5 w-3.5", dispatchingRunner && "animate-pulse")} />
            시험 실행
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onDispatchRunner(false)}
            disabled={dispatchingRunner || pendingCount === 0}
            className="h-8 gap-1.5"
          >
            <Rocket className={cn("h-3.5 w-3.5", dispatchingRunner && "animate-pulse")} />
            실행 보내기
          </Button>
        </div>
      </div>

      {runnerNotice ? (
        <div className="border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {runnerNotice}
        </div>
      ) : null}

      <div className="grid gap-3 lg:grid-cols-3">
        {columns.map((column) => (
          <div key={column.id} className="min-w-0 border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{column.title}</p>
              <span className="text-xs tabular-nums text-muted-foreground">{column.items.length}</span>
            </div>
            <div className="min-h-36">
              {column.items.length ? column.items.slice(0, 6).map((request) => (
                <div key={request.id} className="border-b border-border px-3 py-3 last:border-b-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{compactAgentName(request.agentName, data.name)}</p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{request.note ?? "깨우기 요청"}</p>
                    </div>
                    <StatusBadge status={request.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatIsoAge(request.requestedAt)}</span>
                    <span className="min-w-0 truncate font-mono">{request.id}</span>
                  </div>
                </div>
              )) : (
                <p className="px-3 py-4 text-sm text-muted-foreground">표시할 {column.title} 실행이 없습니다.</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function runMonitorFallbackCounts(runs: SpliceAgentRunRequest[]) {
  const terminalStatuses = new Set(["done", "failed", "blocked", "noop", "cancelled"]);
  const terminal = runs.filter((run) => terminalStatuses.has(String(run.status))).length;
  return {
    total: runs.length,
    active: runs.filter((run) => run.status === "launched").length,
    requested: runs.filter((run) => run.status === "requested").length,
    launchReady: runs.filter((run) => run.status === "launch_ready").length,
    launched: runs.filter((run) => run.status === "launched").length,
    done: runs.filter((run) => run.status === "done").length,
    failed: runs.filter((run) => run.status === "failed").length,
    blocked: runs.filter((run) => run.status === "blocked").length,
    noop: runs.filter((run) => run.status === "noop").length,
    cancelled: runs.filter((run) => run.status === "cancelled").length,
    expired: runs.filter((run) => run.expired).length,
    terminal,
  };
}

function RunMonitorCard({
  data,
  onSelectRun,
  run,
  onUpdateRunStatus,
  selected,
  updatingRunId,
}: {
  data: SpliceWorkspaceRoomData;
  onSelectRun: (runId: string) => void;
  run: SpliceAgentRunRequest;
  onUpdateRunStatus: (runId: string, status: string, error?: string) => void;
  selected: boolean;
  updatingRunId: string | null;
}) {
  const status = String(run.status);
  const isUpdating = updatingRunId === run.id;
  const terminal = ["done", "failed", "blocked", "noop", "cancelled"].includes(status);
  const isLaunched = status === "launched";
  const isQueued = !run.expired && (status === "requested" || status === "launch_ready");
  const runPath = run.launch?.outPath || run.launch?.promptPath || run.workspacePath || run.queue?.path || "";

  return (
    <article className={cn("border bg-background px-4 py-4", selected ? "border-ring" : "border-border")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={run.expired ? "expired" : status} />
            <RunRuntimePill runtime={run.runtime} status={status} />
            <span className="text-xs text-muted-foreground">{formatIsoAge(run.updatedAt || run.requestedAt)}</span>
            {run.process?.pid ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">pid {run.process.pid}</span> : null}
          </div>
          <h3 className="mt-2 truncate text-sm font-semibold">{compactAgentName(run.agentName, data.name)}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{run.note ?? "깨우기 요청"}</p>
          {run.error ? <p className="mt-2 line-clamp-2 text-xs text-red-600 dark:text-red-300">{run.error}</p> : null}
          <div className="mt-3 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
            <p className="min-w-0 truncate font-mono">{run.id}</p>
            <p className="min-w-0 truncate font-mono">{runPath || "실행 경로 없음"}</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelectRun(run.id)}
            className={cn("gap-1.5", selected && "border-ring")}
          >
            <FileText className="h-3.5 w-3.5" />
            Details
          </Button>
          {isQueued || isLaunched ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onUpdateRunStatus(run.id, "cancelled")}
              disabled={isUpdating}
            >
              Cancel
            </Button>
          ) : null}
          {isLaunched ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onUpdateRunStatus(run.id, "failed", "Marked failed from Run Monitor.")}
                disabled={isUpdating}
              >
                Fail
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onUpdateRunStatus(run.id, "done")}
                disabled={isUpdating}
                className="gap-1.5"
              >
                <CheckCircle2 className={cn("h-3.5 w-3.5", isUpdating && "animate-pulse")} />
                완료
              </Button>
            </>
          ) : null}
          {terminal ? (
            <Button
              type="button"
              size="sm"
              onClick={() => onUpdateRunStatus(run.id, "requested")}
              disabled={isUpdating}
              className="gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isUpdating && "animate-spin")} />
              Retry
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function RunArtifactPanel({ artifact, title }: { artifact: SpliceRunDetailData["artifacts"]["output"]; title: string }) {
  return (
    <section className="border border-border">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{artifact.path ?? "산출물 경로 없음"}</p>
        </div>
        {artifact.exists ? (
          <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(artifact.size)}</span>
        ) : null}
      </div>
      {artifact.error ? (
        <p className="px-4 py-4 text-sm text-red-600 dark:text-red-300">{artifact.error}</p>
      ) : artifact.exists && artifact.readable ? (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words bg-muted/30 px-4 py-4 text-[11px] leading-5 text-foreground/80">
          {artifact.truncated ? `[${artifact.mode} 일부 표시]\n\n` : ""}
          {artifact.text || "산출물 파일이 비어 있습니다."}
        </pre>
      ) : (
        <p className="px-4 py-4 text-sm text-muted-foreground">아직 저장된 산출물이 없습니다.</p>
      )}
    </section>
  );
}

function RunInspector({
  data,
  detail,
  loading,
  onAddComment,
  onFocusAgent,
  onOpenTab,
  onOpenWorkOrder,
  onOpenWorkItem,
  postingCommentKey,
  run,
}: {
  data: SpliceWorkspaceRoomData;
  detail: SpliceRunDetailData | null;
  loading: boolean;
  onAddComment: (input: WorkThreadCommentInput) => void;
  onFocusAgent: (agentId: string) => void;
  onOpenTab: (tab: RoomTab) => void;
  onOpenWorkOrder: (workOrderId: string) => void;
  onOpenWorkItem: (item: WorkItemRef) => void;
  postingCommentKey: string | null;
  run: SpliceAgentRunRequest | null;
}) {
  const [followupDraft, setFollowupDraft] = useState("");
  const [wakeOnFollowup, setWakeOnFollowup] = useState(true);

  useEffect(() => {
    setFollowupDraft("");
    setWakeOnFollowup(true);
  }, [run?.id]);

  if (!run) {
    return (
      <aside className="min-w-0 space-y-3">
        <SectionTitle title="실행 상세" aside="선택 없음" />
        <p className="border border-border px-4 py-4 text-sm text-muted-foreground">프롬프트, 출력, 연결 업무를 확인할 실행을 선택하세요.</p>
      </aside>
    );
  }

  const comments = detail?.related.comments ?? [];
  const messages = detail?.related.messages ?? [];
  const workOrders = detail?.related.workOrders ?? [];
  const workProducts = detail?.related.workProducts ?? [];
  const routineRuns = detail?.related.routineRuns ?? [];
  const relatedWorkItem =
    comments.map((comment) => workItemRefFromTarget(comment.itemType, comment.itemId)).find(Boolean) ??
    workProducts.map((product) => workItemRefFromTarget(product.itemType, product.itemId)).find(Boolean) ??
    workOrders.map((workOrder) => workItemRefFromTarget("project", workOrder.projectId)).find(Boolean) ??
    null;
  const followupPosting = relatedWorkItem ? postingCommentKey === workItemKey(relatedWorkItem) : false;
  const openAgent = () => {
    const agentId = run.agentId || data.agents.find((agent) => agent.name === run.agentName)?.id || "";
    if (agentId) onFocusAgent(agentId);
    onOpenTab("comms");
  };

  const openWorkItem = (item: WorkItemRef | null) => {
    if (item) {
      onOpenWorkItem(item);
      return;
    }
    onOpenTab("desk");
  };
  const submitFollowup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = followupDraft.trim();
    if (!body || !relatedWorkItem || followupPosting) return;
    setFollowupDraft("");
    onAddComment({
      itemType: relatedWorkItem.type,
      itemId: relatedWorkItem.id,
      body,
      wakeAgent: wakeOnFollowup,
      sourceRunRequestId: run.id,
    });
  };

  return (
    <aside className="min-w-0 space-y-3">
      <SectionTitle title="실행 상세" aside={loading ? "불러오는 중" : koStatusLabel(run.status)} />
      <section className="border border-border px-4 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={run.status} />
          <RunRuntimePill runtime={detail?.run.runtime ?? run.runtime} status={run.status} />
          <span className="text-xs text-muted-foreground">{formatIsoAge(run.updatedAt || run.requestedAt)}</span>
          {run.process?.pid ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">pid {run.process.pid}</span> : null}
        </div>
        {detail?.run.runtime?.verdict ? (
          <p className="mt-3 border border-border bg-muted/30 px-3 py-2 font-mono text-[11px] text-muted-foreground">
            {detail.run.runtime.verdict.line}
          </p>
        ) : null}
        <h3 className="mt-3 truncate text-sm font-semibold">{compactAgentName(run.agentName, data.name)}</h3>
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{run.note ?? "깨우기 요청"}</p>
        <div className="mt-3 grid gap-1 text-[11px] text-muted-foreground">
          <p className="truncate font-mono">{run.id}</p>
          <p className="truncate font-mono">{run.launch?.workspacePath || run.workspacePath || "작업 공간 경로 없음"}</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={openAgent} className="gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            Talk
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openWorkItem(relatedWorkItem)}
            className="gap-1.5"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            Work
          </Button>
        </div>
      </section>

      <section className="border border-border px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-semibold">후속 지시</p>
          {relatedWorkItem ? (
            <button
              type="button"
              onClick={() => openWorkItem(relatedWorkItem)}
              className="max-w-[180px] truncate font-mono text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {workItemKey(relatedWorkItem)}
            </button>
          ) : (
        <span className="text-xs text-muted-foreground">연결된 업무 없음</span>
          )}
        </div>
        <form className="mt-3 space-y-3" onSubmit={submitFollowup}>
          <textarea
            value={followupDraft}
            onChange={(event) => setFollowupDraft(event.target.value)}
            className="min-h-24 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring disabled:opacity-60"
            placeholder={relatedWorkItem ? "다음 작업을 요청하세요" : "연결된 업무가 없는 실행입니다"}
            disabled={!relatedWorkItem || followupPosting}
          />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={wakeOnFollowup}
                onChange={(event) => setWakeOnFollowup(event.target.checked)}
                disabled={!relatedWorkItem || followupPosting}
                className="h-4 w-4 accent-primary"
              />
              담당자 깨우기
            </label>
            <Button type="submit" size="sm" disabled={!relatedWorkItem || !followupDraft.trim() || followupPosting} className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              {followupPosting ? "보내는 중" : "보내기"}
            </Button>
          </div>
        </form>
      </section>

      <section className="border border-border">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">연결된 오피스 업무</p>
        </div>
        {comments.length || messages.length || workOrders.length || workProducts.length || routineRuns.length ? (
          <div>
            {comments.map((comment) => {
              const item = workItemRefFromTarget(comment.itemType, comment.itemId);
              return (
                <EntityRow
                  key={comment.id}
                  title={`${comment.itemTitle} 댓글`}
                  subtitle={comment.body}
                  leading={<SquarePen className="h-4 w-4 text-muted-foreground" />}
                  trailing={<StatusBadge status={comment.status} />}
                  onClick={() => openWorkItem(item)}
                />
              );
            })}
            {messages.map((message) => (
              <EntityRow
                key={message.id}
                title={`${message.author}의 메시지`}
                subtitle={message.body}
                leading={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
                trailing={<StatusBadge status={message.status} />}
                onClick={() => {
                  onFocusAgent(message.agentId || run.agentId);
                  onOpenTab("comms");
                }}
              />
            ))}
            {workOrders.map((workOrder) => {
              return (
                <EntityRow
                  key={workOrder.id}
                  title={workOrder.title}
                  subtitle={`${workOrder.agentName ? compactAgentName(workOrder.agentName, data.name) : "미배정"} · ${workOrder.priority}`}
                  leading={<SquarePen className="h-4 w-4 text-muted-foreground" />}
                  trailing={<StatusBadge status={workOrder.status} />}
                  onClick={() => onOpenWorkOrder(workOrder.id)}
                />
              );
            })}
            {workProducts.map((product) => {
              const item = workItemRefFromTarget(product.itemType, product.itemId);
              return (
                <EntityRow
                  key={product.id}
                  title={product.title}
                  subtitle={`${product.itemTitle} · ${product.agentName ? compactAgentName(product.agentName, data.name) : product.author}`}
                  leading={<FileText className="h-4 w-4 text-muted-foreground" />}
                  trailing={<StatusBadge status={product.status} />}
                  onClick={() => openWorkItem(item)}
                />
              );
            })}
            {routineRuns.map((routineRun) => (
              <EntityRow
                key={routineRun.id}
                title={routineRun.routineTitle}
                subtitle={compactAgentName(routineRun.agentName, data.name)}
                leading={<Repeat2 className="h-4 w-4 text-muted-foreground" />}
                trailing={<StatusBadge status={routineRun.status} />}
                onClick={() => onOpenTab("routines")}
              />
            ))}
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-muted-foreground">이 실행에 연결된 메시지, 접수 업무 또는 루틴이 없습니다.</p>
        )}
      </section>

      {detail ? (
        <>
          <RunArtifactPanel title="출력" artifact={detail.artifacts.output} />
          <RunArtifactPanel title="지시문" artifact={detail.artifacts.prompt} />
        </>
      ) : (
        <p className="border border-border px-4 py-4 text-sm text-muted-foreground">실행 상세를 아직 불러오지 못했습니다.</p>
      )}
    </aside>
  );
}

function RunsTab({
  data,
  dispatchingRunner,
  focusedRunId,
  onAddComment,
  onDispatchRunner,
  onFocusAgent,
  onFocusRun,
  onOpenTab,
  onOpenWorkOrder,
  onOpenWorkItem,
  onUpdateRunStatus,
  postingCommentKey,
  runnerNotice,
  runs,
  updatingRunId,
}: {
  data: SpliceWorkspaceRoomData;
  dispatchingRunner: boolean;
  focusedRunId: string | null;
  onAddComment: (input: WorkThreadCommentInput) => void;
  onDispatchRunner: (dryRun: boolean) => void;
  onFocusAgent: (agentId: string) => void;
  onFocusRun: (runId: string) => void;
  onOpenTab: (tab: RoomTab) => void;
  onOpenWorkOrder: (workOrderId: string) => void;
  onOpenWorkItem: (item: WorkItemRef) => void;
  onUpdateRunStatus: (runId: string, status: string, error?: string) => void;
  postingCommentKey: string | null;
  runnerNotice: string | null;
  runs: SpliceRunMonitorData | null;
  updatingRunId: string | null;
}) {
  const runList = runs?.runs ?? data.requests;
  const counts = runs?.counts ?? runMonitorFallbackCounts(runList);
  const queuedCount = counts.requested + counts.launchReady;
  const activeRuns = runList.filter((run) => !run.expired && ["requested", "launch_ready", "launched"].includes(String(run.status)));
  const historyRuns = runList.filter((run) => run.expired || !["requested", "launch_ready", "launched"].includes(String(run.status)));
  const runIds = runList.map((run) => run.id).join("|");
  const [selectedRunId, setSelectedRunId] = useState(runList[0]?.id ?? "");

  useEffect(() => {
    if (!runList.length) {
      if (selectedRunId) setSelectedRunId("");
      return;
    }
    if (focusedRunId && runList.some((run) => run.id === focusedRunId)) {
      if (selectedRunId !== focusedRunId) {
        setSelectedRunId(focusedRunId);
      }
      return;
    }
    if (!selectedRunId || !runList.some((run) => run.id === selectedRunId)) {
      setSelectedRunId(runList[0].id);
    }
  }, [focusedRunId, runIds, runList, selectedRunId]);

  const selectRun = (runId: string) => {
    setSelectedRunId(runId);
    onFocusRun(runId);
  };

  const selectedRun = runList.find((run) => run.id === selectedRunId) ?? runList[0] ?? null;
  const selectedRunDetailQuery = useQuery({
    queryKey: [...WORKSPACE_ROOM_QUERY_ROOT, "run-detail", selectedRun?.id ?? "none"],
    queryFn: () => spliceApi.workspaceRoomRunDetail(PUZZLE_TESTBED_ID, selectedRun?.id ?? ""),
    enabled: Boolean(selectedRun?.id),
    refetchInterval: 3000,
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
        <SectionTitle title="실행 현황" aside={`실제 실행 ${counts.active} · 전체 기록 ${counts.total}`} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onDispatchRunner(true)}
            disabled={dispatchingRunner || queuedCount === 0}
            className="gap-1.5"
          >
            <Activity className={cn("h-3.5 w-3.5", dispatchingRunner && "animate-pulse")} />
            Dry Run
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onDispatchRunner(false)}
            disabled={dispatchingRunner || queuedCount === 0}
            className="gap-1.5"
          >
            <Rocket className={cn("h-3.5 w-3.5", dispatchingRunner && "animate-pulse")} />
            Dispatch
          </Button>
        </div>
      </div>

      {runnerNotice ? (
        <div className="border border-border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          {runnerNotice}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <MetricCard icon={Rocket} value={counts.active} label="실제 실행" description="프로세스 시작됨" />
        <MetricCard icon={Clock3} value={queuedCount} label="실행 대기" description={`${counts.launchReady} 준비 완료`} />
        <MetricCard icon={History} value={counts.expired} label="만료 기록" description="실시간 집계 제외" />
        <MetricCard icon={ShieldAlert} value={counts.failed} label="실패" description={`${counts.blocked} 막힘 · ${counts.noop} 무작업`} />
      </div>

      <section className="border border-border">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">실행 대기열</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{runs?.queuePath ?? data.requests[0]?.queue?.path ?? "실행 대기열 경로 없음"}</p>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 space-y-3">
          <SectionTitle title="현재 실행·대기" aside={`${activeRuns.length}`} />
          {activeRuns.length ? activeRuns.map((run) => (
            <RunMonitorCard
              key={run.id}
              data={data}
              onSelectRun={selectRun}
              run={run}
              selected={selectedRun?.id === run.id}
              updatingRunId={updatingRunId}
              onUpdateRunStatus={onUpdateRunStatus}
            />
          )) : (
            <p className="border border-border px-4 py-4 text-sm text-muted-foreground">현재 실행되거나 대기 중인 요청이 없습니다.</p>
          )}
        </section>

        <RunInspector
          data={data}
          detail={selectedRunDetailQuery.data ?? null}
          loading={selectedRunDetailQuery.isFetching}
          onAddComment={onAddComment}
          onFocusAgent={onFocusAgent}
          onOpenTab={onOpenTab}
          onOpenWorkOrder={onOpenWorkOrder}
          onOpenWorkItem={onOpenWorkItem}
          postingCommentKey={postingCommentKey}
          run={selectedRun}
        />
      </div>

      <section className="min-w-0 space-y-3">
        <SectionTitle title="실행 기록" aside={`${historyRuns.length}건`} />
        <div className="grid gap-3 xl:grid-cols-2">
          {historyRuns.length ? historyRuns.slice(0, 18).map((run) => (
            <RunMonitorCard
              key={run.id}
              data={data}
              onSelectRun={selectRun}
              run={run}
              selected={selectedRun?.id === run.id}
              updatingRunId={updatingRunId}
              onUpdateRunStatus={onUpdateRunStatus}
            />
          )) : (
            <p className="border border-border px-4 py-4 text-sm text-muted-foreground">아직 완료된 실행이 없습니다.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function ReviewGateSummary({ data, reviews }: { data: SpliceWorkspaceRoomData; reviews: SpliceReview[] }) {
  const requested = reviews.filter((review) => review.status === "requested");
  const decided = reviews.filter((review) => review.status !== "requested");

  return (
    <section className="space-y-3">
      <SectionTitle title="검수" aside={`대기 ${requested.length} · 처리 ${decided.length}`} />
      <div className="border border-border">
        {reviews.length ? reviews.slice(0, 6).map((review) => (
          <EntityRow
            key={review.id}
            title={review.title}
            subtitle={`${review.itemTitle} · ${review.reviewerAgentName ? compactAgentName(review.reviewerAgentName, data.name) : "검수자 미배정"}`}
            leading={<ShieldAlert className="h-4 w-4 text-muted-foreground" />}
            trailing={<StatusBadge status={review.status} />}
          />
        )) : (
          <p className="px-4 py-4 text-sm text-muted-foreground">아직 검토 요청이 없습니다.</p>
        )}
      </div>
    </section>
  );
}

function InboxItemCard({
  item,
  onOpenTab,
  onOpenRun,
  onOpenWorkOrder,
  onOpenWorkItem,
  onUpdateStatus,
  updatingItemId,
}: {
  item: SpliceInboxItem;
  onOpenTab: (tab: RoomTab) => void;
  onOpenRun: (runId: string) => void;
  onOpenWorkOrder: (workOrderId: string) => void;
  onOpenWorkItem: (item: WorkItemRef) => void;
  onUpdateStatus: (itemId: string, status: "open" | "done") => void;
  updatingItemId: string | null;
}) {
  const updating = updatingItemId === item.id;
  const targetTab = roomTabs.some((tab) => tab.value === item.targetTab) ? item.targetTab as RoomTab : "dashboard";
  const targetWorkItem = workItemRefFromTarget(item.targetType, item.targetId);
  const targetRunId = runIdFromTarget(item.targetType, item.targetId);
  const targetWorkOrderId = workOrderIdFromTarget(item.targetType, item.targetId);
  const openLabel = targetWorkItem ? "업무 책상 열기" : targetRunId ? "실행 열기" : targetWorkOrderId ? "업무 요청 열기" : `${roomTabLabel(targetTab)} 열기`;
  const openTarget = () => {
    if (targetWorkItem) {
      onOpenWorkItem(targetWorkItem);
      return;
    }
    if (targetRunId) {
      onOpenRun(targetRunId);
      return;
    }
    if (targetWorkOrderId) {
      onOpenWorkOrder(targetWorkOrderId);
      return;
    }
    onOpenTab(targetTab);
  };
  return (
    <article className={cn(
      "border border-border px-4 py-4",
      item.inboxStatus === "done" && "bg-muted/30 text-muted-foreground",
    )}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.kind} />
            <StatusBadge status={item.sourceStatus} />
            <span className="text-xs text-muted-foreground">{formatIsoAge(item.createdAt)}</span>
          </div>
          <h3 className="mt-2 truncate text-sm font-semibold">{item.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.subtitle}</p>
          {item.body ? <p className="mt-3 line-clamp-3 text-sm leading-6 text-foreground/80">{item.body}</p> : null}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openTarget}
          >
            {openLabel}
          </Button>
          {item.inboxStatus === "done" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onUpdateStatus(item.id, "open")}
              disabled={updating}
              className="gap-1.5"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", updating && "animate-spin")} />
              Reopen
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              onClick={() => onUpdateStatus(item.id, "done")}
              disabled={updating}
              className="gap-1.5"
            >
              <CheckCircle2 className={cn("h-3.5 w-3.5", updating && "animate-pulse")} />
              완료
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}

function InboxTab({
  inbox,
  onOpenTab,
  onOpenRun,
  onOpenWorkOrder,
  onOpenWorkItem,
  onUpdateStatus,
  updatingItemId,
}: {
  inbox: SpliceOfficeInboxData | null;
  onOpenTab: (tab: RoomTab) => void;
  onOpenRun: (runId: string) => void;
  onOpenWorkOrder: (workOrderId: string) => void;
  onOpenWorkItem: (item: WorkItemRef) => void;
  onUpdateStatus: (itemId: string, status: "open" | "done") => void;
  updatingItemId: string | null;
}) {
  const items = inbox?.items ?? [];
  const openItems = items.filter((item) => item.inboxStatus === "open");
  const doneItems = items.filter((item) => item.inboxStatus === "done");

  return (
    <div className="space-y-4">
      <SectionTitle title="사무실 신호함" aside={`열림 ${openItems.length} · 완료 ${doneItems.length}`} />
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <MetricCard icon={Inbox} value={inbox?.counts.open ?? 0} label="열림" description={`전체 ${inbox?.counts.total ?? 0}건`} />
        <MetricCard icon={ShieldAlert} value={inbox?.counts.reviews ?? 0} label="검수" description="결정 필요" />
        <MetricCard icon={Activity} value={inbox?.counts.runs ?? 0} label="깨우기" description="대기 또는 실행 중" />
        <MetricCard icon={SquarePen} value={inbox?.counts.workOrders ?? 0} label="접수" description={`대화 ${inbox?.counts.messages ?? 0} · 막힘 ${inbox?.counts.blocked ?? 0}`} />
      </div>

      <section className="space-y-3">
        <SectionTitle title="열린 항목" aside={`${openItems.length}건`} />
        {openItems.length ? (
          <div className="grid gap-3">
            {openItems.map((item) => (
              <InboxItemCard
                key={item.id}
                item={item}
                onOpenTab={onOpenTab}
                onOpenRun={onOpenRun}
                onOpenWorkOrder={onOpenWorkOrder}
                onOpenWorkItem={onOpenWorkItem}
                onUpdateStatus={onUpdateStatus}
                updatingItemId={updatingItemId}
              />
            ))}
          </div>
        ) : (
          <p className="border border-border px-4 py-4 text-sm text-muted-foreground">열린 신호가 없습니다.</p>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle title="완료" aside={`${doneItems.length}건`} />
        {doneItems.length ? (
          <div className="grid gap-3">
            {doneItems.slice(0, 12).map((item) => (
              <InboxItemCard
                key={item.id}
                item={item}
                onOpenTab={onOpenTab}
                onOpenRun={onOpenRun}
                onOpenWorkOrder={onOpenWorkOrder}
                onOpenWorkItem={onOpenWorkItem}
                onUpdateStatus={onUpdateStatus}
                updatingItemId={updatingItemId}
              />
            ))}
          </div>
        ) : (
          <p className="border border-border px-4 py-4 text-sm text-muted-foreground">아직 완료된 신호가 없습니다.</p>
        )}
      </section>
    </div>
  );
}

function GoalsTab({ goals, projects, issues }: { goals: Goal[]; projects: Project[]; issues: Issue[] }) {
  const okrCount = goals.filter((goal) => goal.kind === "objective" || goal.kind === "key_result").length;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionTitle title="미션 · 비전" aside="최상위 기준" />
        <MissionVisionCards goals={goals} goalLink={() => null} />
      </section>

      <section className="space-y-3">
        <SectionTitle title="목표와 핵심 결과" aside={`${okrCount}개 항목`} />
        <OkrTree goals={goals} projects={projects} issues={issues} />
      </section>
    </div>
  );
}

function ProjectsTab({ projects }: { projects: SpliceWorkspaceRoomProject[] }) {
  return (
    <div className="space-y-4">
      <SectionTitle title="프로젝트" aside={`진행 ${projects.length}개`} />
      <div className="border border-border">
        {projects.map((project) => (
          <EntityRow
            key={project.id}
            identifier={project.id}
            title={project.title}
            subtitle={plainSummary(project.description, `${project.ownerName} · 이슈 ${project.issueTotal}개`)}
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

function IntakeTab({
  creatingWorkOrder,
  data,
  focusedWorkOrderId,
  onCreateWorkOrder,
  onFocusAgent,
  onOpenRun,
  onOpenTab,
  onOpenWorkItem,
  onUpdateWorkOrderStatus,
  updatingWorkOrderId,
  workOrders,
}: {
  creatingWorkOrder: boolean;
  data: SpliceWorkspaceRoomData;
  focusedWorkOrderId: string | null;
  onCreateWorkOrder: (input: { title: string; body: string; agentId?: string | null; projectId?: string | null; priority?: string; wakeAgent?: boolean }) => void;
  onFocusAgent: (agentId: string) => void;
  onOpenRun: (runId: string) => void;
  onOpenTab: (tab: RoomTab) => void;
  onOpenWorkItem: (item: WorkItemRef) => void;
  onUpdateWorkOrderStatus: (workOrderId: string, status: string, wakeAgent?: boolean) => void;
  updatingWorkOrderId: string | null;
  workOrders: SpliceWorkOrdersData | null;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [agentId, setAgentId] = useState(data.agents[0]?.id ?? "");
  const [projectId, setProjectId] = useState("");
  const [priority, setPriority] = useState("medium");
  const [wakeAgent, setWakeAgent] = useState(true);
  const orders = workOrders?.workOrders ?? [];
  const firstOrderId = orders[0]?.id ?? "";
  const [selectedOrderId, setSelectedOrderId] = useState(firstOrderId);

  useEffect(() => {
    if (!data.agents.length) return;
    if (!agentId || !data.agents.some((agent) => agent.id === agentId)) {
      setAgentId(data.agents[0].id);
    }
  }, [agentId, data.agents]);

  useEffect(() => {
    if (!orders.length) {
      if (selectedOrderId) setSelectedOrderId("");
      return;
    }
    if (focusedWorkOrderId && orders.some((order) => order.id === focusedWorkOrderId)) {
      if (selectedOrderId !== focusedWorkOrderId) setSelectedOrderId(focusedWorkOrderId);
      return;
    }
    if (!selectedOrderId || !orders.some((order) => order.id === selectedOrderId)) {
      setSelectedOrderId(firstOrderId);
    }
  }, [firstOrderId, focusedWorkOrderId, orders, selectedOrderId]);

  const submitWorkOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();
    if (!trimmedTitle || !trimmedBody || creatingWorkOrder) return;
    setTitle("");
    setBody("");
    onCreateWorkOrder({
      title: trimmedTitle,
      body: trimmedBody,
      agentId: agentId || null,
      projectId: projectId || null,
      priority,
      wakeAgent,
    });
  };
  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? null;
  const visibleOrders = selectedOrder
    ? [selectedOrder, ...orders.filter((order) => order.id !== selectedOrder.id)]
    : orders;

  return (
    <div className="space-y-4">
      <SectionTitle title="업무 접수" aside={`열림 ${workOrders?.counts.open ?? 0}건`} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="border border-border">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">새 업무 접수</p>
            <p className="mt-0.5 text-xs text-muted-foreground">이 오피스에 PaperClip 방식 업무 신호를 만듭니다.</p>
          </div>
          <form className="space-y-3 px-4 py-4" onSubmit={submitWorkOrder}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-9 w-full border border-border bg-background px-3 text-sm outline-none focus:border-ring"
              placeholder="업무 제목"
              disabled={creatingWorkOrder}
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="min-h-36 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              placeholder="에이전트가 해야 할 일을 적으세요"
              disabled={creatingWorkOrder}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="min-w-0 text-xs font-medium text-muted-foreground">
                Agent
                <select
                  value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                  className="mt-1 h-9 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
                  disabled={creatingWorkOrder}
                >
                  {data.agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {compactAgentName(agent.name, data.name)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-xs font-medium text-muted-foreground">
                Project
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className="mt-1 h-9 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
                  disabled={creatingWorkOrder}
                >
                  <option value="">프로젝트 연결 없음</option>
                  {data.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
              <label className="min-w-0 text-xs font-medium text-muted-foreground">
                Priority
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="mt-1 h-9 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
                  disabled={creatingWorkOrder}
                >
                  <option value="low">낮음</option>
                  <option value="medium">보통</option>
                  <option value="high">높음</option>
                  <option value="urgent">긴급</option>
                </select>
              </label>
              <label className="flex items-center gap-2 self-end border border-border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={wakeAgent}
                  onChange={(event) => setWakeAgent(event.target.checked)}
                  disabled={creatingWorkOrder}
                />
                에이전트 깨우기
              </label>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!title.trim() || !body.trim() || creatingWorkOrder} className="gap-1.5">
                <Rocket className={cn("h-3.5 w-3.5", creatingWorkOrder && "animate-pulse")} />
                {creatingWorkOrder ? "만드는 중" : "만들고 대기열에 추가"}
              </Button>
            </div>
          </form>
        </section>

        <section className="border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">접수 대기열</p>
            <span className="text-xs text-muted-foreground">{orders.length}</span>
          </div>
          <div className="divide-y divide-border">
            {visibleOrders.length ? visibleOrders.map((order) => {
              const updating = updatingWorkOrderId === order.id;
              const selected = order.id === selectedOrderId;
              const runRequestId = order.runRequestId;
              const agentIdForOrder = order.agentId;
              const projectTarget = order.projectId ? workItemRefFromTarget("project", order.projectId) : null;
              return (
                <article
                  key={order.id}
                  className={cn("px-4 py-4", selected && "bg-muted/45 ring-1 ring-inset ring-ring/35")}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-sm font-semibold">{order.title}</p>
                      <StatusBadge status={order.status} />
                      {selected ? <span className="rounded-full bg-background px-2 py-0.5 text-[11px] text-muted-foreground">선택됨</span> : null}
                    </div>
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {order.agentName ? compactAgentName(order.agentName, data.name) : "미배정"} · {order.projectName || "프로젝트 없음"} · {order.priority} · {formatIsoAge(order.createdAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{order.body}</p>
                    {selected ? (
                      <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                        <div className="min-w-0 border border-border bg-background px-2.5 py-2">
                          <span className="block text-[10px] font-medium uppercase tracking-wider">실행</span>
                          <span className="mt-1 block truncate font-mono">{runRequestId ?? "연결된 실행 없음"}</span>
                        </div>
                        <div className="min-w-0 border border-border bg-background px-2.5 py-2">
                          <span className="block text-[10px] font-medium uppercase tracking-wider">에이전트</span>
                          <span className="mt-1 block truncate">{order.agentName ? compactAgentName(order.agentName, data.name) : "미배정"}</span>
                        </div>
                        <div className="min-w-0 border border-border bg-background px-2.5 py-2">
                          <span className="block text-[10px] font-medium uppercase tracking-wider">프로젝트</span>
                          <span className="mt-1 block truncate">{order.projectName ?? "프로젝트 없음"}</span>
                        </div>
                      </div>
                    ) : null}
                    {selected && order.verdict?.line ? (
                      <p className="mt-2 line-clamp-2 break-words font-mono text-[11px] text-muted-foreground">{order.verdict.line}</p>
                    ) : null}
                    {order.error ? (
                      <p className="mt-2 line-clamp-2 break-words text-xs text-red-600 dark:text-red-300">{order.error}</p>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {runRequestId ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenRun(runRequestId)}
                        className="gap-1.5"
                      >
                        <Rocket className="h-3.5 w-3.5" />
                        Run
                      </Button>
                    ) : null}
                    {agentIdForOrder ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          onFocusAgent(agentIdForOrder);
                          onOpenTab("comms");
                        }}
                        className="gap-1.5"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Talk
                      </Button>
                    ) : null}
                    {projectTarget ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onOpenWorkItem(projectTarget)}
                        className="gap-1.5"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        Work
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={selected}
                      onClick={() => setSelectedOrderId(order.id)}
                    >
                      Focus
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={updating || order.status === "in_progress"}
                      onClick={() => onUpdateWorkOrderStatus(order.id, "in_progress", true)}
                    >
                      시작하고 깨우기
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={updating || order.status === "blocked"}
                      onClick={() => onUpdateWorkOrderStatus(order.id, "blocked")}
                    >
                      Block
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={updating || order.status === "done"}
                      onClick={() => onUpdateWorkOrderStatus(order.id, "done")}
                    >
                      완료
                    </Button>
                  </div>
                </article>
              );
            }) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">아직 접수된 업무가 없습니다.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function IssuesTab({
  data,
  onOpenWorkItem,
}: {
  data: SpliceWorkspaceRoomData;
  onOpenWorkItem: (item: WorkItemRef) => void;
}) {
  const lanes: Array<{ title: string; items: SpliceWorkspaceRoomWorkItem[] }> = [
    { title: "지금", items: data.lanes.active },
    { title: "검수", items: data.lanes.review },
    { title: "다음", items: data.lanes.next },
    { title: "막힘", items: data.lanes.blocked },
  ];

  return (
    <div className="space-y-6">
      {lanes.map((lane) => (
        <section key={lane.title} className="space-y-3">
          <SectionTitle title={lane.title} aside={`이슈 ${lane.items.length}개`} />
          <WorkItemList items={lane.items} empty={`${lane.title} 업무가 없습니다.`} onOpenWorkItem={onOpenWorkItem} />
        </section>
      ))}
    </div>
  );
}

function workItemKey(item: WorkItemRef): string {
  return `${item.type}:${item.id}`;
}

function workItemRefFromTarget(type: string | null | undefined, id: string | null | undefined): WorkItemRef | null {
  const normalizedType = String(type || "").trim();
  const normalizedId = String(id || "").trim();
  if (!normalizedId) return null;
  if (normalizedType !== "project" && normalizedType !== "issue") return null;
  return { type: normalizedType, id: normalizedId };
}

function runIdFromTarget(type: string | null | undefined, id: string | null | undefined): string | null {
  const normalizedType = String(type || "").trim();
  const normalizedId = String(id || "").trim();
  if (!normalizedId) return null;
  return normalizedType === "run" ? normalizedId : null;
}

function workOrderIdFromTarget(type: string | null | undefined, id: string | null | undefined): string | null {
  const normalizedType = String(type || "").trim();
  const normalizedId = String(id || "").trim();
  if (!normalizedId) return null;
  return normalizedType === "work_order" ? normalizedId : null;
}

function reviewBodyFromProduct(product: SpliceWorkProduct): string {
  const body = product.body.trim();
  const clippedBody = body.length > 3400 ? `${body.slice(0, 3397)}...` : body;
  return [
    `Work product ready for review: ${product.title}`,
    product.sourceRunRequestId ? `Run: ${product.sourceRunRequestId}` : null,
    "",
    clippedBody,
  ].filter((line) => line !== null).join("\n");
}

function WorkDeskTab({
  comments,
  data,
  focusedWorkItemKey,
  onAddComment,
  onAddWorkProduct,
  onFocusWorkItem,
  onOpenRun,
  onRequestReview,
  postingCommentKey,
  requestingReviewProductId,
  savingProductKey,
  workProducts,
}: {
  comments: SpliceWorkThreadComment[];
  data: SpliceWorkspaceRoomData;
  focusedWorkItemKey: string | null;
  onAddComment: (input: WorkThreadCommentInput) => void;
  onAddWorkProduct: (input: { itemType: string; itemId: string; title: string; body: string; kind?: string }) => void;
  onFocusWorkItem: (item: WorkItemRef) => void;
  onOpenRun: (runId: string) => void;
  onRequestReview: (input: { itemType: string; itemId: string; title: string; body: string; reviewerAgentId?: string | null; sourceWorkProductId?: string | null }) => void;
  postingCommentKey: string | null;
  requestingReviewProductId: string | null;
  savingProductKey: string | null;
  workProducts: SpliceWorkProduct[];
}) {
  const deskItems = [
    ...data.lanes.active,
    ...data.lanes.review,
    ...data.lanes.next,
    ...data.lanes.blocked,
    ...data.projects,
  ];
  const firstKey = deskItems[0] ? workItemKey(deskItems[0]) : "";
  const [selectedKey, setSelectedKey] = useState(firstKey);
  const [commentDraft, setCommentDraft] = useState("");
  const [wakeOnComment, setWakeOnComment] = useState(true);
  const [productTitle, setProductTitle] = useState("");
  const [productBody, setProductBody] = useState("");

  useEffect(() => {
    if (!deskItems.length) {
      if (selectedKey) setSelectedKey("");
      return;
    }
    if (focusedWorkItemKey && deskItems.some((item) => workItemKey(item) === focusedWorkItemKey)) {
      if (selectedKey !== focusedWorkItemKey) {
        setSelectedKey(focusedWorkItemKey);
      }
      return;
    }
    if (!selectedKey || !deskItems.some((item) => workItemKey(item) === selectedKey)) {
      setSelectedKey(firstKey);
    }
  }, [deskItems, firstKey, focusedWorkItemKey, selectedKey]);

  const selectedItem = deskItems.find((item) => workItemKey(item) === selectedKey) ?? deskItems[0] ?? null;
  const selectedComments = selectedItem
    ? comments.filter((comment) => comment.itemType === selectedItem.type && comment.itemId === selectedItem.id).slice(0, 50).reverse()
    : [];
  const selectedProducts = selectedItem
    ? workProducts.filter((product) => product.itemType === selectedItem.type && product.itemId === selectedItem.id)
    : [];
  const activeKey = selectedItem ? workItemKey(selectedItem) : "";
  const postingComment = postingCommentKey === activeKey;
  const savingProduct = savingProductKey === activeKey;

  const submitComment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = commentDraft.trim();
    if (!selectedItem || !body || postingComment) return;
    setCommentDraft("");
    onAddComment({ itemType: selectedItem.type, itemId: selectedItem.id, body, wakeAgent: wakeOnComment });
  };

  const submitWorkProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = productTitle.trim();
    const body = productBody.trim();
    if (!selectedItem || !title || !body || savingProduct) return;
    setProductTitle("");
    setProductBody("");
    onAddWorkProduct({ itemType: selectedItem.type, itemId: selectedItem.id, title, body, kind: "note" });
  };

  if (!selectedItem) {
    return (
      <div className="space-y-4">
        <SectionTitle title="업무 책상" aside="항목 없음" />
        <p className="border border-border px-4 py-4 text-sm text-muted-foreground">업무 항목을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const body = displayMarkdownBody(selectedItem.description);

  return (
    <div className="space-y-4">
      <SectionTitle title="업무 책상" aside={`${deskItems.length}개 항목`} />
      <div className="grid min-h-[620px] gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="min-w-0 border border-border">
          {deskItems.map((item) => {
            const key = workItemKey(item);
            const active = key === activeKey;
            const itemComments = comments.filter((comment) => comment.itemType === item.type && comment.itemId === item.id).length;
            const itemProducts = workProducts.filter((product) => product.itemType === item.type && product.itemId === item.id).length;
            return (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setSelectedKey(key);
                  onFocusWorkItem(item);
                }}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left last:border-b-0",
                  active ? "bg-muted" : "bg-background hover:bg-muted/60",
                )}
              >
                {item.type === "project" ? (
                  <Flag className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                ) : (
                  <CircleDot className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.ownerName} · {item.status}</p>
                  <div className="mt-2 flex gap-1.5 text-[11px] text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5">{itemComments} comments</span>
                    <span className="rounded-full bg-muted px-2 py-0.5">{itemProducts} products</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <section className="min-w-0 space-y-4">
          <div className="border border-border px-4 py-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{selectedItem.type}</p>
                <h2 className="mt-1 text-lg font-semibold">{selectedItem.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{selectedItem.ownerName} · {selectedItem.projectName}</p>
              </div>
              <StatusBadge status={selectedItem.status} ns={selectedItem.type === "project" ? "project" : "issue"} />
            </div>
            {body ? (
              <MarkdownBody className="mt-4 text-sm text-muted-foreground prose-p:my-2 prose-ul:my-2 prose-li:my-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                {body}
              </MarkdownBody>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">본문이 없습니다.</p>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="min-w-0 border border-border">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">업무 대화</p>
                <span className="text-xs text-muted-foreground">{selectedComments.length}</span>
              </div>
              <div className="max-h-[360px] overflow-y-auto px-4 py-4">
                {selectedComments.length ? selectedComments.map((comment) => (
                  <article key={comment.id} className="border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className="text-xs font-medium">{comment.author}</span>
                        {comment.runRequestId ? <StatusBadge status="wake" /> : null}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">{formatIsoAge(comment.createdAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-sm leading-6">{comment.body}</p>
                    {comment.runRequestId ? (
                      <button
                        type="button"
                        onClick={() => comment.runRequestId && onOpenRun(comment.runRequestId)}
                        className="mt-2 max-w-full truncate font-mono text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        wake · {comment.runRequestId}
                      </button>
                    ) : null}
                  </article>
                )) : (
                  <p className="text-sm text-muted-foreground">아직 댓글이 없습니다.</p>
                )}
              </div>
              <form className="border-t border-border px-4 py-4" onSubmit={submitComment}>
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  className="min-h-24 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  placeholder="의견"
                  disabled={postingComment}
                />
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <label className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={wakeOnComment}
                      onChange={(event) => setWakeOnComment(event.target.checked)}
                      disabled={postingComment}
                      className="h-4 w-4 accent-primary"
                    />
                    담당자 깨우기
                  </label>
                  <Button type="submit" size="sm" disabled={!commentDraft.trim() || postingComment} className="gap-1.5">
                    <MessageSquare className={cn("h-3.5 w-3.5", postingComment && "animate-pulse")} />
                    {postingComment ? "등록 중" : "의견 등록"}
                  </Button>
                </div>
              </form>
            </section>

            <section className="min-w-0 border border-border">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">산출물</p>
                <span className="text-xs text-muted-foreground">{selectedProducts.length}</span>
              </div>
              <div className="max-h-[360px] overflow-y-auto px-4 py-4">
                {selectedProducts.length ? selectedProducts.map((product) => {
                  const agentProduct = product.author === "agent" || Boolean(product.sourceRunRequestId);
                  const requestingProductReview = requestingReviewProductId === product.id;
                  return (
                    <article key={product.id} className="border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <p className="truncate text-sm font-semibold">{product.title}</p>
                            {agentProduct ? (
                              <span className="shrink-0 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-700 dark:text-emerald-300">
                                agent result
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {product.agentName ? compactAgentName(product.agentName, data.name) : product.author} · {product.kind}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className="hidden text-xs text-muted-foreground sm:inline">{formatIsoAge(product.createdAt)}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onRequestReview({
                              itemType: product.itemType,
                              itemId: product.itemId,
                              title: `Review ${product.title}`,
                              body: reviewBodyFromProduct(product),
                              reviewerAgentId: null,
                              sourceWorkProductId: product.id,
                            })}
                            disabled={requestingProductReview}
                            className="h-7 gap-1.5 px-2"
                          >
                            <ShieldAlert className={cn("h-3.5 w-3.5", requestingProductReview && "animate-pulse")} />
                            {requestingProductReview ? "보내는 중" : "검수 요청"}
                          </Button>
                        </div>
                      </div>
                      {product.sourceRunRequestId ? (
                        <button
                          type="button"
                          onClick={() => product.sourceRunRequestId && onOpenRun(product.sourceRunRequestId)}
                          className="mb-2 max-w-full truncate font-mono text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          run · {product.sourceRunRequestId}
                        </button>
                      ) : null}
                      <MarkdownBody className="text-sm text-muted-foreground prose-p:my-2 prose-ul:my-2 prose-li:my-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        {product.body}
                      </MarkdownBody>
                    </article>
                  );
                }) : (
                  <p className="text-sm text-muted-foreground">아직 산출물이 없습니다.</p>
                )}
              </div>
              <form className="space-y-3 border-t border-border px-4 py-4" onSubmit={submitWorkProduct}>
                <input
                  value={productTitle}
                  onChange={(event) => setProductTitle(event.target.value)}
                  className="h-9 w-full border border-border bg-background px-3 text-sm outline-none focus:border-ring"
                  placeholder="결과 제목"
                  disabled={savingProduct}
                />
                <textarea
                  value={productBody}
                  onChange={(event) => setProductBody(event.target.value)}
                  className="min-h-24 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  placeholder="결과 내용"
                  disabled={savingProduct}
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={!productTitle.trim() || !productBody.trim() || savingProduct} className="gap-1.5">
                    <FileText className={cn("h-3.5 w-3.5", savingProduct && "animate-pulse")} />
                    {savingProduct ? "저장 중" : "산출물 저장"}
                  </Button>
                </div>
              </form>
            </section>
          </div>
        </section>
      </div>
    </div>
  );
}

function ReviewGateTab({
  data,
  decidingReviewId,
  onDecideReview,
  onOpenRun,
  onRequestReview,
  requestingReviewKey,
  reviews,
}: {
  data: SpliceWorkspaceRoomData;
  decidingReviewId: string | null;
  onDecideReview: (reviewId: string, decision: "approved" | "changes_requested" | "rejected", body: string, wakeAgent: boolean) => void;
  onOpenRun: (runId: string) => void;
  onRequestReview: (input: { itemType: string; itemId: string; title: string; body: string; reviewerAgentId?: string | null }) => void;
  requestingReviewKey: string | null;
  reviews: SpliceReview[];
}) {
  const reviewItems = [
    ...data.lanes.review,
    ...data.lanes.active,
    ...data.lanes.next,
    ...data.lanes.blocked,
    ...data.projects,
  ];
  const firstItemKey = reviewItems[0] ? workItemKey(reviewItems[0]) : "";
  const [selectedItemKey, setSelectedItemKey] = useState(firstItemKey);
  const [selectedReviewId, setSelectedReviewId] = useState(reviews[0]?.id ?? "");
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");
  const [reviewerAgentId, setReviewerAgentId] = useState(data.agents[0]?.id ?? "");
  const [decisionBody, setDecisionBody] = useState("");
  const [wakeOnDecision, setWakeOnDecision] = useState(true);

  useEffect(() => {
    if (reviewItems.length && (!selectedItemKey || !reviewItems.some((item) => workItemKey(item) === selectedItemKey))) {
      setSelectedItemKey(firstItemKey);
    }
  }, [firstItemKey, reviewItems, selectedItemKey]);

  useEffect(() => {
    if (!reviews.length) {
      setSelectedReviewId("");
      return;
    }
    if (!selectedReviewId || !reviews.some((review) => review.id === selectedReviewId)) {
      setSelectedReviewId(reviews[0].id);
    }
  }, [reviews, selectedReviewId]);

  useEffect(() => {
    if (!data.agents.length) return;
    if (!reviewerAgentId || !data.agents.some((agent) => agent.id === reviewerAgentId)) {
      setReviewerAgentId(data.agents[0].id);
    }
  }, [data.agents, reviewerAgentId]);

  const selectedItem = reviewItems.find((item) => workItemKey(item) === selectedItemKey) ?? reviewItems[0] ?? null;
  const selectedReview = reviews.find((review) => review.id === selectedReviewId) ?? reviews[0] ?? null;
  const activeItemKey = selectedItem ? workItemKey(selectedItem) : "";
  const requestingReview = requestingReviewKey === activeItemKey;
  const decidingReview = Boolean(selectedReview && decidingReviewId === selectedReview.id);

  const submitReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedItem || requestingReview) return;
    const title = reviewTitle.trim() || `Review ${selectedItem.title}`;
    const body = reviewBody.trim();
    if (!body) return;
    setReviewTitle("");
    setReviewBody("");
    onRequestReview({
      itemType: selectedItem.type,
      itemId: selectedItem.id,
      title,
      body,
      reviewerAgentId: reviewerAgentId || null,
    });
  };

  const submitDecision = (decision: "approved" | "changes_requested" | "rejected") => {
    if (!selectedReview || decidingReview) return;
    const body = decisionBody.trim();
    if (!body) return;
    setDecisionBody("");
    onDecideReview(selectedReview.id, decision, body, decision !== "approved" && wakeOnDecision);
  };

  if (!selectedItem) {
    return (
      <div className="space-y-4">
        <SectionTitle title="검수" aside="항목 없음" />
        <p className="border border-border px-4 py-4 text-sm text-muted-foreground">업무 항목을 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="검수" aside={`검수 ${reviews.length}건`} />
      <div className="grid min-h-[620px] gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="min-w-0 border border-border">
          {reviewItems.map((item) => {
            const key = workItemKey(item);
            const active = key === activeItemKey;
            const itemReviews = reviews.filter((review) => review.itemType === item.type && review.itemId === item.id);
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedItemKey(key)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left last:border-b-0",
                  active ? "bg-muted" : "bg-background hover:bg-muted/60",
                )}
              >
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.ownerName} · {item.status}</p>
                  <div className="mt-2 flex gap-1.5 text-[11px] text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5">{itemReviews.length} reviews</span>
                    <span className="rounded-full bg-muted px-2 py-0.5">
                      {itemReviews.filter((review) => review.status === "requested").length} pending
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <section className="min-w-0 space-y-4">
          <div className="grid gap-4 xl:grid-cols-2">
            <section className="border border-border">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">검토 요청</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{selectedItem.title}</p>
              </div>
              <form className="space-y-3 px-4 py-4" onSubmit={submitReview}>
                <input
                  value={reviewTitle}
                  onChange={(event) => setReviewTitle(event.target.value)}
                  className="h-9 w-full border border-border bg-background px-3 text-sm outline-none focus:border-ring"
                  placeholder={`${selectedItem.title} 검토`}
                  disabled={requestingReview}
                />
                <select
                  value={reviewerAgentId}
                  onChange={(event) => setReviewerAgentId(event.target.value)}
                  className="h-9 w-full border border-border bg-background px-3 text-sm outline-none focus:border-ring"
                  disabled={requestingReview}
                >
                  {data.agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {compactAgentName(agent.name, data.name)}
                    </option>
                  ))}
                </select>
                <textarea
                  value={reviewBody}
                  onChange={(event) => setReviewBody(event.target.value)}
                  className="min-h-28 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  placeholder="검수 요청"
                  disabled={requestingReview}
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={!reviewBody.trim() || requestingReview} className="gap-1.5">
                    <ShieldAlert className={cn("h-3.5 w-3.5", requestingReview && "animate-pulse")} />
                    {requestingReview ? "요청 중" : "검수 요청"}
                  </Button>
                </div>
              </form>
            </section>

            <section className="border border-border">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">검토 대기열</p>
                <span className="text-xs text-muted-foreground">{reviews.length}</span>
              </div>
              <div className="max-h-[330px] overflow-y-auto">
                {reviews.length ? reviews.map((review) => {
                  const active = selectedReview?.id === review.id;
                  return (
                    <button
                      key={review.id}
                      type="button"
                      onClick={() => setSelectedReviewId(review.id)}
                      className={cn(
                        "flex w-full items-start justify-between gap-3 border-b border-border px-4 py-3 text-left last:border-b-0",
                        active ? "bg-muted" : "bg-background hover:bg-muted/60",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold">{review.title}</p>
                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {review.itemTitle} · {review.reviewerAgentName ? compactAgentName(review.reviewerAgentName, data.name) : "미배정"}
                        </p>
                        {review.sourceWorkProductTitle ? (
                          <p className="mt-1 truncate text-[11px] text-muted-foreground">
                            product · {review.sourceWorkProductTitle}
                          </p>
                        ) : null}
                      </div>
                      <StatusBadge status={review.status} />
                    </button>
                  );
                }) : (
                  <p className="px-4 py-4 text-sm text-muted-foreground">아직 검토 요청이 없습니다.</p>
                )}
              </div>
            </section>
          </div>

          <section className="border border-border">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">검토 결정</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {selectedReview ? selectedReview.title : "선택한 검수 없음"}
              </p>
            </div>
            {selectedReview ? (
              <div className="grid gap-4 px-4 py-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,0.8fr)]">
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{selectedReview.itemTitle}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Requested {formatIsoAge(selectedReview.createdAt)} · {selectedReview.ownerName}
                      </p>
                      {selectedReview.sourceWorkProductTitle ? (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          Work product · {selectedReview.sourceWorkProductTitle}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge status={selectedReview.status} />
                  </div>
                  <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-foreground/90">{selectedReview.body}</p>
                  <div className="mt-4 space-y-3">
                    {selectedReview.decisions.length ? selectedReview.decisions.map((decision) => (
                      <article key={decision.id} className="border border-border px-3 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{decision.decision}</p>
                          <span className="text-xs text-muted-foreground">{formatIsoAge(decision.createdAt)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{decision.body}</p>
                        {decision.runRequestId ? (
                          <button
                            type="button"
                            onClick={() => decision.runRequestId && onOpenRun(decision.runRequestId)}
                            className="mt-2 max-w-full truncate font-mono text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                          >
                            wake · {decision.runRequestId}
                          </button>
                        ) : null}
                      </article>
                    )) : (
                      <p className="text-sm text-muted-foreground">아직 결정이 없습니다.</p>
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <textarea
                    value={decisionBody}
                    onChange={(event) => setDecisionBody(event.target.value)}
                    className="min-h-32 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    placeholder="결정 메모"
                    disabled={decidingReview}
                  />
                  <label className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={wakeOnDecision}
                      onChange={(event) => setWakeOnDecision(event.target.checked)}
                      disabled={decidingReview}
                      className="h-4 w-4 accent-primary"
                    />
                    변경 요청 시 담당자 깨우기
                  </label>
                  <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:grid-cols-1">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => submitDecision("approved")}
                      disabled={!decisionBody.trim() || decidingReview}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => submitDecision("changes_requested")}
                      disabled={!decisionBody.trim() || decidingReview}
                    >
                      Request Changes
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => submitDecision("rejected")}
                      disabled={!decisionBody.trim() || decidingReview}
                    >
                      Reject
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">선택된 검토가 없습니다.</p>
            )}
          </section>
        </section>
      </div>
    </div>
  );
}

function ApprovalsTab({
  approvals,
  creatingApproval,
  data,
  decidingApprovalId,
  onCreateApproval,
  onDecideApproval,
}: {
  approvals: SpliceOfficeApprovalsData | null;
  creatingApproval: boolean;
  data: SpliceWorkspaceRoomData;
  decidingApprovalId: string | null;
  onCreateApproval: (input: { agentId?: string | null; kind: string; title: string; body: string }) => void;
  onDecideApproval: (approvalId: string, decision: "approved" | "changes_requested" | "rejected", body: string, wakeAgent: boolean) => void;
}) {
  const approvalItems = approvals?.approvals ?? [];
  const [selectedApprovalId, setSelectedApprovalId] = useState(approvalItems[0]?.id ?? "");
  const [agentId, setAgentId] = useState(data.agents[0]?.id ?? "");
  const [kind, setKind] = useState("agent_action");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [decisionBody, setDecisionBody] = useState("");
  const [wakeAgent, setWakeAgent] = useState(true);

  useEffect(() => {
    if (!approvalItems.length) return;
    if (!selectedApprovalId || !approvalItems.some((approval) => approval.id === selectedApprovalId)) {
      setSelectedApprovalId(approvalItems[0].id);
    }
  }, [approvalItems, selectedApprovalId]);

  useEffect(() => {
    if (!data.agents.length) return;
    if (!agentId || !data.agents.some((agent) => agent.id === agentId)) {
      setAgentId(data.agents[0].id);
    }
  }, [agentId, data.agents]);

  const selectedApproval = approvalItems.find((approval) => approval.id === selectedApprovalId) ?? approvalItems[0] ?? null;
  const decidingApproval = Boolean(selectedApproval && decidingApprovalId === selectedApproval.id);
  const pendingStatuses = new Set(["requested", "changes_requested"]);
  const pending = approvalItems.filter((approval) => pendingStatuses.has(approval.status));
  const decided = approvalItems.filter((approval) => !pendingStatuses.has(approval.status));

  const submitApproval = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextTitle = title.trim();
    const nextBody = body.trim();
    if (!nextTitle || !nextBody || creatingApproval) return;
    onCreateApproval({
      agentId: agentId || null,
      kind,
      title: nextTitle,
      body: nextBody,
    });
    setTitle("");
    setBody("");
  };

  const submitDecision = (decision: "approved" | "changes_requested" | "rejected") => {
    const note = decisionBody.trim();
    if (!selectedApproval || !note || decidingApproval) return;
    onDecideApproval(selectedApproval.id, decision, note, wakeAgent);
    setDecisionBody("");
  };

  return (
    <div className="space-y-4">
      <SectionTitle title="승인" aside={`대기 ${pending.length} · 처리 ${decided.length}`} />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <MetricCard icon={CheckCircle2} value={approvals?.counts.pending ?? 0} label="대기" description="결정 필요" />
        <MetricCard icon={Activity} value={approvals?.counts.total ?? 0} label="요청" description="승인 대기열" />
        <MetricCard icon={ShieldAlert} value={approvals?.counts.changesRequested ?? 0} label="수정 요청" description="되돌려 보냄" />
        <MetricCard icon={CheckCircle2} value={approvals?.counts.approved ?? 0} label="승인" description="처리 완료" />
      </div>

      <div className="grid min-h-[640px] gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <section className="min-w-0 border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">승인 대기열</p>
            <span className="text-xs text-muted-foreground">{approvalItems.length}</span>
          </div>
          <div className="max-h-[590px] overflow-y-auto">
            {approvalItems.length ? approvalItems.map((approval) => {
              const active = selectedApproval?.id === approval.id;
              return (
                <button
                  key={approval.id}
                  type="button"
                  onClick={() => setSelectedApprovalId(approval.id)}
                  className={cn(
                    "w-full border-b border-border px-4 py-3 text-left last:border-b-0",
                    active ? "bg-muted" : "bg-background hover:bg-muted/60",
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold">{approval.title}</p>
                    <StatusBadge status={approval.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">
                    {approval.agentName ? compactAgentName(approval.agentName, data.name) : "operator"} · {approval.kind}
                  </p>
                  <p className="mt-2 text-xs text-muted-foreground">{formatIsoAge(approval.updatedAt || approval.createdAt)}</p>
                </button>
              );
            }) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">아직 승인 요청이 없습니다.</p>
            )}
          </div>
        </section>

        <section className="min-w-0 space-y-4">
          <form className="border border-border" onSubmit={submitApproval}>
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">승인 요청</p>
              <p className="mt-0.5 text-xs text-muted-foreground">에이전트가 기다리는 보드 결정과 같은 요청을 만듭니다.</p>
            </div>
            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2">
              <label className="min-w-0 text-xs font-medium text-muted-foreground">
                Agent
                <select
                  value={agentId}
                  onChange={(event) => setAgentId(event.target.value)}
                  className="mt-1 h-9 w-full border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-ring"
                  disabled={creatingApproval}
                >
                  {data.agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>{compactAgentName(agent.name, data.name)}</option>
                  ))}
                </select>
              </label>
              <label className="min-w-0 text-xs font-medium text-muted-foreground">
                Kind
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value)}
                  className="mt-1 h-9 w-full border border-border bg-background px-2 text-sm text-foreground outline-none focus:border-ring"
                  disabled={creatingApproval}
                >
                  <option value="agent_action">에이전트 조치</option>
                  <option value="branch_change">브랜치 변경</option>
                  <option value="release">배포</option>
                  <option value="scope_change">범위 변경</option>
                  <option value="external_effect">외부 영향</option>
                </select>
              </label>
              <label className="min-w-0 text-xs font-medium text-muted-foreground sm:col-span-2">
                Title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-1 h-9 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
                  placeholder="승인 제목"
                  disabled={creatingApproval}
                />
              </label>
              <label className="min-w-0 text-xs font-medium text-muted-foreground sm:col-span-2">
                Request
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="mt-1 min-h-32 w-full resize-y border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                  placeholder="승인할 내용과 이유를 적으세요"
                  disabled={creatingApproval}
                />
              </label>
              <div className="flex justify-end sm:col-span-2">
                <Button type="submit" disabled={!title.trim() || !body.trim() || creatingApproval} className="gap-1.5">
                  <CheckCircle2 className={cn("h-3.5 w-3.5", creatingApproval && "animate-pulse")} />
                  Request
                </Button>
              </div>
            </div>
          </form>

          <section className="border border-border">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">선택된 요청</p>
            </div>
            {selectedApproval ? (
              <article className="px-4 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={selectedApproval.status} />
                  <span className="text-xs text-muted-foreground">{formatIsoAge(selectedApproval.createdAt)}</span>
                  <span className="text-xs text-muted-foreground">{selectedApproval.kind}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold">{selectedApproval.title}</h3>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/85">{selectedApproval.body}</p>
                <div className="mt-4 border border-border">
                  {selectedApproval.decisions.length ? selectedApproval.decisions.map((decision) => (
                    <div key={decision.id} className="border-b border-border px-3 py-3 last:border-b-0">
                      <div className="flex items-center justify-between gap-3">
                        <StatusBadge status={decision.decision} />
                        <span className="text-xs text-muted-foreground">{formatIsoAge(decision.createdAt)}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-5 text-foreground/85">{decision.body}</p>
                    </div>
                  )) : (
                    <p className="px-3 py-3 text-sm text-muted-foreground">아직 결정이 없습니다.</p>
                  )}
                </div>
              </article>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">선택된 승인 요청이 없습니다.</p>
            )}
          </section>
        </section>

        <aside className="min-w-0 border border-border">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">결정</p>
            <p className="mt-0.5 text-xs text-muted-foreground">승인된 요청은 배정된 에이전트를 깨울 수 있습니다.</p>
          </div>
          {selectedApproval ? (
            <div className="space-y-3 px-4 py-4">
              <textarea
                value={decisionBody}
                onChange={(event) => setDecisionBody(event.target.value)}
                className="min-h-36 w-full resize-y border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                placeholder="결정 메모"
                disabled={decidingApproval}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={wakeAgent}
                  onChange={(event) => setWakeAgent(event.target.checked)}
                  disabled={decidingApproval || !selectedApproval.agentId}
                />
                승인 후 에이전트 깨우기
              </label>
              <div className="grid gap-2">
                <Button
                  type="button"
                  onClick={() => submitDecision("approved")}
                  disabled={!decisionBody.trim() || decidingApproval}
                >
                  Approve
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => submitDecision("changes_requested")}
                  disabled={!decisionBody.trim() || decidingApproval}
                >
                  Request Changes
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => submitDecision("rejected")}
                  disabled={!decisionBody.trim() || decidingApproval}
                >
                  Reject
                </Button>
              </div>
            </div>
          ) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">먼저 승인 요청을 선택하세요.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function RoutinesTab({
  data,
  onOpenRun,
  onRunRoutine,
  onToggleRoutine,
  routines,
  runningRoutineId,
  updatingRoutineId,
}: {
  data: SpliceWorkspaceRoomData;
  onOpenRun: (runId: string) => void;
  onRunRoutine: (routineId: string) => void;
  onToggleRoutine: (routineId: string, input: { enabled?: boolean; intervalMinutes?: number }) => void;
  routines: SpliceOfficeRoutinesData | null;
  runningRoutineId: string | null;
  updatingRoutineId: string | null;
}) {
  const routineItems = routines?.routines ?? [];
  const recentRuns = routines?.runs ?? [];
  const sortedRoutines = [...routineItems].sort((a, b) => {
    const stateDelta = Number(!a.due) - Number(!b.due);
    if (stateDelta !== 0) return stateDelta;
    return Date.parse(a.nextRunAt || "") - Date.parse(b.nextRunAt || "");
  });

  return (
    <div className="space-y-4">
      <SectionTitle title="사무실 루틴" aside={`활성 ${routines?.counts.enabled ?? 0} · 실행 시점 ${routines?.counts.due ?? 0}`} />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <MetricCard icon={Repeat2} value={routines?.counts.total ?? 0} label="루틴" description="에이전트 하트비트 슬롯" />
        <MetricCard icon={Clock3} value={routines?.counts.due ?? 0} label="지금 실행" description="깨울 준비됨" />
        <MetricCard icon={Activity} value={routines?.counts.runs ?? 0} label="수동 실행" description="사무실에서 대기열 추가" />
        <MetricCard icon={ShieldAlert} value={routines?.counts.paused ?? 0} label="일시 정지" description="운영자가 보류" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">루틴 보드</p>
            <span className="text-xs text-muted-foreground">{sortedRoutines.length}</span>
          </div>
          <div className="divide-y divide-border">
            {sortedRoutines.length ? sortedRoutines.map((routine) => {
              const agent = data.agents.find((item) => item.id === routine.agentId);
              const isRunning = runningRoutineId === routine.id;
              const isUpdating = updatingRoutineId === routine.id;
              return (
                <article key={routine.id} className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Dot state={agent?.state ?? routine.state} />
                      <h3 className="truncate text-sm font-semibold">{compactAgentName(routine.agentName, data.name)}</h3>
                      <StatusBadge status={routine.state} />
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{routine.agentRole} · {routine.cadenceLabel}</p>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-foreground/80">{routine.description}</p>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
                      <span>Next {formatIsoSchedule(routine.nextRunAt)}</span>
                      <span>Last {routine.lastRunAt ? formatIsoAge(routine.lastRunAt) : "never"}</span>
                      <span>{routine.runCount} run{routine.runCount === 1 ? "" : "s"}</span>
                    </div>
                    {routine.lastRunRequestId ? (
                      <button
                        type="button"
                        onClick={() => routine.lastRunRequestId && onOpenRun(routine.lastRunRequestId)}
                        className="mt-2 max-w-full truncate font-mono text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                      >
                        run · {routine.lastRunRequestId}
                      </button>
                    ) : null}
                  </div>
                  <div className="flex min-w-0 flex-col gap-2">
                    <select
                      value={routine.intervalMinutes}
                      onChange={(event) => onToggleRoutine(routine.id, {
                        enabled: routine.enabled,
                        intervalMinutes: Number(event.target.value),
                      })}
                      disabled={isUpdating}
                      className="h-8 border border-border bg-background px-2 text-xs outline-none focus:border-ring"
                    >
                      <option value={5}>5분마다</option>
                      <option value={10}>10분마다</option>
                      <option value={15}>15분마다</option>
                      <option value={30}>30분마다</option>
                      <option value={60}>1시간마다</option>
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => onToggleRoutine(routine.id, {
                          enabled: !routine.enabled,
                          intervalMinutes: routine.intervalMinutes,
                        })}
                        disabled={isUpdating}
                      >
                        {routine.enabled ? "일시 정지" : "다시 시작"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onRunRoutine(routine.id)}
                        disabled={Boolean(runningRoutineId)}
                        className="gap-1.5"
                      >
                        <Play className={cn("h-3.5 w-3.5", isRunning && "animate-pulse")} />
                        {isRunning ? "대기" : "지금 실행"}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            }) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">아직 오피스 루틴이 없습니다.</p>
            )}
          </div>
        </section>

        <aside className="min-w-0 space-y-4">
          <section className="border border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">최근 루틴 실행</p>
              <span className="text-xs text-muted-foreground">{recentRuns.length}</span>
            </div>
            <div className="max-h-[540px] overflow-y-auto">
              {recentRuns.length ? recentRuns.slice(0, 16).map((run) => (
                <article key={run.id} className="border-b border-border px-4 py-3 last:border-b-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="truncate text-sm font-semibold">{compactAgentName(run.agentName, data.name)}</p>
                    <StatusBadge status={run.status} />
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{run.routineTitle}</p>
                  <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                    <Clock3 className="h-3.5 w-3.5 shrink-0" />
                    <span>{formatIsoAge(run.createdAt)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenRun(run.runRequestId)}
                    className="mt-2 max-w-full truncate font-mono text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                  >
                    run · {run.runRequestId}
                  </button>
                </article>
              )) : (
                <p className="px-4 py-4 text-sm text-muted-foreground">아직 루틴 실행 기록이 없습니다.</p>
              )}
            </div>
          </section>

          <section className="border border-border">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">대기열 경로</p>
            </div>
            <div className="space-y-3 px-4 py-4 text-xs text-muted-foreground">
              <p className="truncate font-mono">{routines?.queuePaths.routines ?? "루틴 저장소 없음"}</p>
              <p className="truncate font-mono">{routines?.queuePaths.runRequests ?? "실행 대기열 없음"}</p>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function AgentsTab({
  agentConsole,
  data,
  focusedAgentId,
  messages,
  onFocusAgent,
  onOpenRun,
  onSend,
  runningAgentId,
  sendingAgentId,
  onRunAgent,
}: {
  agentConsole: SpliceAgentConsoleData | null;
  data: SpliceWorkspaceRoomData;
  focusedAgentId: string | null;
  messages: SpliceAgentMessage[];
  onFocusAgent: (agentId: string) => void;
  onOpenRun: (runId: string) => void;
  onSend: (agentId: string, body: string) => void;
  runningAgentId: string | null;
  sendingAgentId: string | null;
  onRunAgent: (agentId: string) => void;
}) {
  const consoleAgents = useMemo(
    () => roomConsoleAgents(data, agentConsole, messages),
    [agentConsole, data, messages],
  );
  const [selectedAgentId, setSelectedAgentId] = useState(consoleAgents[0]?.id ?? "");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!consoleAgents.length) return;
    const focusedAgent = focusedAgentId
      ? consoleAgents.find((agent) => agent.id === focusedAgentId || agent.slug === focusedAgentId)
      : null;
    if (focusedAgent && focusedAgent.id !== selectedAgentId) {
      setSelectedAgentId(focusedAgent.id);
      return;
    }
    if (!selectedAgentId || !consoleAgents.some((agent) => agent.id === selectedAgentId)) {
      const nextId = focusedAgent?.id ?? consoleAgents[0].id;
      setSelectedAgentId(nextId);
      onFocusAgent(nextId);
    }
  }, [consoleAgents, focusedAgentId, onFocusAgent, selectedAgentId]);

  const selectedAgent = consoleAgents.find((agent) => agent.id === selectedAgentId) ?? consoleAgents[0] ?? null;
  const isRunning = Boolean(selectedAgent && runningAgentId === selectedAgent.id);
  const isSending = Boolean(selectedAgent && sendingAgentId === selectedAgent.id);
  const activeStatuses = new Set(["requested", "launch_ready", "launched"]);
  const selectedRequests = selectedAgent?.requests ?? [];
  const selectedMessages = selectedAgent?.messages ?? [];
  const selectedWorkOrders = selectedAgent?.workOrders ?? [];
  const activeRequestCount = selectedRequests.filter((request) => activeStatuses.has(String(request.status))).length;

  const submitInstruction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!selectedAgent || !body || isSending) return;
    setDraft("");
    onSend(selectedAgent.id, body);
  };

  if (!selectedAgent) {
    return (
      <div className="space-y-4">
        <SectionTitle title="에이전트 현황" aside="에이전트 없음" />
        <p className="border border-border px-4 py-4 text-sm text-muted-foreground">에이전트를 찾지 못했습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="에이전트 현황" aside={`책상 ${consoleAgents.length} · 가동 요청 ${activeRequestCount}`} />
      <div className="grid min-h-[640px] gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="min-w-0 border border-border">
          {consoleAgents.map((agent) => {
            const active = agent.id === selectedAgent.id;
            const pending = agent.requests.filter((request) => activeStatuses.has(String(request.status))).length;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  setSelectedAgentId(agent.id);
                  onFocusAgent(agent.id);
                }}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-border px-3 py-3 text-left last:border-b-0",
                  active ? "bg-muted" : "bg-background hover:bg-muted/60",
                )}
              >
                <Identity name={compactAgentName(agent.name, data.name)} initials={agent.initials} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-2">
                    <Dot state={agent.state} />
                    <p className="truncate text-sm font-semibold">{compactAgentName(agent.name, data.name)}</p>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{agent.role} · {agent.zone}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                    <span className="rounded-full bg-muted px-2 py-0.5">{agent.currentWork.length} work</span>
                    <span className="rounded-full bg-muted px-2 py-0.5">{agent.workOrders.length} orders</span>
                    <span className="rounded-full bg-muted px-2 py-0.5">{agent.requests.length} runs</span>
                    <span className="rounded-full bg-muted px-2 py-0.5">{agent.messages.length} msgs</span>
                    {pending ? <span className="rounded-full bg-muted px-2 py-0.5">{pending} active</span> : null}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <section className="min-w-0 space-y-4">
          <div className="border border-border">
            <div className="flex flex-col gap-3 border-b border-border px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <Identity name={compactAgentName(selectedAgent.name, data.name)} initials={selectedAgent.initials} size="default" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="truncate text-base font-semibold">{compactAgentName(selectedAgent.name, data.name)}</h2>
                    <StatusBadge status={selectedAgent.state} />
                  </div>
                  <p className="mt-1 truncate text-sm text-muted-foreground">
                    {selectedAgent.role} · {selectedWorkOrders[0]?.title ?? selectedAgent.currentWork[0]?.title ?? "배정된 업무 없음"}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onRunAgent(selectedAgent.id)}
                disabled={Boolean(runningAgentId)}
                className="h-8 gap-1.5 self-start lg:self-auto"
              >
                <Play className={cn("h-3.5 w-3.5", isRunning && "animate-pulse")} />
                {isRunning ? "대기" : "깨우기"}
              </Button>
            </div>

            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="배정 업무" value={selectedAgent.currentWork.length} icon={CircleDot} />
              <MetricCard label="사무실 요청" value={selectedWorkOrders.length} icon={SquarePen} />
              <MetricCard label="실행 기록" value={selectedRequests.length} icon={Activity} />
              <MetricCard label="대화" value={selectedMessages.length} icon={MessageSquare} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0 space-y-4">
              <div className="border border-border">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">배정 업무</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">운영 frontmatter에서 읽은 PaperClip 담당 정보입니다.</p>
                </div>
                {selectedAgent.currentWork.length ? selectedAgent.currentWork.map((item) => (
                  <EntityRow
                    key={`${item.type}:${item.id}`}
                    title={item.title}
                    subtitle={`${item.type} · ${item.projectName || item.id}`}
                    leading={<CircleDot className="h-4 w-4 text-muted-foreground" />}
                    trailing={<StatusBadge status={item.status} />}
                  />
                )) : null}
                {selectedWorkOrders.length ? selectedWorkOrders.slice(0, 8).map((order) => (
                  <EntityRow
                    key={`order:${order.id}`}
                    title={order.title}
                    subtitle={`오피스 업무 · ${koStatusLabel(order.priority)}`}
                    leading={<SquarePen className="h-4 w-4 text-muted-foreground" />}
                    trailing={<StatusBadge status={order.status} />}
                  />
                )) : null}
                {!selectedAgent.currentWork.length && !selectedWorkOrders.length ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">아직 배정된 업무가 없습니다.</p>
                ) : null}
              </div>

              <form className="border border-border" onSubmit={submitInstruction}>
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">지시 보내기</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">메시지는 사무실 업무와 깨우기 요청으로 함께 남습니다.</p>
                </div>
                <div className="space-y-3 px-4 py-4">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className="min-h-28 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    placeholder={`${compactAgentName(selectedAgent.name, data.name)}에게 메시지`}
                    disabled={isSending}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={!draft.trim() || isSending} className="gap-1.5">
                      <Send className={cn("h-3.5 w-3.5", isSending && "animate-pulse")} />
                      {isSending ? "보내는 중" : "보내고 깨우기"}
                    </Button>
                  </div>
                </div>
              </form>
            </section>

            <aside className="min-w-0 space-y-4">
              <section className="border border-border">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">실행 기록</p>
                  <span className="text-xs text-muted-foreground">{selectedRequests.length}</span>
                </div>
                <div className="max-h-[310px] overflow-y-auto">
                  {selectedRequests.length ? selectedRequests.slice(0, 12).map((request) => (
                    <button
                      key={request.id}
                      type="button"
                      onClick={() => onOpenRun(request.id)}
                      className="block w-full border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/50"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <StatusBadge status={request.status} />
                        <span className="text-xs text-muted-foreground">{formatIsoAge(request.updatedAt || request.requestedAt)}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{request.note ?? "메모 없음"}</p>
                      <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{request.id}</p>
                    </button>
                  )) : (
                    <p className="px-4 py-4 text-sm text-muted-foreground">아직 실행 기록이 없습니다.</p>
                  )}
                </div>
              </section>

              <section className="border border-border">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">최근 대화</p>
                  <span className="text-xs text-muted-foreground">{selectedMessages.length}</span>
                </div>
                <div className="max-h-[310px] overflow-y-auto">
                  {selectedMessages.length ? selectedMessages.slice(0, 10).map((message) => (
                    <article key={message.id} className="border-b border-border px-4 py-3 last:border-b-0">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <p className="truncate text-xs font-medium">{message.author}</p>
                          {message.kind === "reply" ? <StatusBadge status="reply" /> : null}
                        </div>
                        <span className="text-xs text-muted-foreground">{formatIsoAge(message.createdAt)}</span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-sm leading-5 text-foreground/90">{message.body}</p>
                      {message.workOrderTitle ? (
                        <p className="mt-2 truncate text-[11px] text-muted-foreground">{message.workOrderTitle}</p>
                      ) : null}
                      {message.error ? (
                        <p className="mt-2 line-clamp-2 text-xs text-red-600 dark:text-red-300">{message.error}</p>
                      ) : null}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        <StatusBadge status={message.status} />
                        {message.workOrderId ? <span className="truncate font-mono">{message.workOrderId}</span> : null}
                      </div>
                    </article>
                  )) : (
                    <p className="px-4 py-4 text-sm text-muted-foreground">아직 메시지가 없습니다.</p>
                  )}
                </div>
              </section>
            </aside>
          </div>
        </section>
      </div>
    </div>
  );
}

function CommsTab({
  data,
  focusedAgentId,
  messages,
  onFocusAgent,
  onOpenRun,
  onSend,
  sendingAgentId,
}: {
  data: SpliceWorkspaceRoomData;
  focusedAgentId: string | null;
  messages: SpliceAgentMessage[];
  onFocusAgent: (agentId: string) => void;
  onOpenRun: (runId: string) => void;
  onSend: (agentId: string, body: string) => void;
  sendingAgentId: string | null;
}) {
  const [selectedAgentId, setSelectedAgentId] = useState(data.agents[0]?.id ?? "");
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!data.agents.length) return;
    const focusedAgent = focusedAgentId
      ? data.agents.find((agent) => agent.id === focusedAgentId || agent.slug === focusedAgentId)
      : null;
    if (focusedAgent && focusedAgent.id !== selectedAgentId) {
      setSelectedAgentId(focusedAgent.id);
      return;
    }
    if (!selectedAgentId || !data.agents.some((agent) => agent.id === selectedAgentId)) {
      const nextId = focusedAgent?.id ?? data.agents[0].id;
      setSelectedAgentId(nextId);
      onFocusAgent(nextId);
    }
  }, [data.agents, focusedAgentId, onFocusAgent, selectedAgentId]);

  const selectedAgent = data.agents.find((agent) => agent.id === selectedAgentId) ?? data.agents[0] ?? null;
  const agentMessages = selectedAgent
    ? messages.filter((message) => message.agentId === selectedAgent.id).slice(0, 50).reverse()
    : [];
  const isSending = Boolean(selectedAgent && sendingAgentId === selectedAgent.id);

  const submitMessage = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = draft.trim();
    if (!selectedAgent || !body || isSending) return;
    setDraft("");
    onSend(selectedAgent.id, body);
  };

  if (!selectedAgent) {
    return (
      <div className="space-y-4">
        <SectionTitle title="대화" aside="에이전트 없음" />
        <p className="border border-border px-4 py-4 text-sm text-muted-foreground">에이전트를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="대화" aside={`메시지 ${messages.length}건`} />
      <div className="grid min-h-[560px] gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="min-w-0 border border-border">
          {data.agents.map((agent) => {
            const agentMessageCount = messages.filter((message) => message.agentId === agent.id).length;
            const active = agent.id === selectedAgent.id;
            return (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  setSelectedAgentId(agent.id);
                  onFocusAgent(agent.id);
                }}
                className={cn(
                  "flex w-full items-center gap-3 border-b border-border px-3 py-3 text-left last:border-b-0",
                  active ? "bg-muted" : "bg-background hover:bg-muted/60",
                )}
              >
                <Identity name={compactAgentName(agent.name, data.name)} initials={agent.initials} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{compactAgentName(agent.name, data.name)}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{agent.role} · {agent.state}</p>
                </div>
                <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {agentMessageCount}
                </span>
              </button>
            );
          })}
        </div>

        <section className="flex min-w-0 flex-col border border-border">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Dot state={selectedAgent.state} />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{compactAgentName(selectedAgent.name, data.name)}</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                  {selectedAgent.currentWork[0]?.title ?? "배정 업무 없음"}
                </p>
              </div>
            </div>
            <StatusBadge status={selectedAgent.state} />
          </div>

          <div className="scrollbar-auto-hide flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-muted/20 px-4 py-4">
            {agentMessages.length ? agentMessages.map((message) => (
              <article
                key={message.id}
                className={cn(
                  "max-w-[760px] border px-3 py-3",
                  message.author === "agent"
                    ? "ml-auto border-emerald-500/35 bg-emerald-500/10"
                    : "border-border bg-background"
                )}
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate text-xs font-medium">{message.author}</span>
                    {message.kind === "reply" ? <StatusBadge status="reply" /> : null}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatIsoAge(message.createdAt)}</span>
                </div>
                <p className="whitespace-pre-wrap text-sm leading-6 text-foreground/90">{message.body}</p>
                {message.workOrderTitle ? (
                  <p className="mt-2 truncate text-xs text-muted-foreground">{message.workOrderTitle}</p>
                ) : null}
                {message.error ? (
                  <p className="mt-2 line-clamp-2 text-xs text-red-600 dark:text-red-300">{message.error}</p>
                ) : null}
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <StatusBadge status={message.status} />
                  {message.runRequestId ? (
                    <button
                      type="button"
                      onClick={() => message.runRequestId && onOpenRun(message.runRequestId)}
                      className="min-w-0 truncate font-mono underline-offset-2 hover:text-foreground hover:underline"
                    >
                      {message.runRequestId}
                    </button>
                  ) : null}
                  {message.workOrderId ? <span className="truncate font-mono">{message.workOrderId}</span> : null}
                </div>
              </article>
            )) : (
              <p className="border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                이 에이전트의 메시지가 아직 없습니다.
              </p>
            )}
          </div>

          <form className="flex shrink-0 flex-col gap-3 border-t border-border bg-background px-4 py-4" onSubmit={submitMessage}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-24 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              placeholder={`${compactAgentName(selectedAgent.name, data.name)}에게 메시지`}
              disabled={isSending}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={!draft.trim() || isSending} className="gap-1.5">
                <Send className={cn("h-3.5 w-3.5", isSending && "animate-pulse")} />
                {isSending ? "보내는 중" : "보내고 깨우기"}
              </Button>
            </div>
          </form>
        </section>
      </div>
    </div>
  );
}

function timelineKindIcon(kind: string): LucideIcon {
  if (kind === "message") return MessageSquare;
  if (kind === "run") return Rocket;
  if (kind === "routine") return Repeat2;
  if (kind === "approval" || kind === "approval_decision") return CheckCircle2;
  if (kind === "review" || kind === "review_decision") return ShieldAlert;
  if (kind === "work_order") return SquarePen;
  if (kind === "comment" || kind === "work_product") return SquarePen;
  if (kind === "work") return CircleDot;
  return Activity;
}

function timelineKindLabel(kind: string): string {
  return kind
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function timelineSeverityClass(severity: string): string {
  if (severity === "high") return "border-red-500/45 bg-red-500/10 text-red-700 dark:text-red-200";
  if (severity === "medium") return "border-amber-500/45 bg-amber-500/10 text-amber-700 dark:text-amber-200";
  return "border-border bg-muted/40 text-muted-foreground";
}

function TimelineEventRow({
  event,
  onOpenTab,
  onOpenRun,
  onOpenWorkOrder,
  onOpenWorkItem,
}: {
  event: SpliceOfficeTimelineEvent;
  onOpenTab: (tab: RoomTab) => void;
  onOpenRun: (runId: string) => void;
  onOpenWorkOrder: (workOrderId: string) => void;
  onOpenWorkItem: (item: WorkItemRef) => void;
}) {
  const Icon = timelineKindIcon(event.kind);
  const targetTab = roomTabs.some((tab) => tab.value === event.targetTab) ? event.targetTab as RoomTab : null;
  const targetWorkItem = workItemRefFromTarget(event.targetType, event.targetId);
  const targetRunId = runIdFromTarget(event.targetType, event.targetId);
  const targetWorkOrderId = workOrderIdFromTarget(event.targetType, event.targetId);
  const targetLabel = targetWorkItem ? "업무 책상 열기" : targetRunId ? "실행 열기" : targetWorkOrderId ? "업무 요청 열기" : targetTab ? `${roomTabLabel(targetTab)} 열기` : "";
  const openTarget = () => {
    if (targetWorkItem) {
      onOpenWorkItem(targetWorkItem);
      return;
    }
    if (targetRunId) {
      onOpenRun(targetRunId);
      return;
    }
    if (targetWorkOrderId) {
      onOpenWorkOrder(targetWorkOrderId);
      return;
    }
    if (targetTab) {
      onOpenTab(targetTab);
    }
  };

  return (
    <article className="grid gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:grid-cols-[42px_minmax(0,1fr)]">
      <div className="flex h-9 w-9 items-center justify-center border border-border bg-background">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 break-words text-sm font-semibold">{event.title}</p>
          <span className={cn("inline-flex shrink-0 items-center border px-1.5 py-0.5 text-[10px] font-medium", timelineSeverityClass(event.severity))}>
            {timelineKindLabel(event.kind)}
          </span>
        </div>
        <p className="mt-1 break-words text-xs text-muted-foreground">
          {event.actorName} · {event.status.replace(/_/g, " ")} · {formatIsoAge(event.createdAt)}
        </p>
        {event.subtitle ? <p className="mt-1 break-words text-xs text-muted-foreground">{event.subtitle}</p> : null}
        {event.body ? <p className="mt-2 break-words text-sm text-muted-foreground">{event.body}</p> : null}
        {targetWorkItem || targetRunId || targetWorkOrderId || targetTab ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={openTarget}
            className="mt-3 max-w-full gap-1.5"
          >
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="truncate">{targetLabel}</span>
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function OfficeZoneSignalBoard({
  data,
  timeline,
  messages,
  onOpenTab,
}: {
  data: SpliceWorkspaceRoomData;
  timeline: SpliceOfficeTimelineData | null;
  messages: SpliceAgentMessage[];
  onOpenTab: (tab: RoomTab) => void;
}) {
  const counts = timeline?.counts;
  const zones: Array<{ tab: RoomTab; title: string; value: number; subtitle: string; icon: LucideIcon }> = [
    { tab: "intake", title: "업무 접수", value: counts?.workOrders ?? 0, subtitle: "새 업무 요청", icon: SquarePen },
    { tab: "desk", title: "업무 책상", value: counts?.work ?? data.activity.length, subtitle: `진행 ${data.lanes.active.length} · 검수 ${data.lanes.review.length}`, icon: SquarePen },
    { tab: "comms", title: "대화", value: counts?.messages ?? messages.length, subtitle: `대기 메시지 ${messages.length}건`, icon: MessageSquare },
    { tab: "agents", title: "실행기", value: counts?.runs ?? data.requests.length, subtitle: `깨우기 요청 ${data.requests.length}건`, icon: Rocket },
    { tab: "approvals", title: "검수 관문", value: (counts?.approvals ?? 0) + (counts?.reviews ?? 0), subtitle: `승인 ${counts?.approvals ?? 0} · 검수 ${counts?.reviews ?? 0}`, icon: ShieldAlert },
    { tab: "routines", title: "루틴", value: counts?.routines ?? 0, subtitle: "하트비트와 수동 깨우기 기록", icon: Repeat2 },
  ];

  return (
    <section className="space-y-3">
      <SectionTitle title="사무실 구역" aside="책상을 선택하세요" />
      <div className="border border-border">
        {zones.map((zone) => {
          const Icon = zone.icon;
          return (
            <button
              key={zone.tab}
              type="button"
              onClick={() => onOpenTab(zone.tab)}
              className="grid w-full grid-cols-[32px_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-accent/50"
            >
              <span className="flex h-8 w-8 items-center justify-center border border-border bg-background">
                <Icon className="h-4 w-4 text-muted-foreground" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{zone.title}</span>
                <span className="block truncate text-xs text-muted-foreground">{zone.subtitle}</span>
              </span>
              <span className="text-lg font-semibold tabular-nums">{formatNumber(zone.value)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function ActivityTab({
  data,
  messages,
  timeline,
  onOpenTab,
  onOpenRun,
  onOpenWorkOrder,
  onOpenWorkItem,
}: {
  data: SpliceWorkspaceRoomData;
  messages: SpliceAgentMessage[];
  timeline: SpliceOfficeTimelineData | null;
  onOpenTab: (tab: RoomTab) => void;
  onOpenRun: (runId: string) => void;
  onOpenWorkOrder: (workOrderId: string) => void;
  onOpenWorkItem: (item: WorkItemRef) => void;
}) {
  const events = timeline?.events ?? [];
  const counts = timeline?.counts;

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <SectionTitle title="사무실 타임라인" aside={`${events.length || data.activity.length}개 이벤트`} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Activity} value={counts?.total ?? data.activity.length} label="사무실 이벤트" description="타임라인 신호" />
          <MetricCard icon={SquarePen} value={counts?.work ?? data.activity.length} label="업무" description="책상과 보드 활동" />
          <MetricCard icon={MessageSquare} value={counts?.messages ?? messages.length} label="대화" description="운영자와 에이전트" />
          <MetricCard icon={ShieldAlert} value={(counts?.approvals ?? 0) + (counts?.reviews ?? 0)} label="검수 관문" description="검수와 승인" />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-3">
          <SectionTitle title="실시간 사무실 기록" aside={timeline ? `${formatIsoAge(timeline.generatedAt)} 갱신` : "대기 중"} />
          <div className="border border-border">
            {events.length ? events.map((event) => (
              <TimelineEventRow
                key={event.id}
                event={event}
                onOpenTab={onOpenTab}
                onOpenRun={onOpenRun}
                onOpenWorkOrder={onOpenWorkOrder}
                onOpenWorkItem={onOpenWorkItem}
              />
            )) : (
              <div className="space-y-3 px-4 py-4">
                <p className="text-sm text-muted-foreground">아직 오피스 타임라인 신호가 없습니다.</p>
                <ActivityList items={data.activity} />
              </div>
            )}
          </div>
        </section>

        <div className="space-y-4">
          <OfficeZoneSignalBoard data={data} timeline={timeline} messages={messages} onOpenTab={onOpenTab} />
          <section className="space-y-3">
            <SectionTitle title="실행 대기열" aside={`요청 ${data.requests.length}건`} />
            <div className="border border-border">
              {data.requests.length ? data.requests.map((request) => (
                <EntityRow
                  key={request.id}
                  title={request.agentName}
                  subtitle={request.note ?? "메모 없음"}
                  leading={<Activity className="h-4 w-4 text-muted-foreground" />}
                  trailing={<StatusBadge status={request.status} />}
                />
              )) : (
                <p className="px-4 py-4 text-sm text-muted-foreground">대기 중인 에이전트 실행이 없습니다.</p>
              )}
            </div>
          </section>

          <section className="space-y-3">
            <SectionTitle title="사무실 대화" aside={`메시지 ${messages.length}건`} />
            <div className="border border-border">
              {messages.length ? messages.slice(0, 8).map((message) => (
                <EntityRow
                  key={message.id}
                  title={compactAgentName(message.agentName, data.name)}
                  subtitle={message.body.length > 120 ? `${message.body.slice(0, 117)}...` : message.body}
                  leading={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
                  trailing={<span className="text-xs text-muted-foreground">{formatIsoAge(message.createdAt)}</span>}
                />
              )) : (
                <p className="px-4 py-4 text-sm text-muted-foreground">아직 오피스 메시지가 없습니다.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function DetailsTab({ data }: { data: SpliceWorkspaceRoomData }) {
  const detailItems = [
    data.objective ? { id: data.objective.slug, title: data.objective.name, type: goalKindLabel(data.objective), body: data.objective.description } : null,
    ...data.projects.slice(0, 2).map((project) => ({ id: project.id, title: project.title, type: "프로젝트", body: project.description })),
    ...data.lanes.review.slice(0, 2).map((issue) => ({ id: issue.id, title: issue.title, type: "이슈", body: issue.description })),
  ].filter((item): item is { id: string; title: string; type: string; body: string | null } => Boolean(item));

  return (
    <div className="space-y-4">
      <SectionTitle title="상세" aside="PaperClip 본문" />
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
                <p className="mt-3 text-sm text-muted-foreground">본문이 없습니다.</p>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}

function WorkItemList({
  empty,
  items,
  onOpenWorkItem,
}: {
  empty: string;
  items: SpliceWorkspaceRoomWorkItem[];
  onOpenWorkItem?: (item: WorkItemRef) => void;
}) {
  return (
    <div className="border border-border">
      {items.length ? items.map((item) => {
        return (
          <EntityRow
            key={`${item.type}:${item.id}`}
            identifier={item.id}
            title={item.title}
            subtitle={`${item.ownerName} · ${item.projectName || item.type}`}
            leading={<StatusBadge status={item.status} ns={item.type === "project" ? "project" : "issue"} />}
            trailing={<span className="text-xs text-muted-foreground">{formatAge(item.ageMin)}</span>}
            onClick={onOpenWorkItem ? () => onOpenWorkItem(item) : undefined}
          />
        );
      }) : (
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
        <p className="px-4 py-4 text-sm text-muted-foreground">아직 활동 기록이 없습니다.</p>
      )}
    </div>
  );
}

function LaneCard({ lane }: { lane: SpliceExecutionLane }) {
  const Icon = laneIcon(lane);
  const lastCommit = lane.lastCommit;

  return (
    <div className="min-w-0 border border-border bg-background px-3 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Icon className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{lane.name}</p>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{lane.copyKindLabel} · {lane.managerLabel}</p>
            <p className="mt-0.5 truncate font-mono text-[11px] text-muted-foreground">{lane.branch}</p>
          </div>
        </div>
        <LaneStatePill state={lane.state} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="min-w-0 rounded-md bg-muted/40 px-2 py-1.5">
          <p className="font-semibold tabular-nums">{lane.dirty}</p>
          <p className="truncate text-[11px] text-muted-foreground">수정 파일</p>
        </div>
        <div className="min-w-0 rounded-md bg-muted/40 px-2 py-1.5">
          <p className="font-semibold tabular-nums">{lane.ahead}/{lane.behind}</p>
          <p className="truncate text-[11px] text-muted-foreground">앞섬/뒤처짐</p>
        </div>
        <div className="min-w-0 rounded-md bg-muted/40 px-2 py-1.5">
          <p className="font-semibold tabular-nums">{lane.liveRunCount}/{lane.queuedRunCount}</p>
          <p className="truncate text-[11px] text-muted-foreground">실행/대기</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <div className="grid grid-cols-[52px_minmax(0,1fr)] gap-x-2 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>사본</span>
          <span className="truncate">{lane.path}</span>
          <span>프로젝트</span>
          <span className="truncate">{lane.projectPath}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <GitCommit className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">{lastCommit?.msg ?? "커밋 신호 없음"}</span>
          <span className="shrink-0">{formatAge(lastCommit?.ageMin)}</span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-[72px_minmax(0,1fr)] gap-x-2 gap-y-1 border-t border-border pt-3 text-[11px]">
        <span className="text-muted-foreground">도구 관리</span>
        <span>{lane.managerLabel}</span>
        <span className="text-muted-foreground">세션 신호</span>
        <span>{lane.actors.length ? `${lane.actors.length}개 활동 신호 감지` : "아직 연결된 활동 없음"}</span>
        <span className="text-muted-foreground">내부 경로</span>
        <span className={lane.projectPresent ? "text-foreground" : "text-destructive"}>{lane.projectPresent ? "확인됨" : "이 사본에 없음"}</span>
      </div>

      {lane.actors.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {lane.actors.slice(0, 4).map((actor) => (
            <span
              key={actor.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[11px]"
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", actor.kind === "agent" ? "bg-blue-500" : "bg-emerald-500")} />
              <span className="truncate">{actor.name}</span>
            </span>
          ))}
          {lane.actors.length > 4 ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">+{lane.actors.length - 4}</span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ExecutionLanesPanel({ data, limit }: { data: SpliceWorkspaceRoomData; limit?: number }) {
  const allLanes = data.executionLanes ?? [];
  const lanes = limit ? allLanes.slice(0, limit) : allLanes;

  return (
    <section className="space-y-3">
      <SectionTitle title="프로젝트 작업 사본" aside={`${allLanes.length}개 감지`} />
      <div className="border border-border bg-muted/20 px-4 py-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-muted-foreground" />
              <p className="text-xs font-medium text-muted-foreground">내부 테스트 프로젝트</p>
            </div>
            <p className="mt-2 truncate text-lg font-semibold">{data.name}</p>
            <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{data.path}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {data.workspaceBinding.mode === "embedded" ? "현재 Splice Hub 내부 경로를 각 도구의 worktree에 투영 중" : "독립 프로젝트 원본에 연결됨"}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-px border border-border bg-border text-xs">
            <div className="min-w-[88px] bg-background px-3 py-2">
              <p className="font-semibold tabular-nums">{allLanes.length}</p>
              <p className="text-[11px] text-muted-foreground">작업 사본</p>
            </div>
            <div className="min-w-[88px] bg-background px-3 py-2">
              <p className="font-semibold tabular-nums">{data.totals.activeExecutionLanes ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">변경 감지</p>
            </div>
            <div className="min-w-[88px] bg-background px-3 py-2">
              <p className="font-semibold tabular-nums">{allLanes.reduce((sum, lane) => sum + lane.liveRunCount, 0)}</p>
              <p className="text-[11px] text-muted-foreground">실제 실행</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {lanes.length ? lanes.map((lane) => (
          <LaneCard key={lane.id} lane={lane} />
        )) : (
          <div className="border border-border px-4 py-4 text-sm text-muted-foreground">감지된 작업 사본이 없습니다.</div>
        )}
      </div>
    </section>
  );
}

function LanesTab({ data }: { data: SpliceWorkspaceRoomData }) {
  const lanes = data.executionLanes ?? [];

  return (
    <div className="space-y-6">
      <ExecutionLanesPanel data={data} />
      <section className="space-y-3">
        <SectionTitle title="세션·실행 연결 상태" aside={`${lanes.length}개 사본`} />
        <div className="border border-border">
          {lanes.map((lane) => (
            <EntityRow
              key={lane.id}
              title={lane.name}
              subtitle={`${lane.managerLabel} 관리 · ${lane.copyKindLabel} · ${lane.path}`}
              leading={<GitBranch className="h-4 w-4 text-muted-foreground" />}
              trailing={(
                <div className="flex items-center gap-2">
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    실행 {lane.liveRunCount} · 대기 {lane.queuedRunCount} · 변경 {lane.dirty}
                  </span>
                  <LaneStatePill state={lane.state} />
                </div>
              )}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function RoomMap({
  approvals,
  data,
  dispatchingRunner,
  focusedAgentId,
  inbox,
  onDispatchRunner,
  onFocusAgent,
  onOpenWorkItem,
  onOpenRun,
  onOpenTab,
  onOpenWorkOrder,
  onRunAgent,
  onSend,
  routines,
  runnerNotice,
  runningAgentId,
  runs,
  sendingAgentId,
  workOrders,
  workProducts,
}: {
  approvals: SpliceOfficeApprovalsData | null;
  data: SpliceWorkspaceRoomData;
  dispatchingRunner: boolean;
  focusedAgentId: string | null;
  inbox: SpliceOfficeInboxData | null;
  onDispatchRunner: (dryRun: boolean) => void;
  onFocusAgent: (agentId: string) => void;
  onOpenWorkItem: (item: WorkItemRef) => void;
  onOpenRun: (runId: string) => void;
  onOpenTab: (tab: RoomTab) => void;
  onOpenWorkOrder: (workOrderId: string) => void;
  onRunAgent: (agentId: string) => void;
  onSend: (agentId: string, body: string) => void;
  routines: SpliceOfficeRoutinesData | null;
  runnerNotice: string | null;
  runningAgentId: string | null;
  runs: SpliceRunMonitorData | null;
  sendingAgentId: string | null;
  workOrders: SpliceWorkOrdersData | null;
  workProducts: SpliceWorkProduct[];
}) {
  const roomActors = [...data.room.humans, ...data.room.agents];
  const preferredActor = roomActors.find((actor) => actor.state === "requested") ?? roomActors.find((actor) => actor.state === "working") ?? roomActors.find((actor) => actor.state === "assigned") ?? roomActors[0] ?? null;
  const focusedActor = focusedAgentId
    ? roomActors.find((actor) => actor.id === focusedAgentId || actor.slug === focusedAgentId) ?? null
    : null;
  const [selectedActorId, setSelectedActorId] = useState(focusedActor?.id ?? preferredActor?.id ?? "");
  const [deskDraft, setDeskDraft] = useState("");
  const zoneCounts = new Map<string, number>();
  const roomActorEntries = roomActors.map((actor) => {
    const slotIndex = zoneCounts.get(actor.zone) ?? 0;
    zoneCounts.set(actor.zone, slotIndex + 1);
    return { actor, slotIndex };
  });
  useEffect(() => {
    if (!roomActors.length) {
      setSelectedActorId("");
      return;
    }
    if (focusedActor && focusedActor.id !== selectedActorId) {
      setSelectedActorId(focusedActor.id);
      return;
    }
    if (!selectedActorId || !roomActors.some((actor) => actor.id === selectedActorId)) {
      setSelectedActorId(preferredActor?.id ?? roomActors[0].id);
    }
  }, [focusedActor, preferredActor?.id, roomActors, selectedActorId]);

  const selectedActor = roomActors.find((actor) => actor.id === selectedActorId) ?? preferredActor;
  const selectedAgent = selectedActor
    ? data.agents.find((agent) => agent.id === selectedActor.id || agent.slug === selectedActor.slug) ?? null
    : null;
  const roomRunRequests = runs?.runs ?? data.requests;
  const selectedRequests = selectedActor
    ? runRequestsForActor(roomRunRequests, selectedActor).slice(0, 3)
    : [];
  const selectedProducts = selectedActor
    ? workProducts.filter((product) =>
      product.ownerName === selectedActor.name ||
      product.agentName === selectedActor.name ||
      product.agentId === selectedActor.id ||
      product.agentId === selectedActor.slug
    ).slice(0, 3)
    : [];
  const selectedPrimaryWork = selectedActor?.currentWork[0] ?? null;
  const selectedPrimaryRequest = selectedRequests[0] ?? null;
  const sendingSelected = Boolean(selectedAgent && sendingAgentId === selectedAgent.id);
  const roomWorkOrders = (workOrders?.workOrders ?? []).filter((order) => isOpenOfficeStatus(order.status));
  const visibleRoomWorkOrders = roomWorkOrders.slice(0, 8);
  const roomWorkOrderOverflow = Math.max(0, roomWorkOrders.length - visibleRoomWorkOrders.length);
  const openFocusedTab = (tab: RoomTab) => {
    if (selectedAgent) onFocusAgent(selectedAgent.id);
    if (tab === "desk" && selectedPrimaryWork) {
      onOpenWorkItem(selectedPrimaryWork);
      return;
    }
    if (tab === "runs" && selectedPrimaryRequest) {
      onOpenRun(selectedPrimaryRequest.id);
      return;
    }
    onOpenTab(tab);
  };
  const runCounts = runs?.counts ?? runMonitorFallbackCounts(data.requests);
  const queuedRuns = runCounts.requested + runCounts.launchReady;
  const copyCounts = data.executionLanes.reduce<Record<string, number>>((counts, lane) => {
    counts[lane.manager] = (counts[lane.manager] ?? 0) + 1;
    return counts;
  }, {});
  const copyDetail = [
    copyCounts.codex ? `Codex ${copyCounts.codex}` : null,
    copyCounts.claude ? `Claude ${copyCounts.claude}` : null,
    copyCounts.splice ? `Agent ${copyCounts.splice}` : null,
    copyCounts.local ? `원본 ${copyCounts.local}` : null,
  ].filter(Boolean).join(" · ");
  const officeSignals: Array<{
    tab: RoomTab;
    title: string;
    value: number;
    subtitle: string;
    icon: LucideIcon;
  }> = [
    { tab: "runs", title: "실행 중", value: runCounts.active, subtitle: `${queuedRuns} 대기`, icon: Rocket },
    { tab: "inbox", title: "신호함", value: inbox?.counts.open ?? 0, subtitle: "열린 신호", icon: Inbox },
    { tab: "intake", title: "접수 업무", value: workOrders?.counts.open ?? 0, subtitle: `${workOrders?.counts.queued ?? 0} 대기`, icon: SquarePen },
    { tab: "desk", title: "산출물", value: workProducts.length, subtitle: "책상에 저장", icon: FileText },
    { tab: "approvals", title: "승인", value: approvals?.counts.pending ?? 0, subtitle: "대기 중", icon: CheckCircle2 },
    { tab: "routines", title: "루틴", value: routines?.counts.due ?? 0, subtitle: `${routines?.counts.enabled ?? 0} 활성`, icon: Repeat2 },
    { tab: "lanes", title: "작업 사본", value: data.totals.activeExecutionLanes ?? 0, subtitle: `${data.executionLanes.length}개 사본`, icon: GitBranch },
  ];
  const reviewAttention = data.totals.reviewIssues + (approvals?.counts.pending ?? 0);
  const completedRuns = runCounts.done + runCounts.noop;
  const completedNeedsReview = runCounts.active === 0 && queuedRuns === 0 && completedRuns > 0;
  const executionNotStarted = runCounts.active === 0 && queuedRuns === 0 && completedRuns === 0 && data.totals.assignedAgents > 0;
  const priorityItems: Array<{
    tab: RoomTab;
    title: string;
    value: number;
    unit: string;
    detail: string;
    icon: LucideIcon;
    className: string;
  }> = [
    {
      tab: "lanes",
      title: "내 작업 사본",
      value: data.executionLanes.length,
      unit: "개",
      detail: copyDetail || "연결된 사본 없음",
      icon: GitBranch,
      className: "border-0 bg-muted",
    },
    {
      tab: "runs",
      title: "실제 에이전트",
      value: runCounts.active,
      unit: "명",
      detail: `업무 배정 ${data.totals.assignedAgents} · 실행 대기 ${queuedRuns}`,
      icon: Bot,
      className: "border-0 bg-muted",
    },
    {
      tab: executionNotStarted || completedNeedsReview ? "runs" : "reviews",
      title: "확인 필요",
      value: completedNeedsReview ? completedRuns : executionNotStarted ? 1 : reviewAttention,
      unit: "건",
      detail: completedNeedsReview
        ? `완료된 에이전트 결과 ${completedRuns}건 검수 필요`
        : executionNotStarted
          ? "업무는 배정됐지만 실제 실행이 아직 시작되지 않음"
          : `검수 ${data.totals.reviewIssues} · 승인 ${approvals?.counts.pending ?? 0}`,
      icon: ShieldAlert,
      className: "border-0 bg-muted",
    },
  ];
  const submitDeskInstruction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const body = deskDraft.trim();
    if (!selectedAgent || !body || sendingSelected) return;
    setDeskDraft("");
    onFocusAgent(selectedAgent.id);
    onSend(selectedAgent.id, body);
  };

  return (
    <section className="space-y-3">
      <header className="flex flex-col gap-3 border-b border-border pb-0 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">관제</h2>
          <p className="mt-1 text-xs text-muted-foreground">현재 상태와 먼저 확인할 일</p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          <span className="border border-border px-2.5 py-1">작업 사본 {data.executionLanes.length}</span>
          <span className="border border-border px-2.5 py-1">세션 {data.room.humans.length}</span>
          <span className="border border-border px-2.5 py-1">실제 에이전트 {runCounts.active}</span>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
          {priorityItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <button
                key={item.title}
                type="button"
                onClick={() => onOpenTab(item.tab)}
                className={cn(
                  "min-w-0 rounded-2xl border-0 px-4 py-3 text-left transition-colors hover:bg-accent/70",
                  item.className,
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold">{item.title}</span>
                  </span>
                  <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                </div>
                <p className="mt-3 text-xl font-semibold tabular-nums">
                  {formatNumber(item.value)}
                  <span className="ml-1 text-xs font-normal text-muted-foreground">{item.unit}</span>
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p>
              </button>
            );
          })}
      </div>

      <section className="pt-2">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">내가 확인할 것</h3>
          <span className="text-xs text-muted-foreground">우선순위순</span>
        </div>
        <div className="border-y border-border">
          {completedNeedsReview ? (
            <button type="button" onClick={() => onOpenTab("runs")} className="flex w-full items-center justify-between gap-3 border-b border-border px-1 py-3 text-left hover:bg-muted/50">
              <span className="min-w-0"><span className="block truncate text-sm font-medium">완료된 에이전트 결과 검수</span><span className="mt-1 block truncate text-xs text-muted-foreground">완료된 실행 {completedRuns}건을 확인해야 합니다.</span></span>
              <span className="shrink-0 border border-border px-2 py-0.5 text-xs">결과 {completedRuns}</span>
            </button>
          ) : null}
          {executionNotStarted ? (
            <button type="button" onClick={() => onOpenTab("runs")} className="flex w-full items-center justify-between gap-3 border-b border-border px-1 py-3 text-left hover:bg-muted/50">
              <span className="min-w-0"><span className="block truncate text-sm font-medium">배정된 업무의 실행 확인</span><span className="mt-1 block truncate text-xs text-muted-foreground">업무는 배정됐지만 실제 실행이 아직 없습니다.</span></span>
              <span className="shrink-0 border border-border px-2 py-0.5 text-xs">실행 대기</span>
            </button>
          ) : null}
          {reviewAttention > 0 ? (
            <button type="button" onClick={() => onOpenTab("reviews")} className="flex w-full items-center justify-between gap-3 border-b border-border px-1 py-3 text-left hover:bg-muted/50">
              <span className="min-w-0"><span className="block truncate text-sm font-medium">검수와 승인 대기</span><span className="mt-1 block truncate text-xs text-muted-foreground">검수 {data.totals.reviewIssues} · 승인 {approvals?.counts.pending ?? 0}</span></span>
              <span className="shrink-0 border border-border px-2 py-0.5 text-xs">확인 {reviewAttention}</span>
            </button>
          ) : null}
          {(inbox?.counts.open ?? 0) > 0 ? (
            <button type="button" onClick={() => onOpenTab("inbox")} className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left hover:bg-muted/50">
              <span className="min-w-0"><span className="block truncate text-sm font-medium">새 신호함 항목</span><span className="mt-1 block truncate text-xs text-muted-foreground">업무, 실행, 메시지 신호를 확인하세요.</span></span>
              <span className="shrink-0 border border-border px-2 py-0.5 text-xs">신호 {inbox?.counts.open ?? 0}</span>
            </button>
          ) : null}
          {!completedNeedsReview && !executionNotStarted && reviewAttention === 0 && (inbox?.counts.open ?? 0) === 0 ? <p className="px-1 py-3 text-sm text-muted-foreground">지금 바로 확인할 운영 신호가 없습니다.</p> : null}
        </div>
      </section>

      <section className="pt-2">
        <div className="mb-2 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold">현재 움직임</h3>
          <span className="text-xs text-muted-foreground">최근 작업 사본과 세션</span>
        </div>
        <div className="border-y border-border">
          {data.executionLanes.slice(0, 4).map((lane) => (
            <button key={lane.id} type="button" onClick={() => onOpenTab("lanes")} className="flex w-full items-center justify-between gap-3 border-b border-border px-1 py-3 text-left last:border-b-0 hover:bg-muted/50">
              <span className="min-w-0"><span className="block truncate text-sm font-medium"><span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-500" />{lane.name}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{lane.managerLabel} · {lane.branch} · 변경 {lane.dirty}</span></span>
              <span className="shrink-0 text-xs text-muted-foreground">{formatAge(lane.lastCommit?.ageMin)}</span>
            </button>
          ))}
          {!data.executionLanes.length ? <p className="px-1 py-3 text-sm text-muted-foreground">감지된 작업 사본이 없습니다.</p> : null}
        </div>
      </section>

      <section className="border-t border-border pt-4">
        <p className="text-sm font-semibold">기능 보존</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {officeSignals.map((signal) => (
            <button key={signal.tab} type="button" onClick={() => onOpenTab(signal.tab)} className="border border-border px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent hover:text-foreground">
              {signal.title} {signal.value}
            </button>
          ))}
        </div>
      </section>

      <details className="border border-border bg-background">
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-muted-foreground hover:text-foreground">픽셀 사무실 보기</summary>
        <div className="space-y-4 border-t border-border p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <SectionTitle title="퍼즐게임 사무실" aside={`작업 사본 ${data.executionLanes.length} · 실제 에이전트 ${runCounts.active}`} />
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenTab("runs")} className="h-8 gap-1.5">
                <Rocket className="h-3.5 w-3.5" />
                실행 현황
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => onOpenTab("lanes")} className="h-8 gap-1.5">
                <GitBranch className="h-3.5 w-3.5" />
                작업 사본
              </Button>
            </div>
          </div>
        <div
          className="relative h-[360px] min-h-[340px] overflow-hidden border-4 border-black bg-[#10140f] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.06),8px_8px_0_rgba(0,0,0,0.35)] md:h-[420px] 2xl:h-[520px]"
          style={{
            backgroundImage:
              "linear-gradient(45deg, rgba(255,255,255,0.035) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.035) 75%), linear-gradient(45deg, rgba(0,0,0,0.22) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.22) 75%), linear-gradient(to right, rgba(255,255,255,0.06) 2px, transparent 2px), linear-gradient(to bottom, rgba(255,255,255,0.06) 2px, transparent 2px)",
            backgroundPosition: "0 0, 16px 16px, 0 0, 0 0",
            backgroundSize: "32px 32px, 32px 32px, 32px 32px, 32px 32px",
            imageRendering: "pixelated",
          }}
        >
          <div className="absolute left-4 top-4 z-10 border-2 border-black bg-[#101820] px-3 py-2 font-mono text-[11px] font-bold uppercase leading-none text-cyan-100 shadow-[3px_3px_0_rgba(0,0,0,0.55)]">
            퍼즐 사무실
            <span className="ml-2 text-emerald-300">
              {`· ${runCounts.active} 가동`}
            </span>
          </div>
          <OfficeLayout />
          <OfficeWorkProductStack count={workProducts.length} onClick={() => onOpenTab("desk")} />
          <OfficeMapHotspot className="left-[6%] bottom-[33%]" count={inbox?.counts.open ?? 0} icon={Inbox} label="신호함" onClick={() => onOpenTab("inbox")} tone="cyan" />
          <OfficeMapHotspot className="right-[7%] top-[17%]" count={approvals?.counts.pending ?? 0} icon={ShieldAlert} label="검수" onClick={() => onOpenTab("approvals")} tone={(approvals?.counts.pending ?? 0) > 0 ? "amber" : "green"} />
          <OfficeMapHotspot className="right-[7%] bottom-[7%]" count={runCounts.active} icon={Rocket} label="실행" onClick={() => onOpenTab("runs")} tone={runCounts.failed > 0 ? "red" : "green"} />
          {visibleRoomWorkOrders.map((order, index) => (
            <OfficeWorkOrderMarker
              key={order.id}
              data={data}
              index={index}
              order={order}
              onOpen={() => onOpenWorkOrder(order.id)}
            />
          ))}
          {roomWorkOrderOverflow > 0 ? (
            <button
              type="button"
              onClick={() => onOpenTab("intake")}
              className="absolute bottom-[30%] left-[29%] z-20 border-4 border-black bg-[#e7d57a] px-2 py-1 font-mono text-[10px] font-black uppercase leading-none text-black shadow-[4px_4px_0_rgba(0,0,0,0.55)] transition-transform hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-cyan-300"
            >
              +{roomWorkOrderOverflow} 업무
            </button>
          ) : null}
          {roomActorEntries.map(({ actor, slotIndex }) => (
            <RoomActorSprite
              key={actor.id}
              active={selectedActor?.id === actor.id}
              actor={actor}
              workspaceName={data.name}
              slotIndex={slotIndex}
              onSelect={() => {
                setSelectedActorId(actor.id);
                if (data.agents.some((agent) => agent.id === actor.id || agent.slug === actor.slug)) {
                  onFocusAgent(actor.id);
                }
              }}
            />
          ))}
        </div>
        <div className="min-w-0 border-2 border-border bg-background">
          <div className="flex flex-col gap-2 border-b border-border px-4 py-3 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-semibold">사무실 상황판</p>
              <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{data.shortPath}</p>
            </div>
            <p className="text-xs text-muted-foreground">
              연결 책상 {roomActors.length} · 실행 대기 {queuedRuns} · 산출물 {workProducts.length}
            </p>
          </div>

          <div className="border-t border-border px-4 py-4 lg:px-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">선택한 책상</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {selectedActor ? `${compactAgentName(selectedActor.name, data.name)} · ${selectedActor.zone}` : "책상을 선택하세요"}
                </p>
              </div>
              {selectedActor ? (
                <span className={cn("inline-flex border px-2 py-0.5 text-[11px] font-medium", actorStateTone[selectedActor.state] ?? actorStateTone.idle)}>
                  {koStatusLabel(selectedActor.state)}
                </span>
              ) : null}
            </div>

            {selectedActor ? (
              <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <div className="space-y-3">
                  <div className="border border-border bg-muted/30 px-3 py-3">
                    <p className="line-clamp-2 text-sm font-medium">{actorWorkLine(selectedActor)}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{actorRoomLine(selectedActor)}</p>
                    {selectedActor.request ? (
                      <p className="mt-2 line-clamp-2 font-mono text-[11px] text-muted-foreground">
                        {selectedActor.request.note ?? selectedActor.request.id}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <button
                      type="button"
                      onClick={() => selectedPrimaryWork ? onOpenWorkItem(selectedPrimaryWork) : openFocusedTab("issues")}
                      className="border border-border bg-background px-2 py-2 text-left transition-colors hover:bg-accent/50"
                    >
                      <span className="block text-lg font-semibold tabular-nums">{selectedActor.currentWork.length}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">업무</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openFocusedTab("runs")}
                      className="border border-border bg-background px-2 py-2 text-left transition-colors hover:bg-accent/50"
                    >
                      <span className="block text-lg font-semibold tabular-nums">{selectedRequests.length}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">호출</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openFocusedTab("desk")}
                      className="border border-border bg-background px-2 py-2 text-left transition-colors hover:bg-accent/50"
                    >
                      <span className="block text-lg font-semibold tabular-nums">{selectedProducts.length}</span>
                      <span className="block truncate text-[11px] text-muted-foreground">산출물</span>
                    </button>
                  </div>

                  {selectedActor.currentWork.length ? (
                    <div className="space-y-1.5">
                      {selectedActor.currentWork.slice(0, 3).map((work) => (
                        <button
                          key={`${work.type}:${work.id}`}
                          type="button"
                          onClick={() => onOpenWorkItem(work)}
                          className="flex w-full min-w-0 items-center justify-between gap-2 border border-border bg-background px-2.5 py-2 text-left transition-colors hover:bg-accent/50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-xs font-medium">{work.title}</span>
                            <span className="block truncate text-[11px] text-muted-foreground">{work.id} · {work.status}</span>
                          </span>
                          <FolderOpen className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {selectedRequests.length ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">실행 기록</p>
                        <button
                          type="button"
                          onClick={() => openFocusedTab("runs")}
                          className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                        >
                          보기
                        </button>
                      </div>
                      {selectedRequests.map((request) => (
                        <button
                          key={request.id}
                          type="button"
                          onClick={() => onOpenRun(request.id)}
                          className="flex w-full min-w-0 items-start justify-between gap-2 border border-border bg-background px-2.5 py-2 text-left transition-colors hover:bg-accent/50"
                        >
                          <span className="min-w-0">
                            <span className="block line-clamp-2 text-xs font-medium">{request.note ?? request.id}</span>
                            <span className="mt-1 block truncate font-mono text-[10px] text-muted-foreground">
                              {formatIsoAge(request.updatedAt ?? request.requestedAt)} · {request.id}
                            </span>
                          </span>
                          <span className="shrink-0">
                            <RunRuntimePill runtime={request.runtime} status={request.status} />
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="space-y-3">
                  <div className="border border-border bg-muted/25 px-3 py-3">
                    <p className="text-sm font-semibold">관제 모드</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      당분간 지시는 Codex나 Claude Code 앱에서 내리고, 여기서는 어느 책상이 움직이는지 보는 데 집중합니다.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => openFocusedTab("comms")} className="h-8 gap-1.5">
                      <MessageSquare className="h-3.5 w-3.5" />
                      대화 보기
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => openFocusedTab("desk")} className="h-8 gap-1.5">
                      <SquarePen className="h-3.5 w-3.5" />
                      업무 보기
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={() => openFocusedTab("runs")} className="h-8 gap-1.5">
                      <Activity className="h-3.5 w-3.5" />
                      실행 보기
                    </Button>
                  </div>

                  <details className="border border-border bg-background">
                    <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
                      고급 운영 도구: Splice에서 직접 지시하기
                    </summary>
                    <form
                      data-testid="desk-focus-instruction-form"
                      className="space-y-2 border-t border-border px-3 py-3"
                      onSubmit={submitDeskInstruction}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">직접 지시</p>
                        {selectedAgent ? <span className="truncate text-[11px] text-muted-foreground">{compactAgentName(selectedAgent.name, data.name)}</span> : null}
                      </div>
                      <textarea
                        data-testid="desk-focus-instruction-input"
                        value={deskDraft}
                        onChange={(event) => setDeskDraft(event.target.value)}
                        className="min-h-20 w-full resize-y border border-border bg-background px-2.5 py-2 text-sm outline-none focus:border-ring"
                        placeholder={selectedAgent ? `${compactAgentName(selectedAgent.name, data.name)}에게 보낼 말` : "먼저 에이전트 책상을 선택하세요"}
                        disabled={!selectedAgent || sendingSelected}
                      />
                      <div className="flex justify-end">
                        <Button
                          type="submit"
                          size="sm"
                          disabled={!selectedAgent || !deskDraft.trim() || sendingSelected}
                          className="h-8 gap-1.5"
                        >
                          <Send className={cn("h-3.5 w-3.5", sendingSelected && "animate-pulse")} />
                          {sendingSelected ? "전송 중" : "전송 + 깨우기"}
                        </Button>
                      </div>
                    </form>
                  </details>
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-2 gap-px border-t border-border bg-border md:grid-cols-4 xl:grid-cols-7">
            {officeSignals.map((signal) => {
              const Icon = signal.icon;
              return (
                <button
                  key={signal.tab}
                  type="button"
                  onClick={() => onOpenTab(signal.tab)}
                  className="min-w-0 bg-background px-3 py-3 text-left transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="min-w-0 truncate text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                      {signal.title}
                    </span>
                  </div>
                  <p className="mt-2 text-2xl font-semibold tabular-nums">{formatNumber(signal.value)}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{signal.subtitle}</p>
                </button>
              );
            })}
          </div>

          <details className="border-t border-border">
            <summary className="cursor-pointer px-4 py-3 text-xs font-semibold text-muted-foreground hover:text-foreground">
              러너 수동 조작
            </summary>
            <div className="border-t border-border px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDispatchRunner(true)}
                  disabled={dispatchingRunner || queuedRuns === 0}
                  className="h-8 gap-1.5"
                >
                  <Activity className={cn("h-3.5 w-3.5", dispatchingRunner && "animate-pulse")} />
                  미리 점검
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onDispatchRunner(false)}
                  disabled={dispatchingRunner || queuedRuns === 0}
                  className="h-8 gap-1.5"
                >
                  <Rocket className={cn("h-3.5 w-3.5", dispatchingRunner && "animate-pulse")} />
                  실행 시작
                </Button>
              </div>
              {runnerNotice ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{runnerNotice}</p> : null}
            </div>
          </details>

          <div className="grid border-t border-border md:grid-cols-2 xl:grid-cols-5">
            {data.agents.slice(0, 7).map((agent) => (
              <EntityRow
                key={agent.id}
                title={compactAgentName(agent.name, data.name)}
                subtitle={agent.currentWork[0]?.title ?? "배정 업무 없음"}
                leading={<Dot state={agent.state} />}
                trailing={<span className="text-xs text-muted-foreground">{koStatusLabel(agent.state)}</span>}
              />
            ))}
          </div>
        </div>
      </div>
      </details>
    </section>
  );
}

export function SpliceWorkspaceRoom() {
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<RoomTab>("dashboard");
  const [focusedAgentId, setFocusedAgentId] = useState<string | null>(null);
  const [focusedRunId, setFocusedRunId] = useState<string | null>(null);
  const [focusedWorkItemKey, setFocusedWorkItemKey] = useState<string | null>(null);
  const [focusedWorkOrderId, setFocusedWorkOrderId] = useState<string | null>(null);
  const [runnerNotice, setRunnerNotice] = useState<string | null>(null);
  const onFocusAgent = useCallback((agentId: string) => {
    setFocusedAgentId(agentId);
  }, []);
  const onFocusRun = useCallback((runId: string) => {
    setFocusedRunId(runId);
  }, []);
  const onOpenRun = useCallback((runId: string) => {
    setFocusedRunId(runId);
    setActiveTab("runs");
  }, []);
  const onFocusWorkItem = useCallback((item: WorkItemRef) => {
    setFocusedWorkItemKey(workItemKey(item));
  }, []);
  const onOpenWorkItem = useCallback((item: WorkItemRef) => {
    setFocusedWorkItemKey(workItemKey(item));
    setActiveTab("desk");
  }, []);
  const onOpenWorkOrder = useCallback((workOrderId: string) => {
    setFocusedWorkOrderId(workOrderId);
    setActiveTab("intake");
  }, []);
  const roomQuery = useQuery({
    queryKey: WORKSPACE_ROOM_QUERY_ROOT,
    queryFn: () => spliceApi.workspaceRoom(PUZZLE_TESTBED_ID),
    refetchInterval: 10000,
  });
  const inboxQuery = useQuery({
    queryKey: [...WORKSPACE_ROOM_QUERY_ROOT, "inbox"],
    queryFn: () => spliceApi.workspaceRoomInbox(PUZZLE_TESTBED_ID),
    refetchInterval: 5000,
  });
  const messagesQuery = useQuery({
    queryKey: [...WORKSPACE_ROOM_QUERY_ROOT, "messages"],
    queryFn: () => spliceApi.workspaceRoomMessages(PUZZLE_TESTBED_ID),
    refetchInterval: 5000,
  });
  const agentConsoleQuery = useQuery({
    queryKey: [...WORKSPACE_ROOM_QUERY_ROOT, "agent-console"],
    queryFn: () => spliceApi.workspaceRoomAgentConsole(PUZZLE_TESTBED_ID),
    refetchInterval: 5000,
  });
  const runsQuery = useQuery({
    queryKey: [...WORKSPACE_ROOM_QUERY_ROOT, "runs"],
    queryFn: () => spliceApi.workspaceRoomRuns(PUZZLE_TESTBED_ID),
    refetchInterval: 5000,
  });
  const workThreadQuery = useQuery({
    queryKey: [...WORKSPACE_ROOM_QUERY_ROOT, "work-thread"],
    queryFn: () => spliceApi.workspaceRoomWorkThread(PUZZLE_TESTBED_ID),
    refetchInterval: 5000,
  });
  const reviewsQuery = useQuery({
    queryKey: [...WORKSPACE_ROOM_QUERY_ROOT, "reviews"],
    queryFn: () => spliceApi.workspaceRoomReviews(PUZZLE_TESTBED_ID),
    refetchInterval: 5000,
  });
  const routinesQuery = useQuery({
    queryKey: [...WORKSPACE_ROOM_QUERY_ROOT, "routines"],
    queryFn: () => spliceApi.workspaceRoomRoutines(PUZZLE_TESTBED_ID),
    refetchInterval: 5000,
  });
  const approvalsQuery = useQuery({
    queryKey: [...WORKSPACE_ROOM_QUERY_ROOT, "approvals"],
    queryFn: () => spliceApi.workspaceRoomApprovals(PUZZLE_TESTBED_ID),
    refetchInterval: 5000,
  });
  const timelineQuery = useQuery({
    queryKey: [...WORKSPACE_ROOM_QUERY_ROOT, "timeline"],
    queryFn: () => spliceApi.workspaceRoomTimeline(PUZZLE_TESTBED_ID),
    refetchInterval: 5000,
  });
  const workOrdersQuery = useQuery({
    queryKey: [...WORKSPACE_ROOM_QUERY_ROOT, "work-orders"],
    queryFn: () => spliceApi.workspaceRoomWorkOrders(PUZZLE_TESTBED_ID),
    refetchInterval: 5000,
  });
  const runAgentMutation = useMutation({
    mutationFn: (agentId: string) => spliceApi.runWorkspaceRoomAgent(PUZZLE_TESTBED_ID, agentId),
    onSuccess: () => {
      void roomQuery.refetch();
      void inboxQuery.refetch();
      void agentConsoleQuery.refetch();
      void runsQuery.refetch();
      void routinesQuery.refetch();
      void timelineQuery.refetch();
    },
  });
  const sendMessageMutation = useMutation({
    mutationFn: ({ agentId, body }: { agentId: string; body: string }) =>
      spliceApi.sendWorkspaceRoomMessage(PUZZLE_TESTBED_ID, agentId, body),
    onSuccess: () => {
      void roomQuery.refetch();
      void inboxQuery.refetch();
      void messagesQuery.refetch();
      void agentConsoleQuery.refetch();
      void runsQuery.refetch();
      void timelineQuery.refetch();
      void workOrdersQuery.refetch();
    },
  });
  const updateRoutineMutation = useMutation({
    mutationFn: ({ routineId, input }: { routineId: string; input: { enabled?: boolean; intervalMinutes?: number } }) =>
      spliceApi.updateWorkspaceRoomRoutine(PUZZLE_TESTBED_ID, routineId, input),
    onSuccess: () => {
      void routinesQuery.refetch();
      void timelineQuery.refetch();
    },
  });
  const runRoutineMutation = useMutation({
    mutationFn: (routineId: string) => spliceApi.runWorkspaceRoomRoutine(PUZZLE_TESTBED_ID, routineId),
    onSuccess: () => {
      void routinesQuery.refetch();
      void roomQuery.refetch();
      void inboxQuery.refetch();
      void agentConsoleQuery.refetch();
      void runsQuery.refetch();
      void timelineQuery.refetch();
    },
  });
  const createApprovalMutation = useMutation({
    mutationFn: (input: { agentId?: string | null; kind: string; title: string; body: string }) =>
      spliceApi.createWorkspaceRoomApproval(PUZZLE_TESTBED_ID, input),
    onSuccess: () => {
      void approvalsQuery.refetch();
      void inboxQuery.refetch();
      void timelineQuery.refetch();
    },
  });
  const decideApprovalMutation = useMutation({
    mutationFn: ({ approvalId, decision, body, wakeAgent }: { approvalId: string; decision: "approved" | "changes_requested" | "rejected"; body: string; wakeAgent: boolean }) =>
      spliceApi.createWorkspaceRoomApprovalDecision(PUZZLE_TESTBED_ID, approvalId, { decision, body, wakeAgent }),
    onSuccess: () => {
      void approvalsQuery.refetch();
      void inboxQuery.refetch();
      void roomQuery.refetch();
      void agentConsoleQuery.refetch();
      void runsQuery.refetch();
      void timelineQuery.refetch();
    },
  });
  const addCommentMutation = useMutation({
    mutationFn: (input: WorkThreadCommentInput) =>
      spliceApi.createWorkspaceRoomComment(PUZZLE_TESTBED_ID, input),
    onSuccess: () => {
      void workThreadQuery.refetch();
      void roomQuery.refetch();
      void inboxQuery.refetch();
      void agentConsoleQuery.refetch();
      void runsQuery.refetch();
      void timelineQuery.refetch();
      void queryClient.invalidateQueries({ queryKey: [...WORKSPACE_ROOM_QUERY_ROOT, "run-detail"] });
    },
  });
  const addWorkProductMutation = useMutation({
    mutationFn: (input: { itemType: string; itemId: string; title: string; body: string; kind?: string }) =>
      spliceApi.createWorkspaceRoomWorkProduct(PUZZLE_TESTBED_ID, input),
    onSuccess: () => {
      void workThreadQuery.refetch();
      void timelineQuery.refetch();
    },
  });
  const requestReviewMutation = useMutation({
    mutationFn: (input: { itemType: string; itemId: string; title: string; body: string; reviewerAgentId?: string | null; sourceWorkProductId?: string | null }) =>
      spliceApi.createWorkspaceRoomReview(PUZZLE_TESTBED_ID, input),
    onSuccess: () => {
      void reviewsQuery.refetch();
      void workThreadQuery.refetch();
      void inboxQuery.refetch();
      void timelineQuery.refetch();
    },
  });
  const decideReviewMutation = useMutation({
    mutationFn: ({ reviewId, decision, body, wakeAgent }: { reviewId: string; decision: "approved" | "changes_requested" | "rejected"; body: string; wakeAgent: boolean }) =>
      spliceApi.createWorkspaceRoomReviewDecision(PUZZLE_TESTBED_ID, reviewId, { decision, body, wakeAgent }),
    onSuccess: () => {
      void reviewsQuery.refetch();
      void workThreadQuery.refetch();
      void inboxQuery.refetch();
      void roomQuery.refetch();
      void agentConsoleQuery.refetch();
      void runsQuery.refetch();
      void timelineQuery.refetch();
    },
  });
  const updateInboxMutation = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: "open" | "done" }) =>
      spliceApi.updateWorkspaceRoomInboxStatus(PUZZLE_TESTBED_ID, itemId, status),
    onSuccess: () => {
      void inboxQuery.refetch();
      void timelineQuery.refetch();
    },
  });
  const dispatchRunnerMutation = useMutation({
    mutationFn: (dryRun: boolean) => spliceApi.dispatchRunner(dryRun),
    onSuccess: (result, dryRun) => {
      setRunnerNotice(dryRun
        ? `Dry run checked ${result.pending} queued request${result.pending === 1 ? "" : "s"}.`
        : `Runner dispatched ${result.pending} queued request${result.pending === 1 ? "" : "s"}.`);
      void roomQuery.refetch();
      void inboxQuery.refetch();
      void runsQuery.refetch();
      void routinesQuery.refetch();
      void timelineQuery.refetch();
    },
    onError: (error) => {
      setRunnerNotice(error instanceof Error ? error.message : "Runner dispatch failed.");
    },
  });
  const createWorkOrderMutation = useMutation({
    mutationFn: (input: { title: string; body: string; agentId?: string | null; projectId?: string | null; priority?: string; wakeAgent?: boolean }) =>
      spliceApi.createWorkspaceRoomWorkOrder(PUZZLE_TESTBED_ID, input),
    onSuccess: (result) => {
      setFocusedWorkOrderId(result.workOrder.id);
      void workOrdersQuery.refetch();
      void inboxQuery.refetch();
      void timelineQuery.refetch();
      void roomQuery.refetch();
      void agentConsoleQuery.refetch();
      void runsQuery.refetch();
    },
  });
  const updateWorkOrderStatusMutation = useMutation({
    mutationFn: ({ workOrderId, status, wakeAgent }: { workOrderId: string; status: string; wakeAgent?: boolean }) =>
      spliceApi.updateWorkspaceRoomWorkOrderStatus(PUZZLE_TESTBED_ID, workOrderId, { status, wakeAgent }),
    onSuccess: () => {
      void workOrdersQuery.refetch();
      void inboxQuery.refetch();
      void timelineQuery.refetch();
      void roomQuery.refetch();
      void agentConsoleQuery.refetch();
      void runsQuery.refetch();
    },
  });
  const updateRunStatusMutation = useMutation({
    mutationFn: ({ runId, status, error }: { runId: string; status: string; error?: string }) =>
      spliceApi.updateWorkspaceRoomRunStatus(PUZZLE_TESTBED_ID, runId, { status, error }),
    onSuccess: () => {
      void runsQuery.refetch();
      void roomQuery.refetch();
      void inboxQuery.refetch();
      void agentConsoleQuery.refetch();
      void timelineQuery.refetch();
    },
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
          {roomQuery.error instanceof Error ? roomQuery.error.message : "알 수 없는 오류"}
        </p>
      </div>
    );
  }

  const runningAgentId = runAgentMutation.isPending ? runAgentMutation.variables ?? null : null;
  const sendingAgentId = sendMessageMutation.isPending ? sendMessageMutation.variables?.agentId ?? null : null;
  const inbox = inboxQuery.data ?? null;
  const messages = messagesQuery.data?.messages ?? [];
  const agentConsole = agentConsoleQuery.data ?? null;
  const runs = runsQuery.data ?? null;
  const workThread = workThreadQuery.data;
  const reviews = reviewsQuery.data?.reviews ?? [];
  const routines = routinesQuery.data ?? null;
  const approvals = approvalsQuery.data ?? null;
  const timeline = timelineQuery.data ?? null;
  const workOrders = workOrdersQuery.data ?? null;
  const postingCommentKey = addCommentMutation.isPending && addCommentMutation.variables
    ? `${addCommentMutation.variables.itemType}:${addCommentMutation.variables.itemId}`
    : null;
  const savingProductKey = addWorkProductMutation.isPending && addWorkProductMutation.variables
    ? `${addWorkProductMutation.variables.itemType}:${addWorkProductMutation.variables.itemId}`
    : null;
  const requestingReviewKey = requestReviewMutation.isPending && requestReviewMutation.variables
    ? `${requestReviewMutation.variables.itemType}:${requestReviewMutation.variables.itemId}`
    : null;
  const requestingReviewProductId = requestReviewMutation.isPending
    ? requestReviewMutation.variables?.sourceWorkProductId ?? null
    : null;
  const decidingReviewId = decideReviewMutation.isPending ? decideReviewMutation.variables?.reviewId ?? null : null;
  const updatingInboxItemId = updateInboxMutation.isPending ? updateInboxMutation.variables?.itemId ?? null : null;
  const updatingRoutineId = updateRoutineMutation.isPending ? updateRoutineMutation.variables?.routineId ?? null : null;
  const runningRoutineId = runRoutineMutation.isPending ? runRoutineMutation.variables ?? null : null;
  const decidingApprovalId = decideApprovalMutation.isPending ? decideApprovalMutation.variables?.approvalId ?? null : null;
  const updatingWorkOrderId = updateWorkOrderStatusMutation.isPending ? updateWorkOrderStatusMutation.variables?.workOrderId ?? null : null;
  const updatingRunId = updateRunStatusMutation.isPending ? updateRunStatusMutation.variables?.runId ?? null : null;

  return (
    <PuzzleWorkspaceShell
      data={data}
      approvalPendingCount={approvals?.counts.pending ?? 0}
      activeTab={activeTab}
      inboxOpenCount={inbox?.counts.open ?? 0}
      runActiveCount={runs?.counts.active ?? data.requests.filter((request) => ["requested", "launch_ready", "launched"].includes(String(request.status))).length}
      routineDueCount={routines?.counts.due ?? 0}
      workOrderOpenCount={workOrders?.counts.open ?? 0}
      onTabChange={setActiveTab}
      onRefresh={() => {
        void roomQuery.refetch();
        void inboxQuery.refetch();
        void messagesQuery.refetch();
        void agentConsoleQuery.refetch();
        void runsQuery.refetch();
        void workThreadQuery.refetch();
        void reviewsQuery.refetch();
        void routinesQuery.refetch();
        void approvalsQuery.refetch();
        void timelineQuery.refetch();
        void workOrdersQuery.refetch();
      }}
      refreshing={roomQuery.isFetching || inboxQuery.isFetching || messagesQuery.isFetching || agentConsoleQuery.isFetching || runsQuery.isFetching || workThreadQuery.isFetching || reviewsQuery.isFetching || routinesQuery.isFetching || approvalsQuery.isFetching || timelineQuery.isFetching || workOrdersQuery.isFetching}
    >
      {activeTab === "dashboard" && (
        <DashboardTab
          agentConsole={agentConsole}
          approvals={approvals}
          data={data}
          dispatchingRunner={dispatchRunnerMutation.isPending}
          focusedAgentId={focusedAgentId}
          inbox={inbox}
          messages={messages}
          onDispatchRunner={(dryRun) => dispatchRunnerMutation.mutate(dryRun)}
          onFocusAgent={onFocusAgent}
          onOpenRun={onOpenRun}
          onOpenWorkOrder={onOpenWorkOrder}
          onOpenWorkItem={onOpenWorkItem}
          onOpenTab={setActiveTab}
          onRunAgent={(agentId) => runAgentMutation.mutate(agentId)}
          onSend={(agentId, body) => sendMessageMutation.mutate({ agentId, body })}
          routines={routines}
          runs={runs}
          reviews={reviews}
          runningAgentId={runningAgentId}
          runnerNotice={runnerNotice}
          sendingAgentId={sendingAgentId}
          workOrders={workOrders}
          workProducts={workThread?.workProducts ?? []}
        />
      )}
      {activeTab === "inbox" && (
        <InboxTab
          inbox={inbox}
          updatingItemId={updatingInboxItemId}
          onOpenTab={setActiveTab}
          onOpenRun={onOpenRun}
          onOpenWorkOrder={onOpenWorkOrder}
          onOpenWorkItem={onOpenWorkItem}
          onUpdateStatus={(itemId, status) => updateInboxMutation.mutate({ itemId, status })}
        />
      )}
      {activeTab === "lanes" && <LanesTab data={data} />}
      {activeTab === "runs" && (
        <RunsTab
          data={data}
          dispatchingRunner={dispatchRunnerMutation.isPending}
          focusedRunId={focusedRunId}
          postingCommentKey={postingCommentKey}
          runs={runs}
          runnerNotice={runnerNotice}
          updatingRunId={updatingRunId}
          onAddComment={(input) => addCommentMutation.mutate(input)}
          onDispatchRunner={(dryRun) => dispatchRunnerMutation.mutate(dryRun)}
          onFocusAgent={onFocusAgent}
          onFocusRun={onFocusRun}
          onOpenTab={setActiveTab}
          onOpenWorkOrder={onOpenWorkOrder}
          onOpenWorkItem={onOpenWorkItem}
          onUpdateRunStatus={(runId, status, error) => updateRunStatusMutation.mutate({ runId, status, error })}
        />
      )}
      {activeTab === "intake" && (
        <IntakeTab
          creatingWorkOrder={createWorkOrderMutation.isPending}
          data={data}
          focusedWorkOrderId={focusedWorkOrderId}
          updatingWorkOrderId={updatingWorkOrderId}
          workOrders={workOrders}
          onCreateWorkOrder={(input) => createWorkOrderMutation.mutate(input)}
          onFocusAgent={onFocusAgent}
          onOpenRun={onOpenRun}
          onOpenTab={setActiveTab}
          onOpenWorkItem={onOpenWorkItem}
          onUpdateWorkOrderStatus={(workOrderId, status, wakeAgent) =>
            updateWorkOrderStatusMutation.mutate({ workOrderId, status, wakeAgent })}
        />
      )}
      {activeTab === "goals" && <GoalsTab goals={paperGoals} projects={paperProjects} issues={paperIssues} />}
      {activeTab === "projects" && <ProjectsTab projects={data.projects} />}
      {activeTab === "issues" && <IssuesTab data={data} onOpenWorkItem={onOpenWorkItem} />}
      {activeTab === "desk" && (
        <WorkDeskTab
          data={data}
          comments={workThread?.comments ?? []}
          focusedWorkItemKey={focusedWorkItemKey}
          workProducts={workThread?.workProducts ?? []}
          postingCommentKey={postingCommentKey}
          requestingReviewProductId={requestingReviewProductId}
          savingProductKey={savingProductKey}
          onAddComment={(input) => addCommentMutation.mutate(input)}
          onAddWorkProduct={(input) => addWorkProductMutation.mutate(input)}
          onFocusWorkItem={onFocusWorkItem}
          onOpenRun={onOpenRun}
          onRequestReview={(input) => requestReviewMutation.mutate(input)}
        />
      )}
      {activeTab === "reviews" && (
        <ReviewGateTab
          data={data}
          reviews={reviews}
          requestingReviewKey={requestingReviewKey}
          decidingReviewId={decidingReviewId}
          onOpenRun={onOpenRun}
          onRequestReview={(input) => requestReviewMutation.mutate(input)}
          onDecideReview={(reviewId, decision, body, wakeAgent) => decideReviewMutation.mutate({ reviewId, decision, body, wakeAgent })}
        />
      )}
      {activeTab === "approvals" && (
        <ApprovalsTab
          approvals={approvals}
          creatingApproval={createApprovalMutation.isPending}
          data={data}
          decidingApprovalId={decidingApprovalId}
          onCreateApproval={(input) => createApprovalMutation.mutate(input)}
          onDecideApproval={(approvalId, decision, body, wakeAgent) =>
            decideApprovalMutation.mutate({ approvalId, decision, body, wakeAgent })}
        />
      )}
      {activeTab === "routines" && (
        <RoutinesTab
          data={data}
          routines={routines}
          runningRoutineId={runningRoutineId}
          updatingRoutineId={updatingRoutineId}
          onOpenRun={onOpenRun}
          onRunRoutine={(routineId) => runRoutineMutation.mutate(routineId)}
          onToggleRoutine={(routineId, input) => updateRoutineMutation.mutate({ routineId, input })}
        />
      )}
      {activeTab === "agents" && (
        <AgentsTab
          agentConsole={agentConsole}
          data={data}
          focusedAgentId={focusedAgentId}
          messages={messages}
          onFocusAgent={onFocusAgent}
          onOpenRun={onOpenRun}
          sendingAgentId={sendingAgentId}
          runningAgentId={runningAgentId}
          onSend={(agentId, body) => sendMessageMutation.mutate({ agentId, body })}
          onRunAgent={(agentId) => runAgentMutation.mutate(agentId)}
        />
      )}
      {activeTab === "comms" && (
        <CommsTab
          data={data}
          focusedAgentId={focusedAgentId}
          messages={messages}
          onFocusAgent={onFocusAgent}
          onOpenRun={onOpenRun}
          sendingAgentId={sendingAgentId}
          onSend={(agentId, body) => sendMessageMutation.mutate({ agentId, body })}
        />
      )}
      {activeTab === "activity" && <ActivityTab data={data} messages={messages} timeline={timeline} onOpenTab={setActiveTab} onOpenRun={onOpenRun} onOpenWorkOrder={onOpenWorkOrder} onOpenWorkItem={onOpenWorkItem} />}
      {activeTab === "details" && <DetailsTab data={data} />}
    </PuzzleWorkspaceShell>
  );
}
