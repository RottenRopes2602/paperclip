import { api } from "./client";

export interface SpliceAgentRunRequest {
  id: string;
  companyId: string;
  companyName: string;
  workspacePath?: string;
  agentId: string;
  agentName: string;
  status: "requested" | "launch_ready" | "launched" | "done" | "failed" | "blocked" | "noop" | "cancelled" | string;
  requestedAt: string;
  updatedAt: string;
  launchedAt?: string | null;
  completedAt?: string | null;
  cancelledAt?: string | null;
  failedAt?: string | null;
  error?: string | null;
  note?: string;
  operatorNote?: string | null;
  ageSeconds?: number;
  state?: "fresh" | "waiting" | "launched" | "expired" | "terminal" | string;
  expired?: boolean;
  runtime?: SpliceRunRuntime | null;
  queue?: {
    store: string;
    path: string;
  };
  process?: {
    pid: number | null;
  } | null;
  launch?: {
    card?: string;
    promptPath?: string;
    outPath?: string;
    workspacePath?: string;
    dryRun?: boolean;
    codexHome?: string;
  } | null;
}

export interface SpliceRunRuntime {
  state: "queued" | "ready" | "launched" | "running" | "exited" | "terminal" | "verdict_seen" | string;
  ageSeconds: number;
  stale: boolean;
  process: {
    pid: number | null;
    known: boolean;
    alive: boolean;
    state: "unknown" | "running" | "exited" | string;
  };
  verdict: {
    value: "done" | "noop" | "blocked" | "failed" | string;
    label: string;
    line: string;
  } | null;
}

export interface SpliceWorkspaceAgent {
  id: string;
  name: string;
  urlKey: string;
  role: string;
  title: string | null;
  status: "idle" | "running" | "requested" | "launched" | "error" | string;
  source: string;
  lastHeartbeatAt: string | null;
  request: SpliceAgentRunRequest | null;
}

export interface SpliceWorkspace {
  id: string;
  slug: string;
  name: string;
  prefix: string;
  path: string | null;
  state: "idle" | "running" | "requested" | "launched" | "blocked" | "stale";
  projectsActive: number;
  projectsTotal: number;
  issuesActive: number;
  cardsOpen: number;
  activeReal: number;
  stale: number;
  blocked: number;
  review: number;
  sessions: number;
  lastActivityMin: number | null;
  agentCount: number;
  runningAgents: number;
  requestedAgents: number;
  liveRuns: number;
  roomPath?: string;
  agents: SpliceWorkspaceAgent[];
  primaryAgent: SpliceWorkspaceAgent | null;
  requests: SpliceAgentRunRequest[];
}

export interface SpliceOverviewData {
  generatedAt: string;
  mode: "disk-first";
  dataSource: string;
  fleet: {
    running: number;
    abandoned: number;
  };
  sessionsTotal: number;
  totals: {
    workspaces: number;
    agents: number;
    runningAgents: number;
    requestedAgents: number;
    launchedAgents?: number;
    liveRuns: number;
    activeWork: number;
    blocked: number;
    stale: number;
    openCards: number;
    sessions: number;
  };
  runner: {
    queuePath: string;
    command: string;
    pending: number;
    launched: number;
    done?: number;
    failed: number;
    blocked?: number;
    noop?: number;
    cancelled?: number;
    active: number;
    total: number;
    canDispatch: boolean;
    latest: {
      id: string;
      companyId: string;
      agentId: string;
      status: string;
      updatedAt: string;
    } | null;
  };
  companies: SpliceWorkspace[];
  requests: SpliceAgentRunRequest[];
}

export interface SpliceTestWorkspaceSummary {
  id: string;
  name: string;
  path: string;
  kind: string;
  source: string;
  available: boolean;
  totals: SpliceWorkspaceRoomData["totals"] | null;
  workspaceBinding: SpliceWorkspaceRoomData["workspaceBinding"] | null;
}

export interface SpliceTestWorkspacesData {
  generatedAt: string;
  workspaces: SpliceTestWorkspaceSummary[];
}

