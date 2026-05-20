import { useHostNavigation, type PluginPageProps, type PluginSidebarProps } from "@paperclipai/plugin-sdk/ui";

// fork_mangoclaw: pure read-only catalog pages — no fetches, no state.
// Source data mirrors packages/shared/src/constants.ts (AGENT_ROLES). Keep this
// file's role list aligned with that constants file when new keys land.

interface RoleEntry {
  key: string;
  label: string;
  emoji: string;
  oneLine: string;
  doesWhat: string;
  bestFor: string;
  skipIf: string;
}

const ROLES: RoleEntry[] = [
  {
    key: "ceo",
    label: "CEO",
    emoji: "👔",
    oneLine: "의사결정 보좌 · OKR/Inbox 라우팅 · 전체 조망",
    doesWhat:
      "인간 CEO 의 결정 사이 빈 시간을 메움. Inbox 분류, 위임, OKR 상태 점검, 회사 공통 룰 유지. 본인이 직접 결정하지 않음 — 인간이 결정만 빠르게 하면 되는 상태를 만든다.",
    bestFor: "회사당 1명 필수. 다른 agent 들의 supervisor 역할.",
    skipIf: "회사에 agent 가 1명뿐이면 굳이 CEO 만들지 말고 그 1명이 모든 걸 함.",
  },
  {
    key: "cto",
    label: "CTO",
    emoji: "🏗️",
    oneLine: "기술 전략 · 아키텍처 결정 · 기술 부채 관리",
    doesWhat:
      "스택 선택, 라이브러리 도입/제거, 모듈 경계 설계, 성능·보안 트레이드오프 판정. engineer 들에게 \"무엇을 만들지\" 가 아니라 \"어떻게 만들지\" 의 큰 그림을 줌.",
    bestFor: "engineer 2명 이상이거나, 아키텍처 결정이 자주 발생하는 단계.",
    skipIf: "MVP 단계 1인 engineer 만 있을 때는 CEO 가 겸함.",
  },
  {
    key: "cmo",
    label: "CMO",
    emoji: "📣",
    oneLine: "마케팅 전략 · 콘텐츠 기획 · 브랜드 톤",
    doesWhat:
      "GTM(go-to-market) 전략, 채널 선택, 콘텐츠 캘린더, 브랜드 보이스. 실제 콘텐츠는 writer/designer 가 만들고 CMO 는 방향과 검수.",
    bestFor: "마케팅·홍보·콘텐츠 대량 생산 단계. 사용자 획득 시작 시점.",
    skipIf: "아직 제품을 만드는 중이고 외부 노출 없으면 불필요.",
  },
  {
    key: "cfo",
    label: "CFO",
    emoji: "💰",
    oneLine: "재무 모델 · 예산 · LTV/CAC 계산",
    doesWhat:
      "수익 모델 시뮬레이션, runway 계산, 비용 항목 점검, 가격 정책 분석. 회계가 아니라 의사결정용 숫자.",
    bestFor: "수익화 단계 또는 외부 자금 검토 단계.",
    skipIf: "Pre-revenue · 솔로 자금 단계는 spreadsheet 직접 다루는 게 빠름.",
  },
  {
    key: "security",
    label: "Security",
    emoji: "🛡️",
    oneLine: "보안 감사 · 취약점 점검 · secret 관리",
    doesWhat:
      "코드 보안 리뷰, dependency CVE 점검, secret leak 스캔, 권한 모델 검수. 위협 모델링.",
    bestFor: "외부 사용자 데이터를 받기 시작하는 단계. PII·결제·인증 도입 시점.",
    skipIf: "로컬 개발 단계 또는 외부 노출 0 인 상태.",
  },
  {
    key: "engineer",
    label: "Engineer",
    emoji: "🔧",
    oneLine: "코드 작성 · 구현 · 디버깅 · 테스트",
    doesWhat:
      "기능 구현, 버그 수정, 리팩터링, 단위 테스트 작성. PaperClip 에서 가장 흔하고 가장 일 많이 하는 역할.",
    bestFor: "모든 회사 — 1명 이상 거의 필수. 백엔드·프론트·풀스택 구분은 SOUL.md 에서 명시.",
    skipIf: "코드 작성 0 인 회사 (콘텐츠 전용 회사)면 불필요.",
  },
  {
    key: "designer",
    label: "Designer",
    emoji: "🎨",
    oneLine: "UI/UX 디자인 · 시각 · 콘텐츠 구조",
    doesWhat:
      "와이어프레임, 컴포넌트 디자인, 톤·컬러 가이드, 정보 구조. 실제 코드 구현은 engineer 가 받아 처리.",
    bestFor: "사용자 인터페이스가 있는 제품. 출시 직전 정돈 단계.",
    skipIf: "백엔드 전용 또는 CLI 도구 등 GUI 없는 제품.",
  },
  {
    key: "pm",
    label: "PM",
    emoji: "📋",
    oneLine: "일정 · 우선순위 · 이슈 grooming · 릴리즈",
    doesWhat:
      "백로그 정리, sprint 계획, 의존성 추적, 릴리즈 노트 작성. CEO 의 OKR 을 issue 단위로 쪼개는 역할.",
    bestFor: "기능 여러 개 동시 진행 · 외부 의존성 많은 단계.",
    skipIf: "솔로 + agent 1-2명이면 CEO 가 겸함.",
  },
  {
    key: "qa",
    label: "QA",
    emoji: "🔍",
    oneLine: "테스트 · 검수 · 회귀 검사 · 버그 리포트",
    doesWhat:
      "수동·자동 테스트, edge case 발굴, 회귀 시나리오 유지, 사용자 시점 검증. engineer 가 작성한 코드를 외부 시각으로 한 번 더 봄.",
    bestFor: "출시 직전 또는 안정성 중요한 단계 (결제·인증·데이터).",
    skipIf: "프로토타입 단계 — engineer 가 자체 테스트로 커버.",
  },
  {
    key: "devops",
    label: "DevOps",
    emoji: "🚀",
    oneLine: "배포 · 인프라 · CI/CD · 모니터링",
    doesWhat:
      "Docker, CI 파이프라인, 배포 스크립트, 로그·메트릭 수집, 장애 대응 자동화. engineer 가 만든 걸 안정적으로 굴러가게 함.",
    bestFor: "운영 중인 서비스. 트래픽 발생 단계.",
    skipIf: "로컬 개발 단계.",
  },
  {
    key: "researcher",
    label: "Researcher",
    emoji: "🔬",
    oneLine: "시장 조사 · 기술 조사 · 논문 요약 · 자료 수집",
    doesWhat:
      "외부 자료(웹·논문·문서) 수집 및 요약, 경쟁사 분석, 기술 비교표 작성. 결정 직전에 근거가 필요할 때 호출.",
    bestFor: "신규 영역 진입, 라이브러리 선택, 기능 의사결정 직전.",
    skipIf: "이미 잘 아는 영역만 만지는 단계.",
  },
  {
    key: "general",
    label: "General",
    emoji: "🪛",
    oneLine: "범용 — 위 역할에 안 맞는 잡일",
    doesWhat:
      "특정 직무에 안 묶이는 임시 작업. \"이건 어디 역할이지?\" 싶을 때 임시로 부여.",
    bestFor: "테스트 agent, 실험용 1회성 agent, 또는 역할이 모호한 초기 단계.",
    skipIf: "오래 쓸 agent 라면 적절한 직무로 재지정.",
  },
];

