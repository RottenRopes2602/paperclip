// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SpliceRunMonitorData } from "@/api/splice";
import { SpliceWorkspaceRoom } from "./SpliceWorkspaceRoom";

const roomMock = vi.hoisted(() => vi.fn());
const roomApiMocks = vi.hoisted(() => ({
  testWorkspaces: vi.fn(),
  inbox: vi.fn(),
  messages: vi.fn(),
  agentConsole: vi.fn(),
  runs: vi.fn(),
  runDetail: vi.fn(),
  workThread: vi.fn(),
  reviews: vi.fn(),
  routines: vi.fn(),
  approvals: vi.fn(),
  timeline: vi.fn(),
  workOrders: vi.fn(),
}));

vi.mock("@/api/splice", () => ({
  spliceApi: {
    testWorkspaces: roomApiMocks.testWorkspaces,
    workspaceRoom: roomMock,
    workspaceRoomInbox: roomApiMocks.inbox,
    workspaceRoomMessages: roomApiMocks.messages,
    workspaceRoomAgentConsole: roomApiMocks.agentConsole,
    workspaceRoomRuns: roomApiMocks.runs,
    workspaceRoomRunDetail: roomApiMocks.runDetail,
    workspaceRoomWorkThread: roomApiMocks.workThread,
    workspaceRoomReviews: roomApiMocks.reviews,
    workspaceRoomRoutines: roomApiMocks.routines,
    workspaceRoomApprovals: roomApiMocks.approvals,
    workspaceRoomTimeline: roomApiMocks.timeline,
    workspaceRoomWorkOrders: roomApiMocks.workOrders,
  },
}));

vi.mock("@/lib/router", () => ({
  Link: ({ to, children }: { to: string; children?: ReactNode }) => <a href={to}>{children}</a>,
  Navigate: () => null,
  useParams: () => ({ workspaceId: "puzzle-game" }),
}));

vi.mock("@/context/BreadcrumbContext", () => ({
  useBreadcrumbs: () => ({ setBreadcrumbs: vi.fn() }),
}));

vi.mock("@/context/SidebarContext", () => ({
  useSidebar: () => ({ isMobile: false, sidebarOpen: false, setSidebarOpen: vi.fn() }),
}));