export interface SpliceRunnerDispatch {
  status: "runner_dispatched" | "dry_run_dispatched" | string;
  pid: number | null;
  dryRun: boolean;
  pending: number;
  requestId: string;
  runner: SpliceOverviewData["runner"];
}

export interface SpliceRunMonitorData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  queuePath: string;
  runner: SpliceOverviewData["runner"];
  counts: {
    total: number;
    active: number;
    requested: number;
    launchReady: number;
    launched: number;
    done: number;
    failed: number;
    blocked: number;
    noop: number;
    cancelled: number;
    expired: number;
    terminal: number;
  };
  runs: SpliceAgentRunRequest[];
}

export interface SpliceRunStatusPost {
  run: SpliceAgentRunRequest | null;
}

export interface SpliceRunArtifact {
  path: string | null;
  exists: boolean;
  readable: boolean;
  size: number;
  updatedAt: string | null;
  text: string;
  truncated: boolean;
  mode: "none" | "full" | "tail" | string;
  error?: string;
}

export interface SpliceRunDetailData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  run: SpliceAgentRunRequest;
  artifacts: {
    prompt: SpliceRunArtifact;
    output: SpliceRunArtifact;
  };
  related: {
    comments: SpliceWorkThreadComment[];
    messages: SpliceAgentMessage[];
    workOrders: SpliceWorkOrder[];
    workProducts: SpliceWorkProduct[];
    routineRuns: SpliceOfficeRoutineRun[];
  };
}

export interface SpliceAgentMessage {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  agentId: string;
  agentName: string;
  author: "operator" | "agent" | string;
  kind: "instruction" | "message" | "reply" | string;
  body: string;
  status: "queued" | "sent" | "done" | "noop" | "blocked" | "failed" | "cancelled" | string;
  createdAt: string;
  updatedAt: string;
  runRequestId: string | null;
  replyToMessageId?: string | null;
  sourceRunRequestId?: string | null;
  workOrderId?: string | null;
  workOrderTitle?: string | null;
  runStatus?: string | null;
  settledAt?: string | null;
  verdict?: SpliceRunRuntime["verdict"] | null;
  error?: string | null;
  queue?: {
    store: string;
    path: string;
  };
}

export interface SpliceAgentMessagesData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  queuePath: string;
  messages: SpliceAgentMessage[];
}

export interface SpliceAgentMessagePost {
  message: SpliceAgentMessage;
  runRequest: SpliceAgentRunRequest;
  workOrder?: SpliceWorkOrder | null;
}

export interface SpliceWorkThreadEntry {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  itemType: "project" | "issue" | string;
  itemId: string;
  itemTitle: string;
  ownerName: string;
  author: "operator" | "agent" | string;
  status: "posted" | "saved" | "done" | "failed" | string;
  createdAt: string;
  updatedAt: string;
  runRequestId?: string | null;
  sourceRunRequestId?: string | null;
  agentId?: string | null;
  agentName?: string | null;
  runStatus?: string | null;
  settledAt?: string | null;
  verdict?: SpliceRunRuntime["verdict"] | null;
  workOrderId?: string | null;
  workOrderTitle?: string | null;
  sourceCommentId?: string | null;
  reviewId?: string | null;
  reviewDecisionId?: string | null;
  queue?: {
    store: string;
    path: string;
  };
}

export interface SpliceWorkThreadComment extends SpliceWorkThreadEntry {
  body: string;
}

export interface SpliceWorkProduct extends SpliceWorkThreadEntry {
  kind: string;
  title: string;
  body: string;
}

export interface SpliceWorkThreadData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  queuePath: string;
  comments: SpliceWorkThreadComment[];
  workProducts: SpliceWorkProduct[];
}

export interface SpliceWorkThreadCommentPost {
  comment: SpliceWorkThreadComment;
  runRequest?: SpliceAgentRunRequest | null;
}

export interface SpliceWorkProductPost {
  workProduct: SpliceWorkProduct;
}