const STAGE_GUIDE: { stage: string; team: string; note: string }[] = [
  {
    stage: "단계 1 — 발상 · 프로토타입",
    team: "CEO + Engineer",
    note: "최소 구성. CEO 가 PM/CTO 겸함. Researcher 는 필요시 호출.",
  },
  {
    stage: "단계 2 — MVP · 알파",
    team: "+ Designer + Researcher",
    note: "UI 가 생기면 Designer, 의사결정 자주 필요하면 Researcher.",
  },
  {
    stage: "단계 3 — 베타 · 외부 노출",
    team: "+ QA + DevOps + Security",
    note: "외부 사용자 데이터 다루기 시작하면 Security 필수.",
  },
  {
    stage: "단계 4 — 성장 · 수익화",
    team: "+ CMO + CFO + PM + CTO",
    note: "규모 커지면서 직무 세분화. 1인 겸직 풀어내기.",
  },
];

const tokens = {
  pageBg: "#0b0b0e",
  cardBg: "#0f0f12",
  cardBorder: "#2d2d35",
  cardBorderHover: "#3d3d48",
  text: "#eee",
  textDim: "#aaa",
  textMute: "#777",
  accentBg: "#1a1a20",
};

const box: React.CSSProperties = {
  border: `1px solid ${tokens.cardBorder}`,
  borderRadius: 8,
  padding: 16,
  background: tokens.cardBg,
};

const card: React.CSSProperties = {
  ...box,
  display: "grid",
  gap: 10,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 10,
  opacity: 0.55,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  marginBottom: 2,
};

