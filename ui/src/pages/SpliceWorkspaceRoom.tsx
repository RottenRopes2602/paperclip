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
  GitBranch,
  GitCommit,
  History,
  Layers,
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
  type SpliceExecutionLane,
  type SpliceWorkspaceRoomActor,
  type SpliceWorkspaceRoomData,
  type SpliceWorkspaceRoomGoal,
  type SpliceWorkspaceRoomProject,
  type SpliceWorkspaceRoomWorkItem,
} from "@/api/splice";
import { cn } from "@/lib/utils";

const PUZZLE_TESTBED_ID = "puzzle-game";
const WORKSPACE_ROOM_QUERY_ROOT = ["splice", "workspace-room", PUZZLE_TESTBED_ID] as const;

type RoomTab = "dashboard" | "lanes" | "goals" | "projects" | "issues" | "agents" | "activity" | "details";

const roomTabs: Array<{ value: RoomTab; label: string; icon: LucideIcon }> = [
  { value: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { value: "lanes", label: "Lanes", icon: GitBranch },
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
      { x: 18, y: 73 },
      { x: 22, y: 82 },
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

function RoomActorSprite({
  actor,
  workspaceName,
  slotIndex,
}: {
  actor: SpliceWorkspaceRoomActor;
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
    <div
      data-testid="room-actor-sprite"
      className="absolute z-20 flex w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
      style={{ left: `${left}%`, top: `${top}%` }}
      title={`${actor.name} · ${actor.state} · ${workLine}`}
    >
      <div className="relative h-[92px] w-32">
        <Workstation actor={actor} />
        <PixelAvatar actor={actor} />
        <span className={cn(
          "absolute right-3 top-4 z-30 h-3 w-3 border-2 border-black shadow-[2px_2px_0_rgba(0,0,0,0.55)]",
          stateDot[actor.state] ?? stateDot.idle,
        )} />
      </div>
      <div className={cn(
        "w-full border-2 px-2 py-1 font-mono shadow-[3px_3px_0_rgba(0,0,0,0.55)]",
        tone,
      )}>
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-[10px] font-bold uppercase leading-none">{label}</span>
          <span className="shrink-0 text-[9px] uppercase leading-none opacity-85">{actorStateLabel(actor)}</span>
        </div>
        <p className="mt-1 truncate text-[9px] uppercase leading-none opacity-85">{roomLine}</p>
      </div>
    </div>
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
  const laneItem = roomTabs.find((item) => item.value === "lanes")!;
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
            <PuzzleSidebarNavItem
              activeTab={activeTab}
              item={laneItem}
              onSelect={selectTab}
              textBadge={`${data.executionLanes?.length ?? 0}`}
            />
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

      <ExecutionLanesPanel data={data} limit={3} />

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

function RoomMap({ data }: { data: SpliceWorkspaceRoomData }) {
  const roomActors = [...data.room.humans, ...data.room.agents];
  const zoneCounts = new Map<string, number>();
  const roomActorEntries = roomActors.map((actor) => {
    const slotIndex = zoneCounts.get(actor.zone) ?? 0;
    zoneCounts.set(actor.zone, slotIndex + 1);
    return { actor, slotIndex };
  });

  return (
    <section className="space-y-3">
      <SectionTitle title="Workspace Room" aside="pixel office floor" />
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(260px,0.6fr)]">
        <div
          className="relative h-[430px] overflow-hidden border-2 border-border bg-[#10140f] shadow-[inset_0_0_0_4px_rgba(0,0,0,0.24)]"
          style={{
            backgroundImage:
              "linear-gradient(45deg, rgba(255,255,255,0.035) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.035) 75%), linear-gradient(45deg, rgba(0,0,0,0.22) 25%, transparent 25%, transparent 75%, rgba(0,0,0,0.22) 75%), linear-gradient(to right, rgba(255,255,255,0.06) 2px, transparent 2px), linear-gradient(to bottom, rgba(255,255,255,0.06) 2px, transparent 2px)",
            backgroundPosition: "0 0, 16px 16px, 0 0, 0 0",
            backgroundSize: "32px 32px, 32px 32px, 32px 32px, 32px 32px",
            imageRendering: "pixelated",
          }}
        >
          <OfficeLayout />
          {roomActorEntries.map(({ actor, slotIndex }) => (
            <RoomActorSprite key={actor.id} actor={actor} workspaceName={data.name} slotIndex={slotIndex} />
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
    refetchInterval: 10000,
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
      {activeTab === "lanes" && <LanesTab data={data} />}
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