export interface SpliceReviewDecision {
  id: string;
  reviewId: string;
  workspaceId: string;
  workspaceName: string;
  itemType: "project" | "issue" | string;
  itemId: string;
  itemTitle: string;
  author: "operator" | "agent" | string;
  decision: "approved" | "changes_requested" | "rejected" | string;
  body: string;
  resultingStatus: string;
  createdAt: string;
  sourceWorkProductId?: string | null;
  sourceRunRequestId?: string | null;
  runRequestId?: string | null;
  queue?: {
    store: string;
    path: string;
  };
}

export interface SpliceReview {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  itemType: "project" | "issue" | string;
  itemId: string;
  itemTitle: string;
  ownerName: string;
  requester: "operator" | "agent" | string;
  reviewerAgentId: string | null;
  reviewerAgentName: string | null;
  title: string;
  body: string;
  status: "requested" | "approved" | "changes_requested" | "rejected" | string;
  createdAt: string;
  updatedAt: string;
  decidedAt?: string | null;
  decidedBy?: string | null;
  sourceWorkProductId?: string | null;
  sourceWorkProductTitle?: string | null;
  sourceRunRequestId?: string | null;
  decisions: SpliceReviewDecision[];
  queue?: {
    store: string;
    path: string;
  };
}

export interface SpliceReviewGateData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  queuePath: string;
  reviews: SpliceReview[];
  decisions: SpliceReviewDecision[];
}

export interface SpliceReviewPost {
  review: SpliceReview;
}

export interface SpliceReviewDecisionPost {
  review: SpliceReview | null;
  decision: SpliceReviewDecision;
  runRequest?: SpliceAgentRunRequest | null;
}

export interface SpliceInboxItem {
  id: string;
  kind: "review" | "run" | "message" | "blocked" | string;
  severity: "low" | "medium" | "high" | string;
  title: string;
  subtitle: string;
  body: string;
  sourceId: string;
  sourceStatus: string;
  actorName: string;
  createdAt: string;
  targetTab: string;
  targetType: string;
  targetId: string;
  inboxStatus: "open" | "done" | string;
  acknowledgedAt: string | null;
}

export interface SpliceOfficeInboxData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  queuePath: string;
  counts: {
    total: number;
    open: number;
    done: number;
    reviews: number;
    runs: number;
    messages: number;
    approvals?: number;
    workOrders?: number;
    blocked: number;
  };
  items: SpliceInboxItem[];
}

export interface SpliceOfficeInboxStatusPost {
  action: {
    workspaceId: string;
    workspaceName: string;
    itemId: string;
    status: "open" | "done" | string;
    actor: string;
    updatedAt: string;
  };
}

export interface SpliceOfficeRoutine {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  agentId: string;
  agentName: string;
  agentRole: string;
  title: string;
  kind: "heartbeat" | string;
  enabled: boolean;
  intervalMinutes: number;
  cadenceLabel: string;
  queuePath: string;
  description: string;
  state: "due" | "scheduled" | "paused" | string;
  due: boolean;
  lastRunAt: string | null;
  nextRunAt: string;
  lastRunRequestId: string | null;
  runCount: number;
  createdAt: string;
  updatedAt: string | null;
}

export interface SpliceOfficeRoutineRun {
  id: string;
  workspaceId: string;
  workspaceName: string;
  routineId: string;
  routineTitle: string;
  agentId: string;
  agentName: string;
  status: "requested" | "launched" | "failed" | string;
  createdAt: string;
  runRequestId: string;
}

export interface SpliceOfficeRoutinesData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  queuePaths: {
    routines: string;
    runRequests: string;
  };
  counts: {
    total: number;
    enabled: number;
    due: number;
    paused: number;
    runs: number;
  };
  routines: SpliceOfficeRoutine[];
  runs: SpliceOfficeRoutineRun[];
}

export interface SpliceOfficeRoutineSettingPost {
  setting: {
    workspaceId: string;
    workspaceName: string;
    routineId: string;
    enabled: boolean;
    intervalMinutes: number;
    updatedAt: string;
  };
  routine: SpliceOfficeRoutine | null;
}

