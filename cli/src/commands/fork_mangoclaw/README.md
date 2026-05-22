# `cli/src/commands/fork_mangoclaw/` — Fork-only CLI commands

이 폴더의 파일은 **PaperClip OSS upstream 에 없음**. Monday 의 fork (`mangoclaw666/paperclip`) 가 추가한 것.

## 안에 있는 것

| 파일 | 역할 |
|---|---|
| `ops.ts` | Top-level CLI 명령 (`paperclipai init` / `sync` / `add-agent`). slug-based upsert sync 호스팅 |
| `agent-templates.ts` | Baseline 4-file 템플릿 (leadership / default) TS 상수 |
| `_archive/` | 폐기된 코드/방향 보관 (2026-05-20: managed-mode instructions push) |

## `paperclipai sync` 가 하는 일 (2026-05-20 갱신)

| 동작 | 목적 |
|---|---|
| Company import / upsert | `_ops/agents/*/AGENTS.md` 보고 agent 신설·갱신 |
| Goals POST | `_ops/goals/*/GOAL.md` → DB goals upsert (slug 기반) |
| Projects POST | `_ops/projects/*/PROJECT.md` → DB projects upsert |
| Issues POST | `_ops/tasks/*/TASK.md` → DB issues upsert |
| Agent adapterConfig PATCH | cwd 를 workspace 로, legacy prompt template 제거 |
| **Agent instructions PATCH** | **`mode: "external"` + `rootPath: <workspace>/_ops/agents/<slug>/`** ← workspace 가 instructions truth |
| externalSource PATCH | 회사가 어느 워크스페이스에서 왔는지 DB 에 기록 |

→ **instructions 파일 자체를 push 하지 않음**. agent 가 workspace 의 파일을 직접 읽음. workspace 파일 수정 = 즉시 반영.

→ sync 명령의 진짜 가치 = **DB 데이터 upsert** (goals/projects/issues + externalSource).

## 폐기된 동작 (참고)

2026-05-20 이전 sync 는 agent instructions 파일들을 PaperClip 인스턴스 폴더로 일일이 PUT 했음 (managed mode). 헛수고였음 — PaperClip 이 처음부터 `instructionsBundleMode: "external"` 지원. 자세한 사연: `_archive/sync-managed-instructions-2026-05-20.md`

## 본체와의 관계

본체 (upstream) 의 `cli/src/index.ts` 가 이 폴더의 `registerProjectCommands` 를 import 해서 명령을 등록. `index.ts` 의 그 한 줄도 `// fork_mangoclaw:` 마커 박혀 있음.

## 인벤토리 / grep

```bash
grep -rn "fork_mangoclaw" cli/ server/ packages/ --include="*.ts" --include="*.sql"
```

→ fork 자체의 모든 변경 (이 폴더 + 본체 마커) 다 나옴.

## Upstream rebase 시

1. upstream 머지 후 `grep -rn "fork_mangoclaw"` 로 fork 위치 다 확인
2. conflict 거의 없음 (이 폴더는 upstream 이 안 건드림)
3. 본체 마커 있는 파일만 충돌 가능 — 그 위치 보고 manual merge

## 정식 머지 후보

언젠가 upstream 본체로 보낼 만한 부분:
- `ops.ts` 의 top-level `init`/`sync`/`add-agent` 명령
- `agent-templates.ts` 의 baseline 템플릿

업스트림 PR 보낼 때는 `fork_mangoclaw_` prefix·마커 다 떼고 깔끔하게 분리.
