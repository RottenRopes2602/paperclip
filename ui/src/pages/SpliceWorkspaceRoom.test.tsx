// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpliceWorkspaceRoom } from "./SpliceWorkspaceRoom";

const roomMock = vi.hoisted(() => vi.fn());
const roomApiMocks = vi.hoisted(() => ({
  inbox: vi.fn(),
  messages: vi.fn(),
  agentConsole: vi.fn(),
  runs: vi.fn(),
  workThread: vi.fn(),
  reviews: vi.fn(),
  routines: vi.fn(),
  approvals: vi.fn(),
  timeline: vi.fn(),
  workOrders: vi.fn(),
}));

vi.mock("@/api/splice", () => ({
  spliceApi: {
    workspaceRoom: roomMock,
    workspaceRoomInbox: roomApiMocks.inbox,
    workspaceRoomMessages: roomApiMocks.messages,
    workspaceRoomAgentConsole: roomApiMocks.agentConsole,
    workspaceRoomRuns: roomApiMocks.runs,
    workspaceRoomWorkThread: roomApiMocks.workThread,
    workspaceRoomReviews: roomApiMocks.reviews,
    workspaceRoomRoutines: roomApiMocks.routines,
    workspaceRoomApprovals: roomApiMocks.approvals,
    workspaceRoomTimeline: roomApiMocks.timeline,
    workspaceRoomWorkOrders: roomApiMocks.workOrders,
  },
}));

vi.mock("@/lib/router", () => ({
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
    agents: 0,
    activeAgents: 0,
    runningAgents: 0,
    assignedAgents: 0,
    progress: 0,
    agentOwned: 0,
    humanOwned: 0,
    liveRuns: 0,
    requests: 0,
    executionLanes: 0,
    activeExecutionLanes: 0,
  },
  buckets: { active: 0, review: 0, todo: 0, blocked: 0, done: 0 },
  room: { zones: [], agents: [], humans: [] },
  lanes: { active: [], review: [], next: [], blocked: [] },
  projects: [],
  agents: [],
  executionLanes: [],
  activity: [],
  requests: [],
};

const runMonitorFixture = {
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

function primaryTabLabels(scope: Element): string[] {
  return Array.from(scope.querySelectorAll("button"))
    .filter((button) => !button.closest("details"))
    .map((button) => button.textContent?.trim() ?? "");
}

describe("SpliceWorkspaceRoom", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    roomMock.mockResolvedValue(roomData);
    roomApiMocks.inbox.mockResolvedValue(null);
    roomApiMocks.messages.mockResolvedValue(null);
    roomApiMocks.agentConsole.mockResolvedValue(null);
    roomApiMocks.runs.mockResolvedValue(runMonitorFixture);
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
    expect(mainNavigation?.textContent).toContain("업무");
    expect(mainNavigation?.textContent).toContain("기록");
    expect(mainNavigation?.querySelectorAll("button")).toHaveLength(4);

    expect(container.textContent).toContain("내가 확인할 것");
    const attentionQueue = Array.from(container.querySelectorAll("section")).find((section) => section.textContent?.includes("내가 확인할 것"));
    const attentionItems = Array.from(attentionQueue?.querySelectorAll("button") ?? []).filter((button) => button.textContent?.includes("확인 항목"));
    expect(attentionItems.length).toBeGreaterThan(0);
    expect(attentionItems.length).toBeLessThanOrEqual(5);
    expect(container.textContent).toContain("퍼즐게임 사무실");
    expect(container.textContent).toContain("선택한 책상");

    const executeButton = exactButton(mainNavigation!, "실행");
    await act(async () => {
      executeButton.click();
    });
    await flushReact();

    const executeNavigation = container.querySelector('[aria-label="실행 보조 탐색"]');
    expect(executeNavigation).not.toBeNull();
    expect(primaryTabLabels(executeNavigation!)).toEqual(["실행 현황", "코드 사본", "에이전트"]);
    expect(primaryTabLabels(executeNavigation!)).not.toContain("사무실");
    expect(executeNavigation?.querySelector('button[aria-current="page"]')?.textContent?.trim()).toBe("실행 현황");
    expect(container.textContent).toContain("실행 현황");

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
    const executeNavigation = container.querySelector('[aria-label="실행 보조 탐색"]')!;
    const executeAdvanced = executeNavigation.querySelector("details")!;
    expect(executeAdvanced.textContent).toContain("고급 운영 도구");
    await act(async () => executeAdvanced.querySelector("summary")?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(executeAdvanced.textContent).toContain("대화");
    expect(executeAdvanced.textContent).toContain("루틴");

    const workButton = exactButton(mainNavigation!, "업무");
    await act(async () => workButton.click());
    await flushReact();
    const workNavigation = container.querySelector('[aria-label="업무 보조 탐색"]')!;
    expect(primaryTabLabels(workNavigation)).toEqual(["이슈", "프로젝트", "검수", "승인", "목표"]);
    const workAdvanced = workNavigation.querySelector("details")!;
    expect(workAdvanced.textContent).toContain("고급 운영 도구");
    expect(workAdvanced.textContent).toContain("업무 책상");
    expect(workAdvanced.textContent).toContain("업무 접수");

    const historyButton = exactButton(mainNavigation!, "기록");
    await act(async () => historyButton.click());
    await flushReact();
    const historyNavigation = container.querySelector('[aria-label="기록 보조 탐색"]')!;
    expect(primaryTabLabels(historyNavigation)).toEqual(["활동", "상세"]);
    expect(historyNavigation.querySelector('button[aria-current="page"]')?.textContent?.trim()).toBe("활동");
    expect(container.textContent).toContain("사무실 타임라인");

    await act(async () => {
      root.unmount();
    });
  });
});