export interface SpliceOfficeRoutineRunPost {
  routine: SpliceOfficeRoutine | null;
  routineRun: SpliceOfficeRoutineRun;
  runRequest: SpliceAgentRunRequest;
}

export interface SpliceOfficeApprovalDecision {
  id: string;
  approvalId: string;
  workspaceId: string;
  workspaceName: string;
  agentId: string | null;
  agentName: string | null;
  author: "operator" | "agent" | string;
  decision: "approved" | "changes_requested" | "rejected" | string;
  body: string;
  createdAt: string;
  queue?: {
    store: string;
    path: string;
  };
}

export interface SpliceOfficeApproval {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  agentId: string | null;
  agentName: string | null;
  requester: "operator" | "agent" | string;
  kind: string;
  title: string;
  body: string;
  status: "requested" | "approved" | "changes_requested" | "rejected" | string;
  createdAt: string;
  updatedAt: string;
  decidedAt: string | null;
  decidedBy: string | null;
  decisions: SpliceOfficeApprovalDecision[];
  queue?: {
    store: string;
    path: string;
  };
}

export interface SpliceOfficeApprovalsData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  queuePath: string;
  counts: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    changesRequested: number;
  };
  approvals: SpliceOfficeApproval[];
  decisions: SpliceOfficeApprovalDecision[];
}

export interface SpliceOfficeApprovalPost {
  approval: SpliceOfficeApproval;
}

export interface SpliceOfficeApprovalDecisionPost {
  approval: SpliceOfficeApproval | null;
  decision: SpliceOfficeApprovalDecision;
  runRequest: SpliceAgentRunRequest | null;
}

export interface SpliceOfficeTimelineEvent {
  id: string;
  kind: "run" | "message" | "comment" | "work_product" | "review" | "review_decision" | "approval" | "approval_decision" | "routine" | "work" | string;
  title: string;
  subtitle: string;
  body: string;
  actorName: string;
  status: string;
  createdAt: string;
  targetTab: string;
  targetType: string;
  targetId: string;
  severity: "low" | "medium" | "high" | string;
}

export interface SpliceOfficeTimelineData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  counts: {
    total: number;
    runs: number;
    messages: number;
    approvals: number;
    reviews: number;
    routines: number;
    workOrders?: number;
    work: number;
    signals: number;
  };
  events: SpliceOfficeTimelineEvent[];
}

export interface SpliceWorkOrder {
  id: string;
  workspaceId: string;
  workspaceName: string;
  workspacePath: string;
  title: string;
  body: string;
  status: "requested" | "queued" | "in_progress" | "review" | "done" | "blocked" | "failed" | "cancelled" | string;
  priority: "low" | "medium" | "high" | "urgent" | string;
  agentId: string | null;
  agentName: string | null;
  projectId: string | null;
  projectName: string | null;
  requester: "operator" | string;
  createdAt: string;
  updatedAt: string;
  runRequestId: string | null;
  sourceMessageId?: string | null;
  runStatus?: string | null;
  settledAt?: string | null;
  verdict?: SpliceRunRuntime["verdict"] | null;
  error?: string | null;
  queue?: {
    store: string;
    path: string;
  };
}

export interface SpliceWorkOrdersData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  queuePath: string;
  counts: {
    total: number;
    open: number;
    requested: number;
    queued: number;
    inProgress: number;
    blocked: number;
    done: number;
    failed: number;
    cancelled: number;
  };
  workOrders: SpliceWorkOrder[];
}

export interface SpliceWorkOrderPost {
  workOrder: SpliceWorkOrder;
  runRequest: SpliceAgentRunRequest | null;
}

export interface SpliceWorkOrderStatusPost {
  workOrder: SpliceWorkOrder | null;
  runRequest: SpliceAgentRunRequest | null;
}

export interface SpliceWorkspaceRoomWorkItem {
  id: string;
  identifier: string;
  type: "project" | "issue";
  title: string;
  summary: string | null;
  status: string;
  bucket: "active" | "review" | "todo" | "blocked" | "done" | "archived" | string;
  progressWeight: number;
  ownerSlug: string | null;
  ownerName: string;
  projectSlug: string | null;
  projectName: string;
  priority: string | null;
  stage: string | null;
  goalSlug: string | null;
  goalName: string | null;
  ageMin: number | null;
  description: string | null;
}

