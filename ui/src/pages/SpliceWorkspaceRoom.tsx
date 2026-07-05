import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
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
import { SidebarSection } from "@/components/SidebarSection";
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

const roomTabs: Array<{ value: RoomTab; label: string; icon: LucideIcon }> = [
  { value: "dashboard", label: "Office", icon: LayoutDashboard },
  { value: "inbox", label: "Inbox", icon: Inbox },
  { value: "lanes", label: "Lanes", icon: GitBranch },
  { value: "runs", label: "Runs", icon: Rocket },
  { value: "intake", label: "Intake", icon: SquarePen },
  { value: "goals", label: "Goals", icon: Target },
  { value: "projects", label: "Projects", icon: FolderOpen },
  { value: "issues", label: "Issues", icon: CircleDot },
  { value: "desk", label: "Work Desk", icon: SquarePen },
  { value: "reviews", label: "Review Gate", icon: ShieldAlert },
  { value: "approvals", label: "Approvals", icon: CheckCircle2 },
  { value: "routines", label: "Routines", icon: Repeat2 },
  { value: "agents", label: "Agents", icon: Bot },
  { value: "comms", label: "Comms", icon: MessageSquare },
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

const actorStateTone: Record<string, string> = {
  working: "border-emerald-500/45 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200",
  reviewing: "border-sky-500/45 bg-sky-500/10 text-sky-700 dark:text-sky-200",
  requested: "border-amber-500/45 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  queued: "border-stone-500/35 bg-stone-500/10 text-stone-700 dark:text-stone-200",
  present: "border-indigo-500/45 bg-indigo-500/10 text-indigo-700 dark:text-indigo-200",
  away: "border-border bg-muted/50 text-muted-foreground",
  blocked: "border-red-500/45 bg-red-500/10 text-red-700 dark:text-red-200",
  idle: "border-border bg-muted/50 text-muted-foreground",
};

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
  if (minutes == null) return "No file age";
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / (60 * 24))}d`;
}

function formatIsoAge(value: string | null | undefined): string {
  const time = Date.parse(value ?? "");
  if (!Number.isFinite(time)) return "No signal";
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
  if (runtime?.stale) return "process exited";
  if (runtime?.state) return runtime.state.replace(/_/g, " ");
  return status.replace(/_/g, " ");
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
  if (!Number.isFinite(time)) return "No schedule";
  const minutes = Math.round((time - Date.now()) / 60000);
  if (minutes <= 0) return "due now";
  if (minutes < 60) return `in ${minutes}m`;
  if (minutes < 60 * 24) return `in ${Math.round(minutes / 60)}h`;
  return `in ${Math.round(minutes / (60 * 24))}d`;
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
  return (
    <span className={cn(
      "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize",
      laneStateClass[state] ?? laneStateClass.idle,
    )}>
      {state.replace(/_/g, " ")}
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
  if (actor.request) return "Run requested";
  return actor.state === "away" ? "Away from room" : "Waiting for work";
}

function actorRoomLine(actor: SpliceWorkspaceRoomActor): string {
  const counts = [
    actor.activeCount ? `${actor.activeCount} active` : null,
    actor.reviewCount ? `${actor.reviewCount} review` : null,
    actor.queuedCount ? `${actor.queuedCount} queued` : null,
  ].filter(Boolean);
  if (counts.length) return counts.join(" · ");
  if (actor.session) return `${actor.session.branch} · ${actor.session.dirty} dirty`;
  if (actor.request) return "run requested";
  return actor.state === "away" ? "no active lane" : "standing by";
}

function actorStateLabel(actor: SpliceWorkspaceRoomActor): string {
  if (actor.state === "working") return "typing";
  if (actor.state === "reviewing") return "reviewing";
  if (actor.state === "requested") return "queued run";
  if (actor.state === "blocked") return "blocked";
  if (actor.state === "present") return "present";
  if (actor.state === "away") return "away";
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
    g: actor.state === "blocked" ? "#ef4444" : actor.state === "reviewing" ? "#38bdf8" : actor.state === "requested" ? "#f59e0b" : "#10b981",
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
      <OfficeRoom label="meeting" className="left-[5%] top-[5%] h-[27%] w-[24%]" />
      <OfficeRoom label="design pod" className="left-[27%] top-[16%] h-[41%] w-[22%]" />
      <OfficeRoom label="build bay" className="left-[50%] top-[16%] h-[48%] w-[24%]" />
      <OfficeRoom label="review" className="right-[5%] top-[16%] h-[48%] w-[20%]" />
      <OfficeRoom label="operator" className="bottom-[5%] left-[5%] h-[22%] w-[25%]" />
      <OfficeRoom label="ship" className="bottom-[5%] left-[37%] h-[22%] w-[22%]" />
      <OfficeRoom label="infra" className="bottom-[5%] right-[5%] h-[22%] w-[26%]" />
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
      title={`${count} work products`}
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
      aria-label={`${label} desk · ${actorStateLabel(actor)} · ${workLine}`}
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
  return roomTabs.find((item) => item.value === tab)?.label ?? "Office";
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
  approvalPendingCount,
  activeTab,
  data,
  inboxOpenCount,
  runActiveCount,
  routineDueCount,
  workOrderOpenCount,
  onTabChange,
}: {
  approvalPendingCount: number;
  activeTab: RoomTab;
  data: SpliceWorkspaceRoomData;
  inboxOpenCount: number;
  runActiveCount: number;
  routineDueCount: number;
  workOrderOpenCount: number;
  onTabChange: (tab: RoomTab) => void;
}) {
  const { isMobile, sidebarOpen, setSidebarOpen } = useSidebar();
  const selectTab = (tab: RoomTab) => {
    onTabChange(tab);
    if (isMobile) setSidebarOpen(false);
  };

  const dashboardItem = roomTabs.find((item) => item.value === "dashboard")!;
  const inboxItem = roomTabs.find((item) => item.value === "inbox")!;
  const laneItem = roomTabs.find((item) => item.value === "lanes")!;
  const runsItem = roomTabs.find((item) => item.value === "runs")!;
  const intakeItem = roomTabs.find((item) => item.value === "intake")!;
  const issueItem = roomTabs.find((item) => item.value === "issues")!;
  const deskItem = roomTabs.find((item) => item.value === "desk")!;
  const reviewsItem = roomTabs.find((item) => item.value === "reviews")!;
  const approvalsItem = roomTabs.find((item) => item.value === "approvals")!;
  const routinesItem = roomTabs.find((item) => item.value === "routines")!;
  const goalItem = roomTabs.find((item) => item.value === "goals")!;
  const projectItem = roomTabs.find((item) => item.value === "projects")!;
  const agentItem = roomTabs.find((item) => item.value === "agents")!;
  const commsItem = roomTabs.find((item) => item.value === "comms")!;
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
              <p className="truncate text-[11px] text-muted-foreground">PZ · puzzle office</p>
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
              onClick={() => selectTab("intake")}
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium text-foreground/80 transition-colors hover:bg-accent/50 hover:text-foreground"
            >
              <SquarePen className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">New Issue</span>
              <span className="ml-auto rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
                Intake
              </span>
            </button>
            <PuzzleSidebarNavItem activeTab={activeTab} item={dashboardItem} liveCount={runActiveCount} onSelect={selectTab} />
            <PuzzleSidebarNavItem
              activeTab={activeTab}
              item={inboxItem}
              onSelect={selectTab}
              textBadge={inboxOpenCount > 0 ? `${inboxOpenCount}` : undefined}
            />
            <PuzzleSidebarNavItem
              activeTab={activeTab}
              item={laneItem}
              onSelect={selectTab}
              textBadge={`${data.executionLanes?.length ?? 0}`}
            />
            <PuzzleSidebarNavItem
              activeTab={activeTab}
              item={runsItem}
              onSelect={selectTab}
              textBadge={runActiveCount > 0 ? `${runActiveCount}` : undefined}
            />
          </div>

          <SidebarSection label="Work">
            <PuzzleSidebarNavItem
              activeTab={activeTab}
              item={intakeItem}
              onSelect={selectTab}
              textBadge={workOrderOpenCount > 0 ? `${workOrderOpenCount}` : undefined}
            />
            <PuzzleSidebarNavItem activeTab={activeTab} item={issueItem} onSelect={selectTab} />
            <PuzzleSidebarNavItem activeTab={activeTab} item={deskItem} onSelect={selectTab} />
            <PuzzleSidebarNavItem activeTab={activeTab} item={reviewsItem} onSelect={selectTab} />
            <PuzzleSidebarNavItem
              activeTab={activeTab}
              item={approvalsItem}
              onSelect={selectTab}
              textBadge={approvalPendingCount > 0 ? `${approvalPendingCount}` : undefined}
            />
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
            <PuzzleSidebarNavItem
              activeTab={activeTab}
              item={routinesItem}
              onSelect={selectTab}
              textBadge={routineDueCount > 0 ? `${routineDueCount}` : undefined}
            />
            <PuzzleSidebarNavItem activeTab={activeTab} item={agentItem} onSelect={selectTab} textBadge={`${data.agents.length}`} />
            <PuzzleSidebarNavItem activeTab={activeTab} item={commsItem} onSelect={selectTab} textBadge={`${data.requests.length}`} />
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
    <div className="flex h-full min-h-0 bg-background text-foreground">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[200] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Skip to Main Content
      </a>
      <PuzzleSidebar
        approvalPendingCount={approvalPendingCount}
        activeTab={activeTab}
        data={data}
        inboxOpenCount={inboxOpenCount}
        runActiveCount={runActiveCount}
        routineDueCount={routineDueCount}
        workOrderOpenCount={workOrderOpenCount}
        onTabChange={onTabChange}
      />
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
  onOpenTab,
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
  onOpenTab: (tab: RoomTab) => void;
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
        onOpenTab={onOpenTab}
        onRunAgent={onRunAgent}
        routines={routines}
        runnerNotice={runnerNotice}
        runningAgentId={runningAgentId}
        runs={runs}
        workOrders={workOrders}
        workProducts={workProducts}
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
        <MetricCard icon={Bot} value={data.totals.activeAgents} label="Agents Enabled" description={`${data.totals.agents} total`} />
        <MetricCard icon={CircleDot} value={data.totals.activeIssues} label="Tasks In Progress" description={`${data.totals.issues} total issues`} />
        <MetricCard icon={Clock3} value={data.totals.reviewIssues} label="In Review" description={`${data.totals.todoIssues} queued next`} />
        <MetricCard icon={ShieldAlert} value={data.totals.blockedIssues} label="Blocked" description={`${data.totals.progress}% progress`} />
      </div>

      <ExecutionLanesPanel data={data} limit={3} />

      <OfficeRunsSummary data={data} runs={runs} />

      <OfficeWorkOrdersSummary data={data} workOrders={workOrders} />

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

function OfficeRunsSummary({ data, runs }: { data: SpliceWorkspaceRoomData; runs: SpliceRunMonitorData | null }) {
  const monitorRuns = runs?.runs ?? data.requests;
  const activeStatuses = new Set(["requested", "launch_ready", "launched"]);
  const activeRuns = monitorRuns
    .filter((run) => activeStatuses.has(String(run.status)))
    .slice(0, 5);
  const visibleRuns = activeRuns.length ? activeRuns : monitorRuns.slice(0, 5);
  const fallbackCounts = {
    total: monitorRuns.length,
    active: activeRuns.length,
    requested: monitorRuns.filter((run) => run.status === "requested").length,
    launchReady: monitorRuns.filter((run) => run.status === "launch_ready").length,
    launched: monitorRuns.filter((run) => run.status === "launched").length,
    done: monitorRuns.filter((run) => run.status === "done").length,
    failed: monitorRuns.filter((run) => run.status === "failed").length,
    blocked: monitorRuns.filter((run) => run.status === "blocked").length,
    noop: monitorRuns.filter((run) => run.status === "noop").length,
    cancelled: monitorRuns.filter((run) => run.status === "cancelled").length,
    terminal: monitorRuns.filter((run) => ["done", "failed", "blocked", "noop", "cancelled"].includes(String(run.status))).length,
  };
  const counts = runs?.counts ?? fallbackCounts;

  return (
    <section className="space-y-3">
      <SectionTitle title="Run Monitor" aside={`${counts.active} active · ${counts.total} total`} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard icon={Rocket} value={counts.active} label="Active" description={`${counts.requested} queued`} />
          <MetricCard icon={Clock3} value={counts.launchReady} label="Ready" description="runner pickup" />
          <MetricCard icon={Activity} value={counts.launched} label="Launched" description="process started" />
          <MetricCard icon={ShieldAlert} value={counts.failed} label="Failed" description={`${counts.blocked} blocked · ${counts.noop} noop`} />
        </div>
        <div className="min-w-0 border border-border">
          {visibleRuns.length ? visibleRuns.map((run) => (
            <EntityRow
              key={run.id}
              title={compactAgentName(run.agentName, data.name)}
              subtitle={run.note ?? run.launch?.outPath ?? "Wake request"}
              leading={<Rocket className="h-4 w-4 text-muted-foreground" />}
              trailing={(
                <div className="flex flex-wrap items-center justify-end gap-1.5">
                  <RunRuntimePill runtime={run.runtime} status={run.status} />
                  <StatusBadge status={run.status} />
                </div>
              )}
            />
          )) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">No run requests yet.</p>
          )}
        </div>
      </div>
    </section>
  );
}

function OfficeWorkOrdersSummary({ data, workOrders }: { data: SpliceWorkspaceRoomData; workOrders: SpliceWorkOrdersData | null }) {
  const visibleOrders = workOrders?.workOrders.slice(0, 5) ?? [];
  return (
    <section className="space-y-3">
      <SectionTitle title="Work Intake" aside={`${workOrders?.counts.open ?? 0} open · ${workOrders?.counts.queued ?? 0} queued`} />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard icon={SquarePen} value={workOrders?.counts.open ?? 0} label="Open" description={`${workOrders?.counts.total ?? 0} total`} />
          <MetricCard icon={Rocket} value={workOrders?.counts.queued ?? 0} label="Queued" description="agent wake linked" />
          <MetricCard icon={Activity} value={workOrders?.counts.inProgress ?? 0} label="Active" description="in progress" />
          <MetricCard icon={ShieldAlert} value={workOrders?.counts.blocked ?? 0} label="Blocked" description={`${workOrders?.counts.done ?? 0} done`} />
        </div>
        <div className="min-w-0 border border-border">
          {visibleOrders.length ? visibleOrders.map((workOrder) => (
            <EntityRow
              key={workOrder.id}
              title={workOrder.title}
              subtitle={`${workOrder.agentName ? compactAgentName(workOrder.agentName, data.name) : "Unassigned"} · ${workOrder.priority}`}
              leading={<SquarePen className="h-4 w-4 text-muted-foreground" />}
              trailing={<StatusBadge status={workOrder.status} />}
            />
          )) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">No work orders yet.</p>
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
      <SectionTitle title="Office Inbox" aside={`${inbox?.counts.open ?? 0} open`} />
      <div className="border border-border">
        {openItems.length ? openItems.map((item) => (
          <EntityRow
            key={item.id}
            title={item.title}
            subtitle={`${item.kind} · ${item.subtitle}`}
            leading={<Inbox className="h-4 w-4 text-muted-foreground" />}
            trailing={<StatusBadge status={item.sourceStatus} />}
          />
        )) : (
          <p className="px-4 py-4 text-sm text-muted-foreground">No open inbox items.</p>
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
        title="Office Approvals"
        aside={`${approvals?.counts.pending ?? 0} pending · ${approvals?.counts.approved ?? 0} approved`}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard icon={CheckCircle2} value={approvals?.counts.pending ?? 0} label="Pending" description="needs operator" />
          <MetricCard icon={Activity} value={approvals?.counts.total ?? 0} label="Requests" description="approval history" />
          <MetricCard icon={ShieldAlert} value={approvals?.counts.changesRequested ?? 0} label="Changes" description="sent back" />
          <MetricCard icon={CheckCircle2} value={approvals?.counts.approved ?? 0} label="Approved" description="cleared to run" />
        </div>
        <div className="min-w-0 border border-border">
          {visibleItems.length ? visibleItems.map((approval) => (
            <EntityRow
              key={approval.id}
              title={approval.title}
              subtitle={`${approval.agentName ? compactAgentName(approval.agentName, data.name) : "operator"} · ${approval.kind}`}
              leading={<CheckCircle2 className="h-4 w-4 text-muted-foreground" />}
              trailing={<StatusBadge status={approval.status} />}
            />
          )) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">No approval requests yet.</p>
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
        title="Office Routines"
        aside={`${routines?.counts.enabled ?? 0} enabled · ${routines?.counts.due ?? 0} due`}
      />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <MetricCard icon={Repeat2} value={routines?.counts.enabled ?? 0} label="Enabled" description={`${routines?.counts.total ?? 0} routines`} />
          <MetricCard icon={Clock3} value={routines?.counts.due ?? 0} label="Due Now" description="ready to wake" />
          <MetricCard icon={Activity} value={routines?.counts.runs ?? 0} label="Routine Runs" description="manual wakes" />
          <MetricCard icon={ShieldAlert} value={routines?.counts.paused ?? 0} label="Paused" description="not scheduled" />
        </div>
        <div className="min-w-0 border border-border">
          {visibleItems.length ? visibleItems.map((routine) => (
            <EntityRow
              key={routine.id}
              title={compactAgentName(routine.agentName, data.name)}
              subtitle={`${routine.cadenceLabel} · next ${formatIsoSchedule(routine.nextRunAt)}`}
              leading={<Repeat2 className="h-4 w-4 text-muted-foreground" />}
              trailing={<StatusBadge status={routine.state} />}
            />
          )) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">No office routines yet.</p>
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
      <SectionTitle title="Office Signals" aside={`${recentMessages.length} messages · ${activeRequests.length} wakes`} />
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
            <p className="px-4 py-4 text-sm text-muted-foreground">No office messages yet.</p>
          )}
        </div>
        <div className="min-w-0 border border-border">
          {activeRequests.length ? activeRequests.map((request) => (
            <EntityRow
              key={request.id}
              title={compactAgentName(request.agentName, data.name)}
              subtitle={request.note ?? "Wake request"}
              leading={<Activity className="h-4 w-4 text-muted-foreground" />}
              trailing={<StatusBadge status={request.status} />}
            />
          )) : (
            <p className="px-4 py-4 text-sm text-muted-foreground">No active wake requests.</p>
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

function roomConsoleAgents(
  data: SpliceWorkspaceRoomData,
  agentConsole: SpliceAgentConsoleData | null,
  messages: SpliceAgentMessage[],
): RoomConsoleAgent[] {
  if (agentConsole?.agents.length) return agentConsole.agents;

  return data.agents.map((agent) => ({
    ...agent,
    requests: data.requests.filter((request) =>
      request.agentId === agent.id ||
      request.agentId === agent.slug ||
      request.agentName === agent.name
    ),
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
        <SectionTitle title="Agent Talk" aside="0 desks" />
        <p className="border border-border px-4 py-4 text-sm text-muted-foreground">No agents found.</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle title="Agent Talk" aside={`${consoleAgents.length} desks · ${messages.length} messages`} />
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
                  {selectedAgent.workOrders[0]?.title ?? selectedAgent.currentWork[0]?.title ?? "No assigned work"}
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
              {isRunning ? "Queued" : "Wake"}
            </Button>
          </div>

          <div className="grid gap-0 border-b border-border md:grid-cols-[minmax(0,1fr)_300px]">
            <form className="min-w-0 border-b border-border px-4 py-4 md:border-b-0 md:border-r" onSubmit={submitMessage}>
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold">Instruction</p>
                <span className="text-xs text-muted-foreground">{activeRequestCount} active wakes</span>
              </div>
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                className="min-h-24 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                placeholder={`Message ${compactAgentName(selectedAgent.name, data.name)}`}
                disabled={isSending}
              />
              <div className="mt-3 flex justify-end">
                <Button type="submit" disabled={!draft.trim() || isSending} className="gap-1.5">
                  <Send className={cn("h-3.5 w-3.5", isSending && "animate-pulse")} />
                  {isSending ? "Sending" : "Send + Wake"}
                </Button>
              </div>
            </form>

            <div className="min-w-0">
              <div className="border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">Recent Runs</p>
              </div>
              <div className="max-h-56 overflow-y-auto">
                {selectedRequests.length ? selectedRequests.slice(0, 5).map((request) => (
                  <article key={request.id} className="border-b border-border px-4 py-3 last:border-b-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={request.status} />
                      <RunRuntimePill runtime={request.runtime} status={request.status} />
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{request.note ?? "Wake request"}</p>
                  </article>
                )) : (
                  <p className="px-4 py-4 text-sm text-muted-foreground">No run history yet.</p>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Recent Messages</p>
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
                <p className="bg-background px-4 py-4 text-sm text-muted-foreground md:col-span-2">No messages yet.</p>
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
      title: "Queued",
      items: data.requests.filter((request) => request.status === "requested" || request.status === "launch_ready"),
    },
    {
      id: "launched",
      title: "Launched",
      items: data.requests.filter((request) => request.status === "launched"),
    },
    {
      id: "failed",
      title: "Failed",
      items: data.requests.filter((request) => request.status === "failed"),
    },
  ];
  const pendingCount = columns[0].items.length;

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <SectionTitle title="Runner Board" aside={`${formatNumber(data.requests.length)} requests`} />
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
            Dry Run
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => onDispatchRunner(false)}
            disabled={dispatchingRunner || pendingCount === 0}
            className="h-8 gap-1.5"
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
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{request.note ?? "Wake request"}</p>
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
                <p className="px-3 py-4 text-sm text-muted-foreground">No {column.title.toLowerCase()} runs.</p>
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
    active: runs.length - terminal,
    requested: runs.filter((run) => run.status === "requested").length,
    launchReady: runs.filter((run) => run.status === "launch_ready").length,
    launched: runs.filter((run) => run.status === "launched").length,
    done: runs.filter((run) => run.status === "done").length,
    failed: runs.filter((run) => run.status === "failed").length,
    blocked: runs.filter((run) => run.status === "blocked").length,
    noop: runs.filter((run) => run.status === "noop").length,
    cancelled: runs.filter((run) => run.status === "cancelled").length,
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
  const isQueued = status === "requested" || status === "launch_ready";
  const runPath = run.launch?.outPath || run.launch?.promptPath || run.workspacePath || run.queue?.path || "";

  return (
    <article className={cn("border bg-background px-4 py-4", selected ? "border-ring" : "border-border")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={status} />
            <RunRuntimePill runtime={run.runtime} status={status} />
            <span className="text-xs text-muted-foreground">{formatIsoAge(run.updatedAt || run.requestedAt)}</span>
            {run.process?.pid ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">pid {run.process.pid}</span> : null}
          </div>
          <h3 className="mt-2 truncate text-sm font-semibold">{compactAgentName(run.agentName, data.name)}</h3>
          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{run.note ?? "Wake request"}</p>
          {run.error ? <p className="mt-2 line-clamp-2 text-xs text-red-600 dark:text-red-300">{run.error}</p> : null}
          <div className="mt-3 grid gap-1 text-[11px] text-muted-foreground sm:grid-cols-2">
            <p className="min-w-0 truncate font-mono">{run.id}</p>
            <p className="min-w-0 truncate font-mono">{runPath || "No launch path yet"}</p>
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
                Done
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
          <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{artifact.path ?? "No artifact path yet"}</p>
        </div>
        {artifact.exists ? (
          <span className="shrink-0 text-xs text-muted-foreground">{formatBytes(artifact.size)}</span>
        ) : null}
      </div>
      {artifact.error ? (
        <p className="px-4 py-4 text-sm text-red-600 dark:text-red-300">{artifact.error}</p>
      ) : artifact.exists && artifact.readable ? (
        <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words bg-muted/30 px-4 py-4 text-[11px] leading-5 text-foreground/80">
          {artifact.truncated ? `[showing ${artifact.mode}]\n\n` : ""}
          {artifact.text || "Artifact file is empty."}
        </pre>
      ) : (
        <p className="px-4 py-4 text-sm text-muted-foreground">No artifact captured yet.</p>
      )}
    </section>
  );
}

function RunInspector({
  data,
  detail,
  loading,
  run,
}: {
  data: SpliceWorkspaceRoomData;
  detail: SpliceRunDetailData | null;
  loading: boolean;
  run: SpliceAgentRunRequest | null;
}) {
  if (!run) {
    return (
      <aside className="min-w-0 space-y-3">
        <SectionTitle title="Run Inspector" aside="no selection" />
        <p className="border border-border px-4 py-4 text-sm text-muted-foreground">Select a run to inspect its prompt, output, and linked office work.</p>
      </aside>
    );
  }

  const messages = detail?.related.messages ?? [];
  const workOrders = detail?.related.workOrders ?? [];
  const workProducts = detail?.related.workProducts ?? [];
  const routineRuns = detail?.related.routineRuns ?? [];

  return (
    <aside className="min-w-0 space-y-3">
      <SectionTitle title="Run Inspector" aside={loading ? "loading" : run.status} />
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
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{run.note ?? "Wake request"}</p>
        <div className="mt-3 grid gap-1 text-[11px] text-muted-foreground">
          <p className="truncate font-mono">{run.id}</p>
          <p className="truncate font-mono">{run.launch?.workspacePath || run.workspacePath || "No workspace path"}</p>
        </div>
      </section>

      <section className="border border-border">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Linked Office Work</p>
        </div>
        {messages.length || workOrders.length || workProducts.length || routineRuns.length ? (
          <div>
            {messages.map((message) => (
              <EntityRow
                key={message.id}
                title={`Message from ${message.author}`}
                subtitle={message.body}
                leading={<MessageSquare className="h-4 w-4 text-muted-foreground" />}
                trailing={<StatusBadge status={message.status} />}
              />
            ))}
            {workOrders.map((workOrder) => (
              <EntityRow
                key={workOrder.id}
                title={workOrder.title}
                subtitle={`${workOrder.agentName ? compactAgentName(workOrder.agentName, data.name) : "Unassigned"} · ${workOrder.priority}`}
                leading={<SquarePen className="h-4 w-4 text-muted-foreground" />}
                trailing={<StatusBadge status={workOrder.status} />}
              />
            ))}
            {workProducts.map((product) => (
              <EntityRow
                key={product.id}
                title={product.title}
                subtitle={`${product.itemTitle} · ${product.agentName ? compactAgentName(product.agentName, data.name) : product.author}`}
                leading={<FileText className="h-4 w-4 text-muted-foreground" />}
                trailing={<StatusBadge status={product.status} />}
              />
            ))}
            {routineRuns.map((routineRun) => (
              <EntityRow
                key={routineRun.id}
                title={routineRun.routineTitle}
                subtitle={compactAgentName(routineRun.agentName, data.name)}
                leading={<Repeat2 className="h-4 w-4 text-muted-foreground" />}
                trailing={<StatusBadge status={routineRun.status} />}
              />
            ))}
          </div>
        ) : (
          <p className="px-4 py-4 text-sm text-muted-foreground">No linked message, intake item, or routine for this run.</p>
        )}
      </section>

      {detail ? (
        <>
          <RunArtifactPanel title="Output" artifact={detail.artifacts.output} />
          <RunArtifactPanel title="Prompt" artifact={detail.artifacts.prompt} />
        </>
      ) : (
        <p className="border border-border px-4 py-4 text-sm text-muted-foreground">Run detail has not loaded yet.</p>
      )}
    </aside>
  );
}

function RunsTab({
  data,
  dispatchingRunner,
  onDispatchRunner,
  onUpdateRunStatus,
  runnerNotice,
  runs,
  updatingRunId,
}: {
  data: SpliceWorkspaceRoomData;
  dispatchingRunner: boolean;
  onDispatchRunner: (dryRun: boolean) => void;
  onUpdateRunStatus: (runId: string, status: string, error?: string) => void;
  runnerNotice: string | null;
  runs: SpliceRunMonitorData | null;
  updatingRunId: string | null;
}) {
  const runList = runs?.runs ?? data.requests;
  const counts = runs?.counts ?? runMonitorFallbackCounts(runList);
  const queuedCount = counts.requested + counts.launchReady;
  const activeRuns = runList.filter((run) => ["requested", "launch_ready", "launched"].includes(String(run.status)));
  const historyRuns = runList.filter((run) => !["requested", "launch_ready", "launched"].includes(String(run.status)));
  const runIds = runList.map((run) => run.id).join("|");
  const [selectedRunId, setSelectedRunId] = useState(runList[0]?.id ?? "");

  useEffect(() => {
    if (!runList.length) {
      if (selectedRunId) setSelectedRunId("");
      return;
    }
    if (!selectedRunId || !runList.some((run) => run.id === selectedRunId)) {
      setSelectedRunId(runList[0].id);
    }
  }, [runIds, runList, selectedRunId]);

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
        <SectionTitle title="Run Monitor" aside={`${counts.active} active · ${counts.total} total`} />
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
        <MetricCard icon={Rocket} value={counts.active} label="Active" description={`${queuedCount} queued`} />
        <MetricCard icon={Clock3} value={counts.requested} label="Requested" description={`${counts.launchReady} ready`} />
        <MetricCard icon={Activity} value={counts.launched} label="Launched" description="runner started" />
        <MetricCard icon={ShieldAlert} value={counts.failed} label="Failed" description={`${counts.blocked} blocked · ${counts.noop} noop`} />
      </div>

      <section className="border border-border">
        <div className="border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">Queue</p>
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{runs?.queuePath ?? data.requests[0]?.queue?.path ?? "No run queue path yet"}</p>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 space-y-3">
          <SectionTitle title="Active Runs" aside={`${activeRuns.length}`} />
          {activeRuns.length ? activeRuns.map((run) => (
            <RunMonitorCard
              key={run.id}
              data={data}
              onSelectRun={setSelectedRunId}
              run={run}
              selected={selectedRun?.id === run.id}
              updatingRunId={updatingRunId}
              onUpdateRunStatus={onUpdateRunStatus}
            />
          )) : (
            <p className="border border-border px-4 py-4 text-sm text-muted-foreground">No active runs.</p>
          )}
        </section>

        <RunInspector
          data={data}
          detail={selectedRunDetailQuery.data ?? null}
          loading={selectedRunDetailQuery.isFetching}
          run={selectedRun}
        />
      </div>

      <section className="min-w-0 space-y-3">
        <SectionTitle title="Run History" aside={`${historyRuns.length}`} />
        <div className="grid gap-3 xl:grid-cols-2">
          {historyRuns.length ? historyRuns.slice(0, 18).map((run) => (
            <RunMonitorCard
              key={run.id}
              data={data}
              onSelectRun={setSelectedRunId}
              run={run}
              selected={selectedRun?.id === run.id}
              updatingRunId={updatingRunId}
              onUpdateRunStatus={onUpdateRunStatus}
            />
          )) : (
            <p className="border border-border px-4 py-4 text-sm text-muted-foreground">No completed runs yet.</p>
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
      <SectionTitle title="Review Gate" aside={`${requested.length} pending · ${decided.length} decided`} />
      <div className="border border-border">
        {reviews.length ? reviews.slice(0, 6).map((review) => (
          <EntityRow
            key={review.id}
            title={review.title}
            subtitle={`${review.itemTitle} · ${review.reviewerAgentName ? compactAgentName(review.reviewerAgentName, data.name) : "Unassigned reviewer"}`}
            leading={<ShieldAlert className="h-4 w-4 text-muted-foreground" />}
            trailing={<StatusBadge status={review.status} />}
          />
        )) : (
          <p className="px-4 py-4 text-sm text-muted-foreground">No reviews requested yet.</p>
        )}
      </div>
    </section>
  );
}

function InboxItemCard({
  item,
  onOpenTab,
  onUpdateStatus,
  updatingItemId,
}: {
  item: SpliceInboxItem;
  onOpenTab: (tab: RoomTab) => void;
  onUpdateStatus: (itemId: string, status: "open" | "done") => void;
  updatingItemId: string | null;
}) {
  const updating = updatingItemId === item.id;
  const targetTab = roomTabs.some((tab) => tab.value === item.targetTab) ? item.targetTab as RoomTab : "dashboard";
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
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenTab(targetTab)}>
            Open {roomTabLabel(targetTab)}
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
              Done
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
  onUpdateStatus,
  updatingItemId,
}: {
  inbox: SpliceOfficeInboxData | null;
  onOpenTab: (tab: RoomTab) => void;
  onUpdateStatus: (itemId: string, status: "open" | "done") => void;
  updatingItemId: string | null;
}) {
  const items = inbox?.items ?? [];
  const openItems = items.filter((item) => item.inboxStatus === "open");
  const doneItems = items.filter((item) => item.inboxStatus === "done");

  return (
    <div className="space-y-4">
      <SectionTitle title="Office Inbox" aside={`${openItems.length} open · ${doneItems.length} done`} />
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <MetricCard icon={Inbox} value={inbox?.counts.open ?? 0} label="Open" description={`${inbox?.counts.total ?? 0} total`} />
        <MetricCard icon={ShieldAlert} value={inbox?.counts.reviews ?? 0} label="Reviews" description="needs decision" />
        <MetricCard icon={Activity} value={inbox?.counts.runs ?? 0} label="Wakes" description="queued or running" />
        <MetricCard icon={SquarePen} value={inbox?.counts.workOrders ?? 0} label="Intake" description={`${inbox?.counts.messages ?? 0} messages · ${inbox?.counts.blocked ?? 0} blocked`} />
      </div>

      <section className="space-y-3">
        <SectionTitle title="Open Items" aside={`${openItems.length}`} />
        {openItems.length ? (
          <div className="grid gap-3">
            {openItems.map((item) => (
              <InboxItemCard
                key={item.id}
                item={item}
                onOpenTab={onOpenTab}
                onUpdateStatus={onUpdateStatus}
                updatingItemId={updatingItemId}
              />
            ))}
          </div>
        ) : (
          <p className="border border-border px-4 py-4 text-sm text-muted-foreground">No open inbox items.</p>
        )}
      </section>

      <section className="space-y-3">
        <SectionTitle title="Done" aside={`${doneItems.length}`} />
        {doneItems.length ? (
          <div className="grid gap-3">
            {doneItems.slice(0, 12).map((item) => (
              <InboxItemCard
                key={item.id}
                item={item}
                onOpenTab={onOpenTab}
                onUpdateStatus={onUpdateStatus}
                updatingItemId={updatingItemId}
              />
            ))}
          </div>
        ) : (
          <p className="border border-border px-4 py-4 text-sm text-muted-foreground">No completed inbox items yet.</p>
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

function IntakeTab({
  creatingWorkOrder,
  data,
  onCreateWorkOrder,
  onUpdateWorkOrderStatus,
  updatingWorkOrderId,
  workOrders,
}: {
  creatingWorkOrder: boolean;
  data: SpliceWorkspaceRoomData;
  onCreateWorkOrder: (input: { title: string; body: string; agentId?: string | null; projectId?: string | null; priority?: string; wakeAgent?: boolean }) => void;
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

  useEffect(() => {
    if (!data.agents.length) return;
    if (!agentId || !data.agents.some((agent) => agent.id === agentId)) {
      setAgentId(data.agents[0].id);
    }
  }, [agentId, data.agents]);

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

  return (
    <div className="space-y-4">
      <SectionTitle title="Work Intake" aside={`${workOrders?.counts.open ?? 0} open`} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
        <section className="border border-border">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">New Work Order</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Create a PaperClip-style task signal for this office.</p>
          </div>
          <form className="space-y-3 px-4 py-4" onSubmit={submitWorkOrder}>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-9 w-full border border-border bg-background px-3 text-sm outline-none focus:border-ring"
              placeholder="Task title"
              disabled={creatingWorkOrder}
            />
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="min-h-36 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              placeholder="What should the agent do?"
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
                  <option value="">No project link</option>
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
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="flex items-center gap-2 self-end border border-border px-3 py-2 text-sm">
                <input
                  type="checkbox"
                  checked={wakeAgent}
                  onChange={(event) => setWakeAgent(event.target.checked)}
                  disabled={creatingWorkOrder}
                />
                Wake agent
              </label>
            </div>
            <div className="flex justify-end">
              <Button type="submit" disabled={!title.trim() || !body.trim() || creatingWorkOrder} className="gap-1.5">
                <Rocket className={cn("h-3.5 w-3.5", creatingWorkOrder && "animate-pulse")} />
                {creatingWorkOrder ? "Creating" : "Create + Queue"}
              </Button>
            </div>
          </form>
        </section>

        <section className="border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Intake Queue</p>
            <span className="text-xs text-muted-foreground">{orders.length}</span>
          </div>
          <div className="divide-y divide-border">
            {orders.length ? orders.map((order) => {
              const updating = updatingWorkOrderId === order.id;
              return (
                <article key={order.id} className="px-4 py-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="break-words text-sm font-semibold">{order.title}</p>
                      <StatusBadge status={order.status} />
                    </div>
                    <p className="mt-1 break-words text-xs text-muted-foreground">
                      {order.agentName ? compactAgentName(order.agentName, data.name) : "Unassigned"} · {order.projectName || "No project"} · {order.priority} · {formatIsoAge(order.createdAt)}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted-foreground">{order.body}</p>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={updating || order.status === "in_progress"}
                      onClick={() => onUpdateWorkOrderStatus(order.id, "in_progress", true)}
                    >
                      Start + Wake
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
                      Done
                    </Button>
                  </div>
                </article>
              );
            }) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">No work orders yet.</p>
            )}
          </div>
        </section>
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

function workItemKey(item: Pick<SpliceWorkspaceRoomWorkItem, "id" | "type">): string {
  return `${item.type}:${item.id}`;
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
  onAddComment,
  onAddWorkProduct,
  onRequestReview,
  postingCommentKey,
  requestingReviewProductId,
  savingProductKey,
  workProducts,
}: {
  comments: SpliceWorkThreadComment[];
  data: SpliceWorkspaceRoomData;
  onAddComment: (input: { itemType: string; itemId: string; body: string; wakeAgent?: boolean }) => void;
  onAddWorkProduct: (input: { itemType: string; itemId: string; title: string; body: string; kind?: string }) => void;
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
    if (!deskItems.length) return;
    if (!selectedKey || !deskItems.some((item) => workItemKey(item) === selectedKey)) {
      setSelectedKey(firstKey);
    }
  }, [deskItems, firstKey, selectedKey]);

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
        <SectionTitle title="Work Desk" aside="0 items" />
        <p className="border border-border px-4 py-4 text-sm text-muted-foreground">No work items found.</p>
      </div>
    );
  }

  const body = displayMarkdownBody(selectedItem.description);

  return (
    <div className="space-y-4">
      <SectionTitle title="Work Desk" aside={`${deskItems.length} items`} />
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
                onClick={() => setSelectedKey(key)}
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
              <p className="mt-4 text-sm text-muted-foreground">No body found.</p>
            )}
          </div>

          <div className="grid gap-4 xl:grid-cols-2">
            <section className="min-w-0 border border-border">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">Thread</p>
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
                      <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                        wake · {comment.runRequestId}
                      </p>
                    ) : null}
                  </article>
                )) : (
                  <p className="text-sm text-muted-foreground">No comments yet.</p>
                )}
              </div>
              <form className="border-t border-border px-4 py-4" onSubmit={submitComment}>
                <textarea
                  value={commentDraft}
                  onChange={(event) => setCommentDraft(event.target.value)}
                  className="min-h-24 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  placeholder="Comment"
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
                    Wake owner
                  </label>
                  <Button type="submit" size="sm" disabled={!commentDraft.trim() || postingComment} className="gap-1.5">
                    <MessageSquare className={cn("h-3.5 w-3.5", postingComment && "animate-pulse")} />
                    {postingComment ? "Posting" : "Post Comment"}
                  </Button>
                </div>
              </form>
            </section>

            <section className="min-w-0 border border-border">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">Work Products</p>
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
                            {requestingProductReview ? "Sending" : "Review"}
                          </Button>
                        </div>
                      </div>
                      {product.sourceRunRequestId ? (
                        <p className="mb-2 truncate font-mono text-[11px] text-muted-foreground">
                          run · {product.sourceRunRequestId}
                        </p>
                      ) : null}
                      <MarkdownBody className="text-sm text-muted-foreground prose-p:my-2 prose-ul:my-2 prose-li:my-0 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        {product.body}
                      </MarkdownBody>
                    </article>
                  );
                }) : (
                  <p className="text-sm text-muted-foreground">No work products yet.</p>
                )}
              </div>
              <form className="space-y-3 border-t border-border px-4 py-4" onSubmit={submitWorkProduct}>
                <input
                  value={productTitle}
                  onChange={(event) => setProductTitle(event.target.value)}
                  className="h-9 w-full border border-border bg-background px-3 text-sm outline-none focus:border-ring"
                  placeholder="Result title"
                  disabled={savingProduct}
                />
                <textarea
                  value={productBody}
                  onChange={(event) => setProductBody(event.target.value)}
                  className="min-h-24 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  placeholder="Result body"
                  disabled={savingProduct}
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={!productTitle.trim() || !productBody.trim() || savingProduct} className="gap-1.5">
                    <FileText className={cn("h-3.5 w-3.5", savingProduct && "animate-pulse")} />
                    {savingProduct ? "Saving" : "Save Product"}
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
  onRequestReview,
  requestingReviewKey,
  reviews,
}: {
  data: SpliceWorkspaceRoomData;
  decidingReviewId: string | null;
  onDecideReview: (reviewId: string, decision: "approved" | "changes_requested" | "rejected", body: string, wakeAgent: boolean) => void;
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
        <SectionTitle title="Review Gate" aside="0 items" />
        <p className="border border-border px-4 py-4 text-sm text-muted-foreground">No work items found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Review Gate" aside={`${reviews.length} reviews`} />
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
                <p className="text-sm font-semibold">Request Review</p>
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{selectedItem.title}</p>
              </div>
              <form className="space-y-3 px-4 py-4" onSubmit={submitReview}>
                <input
                  value={reviewTitle}
                  onChange={(event) => setReviewTitle(event.target.value)}
                  className="h-9 w-full border border-border bg-background px-3 text-sm outline-none focus:border-ring"
                  placeholder={`Review ${selectedItem.title}`}
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
                  placeholder="Review request"
                  disabled={requestingReview}
                />
                <div className="flex justify-end">
                  <Button type="submit" size="sm" disabled={!reviewBody.trim() || requestingReview} className="gap-1.5">
                    <ShieldAlert className={cn("h-3.5 w-3.5", requestingReview && "animate-pulse")} />
                    {requestingReview ? "Requesting" : "Request Review"}
                  </Button>
                </div>
              </form>
            </section>

            <section className="border border-border">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <p className="text-sm font-semibold">Review Queue</p>
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
                          {review.itemTitle} · {review.reviewerAgentName ? compactAgentName(review.reviewerAgentName, data.name) : "Unassigned"}
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
                  <p className="px-4 py-4 text-sm text-muted-foreground">No reviews requested yet.</p>
                )}
              </div>
            </section>
          </div>

          <section className="border border-border">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Decision Desk</p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {selectedReview ? selectedReview.title : "No review selected"}
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
                          <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">
                            wake · {decision.runRequestId}
                          </p>
                        ) : null}
                      </article>
                    )) : (
                      <p className="text-sm text-muted-foreground">No decisions yet.</p>
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <textarea
                    value={decisionBody}
                    onChange={(event) => setDecisionBody(event.target.value)}
                    className="min-h-32 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    placeholder="Decision note"
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
                    Wake owner on changes
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
              <p className="px-4 py-4 text-sm text-muted-foreground">No review selected.</p>
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
      <SectionTitle title="Approvals" aside={`${pending.length} pending · ${decided.length} decided`} />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <MetricCard icon={CheckCircle2} value={approvals?.counts.pending ?? 0} label="Pending" description="needs decision" />
        <MetricCard icon={Activity} value={approvals?.counts.total ?? 0} label="Requests" description="approval queue" />
        <MetricCard icon={ShieldAlert} value={approvals?.counts.changesRequested ?? 0} label="Changes" description="sent back" />
        <MetricCard icon={CheckCircle2} value={approvals?.counts.approved ?? 0} label="Approved" description="cleared" />
      </div>

      <div className="grid min-h-[640px] gap-4 xl:grid-cols-[300px_minmax(0,1fr)_340px]">
        <section className="min-w-0 border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Approval Queue</p>
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
              <p className="px-4 py-4 text-sm text-muted-foreground">No approval requests yet.</p>
            )}
          </div>
        </section>

        <section className="min-w-0 space-y-4">
          <form className="border border-border" onSubmit={submitApproval}>
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Request Approval</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Create the same kind of board decision an agent would wait on.</p>
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
                  <option value="agent_action">Agent action</option>
                  <option value="branch_change">Branch change</option>
                  <option value="release">Release</option>
                  <option value="scope_change">Scope change</option>
                  <option value="external_effect">External effect</option>
                </select>
              </label>
              <label className="min-w-0 text-xs font-medium text-muted-foreground sm:col-span-2">
                Title
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  className="mt-1 h-9 w-full border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-ring"
                  placeholder="Approval title"
                  disabled={creatingApproval}
                />
              </label>
              <label className="min-w-0 text-xs font-medium text-muted-foreground sm:col-span-2">
                Request
                <textarea
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  className="mt-1 min-h-32 w-full resize-y border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                  placeholder="What should be approved, and why?"
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
              <p className="text-sm font-semibold">Selected Request</p>
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
                    <p className="px-3 py-3 text-sm text-muted-foreground">No decisions yet.</p>
                  )}
                </div>
              </article>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">No approval selected.</p>
            )}
          </section>
        </section>

        <aside className="min-w-0 border border-border">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Decision</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Approved requests can wake the assigned agent.</p>
          </div>
          {selectedApproval ? (
            <div className="space-y-3 px-4 py-4">
              <textarea
                value={decisionBody}
                onChange={(event) => setDecisionBody(event.target.value)}
                className="min-h-36 w-full resize-y border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                placeholder="Decision note"
                disabled={decidingApproval}
              />
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={wakeAgent}
                  onChange={(event) => setWakeAgent(event.target.checked)}
                  disabled={decidingApproval || !selectedApproval.agentId}
                />
                Wake agent after approval
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
            <p className="px-4 py-4 text-sm text-muted-foreground">Select an approval first.</p>
          )}
        </aside>
      </div>
    </div>
  );
}

function RoutinesTab({
  data,
  onRunRoutine,
  onToggleRoutine,
  routines,
  runningRoutineId,
  updatingRoutineId,
}: {
  data: SpliceWorkspaceRoomData;
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
      <SectionTitle title="Office Routines" aside={`${routines?.counts.enabled ?? 0} enabled · ${routines?.counts.due ?? 0} due`} />

      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <MetricCard icon={Repeat2} value={routines?.counts.total ?? 0} label="Routines" description="agent heartbeat slots" />
        <MetricCard icon={Clock3} value={routines?.counts.due ?? 0} label="Due Now" description="ready to wake" />
        <MetricCard icon={Activity} value={routines?.counts.runs ?? 0} label="Manual Runs" description="queued from office" />
        <MetricCard icon={ShieldAlert} value={routines?.counts.paused ?? 0} label="Paused" description="operator held" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Routine Board</p>
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
                      <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{routine.lastRunRequestId}</p>
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
                      <option value={5}>Every 5m</option>
                      <option value={10}>Every 10m</option>
                      <option value={15}>Every 15m</option>
                      <option value={30}>Every 30m</option>
                      <option value={60}>Every 1h</option>
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
                        {routine.enabled ? "Pause" : "Resume"}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onRunRoutine(routine.id)}
                        disabled={Boolean(runningRoutineId)}
                        className="gap-1.5"
                      >
                        <Play className={cn("h-3.5 w-3.5", isRunning && "animate-pulse")} />
                        {isRunning ? "Queued" : "Run Now"}
                      </Button>
                    </div>
                  </div>
                </article>
              );
            }) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">No office routines yet.</p>
            )}
          </div>
        </section>

        <aside className="min-w-0 space-y-4">
          <section className="border border-border">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Recent Routine Runs</p>
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
                  <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{run.runRequestId}</p>
                </article>
              )) : (
                <p className="px-4 py-4 text-sm text-muted-foreground">No routine runs yet.</p>
              )}
            </div>
          </section>

          <section className="border border-border">
            <div className="border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Queue Paths</p>
            </div>
            <div className="space-y-3 px-4 py-4 text-xs text-muted-foreground">
              <p className="truncate font-mono">{routines?.queuePaths.routines ?? "No routine store"}</p>
              <p className="truncate font-mono">{routines?.queuePaths.runRequests ?? "No run queue"}</p>
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
        <SectionTitle title="Agent Console" aside="0 agents" />
        <p className="border border-border px-4 py-4 text-sm text-muted-foreground">No agents found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Agent Console" aside={`${consoleAgents.length} desks · ${activeRequestCount} active wakes`} />
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
                    {selectedAgent.role} · {selectedWorkOrders[0]?.title ?? selectedAgent.currentWork[0]?.title ?? "No assigned work"}
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
                {isRunning ? "Queued" : "Wake"}
              </Button>
            </div>

            <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Assigned Work" value={selectedAgent.currentWork.length} icon={CircleDot} />
              <MetricCard label="Office Orders" value={selectedWorkOrders.length} icon={SquarePen} />
              <MetricCard label="Run History" value={selectedRequests.length} icon={Activity} />
              <MetricCard label="Messages" value={selectedMessages.length} icon={MessageSquare} />
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <section className="min-w-0 space-y-4">
              <div className="border border-border">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">Assigned Work</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">PaperClip ownership projected from ops frontmatter.</p>
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
                    subtitle={`office order · ${order.priority}`}
                    leading={<SquarePen className="h-4 w-4 text-muted-foreground" />}
                    trailing={<StatusBadge status={order.status} />}
                  />
                )) : null}
                {!selectedAgent.currentWork.length && !selectedWorkOrders.length ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">No assigned work yet.</p>
                ) : null}
              </div>

              <form className="border border-border" onSubmit={submitInstruction}>
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">Instruction</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Message is stored as office work and paired with a wake request.</p>
                </div>
                <div className="space-y-3 px-4 py-4">
                  <textarea
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    className="min-h-28 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                    placeholder={`Message ${compactAgentName(selectedAgent.name, data.name)}`}
                    disabled={isSending}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={!draft.trim() || isSending} className="gap-1.5">
                      <Send className={cn("h-3.5 w-3.5", isSending && "animate-pulse")} />
                      {isSending ? "Sending" : "Send + Wake"}
                    </Button>
                  </div>
                </div>
              </form>
            </section>

            <aside className="min-w-0 space-y-4">
              <section className="border border-border">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">Run History</p>
                  <span className="text-xs text-muted-foreground">{selectedRequests.length}</span>
                </div>
                <div className="max-h-[310px] overflow-y-auto">
                  {selectedRequests.length ? selectedRequests.slice(0, 12).map((request) => (
                    <article key={request.id} className="border-b border-border px-4 py-3 last:border-b-0">
                      <div className="flex items-center justify-between gap-3">
                        <StatusBadge status={request.status} />
                        <span className="text-xs text-muted-foreground">{formatIsoAge(request.updatedAt || request.requestedAt)}</span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{request.note ?? "No note"}</p>
                      <p className="mt-2 truncate font-mono text-[11px] text-muted-foreground">{request.id}</p>
                    </article>
                  )) : (
                    <p className="px-4 py-4 text-sm text-muted-foreground">No run history yet.</p>
                  )}
                </div>
              </section>

              <section className="border border-border">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <p className="text-sm font-semibold">Recent Messages</p>
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
                    <p className="px-4 py-4 text-sm text-muted-foreground">No messages yet.</p>
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
  onSend,
  sendingAgentId,
}: {
  data: SpliceWorkspaceRoomData;
  focusedAgentId: string | null;
  messages: SpliceAgentMessage[];
  onFocusAgent: (agentId: string) => void;
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
        <SectionTitle title="Comms" aside="0 agents" />
        <p className="border border-border px-4 py-4 text-sm text-muted-foreground">No agents found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <SectionTitle title="Comms" aside={`${messages.length} messages`} />
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
                  {selectedAgent.currentWork[0]?.title ?? "No assigned work"}
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
                  {message.runRequestId ? <span className="truncate font-mono">{message.runRequestId}</span> : null}
                  {message.workOrderId ? <span className="truncate font-mono">{message.workOrderId}</span> : null}
                </div>
              </article>
            )) : (
              <p className="border border-dashed border-border bg-background px-4 py-4 text-sm text-muted-foreground">
                No messages for this agent yet.
              </p>
            )}
          </div>

          <form className="flex shrink-0 flex-col gap-3 border-t border-border bg-background px-4 py-4" onSubmit={submitMessage}>
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              className="min-h-24 w-full resize-y border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              placeholder={`Message ${compactAgentName(selectedAgent.name, data.name)}`}
              disabled={isSending}
            />
            <div className="flex justify-end">
              <Button type="submit" disabled={!draft.trim() || isSending} className="gap-1.5">
                <Send className={cn("h-3.5 w-3.5", isSending && "animate-pulse")} />
                {isSending ? "Sending" : "Send + Wake"}
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
}: {
  event: SpliceOfficeTimelineEvent;
  onOpenTab: (tab: RoomTab) => void;
}) {
  const Icon = timelineKindIcon(event.kind);
  const targetTab = roomTabs.some((tab) => tab.value === event.targetTab) ? event.targetTab as RoomTab : null;

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
        {targetTab ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenTab(targetTab)} className="mt-3 max-w-full gap-1.5">
            <FolderOpen className="h-3.5 w-3.5" />
            <span className="truncate">Open {roomTabLabel(targetTab)}</span>
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
    { tab: "intake", title: "Work Intake", value: counts?.workOrders ?? 0, subtitle: "new work orders", icon: SquarePen },
    { tab: "desk", title: "Work Desks", value: counts?.work ?? data.activity.length, subtitle: `${data.lanes.active.length} active · ${data.lanes.review.length} review`, icon: SquarePen },
    { tab: "comms", title: "Comms", value: counts?.messages ?? messages.length, subtitle: `${messages.length} queued messages`, icon: MessageSquare },
    { tab: "agents", title: "Runner", value: counts?.runs ?? data.requests.length, subtitle: `${data.requests.length} wake requests`, icon: Rocket },
    { tab: "approvals", title: "Gates", value: (counts?.approvals ?? 0) + (counts?.reviews ?? 0), subtitle: `${counts?.approvals ?? 0} approvals · ${counts?.reviews ?? 0} reviews`, icon: ShieldAlert },
    { tab: "routines", title: "Routines", value: counts?.routines ?? 0, subtitle: "heartbeat and manual wake logs", icon: Repeat2 },
  ];

  return (
    <section className="space-y-3">
      <SectionTitle title="Office Zones" aside="click a desk" />
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
}: {
  data: SpliceWorkspaceRoomData;
  messages: SpliceAgentMessage[];
  timeline: SpliceOfficeTimelineData | null;
  onOpenTab: (tab: RoomTab) => void;
}) {
  const events = timeline?.events ?? [];
  const counts = timeline?.counts;

  return (
    <div className="space-y-4">
      <section className="space-y-3">
        <SectionTitle title="Office Timeline" aside={`${events.length || data.activity.length} events`} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard icon={Activity} value={counts?.total ?? data.activity.length} label="Office Events" description="timeline signals" />
          <MetricCard icon={SquarePen} value={counts?.work ?? data.activity.length} label="Work" description="desk and board activity" />
          <MetricCard icon={MessageSquare} value={counts?.messages ?? messages.length} label="Comms" description="operator to agents" />
          <MetricCard icon={ShieldAlert} value={(counts?.approvals ?? 0) + (counts?.reviews ?? 0)} label="Gates" description="review and approvals" />
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="space-y-3">
          <SectionTitle title="Live Office Log" aside={timeline ? `updated ${formatIsoAge(timeline.generatedAt)}` : "waiting"} />
          <div className="border border-border">
            {events.length ? events.map((event) => (
              <TimelineEventRow key={event.id} event={event} onOpenTab={onOpenTab} />
            )) : (
              <div className="space-y-3 px-4 py-4">
                <p className="text-sm text-muted-foreground">No office timeline signals yet.</p>
                <ActivityList items={data.activity} />
              </div>
            )}
          </div>
        </section>

        <div className="space-y-4">
          <OfficeZoneSignalBoard data={data} timeline={timeline} messages={messages} onOpenTab={onOpenTab} />
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

          <section className="space-y-3">
            <SectionTitle title="Office Messages" aside={`${messages.length} messages`} />
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
                <p className="px-4 py-4 text-sm text-muted-foreground">No office messages yet.</p>
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
            <p className="mt-0.5 truncate text-xs text-muted-foreground">{lane.kindLabel} · {lane.branch}</p>
          </div>
        </div>
        <LaneStatePill state={lane.state} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <div className="min-w-0 rounded-md bg-muted/40 px-2 py-1.5">
          <p className="font-semibold tabular-nums">{lane.dirty}</p>
          <p className="truncate text-[11px] text-muted-foreground">dirty</p>
        </div>
        <div className="min-w-0 rounded-md bg-muted/40 px-2 py-1.5">
          <p className="font-semibold tabular-nums">{lane.ahead}/{lane.behind}</p>
          <p className="truncate text-[11px] text-muted-foreground">ahead/behind</p>
        </div>
        <div className="min-w-0 rounded-md bg-muted/40 px-2 py-1.5">
          <p className="font-semibold tabular-nums">{lane.activeRequestCount}</p>
          <p className="truncate text-[11px] text-muted-foreground">requests</p>
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="truncate font-mono text-[11px] text-muted-foreground">{lane.shortPath || lane.path}</p>
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <GitCommit className="h-3.5 w-3.5 shrink-0" />
          <span className="min-w-0 truncate">{lastCommit?.msg ?? "No commit signal"}</span>
          <span className="shrink-0">{formatAge(lastCommit?.ageMin)}</span>
        </div>
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
      <SectionTitle title="Execution Lanes" aside={`${allLanes.length} work copies`} />
      <div className="grid gap-3 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="border border-border bg-muted/20 px-4 py-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Project Space</p>
          </div>
          <p className="mt-3 truncate text-lg font-semibold">{data.name}</p>
          <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{data.shortPath}</p>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md bg-background px-2 py-1.5">
              <p className="font-semibold tabular-nums">{data.totals.activeExecutionLanes ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">active lanes</p>
            </div>
            <div className="rounded-md bg-background px-2 py-1.5">
              <p className="font-semibold tabular-nums">{data.totals.requests}</p>
              <p className="text-[11px] text-muted-foreground">queued runs</p>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {lanes.length ? lanes.map((lane) => (
            <LaneCard key={lane.id} lane={lane} />
          )) : (
            <div className="border border-border px-4 py-4 text-sm text-muted-foreground">No execution lanes found.</div>
          )}
        </div>
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
        <SectionTitle title="Lane Signals" aside={`${lanes.length} lanes`} />
        <div className="border border-border">
          {lanes.map((lane) => (
            <EntityRow
              key={lane.id}
              title={lane.name}
              subtitle={`${lane.kindLabel} · ${lane.shortPath || lane.path}`}
              leading={<GitBranch className="h-4 w-4 text-muted-foreground" />}
              trailing={(
                <div className="flex items-center gap-2">
                  <span className="hidden text-xs text-muted-foreground sm:inline">
                    {lane.branch} · {lane.dirty} dirty
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
  onOpenTab,
  onRunAgent,
  routines,
  runnerNotice,
  runningAgentId,
  runs,
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
  onOpenTab: (tab: RoomTab) => void;
  onRunAgent: (agentId: string) => void;
  routines: SpliceOfficeRoutinesData | null;
  runnerNotice: string | null;
  runningAgentId: string | null;
  runs: SpliceRunMonitorData | null;
  workOrders: SpliceWorkOrdersData | null;
  workProducts: SpliceWorkProduct[];
}) {
  const roomActors = [...data.room.humans, ...data.room.agents];
  const preferredActor = roomActors.find((actor) => actor.state === "requested") ?? roomActors.find((actor) => actor.state === "working") ?? roomActors[0] ?? null;
  const focusedActor = focusedAgentId
    ? roomActors.find((actor) => actor.id === focusedAgentId || actor.slug === focusedAgentId) ?? null
    : null;
  const [selectedActorId, setSelectedActorId] = useState(focusedActor?.id ?? preferredActor?.id ?? "");
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
  const selectedRequests = selectedActor
    ? data.requests.filter((request) =>
      request.agentId === selectedActor.id ||
      request.agentId === selectedActor.slug ||
      request.agentName === selectedActor.name
    ).slice(0, 3)
    : [];
  const selectedProducts = selectedActor
    ? workProducts.filter((product) =>
      product.ownerName === selectedActor.name ||
      product.agentName === selectedActor.name ||
      product.agentId === selectedActor.id ||
      product.agentId === selectedActor.slug
    ).slice(0, 3)
    : [];
  const wakingSelected = Boolean(selectedAgent && runningAgentId === selectedAgent.id);
  const openFocusedTab = (tab: RoomTab) => {
    if (selectedAgent) onFocusAgent(selectedAgent.id);
    onOpenTab(tab);
  };
  const runCounts = runs?.counts ?? runMonitorFallbackCounts(data.requests);
  const queuedRuns = runCounts.requested + runCounts.launchReady;
  const activeActors = roomActors.filter((actor) =>
    ["working", "reviewing", "requested", "present"].includes(actor.state),
  ).length;
  const officeSignals: Array<{
    tab: RoomTab;
    title: string;
    value: number;
    subtitle: string;
    icon: LucideIcon;
  }> = [
    { tab: "runs", title: "Active Runs", value: runCounts.active, subtitle: `${queuedRuns} queued`, icon: Rocket },
    { tab: "inbox", title: "Inbox", value: inbox?.counts.open ?? 0, subtitle: "open signals", icon: Inbox },
    { tab: "intake", title: "Work Orders", value: workOrders?.counts.open ?? 0, subtitle: `${workOrders?.counts.queued ?? 0} queued`, icon: SquarePen },
    { tab: "desk", title: "Products", value: workProducts.length, subtitle: "saved on desks", icon: FileText },
    { tab: "approvals", title: "Approvals", value: approvals?.counts.pending ?? 0, subtitle: "pending", icon: CheckCircle2 },
    { tab: "routines", title: "Routines", value: routines?.counts.due ?? 0, subtitle: `${routines?.counts.enabled ?? 0} enabled`, icon: Repeat2 },
    { tab: "lanes", title: "Work Copies", value: data.totals.activeExecutionLanes ?? 0, subtitle: `${data.executionLanes.length} lanes`, icon: GitBranch },
  ];

  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <SectionTitle title="Puzzle Game Office" aside={`${activeActors} desks active · ${data.totals.progress}% progress`} />
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenTab("runs")} className="h-8 gap-1.5">
            <Rocket className="h-3.5 w-3.5" />
            Runs
          </Button>
          <Button type="button" size="sm" onClick={() => onOpenTab("intake")} className="h-8 gap-1.5">
            <SquarePen className="h-3.5 w-3.5" />
            New Work
          </Button>
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div
          className="relative h-[560px] min-h-[480px] overflow-hidden border-4 border-black bg-[#10140f] shadow-[inset_0_0_0_4px_rgba(255,255,255,0.06),8px_8px_0_rgba(0,0,0,0.35)] md:h-[640px]"
          style={{
            backgroundImage:
              "linear-gradient(45deg, rgba(255,255,255,0.035) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.035) 75%), linear-gradient(45deg, rgba(0,0,0,0.22) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.22) 75%), linear-gradient(to right, rgba(255,255,255,0.06) 2px, transparent 2px), linear-gradient(to bottom, rgba(255,255,255,0.06) 2px, transparent 2px)",
            backgroundPosition: "0 0, 16px 16px, 0 0, 0 0",
            backgroundSize: "32px 32px, 32px 32px, 32px 32px, 32px 32px",
            imageRendering: "pixelated",
          }}
        >
          <div className="absolute left-4 top-4 z-10 border-2 border-black bg-[#101820] px-3 py-2 font-mono text-[11px] font-bold uppercase leading-none text-cyan-100 shadow-[3px_3px_0_rgba(0,0,0,0.55)]">
            Puzzle Office
            <span className="ml-2 text-emerald-300">
              {`· ${runCounts.active} run${runCounts.active === 1 ? "" : "s"}`}
            </span>
          </div>
          <OfficeLayout />
          <OfficeWorkProductStack count={workProducts.length} onClick={() => onOpenTab("desk")} />
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
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold">Office Board</p>
            <p className="mt-1 truncate font-mono text-[11px] text-muted-foreground">{data.shortPath}</p>
          </div>

          <div className="grid grid-cols-2 gap-px bg-border">
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

          <div className="border-t border-border px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">Desk Focus</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {selectedActor ? `${compactAgentName(selectedActor.name, data.name)} · ${selectedActor.zone}` : "No desk selected"}
                </p>
              </div>
              {selectedActor ? <StatusBadge status={selectedActor.state} /> : null}
            </div>

            {selectedActor ? (
              <div className="mt-3 space-y-3">
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
                    onClick={() => openFocusedTab("issues")}
                    className="border border-border bg-background px-2 py-2 text-left transition-colors hover:bg-accent/50"
                  >
                    <span className="block text-lg font-semibold tabular-nums">{selectedActor.currentWork.length}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">work</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openFocusedTab("runs")}
                    className="border border-border bg-background px-2 py-2 text-left transition-colors hover:bg-accent/50"
                  >
                    <span className="block text-lg font-semibold tabular-nums">{selectedRequests.length}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">wakes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openFocusedTab("desk")}
                    className="border border-border bg-background px-2 py-2 text-left transition-colors hover:bg-accent/50"
                  >
                    <span className="block text-lg font-semibold tabular-nums">{selectedProducts.length}</span>
                    <span className="block truncate text-[11px] text-muted-foreground">products</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => selectedAgent && onRunAgent(selectedAgent.id)}
                    disabled={!selectedAgent || wakingSelected}
                    className="h-8 gap-1.5"
                  >
                    <Rocket className={cn("h-3.5 w-3.5", wakingSelected && "animate-pulse")} />
                    {wakingSelected ? "Waking" : "Wake"}
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => openFocusedTab("comms")} className="h-8 gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Talk
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => openFocusedTab("desk")} className="h-8 gap-1.5">
                    <SquarePen className="h-3.5 w-3.5" />
                    Desk
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => openFocusedTab("runs")} className="h-8 gap-1.5">
                    <Activity className="h-3.5 w-3.5" />
                    Runs
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

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
                Dry Run
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => onDispatchRunner(false)}
                disabled={dispatchingRunner || queuedRuns === 0}
                className="h-8 gap-1.5"
              >
                <Rocket className={cn("h-3.5 w-3.5", dispatchingRunner && "animate-pulse")} />
                Dispatch
              </Button>
            </div>
            {runnerNotice ? <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{runnerNotice}</p> : null}
          </div>

          <div className="border-t border-border">
            {data.agents.slice(0, 7).map((agent) => (
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
      </div>
    </section>
  );
}

export function SpliceWorkspaceRoom() {
  const { workspaceId } = useParams<{ workspaceId?: string }>();
  const [activeTab, setActiveTab] = useState<RoomTab>("dashboard");
  const [focusedAgentId, setFocusedAgentId] = useState<string | null>(null);
  const [runnerNotice, setRunnerNotice] = useState<string | null>(null);
  const onFocusAgent = useCallback((agentId: string) => {
    setFocusedAgentId(agentId);
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
    mutationFn: (input: { itemType: string; itemId: string; body: string; wakeAgent?: boolean }) =>
      spliceApi.createWorkspaceRoomComment(PUZZLE_TESTBED_ID, input),
    onSuccess: () => {
      void workThreadQuery.refetch();
      void roomQuery.refetch();
      void inboxQuery.refetch();
      void agentConsoleQuery.refetch();
      void runsQuery.refetch();
      void timelineQuery.refetch();
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
    onSuccess: () => {
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
          {roomQuery.error instanceof Error ? roomQuery.error.message : "Unknown error"}
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
          onUpdateStatus={(itemId, status) => updateInboxMutation.mutate({ itemId, status })}
        />
      )}
      {activeTab === "lanes" && <LanesTab data={data} />}
      {activeTab === "runs" && (
        <RunsTab
          data={data}
          dispatchingRunner={dispatchRunnerMutation.isPending}
          runs={runs}
          runnerNotice={runnerNotice}
          updatingRunId={updatingRunId}
          onDispatchRunner={(dryRun) => dispatchRunnerMutation.mutate(dryRun)}
          onUpdateRunStatus={(runId, status, error) => updateRunStatusMutation.mutate({ runId, status, error })}
        />
      )}
      {activeTab === "intake" && (
        <IntakeTab
          creatingWorkOrder={createWorkOrderMutation.isPending}
          data={data}
          updatingWorkOrderId={updatingWorkOrderId}
          workOrders={workOrders}
          onCreateWorkOrder={(input) => createWorkOrderMutation.mutate(input)}
          onUpdateWorkOrderStatus={(workOrderId, status, wakeAgent) =>
            updateWorkOrderStatusMutation.mutate({ workOrderId, status, wakeAgent })}
        />
      )}
      {activeTab === "goals" && <GoalsTab goals={paperGoals} projects={paperProjects} issues={paperIssues} />}
      {activeTab === "projects" && <ProjectsTab projects={data.projects} />}
      {activeTab === "issues" && <IssuesTab data={data} />}
      {activeTab === "desk" && (
        <WorkDeskTab
          data={data}
          comments={workThread?.comments ?? []}
          workProducts={workThread?.workProducts ?? []}
          postingCommentKey={postingCommentKey}
          requestingReviewProductId={requestingReviewProductId}
          savingProductKey={savingProductKey}
          onAddComment={(input) => addCommentMutation.mutate(input)}
          onAddWorkProduct={(input) => addWorkProductMutation.mutate(input)}
          onRequestReview={(input) => requestReviewMutation.mutate(input)}
        />
      )}
      {activeTab === "reviews" && (
        <ReviewGateTab
          data={data}
          reviews={reviews}
          requestingReviewKey={requestingReviewKey}
          decidingReviewId={decidingReviewId}
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
          sendingAgentId={sendingAgentId}
          onSend={(agentId, body) => sendMessageMutation.mutate({ agentId, body })}
        />
      )}
      {activeTab === "activity" && <ActivityTab data={data} messages={messages} timeline={timeline} onOpenTab={setActiveTab} />}
      {activeTab === "details" && <DetailsTab data={data} />}
    </PuzzleWorkspaceShell>
  );
}
