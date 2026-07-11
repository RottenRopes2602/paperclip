// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SpliceWorkspaceRoom } from "./SpliceWorkspaceRoom";

const roomMock = vi.hoisted(() => vi.fn());
const roomApiMocks = vi.hoisted(() => ({
  inbox: vi.fn(async () => null),
  messages: vi.fn(async () => null),
  agentConsole: vi.fn(async () => null),
  runs: vi.fn(async () => null),
  workThread: vi.fn(async () => null),
  reviews: vi.fn(async () => null),
  routines: vi.fn(async () => null),
  approvals: vi.fn(async () => null),
  timeline: vi.fn(async () => null),
  workOrders: vi.fn(async () => null),
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

async function flushReact() {
  await act(async () => {
    await Promise.resolve();
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

describe("SpliceWorkspaceRoom", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    roomMock.mockResolvedValue(roomData);
  });

  afterEach(() => {
    container.remove();
    document.body.innerHTML = "";
    vi.clearAllMocks();
  });

  it("keeps the grouped navigation and work entry points while exposing the office from execution", async () => {
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

    expect(container.textContent).not.toContain("현재 움직임");
    expect(container.textContent).not.toContain("기능 보존");

    const executeButton = Array.from(mainNavigation?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === "실행",
    );
    await act(async () => {
      executeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    expect(container.textContent).toContain("코드 사본");
    expect(container.textContent).not.toContain("작업 사본");
    expect(container.textContent).toContain("사무실");
    const officeButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === "사무실",
    );
    await act(async () => {
      officeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    expect(container.textContent).toContain("퍼즐게임 사무실");
    expect(container.textContent).not.toContain("현재 움직임");
    expect(container.textContent).not.toContain("기능 보존");

    const workButton = Array.from(mainNavigation?.querySelectorAll("button") ?? []).find(
      (button) => button.textContent?.trim() === "업무",
    );
    await act(async () => {
      workButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flushReact();

    const workNavigation = container.querySelector('[aria-label="업무 보조 탐색"]');
    expect(workNavigation?.textContent).toContain("이슈");
    expect(workNavigation?.textContent).toContain("프로젝트");
    expect(workNavigation?.textContent).toContain("검수");
    expect(workNavigation?.textContent).toContain("승인");
    expect(workNavigation?.textContent).toContain("목표");
    expect(container.textContent).toContain("업무 책상");
    expect(container.textContent).toContain("업무 접수");

    await act(async () => {
      root.unmount();
    });
  });
});