export interface SpliceWorkspaceRoomProject extends SpliceWorkspaceRoomWorkItem {
  progress: number;
  issueCounts: {
    active: number;
    review: number;
    todo: number;
    blocked: number;
    done: number;
    archived: number;
  };
  issueTotal: number;
}

export interface SpliceWorkspaceRoomActor {
  id: string;
  slug: string;
  name: string;
  initials: string;
  role: string;
  state: "working" | "assigned" | "reviewing" | "requested" | "queued" | "idle" | "blocked" | "present" | "away" | string;
  zone: string;
  x: number;
  y: number;
  currentWork: SpliceWorkspaceRoomWorkItem[];
  activeCount: number;
  reviewCount: number;
  queuedCount: number;
  request?: SpliceAgentRunRequest | null;
  session?: {
    branch: string;
    dirty: number;
    path: string;
    projectPath?: string;
    manager?: string;
    lastCommit: { sha?: string; msg?: string; ageMin?: number } | null;
  } | null;
}

export interface SpliceAgentConsoleAgent extends SpliceWorkspaceRoomActor {
  requests: SpliceAgentRunRequest[];
  messages: SpliceAgentMessage[];
  workOrders: SpliceWorkOrder[];
  lastEventAt: string | null;
}

export interface SpliceAgentConsoleData {
  generatedAt: string;
  workspaceId: string;
  workspaceName: string;
  queuePaths: {
    runRequests: string;
    messages: string;
    workOrders?: string;
  };
  agents: SpliceAgentConsoleAgent[];
  requests: SpliceAgentRunRequest[];
  messages: SpliceAgentMessage[];
  workOrders?: SpliceWorkOrder[];
}

export interface SpliceWorkspaceRoomGoal {
  slug: string;
  kind: "mission" | "vision" | "objective" | "key_result" | "goal" | string;
  level: string | null;
  name: string;
  status: string;
  parentGoalSlug: string | null;
  identifier: string | null;
  description: string | null;
}

export interface SpliceExecutionLane {
  id: string;
  name: string;
  kind: "main" | "worktree" | "codex" | "claude" | "conductor" | "agent" | string;
  kindLabel: string;
  copyKind: "root" | "worktree" | "clone" | string;
  copyKindLabel: string;
  manager: "local" | "codex" | "claude" | "conductor" | "splice" | "git" | string;
  managerLabel: string;
  state: "idle" | "active" | "dirty" | "ahead" | "queued" | "running" | "stale" | string;
  projectSpaceId: string;
  projectSpaceName: string;
  path: string;
  shortPath: string;
  projectPath: string;
  projectShortPath: string;
  projectPresent: boolean;
  repositoryRoot: string;
  branch: string;
  isMain: boolean;
  dirty: number;
  ahead: number;
  behind: number;
  lastCommit: { sha?: string; msg?: string; ageMin?: number } | null;
  requestCount: number;
  activeRequestCount: number;
  queuedRunCount: number;
  liveRunCount: number;
  actors: Array<{
    id: string;
    name: string;
    kind: "human" | "agent" | string;
    state: string;
  }>;
}