vi.mock("@/components/BreadcrumbBar", () => ({
  BreadcrumbBar: () => null,
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const registeredRole = (id: string, slug: string, name: string, role: string, state = "idle") => ({
  id,
  slug,
  name,
  initials: name.slice(0, 2),
  role,
  state,
  zone: "registered-roles",
  x: 0,
  y: 0,
  currentWork: [],
  activeCount: 0,
  reviewCount: 0,
  queuedCount: 0,
  request: null,
  session: null,
});

const copyActor = (id: string, name: string, kind: "human" | "agent", state = "idle") => ({
  id,
  name,
  kind,
  state,
});

const assignedWork = {
  id: "issue-inspector",
  type: "issue" as const,
  title: "선택 정보 인스펙터 검증",
  status: "in_progress",
  bucket: "active" as const,
  progressWeight: 1,
  ownerSlug: "codex",
  ownerName: "Codex 등록 역할",
  projectSlug: "puzzle-game",
  projectName: "Puzzle Game",
  priority: "high",
  ageMin: 3,
  description: "역할·코드 사본·세션·실행 선택 상태를 확인합니다.",
};

const rootRole = registeredRole("role-root", "operator", "운영자 등록 역할", "operator", "present");
const codexRole = {
  ...registeredRole("role-codex", "codex", "Codex 등록 역할", "engineer", "assigned"),
  currentWork: [assignedWork],
  activeCount: 1,
  reviewCount: 1,
  queuedCount: 0,
  session: {
    branch: "codex/copy-room",
    dirty: 2,
    path: "D:/worktrees/puzzle-game-codex",
    projectPath: "D:/testbeds/puzzle-game",
    manager: "Codex",
    lastCommit: { sha: "codex-sha", msg: "codex snapshot", ageMin: 7 },
  },
};
const claudeRole = registeredRole("role-claude", "claude", "Claude 등록 역할", "designer");
const spliceRole = registeredRole("role-splice", "splice", "Splice 등록 역할", "general");

const executionLanes = [
  {
    id: "lane-root",
    name: "원본 코드 방",
    kind: "main",
    kindLabel: "원본 코드",
    copyKind: "root",
    copyKindLabel: "원본 코드",
    manager: "local",
    managerLabel: "Splice Hub",
    state: "active",
    projectSpaceId: "space-puzzle-game",
    projectSpaceName: "Puzzle Game",
    path: "D:/testbeds/puzzle-game",
    shortPath: "testbeds/puzzle-game",
    projectPath: "D:/testbeds/puzzle-game",
    projectShortPath: "testbeds/puzzle-game",
    projectPresent: true,
    repositoryRoot: "D:/testbeds/puzzle-game",
    branch: "main",
    isMain: true,
    dirty: 0,
    ahead: 0,
    behind: 0,
    lastCommit: { sha: "root-sha", msg: "root snapshot", ageMin: 4 },
    requestCount: 0,
    activeRequestCount: 0,
    queuedRunCount: 0,
    liveRunCount: 0,
    actors: [copyActor("role-root", "원본 세션 인스턴스", "human", "present")],
  },
  {
    id: "lane-codex",
    name: "Codex 코드 방",
    kind: "codex",
    kindLabel: "Codex",
    copyKind: "worktree",
    copyKindLabel: "Codex",
    manager: "codex",
    managerLabel: "Codex",
    state: "dirty",
    projectSpaceId: "space-puzzle-game",
    projectSpaceName: "Puzzle Game",
    path: "D:/worktrees/puzzle-game-codex",
    shortPath: "worktrees/puzzle-game-codex",
    projectPath: "D:/worktrees/puzzle-game-codex",
    projectShortPath: "worktrees/puzzle-game-codex",
    projectPresent: true,
    repositoryRoot: "D:/testbeds/puzzle-game",
    branch: "codex/copy-room",
    isMain: false,
    dirty: 2,
    ahead: 1,
    behind: 0,
    lastCommit: { sha: "codex-sha", msg: "codex snapshot", ageMin: 7 },
    requestCount: 1,
    activeRequestCount: 1,
    queuedRunCount: 0,
    liveRunCount: 1,
    actors: [copyActor("role-codex", "Codex 세션 인스턴스", "agent", "working")],
  },
  {
    id: "lane-claude",
    name: "Claude 코드 방",
    kind: "claude",
    kindLabel: "Claude Code",
    copyKind: "worktree",
    copyKindLabel: "Claude",
    manager: "claude",
    managerLabel: "Claude Code",
    state: "queued",
    projectSpaceId: "space-puzzle-game",
    projectSpaceName: "Puzzle Game",
    path: "D:/worktrees/puzzle-game-claude",
    shortPath: "worktrees/puzzle-game-claude",
    projectPath: "D:/worktrees/puzzle-game-claude",
    projectShortPath: "worktrees/puzzle-game-claude",
    projectPresent: true,
    repositoryRoot: "D:/testbeds/puzzle-game",
    branch: "claude/copy-room",
    isMain: false,
    dirty: 1,
    ahead: 0,
    behind: 1,
    lastCommit: { sha: "claude-sha", msg: "claude snapshot", ageMin: 9 },
    requestCount: 1,
    activeRequestCount: 0,
    queuedRunCount: 1,
    liveRunCount: 0,
    actors: [copyActor("role-claude", "Claude 세션 인스턴스", "agent", "requested")],
  },
  {
    id: "lane-splice",
    name: "Splice 코드 방",
    kind: "splice",
    kindLabel: "Splice",
    copyKind: "clone",
    copyKindLabel: "Splice",
    manager: "splice",
    managerLabel: "Splice",
    state: "idle",
    projectSpaceId: "space-puzzle-game",
    projectSpaceName: "Puzzle Game",
    path: "D:/worktrees/puzzle-game-splice",
    shortPath: "worktrees/puzzle-game-splice",
    projectPath: "D:/worktrees/puzzle-game-splice",
    projectShortPath: "worktrees/puzzle-game-splice",
    projectPresent: true,
    repositoryRoot: "D:/testbeds/puzzle-game",
    branch: "splice/copy-room",
    isMain: false,
    dirty: 0,
    ahead: 0,
    behind: 0,
    lastCommit: { sha: "splice-sha", msg: "splice snapshot", ageMin: 12 },
    requestCount: 0,
    activeRequestCount: 0,
    queuedRunCount: 0,
    liveRunCount: 0,
    actors: [copyActor("role-splice", "Splice 세션 인스턴스", "agent", "idle")],
  },
];

const roomData = {
  generatedAt: "2026-07-11T00:00:00.000Z",
  id: "puzzle-game",
  name: "Puzzle Game",
  mode: "single-workspace-live-room",
  path: "D:/testbeds/puzzle-game",
  shortPath: "testbeds/puzzle-game",
  dataSource: "test",
  workspaceBinding: { mode: "embedded", repositoryRoot: "D:/testbeds/puzzle-game", projectRelativePath: ".", projectPath: "D:/testbeds/puzzle-game" },
  objective: null,
  goals: [],
  totals: {
    projects: 0,
    activeProjects: 0,
    issues: 0,
    activeIssues: 0,
    reviewIssues: 0,
    todoIssues: 0,
    blockedIssues: 0,
    doneIssues: 0,
    agents: 3,
    activeAgents: 0,
    runningAgents: 0,
    assignedAgents: 3,
    progress: 0,
    agentOwned: 0,
    humanOwned: 0,
    liveRuns: 0,
    requests: 0,
    executionLanes: executionLanes.length,
    activeExecutionLanes: 3,
  },
  buckets: { active: 0, review: 0, todo: 0, blocked: 0, done: 0 },
  room: { zones: [], agents: [codexRole, claudeRole, spliceRole], humans: [rootRole] },
  lanes: { active: [], review: [], next: [], blocked: [] },
  projects: [],
  agents: [codexRole, claudeRole, spliceRole],
  executionLanes,
  activity: [],
  requests: [],
};

const runMonitorFixture: SpliceRunMonitorData = {
  generatedAt: "2026-07-11T00:00:00.000Z",
  workspaceId: "puzzle-game",
  workspaceName: "Puzzle Game",
  queuePath: "D:/testbeds/puzzle-game/.paperclip/run-requests.jsonl",
  runner: {
    queuePath: "D:/testbeds/puzzle-game/.paperclip/run-requests.jsonl",
    command: "paperclip runner",
    pending: 0,
    launched: 0,
    failed: 0,
    active: 0,
    total: 6,
    canDispatch: false,
    latest: null,
  },
  counts: {
    total: 6,
    active: 0,
    requested: 0,
    launchReady: 0,
    launched: 0,
    done: 0,
    failed: 0,
    blocked: 6,
    noop: 0,
    cancelled: 0,
    expired: 0,
    terminal: 6,
  },
  runs: Array.from({ length: 6 }, (_, index) => ({
    id: `blocked-run-${index + 1}`,
    companyId: "splice",
    companyName: "Splice",
    workspacePath: "D:/testbeds/puzzle-game",
    agentId: `agent-${index + 1}`,
    agentName: `검증 에이전트 ${index + 1}`,
    status: "blocked",
    requestedAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    error: `확인 항목 ${index + 1}`,
    expired: false,
    runtime: null,
    process: null,
    launch: null,
  })),
};

const zeroRunMonitorFixture: SpliceRunMonitorData = {
  ...runMonitorFixture,
  runner: {
    ...runMonitorFixture.runner,
    total: 0,
  },
  counts: {
    total: 0,
    active: 0,
    requested: 0,
    launchReady: 0,
    launched: 0,
    done: 0,
    failed: 0,
    blocked: 0,
    noop: 0,
    cancelled: 0,
    expired: 0,
    terminal: 0,
  },
  runs: [],
};

const copyRoomRunFixture: SpliceRunMonitorData = {
  ...zeroRunMonitorFixture,
  counts: { ...zeroRunMonitorFixture.counts, total: 1, active: 1, launched: 1, terminal: 0 },
  runs: [{
    id: "live-run-codex",
    companyId: "splice",
    companyName: "Splice",
    workspacePath: executionLanes[1].path,
    agentId: "role-codex",
    agentName: "Engineer 실행 인스턴스",
    status: "launched",
    requestedAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    error: "",
    expired: false,
    runtime: {
      state: "running",
      ageSeconds: 12,
      stale: false,
      process: { pid: 4312, known: true, alive: true, state: "running" },
      verdict: null,
    },
    process: null,
    launch: null,
  }],
};

const runDetailFixture = {
  generatedAt: "2026-07-11T00:00:00.000Z",
  workspaceId: "puzzle-game",
  workspaceName: "Puzzle Game",
  run: copyRoomRunFixture.runs[0],
  artifacts: {
    prompt: { path: null, exists: false, readable: false, size: 0, updatedAt: null, text: "", truncated: false, mode: "none" },
    output: { path: null, exists: false, readable: false, size: 0, updatedAt: null, text: "", truncated: false, mode: "none" },
  },
  related: { comments: [], messages: [], workOrders: [], workProducts: [], routineRuns: [] },
};

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function exactButton(scope: ParentNode, label: string): HTMLButtonElement {
  const button = Array.from(scope.querySelectorAll("button")).find((candidate) => candidate.textContent?.trim() === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function labelledButton(scope: ParentNode, label: string): HTMLButtonElement {
  const button = Array.from(scope.querySelectorAll("button")).find((candidate) => candidate.getAttribute("aria-label") === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function titledButton(scope: ParentNode, title: string): HTMLButtonElement {
  const button = Array.from(scope.querySelectorAll("button")).find((candidate) => candidate.getAttribute("title") === title);
  if (!button) throw new Error(`Button not found: ${title}`);
  return button;
}

function selectionInspector(container: HTMLDivElement): HTMLElement {
  const inspector = container.querySelector('[data-testid="selection-inspector"]');
  if (!inspector) throw new Error("Selection inspector not found");
  return inspector as HTMLElement;
}

function expectInspectorWithoutRunnerControls(inspector: HTMLElement) {
  expect(inspector.textContent).not.toContain("러너 수동 조작");
  expect(inspector.textContent).not.toContain("Dry Run");
  expect(inspector.textContent).not.toContain("Dispatch");
}

function primaryTabLabels(scope: Element): string[] {
  return Array.from(scope.querySelectorAll("button"))
    .filter((button) => !button.closest("details"))
    .map((button) => button.textContent?.trim() ?? "");
}

async function renderRoom(container: HTMLDivElement, data = roomData, runs: SpliceRunMonitorData = runMonitorFixture) {
  roomMock.mockResolvedValue(data);
  roomApiMocks.runs.mockResolvedValue(runs);
  const root = createRoot(container);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  await act(async () => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <SpliceWorkspaceRoom />
      </QueryClientProvider>,
    );
  });
  await flushReact();
  await flushReact();
  return root;
}

function copyRooms(container: HTMLDivElement): Element[] {
  return Array.from(container.querySelectorAll('[data-testid="copy-room"]'));
}

describe("SpliceWorkspaceRoom", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    roomMock.mockResolvedValue(roomData);
    roomApiMocks.testWorkspaces.mockResolvedValue({
      workspaces: [
        { id: "puzzle-game", name: "Puzzle Game", path: "D:/00_WorkSpace/08_PuzzleGame", kind: "testbed", source: "env", available: true, totals: null, workspaceBinding: null },
        { id: "music", name: "Music(Draft)", path: "D:/00_WorkSpace/07_Music(Draft)", kind: "testbed", source: "env", available: true, totals: null, workspaceBinding: null },
      ],
    });
    roomApiMocks.inbox.mockResolvedValue(null);
    roomApiMocks.messages.mockResolvedValue(null);
    roomApiMocks.agentConsole.mockResolvedValue(null);
    roomApiMocks.runs.mockResolvedValue(runMonitorFixture);
    roomApiMocks.runDetail.mockResolvedValue(runDetailFixture);
    roomApiMocks.workThread.mockResolvedValue(null);
    roomApiMocks.reviews.mockResolvedValue([]);
    roomApiMocks.routines.mockResolvedValue(null);
    roomApiMocks.approvals.mockResolvedValue(null);
    roomApiMocks.timeline.mockResolvedValue(null);
    roomApiMocks.workOrders.mockResolvedValue(null);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("integrates the pixel office into 관제 and makes execution observation-first", async () => {
    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SpliceWorkspaceRoom />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    const mainNavigation = container.querySelector('nav[aria-label="Splice 주요 탐색"]');
    expect(mainNavigation?.textContent).toContain("관제");
    expect(mainNavigation?.textContent).toContain("실행");
    expect(mainNavigation?.textContent).toContain("코드 사본");
    expect(mainNavigation?.textContent).toContain("업무");
    expect(mainNavigation?.textContent).toContain("기록");
    expect(mainNavigation?.textContent).toContain("확인할 것");
    expect(mainNavigation?.textContent).toContain("목표 기준");
    expect(mainNavigation?.textContent).toContain("검토");
    expect(mainNavigation?.textContent).toContain("승인");
    expect(mainNavigation?.querySelectorAll("button")).toHaveLength(9);

    expect(container.textContent).toContain("내가 확인할 것");
    const attentionQueue = Array.from(container.querySelectorAll("section")).find((section) => section.textContent?.includes("내가 확인할 것"));
    const attentionItems = Array.from(attentionQueue?.querySelectorAll("button") ?? []).filter((button) => button.textContent?.includes("확인 항목"));
    expect(attentionItems.length).toBeGreaterThan(0);
    expect(attentionItems.length).toBeLessThanOrEqual(5);
    expect(container.querySelector('button[aria-label="테스트 프로젝트 바꾸기"]')).not.toBeNull();
    expect(container.textContent).toContain("Puzzle Game 사무실");
    expect(container.textContent).toContain("선택 정보");

    const executeButton = exactButton(mainNavigation!, "실행");
    await act(async () => {
      executeButton.click();
    });
    await flushReact();

    expect(container.querySelector('[aria-label="실행 보조 탐색"]')).toBeNull();
    expect(mainNavigation?.textContent).toContain("확인할 것");
    expect(mainNavigation?.textContent).toContain("에이전트");
    expect(mainNavigation?.textContent).toContain("대화");
    expect(mainNavigation?.textContent).toContain("루틴");
    expect(container.textContent).toContain("실행 현황");

    await act(async () => {
      exactButton(mainNavigation!, "에이전트").click();
    });
    await flushReact();
    expect(container.textContent).toContain("에이전트 현황");

    const codeCopiesButton = exactButton(mainNavigation!, "코드 사본");
    await act(async () => {
      codeCopiesButton.click();
    });
    await flushReact();

    expect(container.querySelector('[aria-label="코드 사본 보조 탐색"]')).toBeNull();
    expect(container.textContent).toContain("프로젝트 코드 사본");
    expect(mainNavigation?.textContent).toContain("확인할 것");
    expect(mainNavigation?.textContent).toContain("실행 현황");

    await act(async () => exactButton(mainNavigation!, "실행").click());
    await flushReact();
    expect(mainNavigation?.textContent).toContain("에이전트");
    expect(mainNavigation?.textContent).toContain("확인할 것");
    await act(async () => exactButton(mainNavigation!, "실행").click());
    await flushReact();
    expect(mainNavigation?.textContent).not.toContain("에이전트");

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps 업무·기록 and advanced tools reachable", async () => {
    const root = createRoot(container);
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

    await act(async () => {
      root.render(
        <QueryClientProvider client={queryClient}>
          <SpliceWorkspaceRoom />
        </QueryClientProvider>,
      );
    });
    await flushReact();
    await flushReact();

    const mainNavigation = container.querySelector('nav[aria-label="Splice 주요 탐색"]');
    const executeButton = exactButton(mainNavigation!, "실행");
    await act(async () => executeButton.click());
    await flushReact();
    expect(container.querySelector('[aria-label="실행 보조 탐색"]')).toBeNull();
    expect(mainNavigation?.textContent).toContain("에이전트");
    expect(mainNavigation?.textContent).toContain("대화");
    expect(mainNavigation?.textContent).toContain("루틴");

    const workButton = exactButton(mainNavigation!, "업무");
    await act(async () => workButton.click());
    await flushReact();
    expect(container.querySelector('[aria-label="업무 보조 탐색"]')).toBeNull();
    expect(mainNavigation?.textContent).toContain("프로젝트");
    expect(mainNavigation?.textContent).toContain("작업");
    expect(mainNavigation?.textContent).toContain("검토");
    expect(mainNavigation?.textContent).toContain("승인");
    expect(mainNavigation?.textContent).toContain("목표 기준");
    expect(mainNavigation?.textContent).toContain("업무 책상");
    expect(mainNavigation?.textContent).toContain("업무 접수");
    expect(mainNavigation?.textContent).toContain("확인할 것");
    expect(mainNavigation?.textContent).toContain("에이전트");
    expect(mainNavigation?.textContent).toContain("대화");
    expect(mainNavigation?.textContent).toContain("루틴");

    const observeButton = exactButton(mainNavigation!, "관제");
    await act(async () => observeButton.click());
    await flushReact();
    expect(mainNavigation?.textContent).toContain("확인할 것");
    expect(mainNavigation?.textContent).toContain("목표 기준");
    expect(mainNavigation?.textContent).toContain("검토");
    expect(mainNavigation?.textContent).toContain("승인");

    const historyButton = exactButton(mainNavigation!, "기록");
    await act(async () => historyButton.click());
    await flushReact();
    expect(container.querySelector('[aria-label="기록 보조 탐색"]')).toBeNull();
    expect(mainNavigation?.textContent).toContain("상세");
    expect(container.textContent).toContain("사무실 타임라인");

    await act(async () => {
      root.unmount();
    });
  });

  it("renders one copy room per lane and keeps registered roles distinct from room instances", async () => {
    const runMatchedLanes = roomData.executionLanes.map((lane) => lane.id === "lane-codex"
      ? { ...lane, projectPath: `${lane.path}/testbeds/puzzle-game` }
      : lane);
    const root = await renderRoom(container, { ...roomData, executionLanes: runMatchedLanes }, copyRoomRunFixture);
    const rooms = copyRooms(container);
    const roomText = rooms.map((room) => room.textContent ?? "").join(" ");

    expect(rooms).toHaveLength(4);
    expect(roomText).toContain("원본 코드 방");
    expect(roomText).toContain("Codex 코드 방");
    expect(roomText).toContain("Claude 코드 방");
    expect(roomText).toContain("Splice 코드 방");
    expect(roomText).toContain("원본 코드");
    expect(roomText).toContain("Codex");
    expect(roomText).toContain("Claude");
    expect(roomText).toContain("Splice");
    expect(roomText).toContain("원본 세션 인스턴스");
    expect(roomText).toContain("Codex 세션 인스턴스");
    expect(roomText).toContain("Claude 세션 인스턴스");
    expect(roomText).toContain("Splice 세션 인스턴스");
    expect(roomText).toContain("Engineer 실행 인스턴스");

    const registeredRoleText = container.textContent ?? "";
    expect(registeredRoleText).toContain("Codex 등록 역할");
    expect(registeredRoleText).toContain("Claude 등록 역할");
    expect(registeredRoleText).toContain("Splice 등록 역할");
    expect(roomText).not.toContain("Codex 등록 역할");
    expect(roomText).not.toContain("Claude 등록 역할");
    expect(roomText).not.toContain("Splice 등록 역할");

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps the four office rooms mounted and highlights the selected room filter", async () => {
    const root = await renderRoom(container);
    const filters = [
      ["전체", null],
      ["원본 코드", "root"],
      ["Codex", "codex"],
      ["Claude", "claude"],
      ["Splice", "splice"],
    ] as const;

    for (const [label, activeRoomId] of filters) {
      await act(async () => {
        exactButton(container, label).click();
      });
      await flushReact();
      const rooms = copyRooms(container);
      expect(rooms).toHaveLength(4);
      for (const room of rooms) {
        const isActiveRoom = activeRoomId === null || room.getAttribute("data-room-id") === activeRoomId;
        expect(room.classList.contains("opacity-45")).toBe(!isActiveRoom);
      }
    }

    expect(roomMock).toHaveBeenCalled();
    expect(roomMock.mock.calls.length).toBe(1);
    const unchangedFixture = roomMock.mock.results[0]?.value;
    expect(unchangedFixture).toBeInstanceOf(Promise);

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps copy rooms and registered roles visible when there are zero runs", async () => {
    const zeroRunData = {
      ...roomData,
      totals: { ...roomData.totals, liveRuns: 0, runningAgents: 0 },
      executionLanes: roomData.executionLanes.slice(0, 1).map((lane) => ({
        ...lane,
        requestCount: 0,
        activeRequestCount: 0,
        queuedRunCount: 0,
        liveRunCount: 0,
      })),
    };
    const root = await renderRoom(container, zeroRunData, zeroRunMonitorFixture);

    expect(copyRooms(container)).toHaveLength(4);
    expect(container.textContent).toContain("Codex 등록 역할");
    expect(container.textContent).toContain("Claude 등록 역할");
    expect(container.textContent).toContain("Splice 등록 역할");
    expect(container.textContent).toContain("0");

    await act(async () => {
      root.unmount();
    });
  });

  it("shows the registered-role inspector with assignment actions and collapsed direct instruction", async () => {
    const root = await renderRoom(container, roomData, copyRoomRunFixture);

    await act(async () => {
      labelledButton(container, "Codex 등록 역할 공용 대기 책상").click();
    });
    await flushReact();

    const inspector = selectionInspector(container);
    const inspectorText = inspector.textContent ?? "";
    expect(inspectorText).toContain("등록 역할");
    expect(inspectorText).toContain("Codex 등록 역할");
    expect(inspectorText).toContain("선택 정보 인스펙터 검증");
    expect(inspectorText).toContain("현재 담당");
    expect(inspectorText).toContain("작업 위치");
    expect(inspectorText).toContain("결과");
    expect(inspectorText).toContain("검수");
    expect(inspectorText).toContain("업무");
    expect(inspectorText).toContain("대화");
    expect(inspectorText).toContain("실행 기록");
    expect(inspectorText).toContain("직접 지시");
    expect(inspector.querySelector("details")).not.toBeNull();
    expect((inspector.querySelector("details") as HTMLDetailsElement).open).toBe(false);
    expectInspectorWithoutRunnerControls(inspector);

    await act(async () => {
      root.unmount();
    });
  });

  it("shows code-copy details when a room title is selected", async () => {
    const root = await renderRoom(container, roomData, copyRoomRunFixture);

    await act(async () => {
      titledButton(container, "Codex 코드 방 코드 사본 열기").click();
    });
    await flushReact();

    const inspector = selectionInspector(container);
    const inspectorText = inspector.textContent ?? "";
    expect(inspectorText).toContain("코드 사본");
    expect(inspectorText).toContain("Codex 코드 방");
    expect(inspectorText).toContain("Codex");
    expect(inspectorText).toContain("codex/copy-room");
    expect(inspectorText).toContain("D:/worktrees/puzzle-game-codex");
    expect(inspectorText).toContain("변경");
    expect(inspectorText).toContain("세션");
    expect(inspectorText).toContain("실행");
    expect(inspectorText).not.toContain("직접 지시");
    expectInspectorWithoutRunnerControls(inspector);

    await act(async () => {
      root.unmount();
    });
  });

  it("shows a session as a work instance, separate from an agent run", async () => {
    const root = await renderRoom(container, roomData, copyRoomRunFixture);

    await act(async () => {
      titledButton(container, "Codex 세션 인스턴스 · 세션").click();
    });
    await flushReact();

    const inspector = selectionInspector(container);
    const inspectorText = inspector.textContent ?? "";
    expect(inspectorText).toContain("작업 인스턴스");
    expect(inspectorText).toContain("실제 에이전트 실행");
    expect(inspectorText).toMatch(/실제 에이전트 실행.*아니/);
    expect(inspectorText).toContain("Codex 코드 방");
    expect(inspectorText).toContain("Codex 등록 역할");
    expect(inspectorText).not.toContain("직접 지시");
    expectInspectorWithoutRunnerControls(inspector);

    await act(async () => {
      root.unmount();
    });
  });

  it("shows a live run with run identity, role, and code-copy context", async () => {
    const root = await renderRoom(container, roomData, copyRoomRunFixture);

    await act(async () => {
      titledButton(container, "Engineer 실행 인스턴스 · 실행 중").click();
    });
    await flushReact();
    await flushReact();

    const inspector = selectionInspector(container);
    const inspectorText = inspector.textContent ?? "";
    expect(inspectorText).toContain("실제 실행");
    expect(inspectorText).toContain("live-run-codex");
    expect(inspectorText).toContain("실행 중");
    expect(inspectorText).toContain("Codex 등록 역할");
    expect(inspectorText).toContain("Codex 코드 방");
    expect(inspectorText).not.toContain("직접 지시");
    expectInspectorWithoutRunnerControls(inspector);

    await act(async () => {
      root.unmount();
    });
  });

  it("keeps Dry Run and Dispatch on RunsTab while inspector stays observation-only", async () => {
    const root = await renderRoom(container, roomData, copyRoomRunFixture);
    const mainNavigation = container.querySelector('nav[aria-label="Splice 주요 탐색"]')!;

    await act(async () => {
      const executeButton = Array.from(mainNavigation.querySelectorAll("button")).find((button) => button.textContent?.trim().startsWith("실행"));
      if (!executeButton) throw new Error("Button not found: 실행");
      executeButton.click();
    });
    await flushReact();
    expect(container.querySelector('[aria-label="실행 보조 탐색"]')).toBeNull();
    expect(mainNavigation.textContent).toContain("에이전트");
    expect(container.textContent).toContain("Dry Run");
    expect(container.textContent).toContain("Dispatch");

    await act(async () => {
      root.unmount();
    });
  });
});