export function AgentRolesPage(_props: PluginPageProps) {
  return (
    <div style={{ maxWidth: 1080, display: "grid", gap: 24, padding: 20, color: tokens.text }}>
      <header style={{ display: "grid", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>📚</span>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Agent Roles</h2>
          <span
            style={{
              fontSize: 10,
              padding: "2px 8px",
              borderRadius: 999,
              background: tokens.accentBg,
              color: tokens.textDim,
              border: `1px solid ${tokens.cardBorder}`,
              letterSpacing: "0.05em",
            }}
          >
            CATALOG · 12 ITEMS
          </span>
        </div>
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: tokens.textDim, maxWidth: 720 }}>
          PaperClip 이 지원하는 agent 직무 카탈로그. 각 agent 의 <code>role</code> 필드 (Agent 상세 페이지
          또는 AGENTS.md frontmatter <code>role:</code>) 에 아래 키 중 하나를 넣으면 됨. 역할은 라벨일
          뿐 자동 동작 분기는 없음 — 실제 행동은 SOUL.md / AGENTS.md 가 결정.
        </p>
      </header>

      <div style={{ ...box, fontSize: 13, lineHeight: 1.7 }}>
        <div style={{ ...sectionLabel, marginBottom: 6 }}>고를 때 기준</div>
        <ul style={{ paddingLeft: 18, margin: 0 }}>
          <li>SOUL.md 의 페르소나와 AGENTS.md 의 직무 정의가 본질. role 은 분류 라벨.</li>
          <li>1명 agent 가 여러 직무 겸직 가능 — 가장 큰 비중인 직무를 골라 넣음.</li>
          <li>role 을 자주 바꾸지 말 것 — agent 정체성이 흔들림. 큰 변경은 새 agent 로.</li>
        </ul>
      </div>

      <section style={{ display: "grid", gap: 12 }}>
        <div style={sectionLabel}>역할 · {ROLES.length}</div>
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
          {ROLES.map((r) => (
            <article key={r.key} style={card}>
              <header style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span style={{ fontSize: 22 }}>{r.emoji}</span>
                <span style={{ fontSize: 16, fontWeight: 700 }}>{r.label}</span>
                <code
                  style={{
                    fontSize: 11,
                    color: tokens.textMute,
                    background: tokens.accentBg,
                    padding: "2px 6px",
                    borderRadius: 4,
                  }}
                >
                  {r.key}
                </code>
              </header>
              <div style={{ fontSize: 12.5, lineHeight: 1.5, opacity: 0.9 }}>{r.oneLine}</div>
              <div>
                <div style={sectionLabel}>하는 일</div>
                <div style={{ fontSize: 12, lineHeight: 1.6, opacity: 0.88 }}>{r.doesWhat}</div>
              </div>
              <div>
                <div style={sectionLabel}>적합</div>
                <div style={{ fontSize: 12, lineHeight: 1.6, opacity: 0.88 }}>{r.bestFor}</div>
              </div>
              <div>
                <div style={sectionLabel}>건너뛰어도 됨</div>
                <div style={{ fontSize: 12, lineHeight: 1.6, color: tokens.textMute }}>{r.skipIf}</div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div style={sectionLabel}>단계별 추천 구성</div>
        <div style={{ display: "grid", gap: 10 }}>
          {STAGE_GUIDE.map((s) => (
            <div key={s.stage} style={{ ...box, display: "grid", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{s.stage}</span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>{s.team}</span>
              </div>
              <div style={{ fontSize: 12, lineHeight: 1.5, color: tokens.textDim }}>{s.note}</div>
            </div>
          ))}
        </div>
      </section>

      <footer
        style={{
          ...box,
          fontSize: 11,
          color: tokens.textMute,
          lineHeight: 1.6,
        }}
      >
        출처: <code>AGENT_ROLES</code> in <code>packages/shared/src/constants.ts</code>.
        새 키 추가는 거기서 → 이 카탈로그도 같이 갱신 필요.
      </footer>
    </div>
  );
}

// ─── Sidebar links ──────────────────────────────────────────────────────────

function SidebarLink({ label, route, icon }: { label: string; route: string; icon: string }) {
  const nav = useHostNavigation();
  const href = nav.resolveHref(route);
  const isActive = typeof window !== "undefined" && window.location.pathname === href;
  const linkProps = nav.linkProps(route);
  return (
    <a
      {...linkProps}
      aria-current={isActive ? "page" : undefined}
      className={[
        "flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition-colors rounded-md",
        isActive
          ? "bg-accent text-foreground"
          : "text-foreground/80 hover:bg-accent/50 hover:text-foreground",
      ].join(" ")}
    >
      <span aria-hidden="true" style={{ width: 16, textAlign: "center" }}>{icon}</span>
      <span className="flex-1 truncate">{label}</span>
    </a>
  );
}

export function AgentRolesSidebarLink(_props: PluginSidebarProps) {
  return <SidebarLink label="Agent Roles" route="/catalog-agent-roles" icon="📚" />;
}