export interface SpliceWorkspaceRoomData {
  generatedAt: string;
  id: string;
  name: string;
  mode: "single-workspace-live-room";
  path: string;
  shortPath: string;
  dataSource: string;
  workspaceBinding: {
    mode: "embedded" | "standalone" | string;
    repositoryRoot: string;
    projectRelativePath: string;
    projectPath: string;
  };
  objective: SpliceWorkspaceRoomGoal | null;
  goals: SpliceWorkspaceRoomGoal[];
  totals: {
    projects: number;
    archivedProjects: number;
    activeProjects: number;
    issues: number;
    archivedIssues: number;
    activeIssues: number;
    reviewIssues: number;
    todoIssues: number;
    blockedIssues: number;
    doneIssues: number;
    agents: number;
    activeAgents: number;
    runningAgents: number;
    assignedAgents: number;
    progress: number;
    agentOwned: number;
    humanOwned: number;
    liveRuns: number;
    requests: number;
    executionLanes?: number;
    activeExecutionLanes?: number;
  };
  buckets: {
    active: number;
    review: number;
    todo: number;
    blocked: number;
    done: number;
    archived: number;
  };
  room: {
    zones: Array<{ id: string; label: string; x: number; y: number; workCount: number }>;
    agents: SpliceWorkspaceRoomActor[];
    humans: SpliceWorkspaceRoomActor[];
  };
  lanes: {
    active: SpliceWorkspaceRoomWorkItem[];
    review: SpliceWorkspaceRoomWorkItem[];
    next: SpliceWorkspaceRoomWorkItem[];
    blocked: SpliceWorkspaceRoomWorkItem[];
  };
  projects: SpliceWorkspaceRoomProject[];
  archivedProjects: SpliceWorkspaceRoomProject[];
  archivedIssues: SpliceWorkspaceRoomWorkItem[];
  agents: SpliceWorkspaceRoomActor[];
  executionLanes: SpliceExecutionLane[];
  activity: Array<{
    id: string;
    type: "project" | "issue";
    title: string;
    status: string;
    ownerName: string;
    ageMin: number | null;
  }>;
  requests: SpliceAgentRunRequest[];
}

export const spliceApi = {
  overview: () => api.get<SpliceOverviewData>("/splice/overview"),
  testWorkspaces: () => api.get<SpliceTestWorkspacesData>("/splice/test-workspaces"),
  workspaceRoom: (workspaceId: string) =>
    api.get<SpliceWorkspaceRoomData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/room`),
  workspaceRoomTimeline: (workspaceId: string) =>
    api.get<SpliceOfficeTimelineData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/timeline`),
  workspaceRoomWorkOrders: (workspaceId: string) =>
    api.get<SpliceWorkOrdersData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/work-orders`),
  createWorkspaceRoomWorkOrder: (
    workspaceId: string,
    input: { title: string; body: string; agentId?: string | null; projectId?: string | null; priority?: string; wakeAgent?: boolean },
  ) =>
    api.post<SpliceWorkOrderPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/work-orders`,
      input,
    ),
  updateWorkspaceRoomWorkOrderStatus: (
    workspaceId: string,
    workOrderId: string,
    input: { status: string; wakeAgent?: boolean },
  ) =>
    api.post<SpliceWorkOrderStatusPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/work-orders/${encodeURIComponent(workOrderId)}/status`,
      input,
    ),
  puzzleRoom: () => api.get<SpliceWorkspaceRoomData>("/splice/puzzle-room"),
  runAgent: (companyId: string, agentId: string) =>
    api.post<SpliceAgentRunRequest>(
      `/splice/companies/${encodeURIComponent(companyId)}/agents/${encodeURIComponent(agentId)}/run`,
      {},
    ),
  runPuzzleAgent: (agentId: string) =>
    api.post<SpliceAgentRunRequest>(
      `/splice/puzzle-room/agents/${encodeURIComponent(agentId)}/run`,
      {},
    ),
  runWorkspaceRoomAgent: (workspaceId: string, agentId: string) =>
    api.post<SpliceAgentRunRequest>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/agents/${encodeURIComponent(agentId)}/run`,
      {},
    ),
  workspaceRoomMessages: (workspaceId: string) =>
    api.get<SpliceAgentMessagesData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/messages`),
  workspaceRoomAgentConsole: (workspaceId: string) =>
    api.get<SpliceAgentConsoleData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/agent-console`),
  workspaceRoomRuns: (workspaceId: string) =>
    api.get<SpliceRunMonitorData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/runs`),
  workspaceRoomRunDetail: (workspaceId: string, runId: string) =>
    api.get<SpliceRunDetailData>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/runs/${encodeURIComponent(runId)}`,
    ),
  updateWorkspaceRoomRunStatus: (
    workspaceId: string,
    runId: string,
    input: { status: string; error?: string; note?: string },
  ) =>
    api.post<SpliceRunStatusPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/runs/${encodeURIComponent(runId)}/status`,
      input,
    ),
  workspaceRoomInbox: (workspaceId: string) =>
    api.get<SpliceOfficeInboxData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/inbox`),
  updateWorkspaceRoomInboxStatus: (workspaceId: string, itemId: string, status: "open" | "done") =>
    api.post<SpliceOfficeInboxStatusPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/inbox/${encodeURIComponent(itemId)}/status`,
      { status },
    ),
  workspaceRoomRoutines: (workspaceId: string) =>
    api.get<SpliceOfficeRoutinesData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/routines`),
  updateWorkspaceRoomRoutine: (
    workspaceId: string,
    routineId: string,
    input: { enabled?: boolean; intervalMinutes?: number },
  ) =>
    api.post<SpliceOfficeRoutineSettingPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/routines/${encodeURIComponent(routineId)}/toggle`,
      input,
    ),
  runWorkspaceRoomRoutine: (workspaceId: string, routineId: string) =>
    api.post<SpliceOfficeRoutineRunPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/routines/${encodeURIComponent(routineId)}/run`,
      {},
    ),
  workspaceRoomApprovals: (workspaceId: string) =>
    api.get<SpliceOfficeApprovalsData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/approvals`),
  createWorkspaceRoomApproval: (
    workspaceId: string,
    input: { agentId?: string | null; kind: string; title: string; body: string },
  ) =>
    api.post<SpliceOfficeApprovalPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/approvals`,
      input,
    ),
  createWorkspaceRoomApprovalDecision: (
    workspaceId: string,
    approvalId: string,
    input: { decision: "approved" | "changes_requested" | "rejected"; body: string; wakeAgent?: boolean },
  ) =>
    api.post<SpliceOfficeApprovalDecisionPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/approvals/${encodeURIComponent(approvalId)}/decision`,
      input,
    ),
  sendWorkspaceRoomMessage: (workspaceId: string, agentId: string, body: string) =>
    api.post<SpliceAgentMessagePost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/messages`,
      { agentId, body, createWorkOrder: true },
    ),
  workspaceRoomWorkThread: (workspaceId: string) =>
    api.get<SpliceWorkThreadData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/work-thread`),
  createWorkspaceRoomComment: (workspaceId: string, input: { itemType: string; itemId: string; body: string; wakeAgent?: boolean; sourceRunRequestId?: string | null }) =>
    api.post<SpliceWorkThreadCommentPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/work-thread/comments`,
      input,
    ),
  createWorkspaceRoomWorkProduct: (
    workspaceId: string,
    input: { itemType: string; itemId: string; title: string; body: string; kind?: string },
  ) =>
    api.post<SpliceWorkProductPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/work-thread/work-products`,
      input,
    ),
  workspaceRoomReviews: (workspaceId: string) =>
    api.get<SpliceReviewGateData>(`/splice/workspaces/${encodeURIComponent(workspaceId)}/reviews`),
  createWorkspaceRoomReview: (
    workspaceId: string,
    input: { itemType: string; itemId: string; title: string; body: string; reviewerAgentId?: string | null; sourceWorkProductId?: string | null },
  ) =>
    api.post<SpliceReviewPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/reviews`,
      input,
    ),
  createWorkspaceRoomReviewDecision: (
    workspaceId: string,
    reviewId: string,
    input: { decision: "approved" | "changes_requested" | "rejected"; body: string; wakeAgent?: boolean },
  ) =>
    api.post<SpliceReviewDecisionPost>(
      `/splice/workspaces/${encodeURIComponent(workspaceId)}/reviews/${encodeURIComponent(reviewId)}/decision`,
      input,
    ),
  dispatchRunner: (dryRun = false) =>
    api.post<SpliceRunnerDispatch>(`/splice/runner/dispatch${dryRun ? "?dryRun=1" : ""}`, {}),
};
