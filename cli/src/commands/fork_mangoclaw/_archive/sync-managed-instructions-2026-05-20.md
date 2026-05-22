# Archive: managed-mode instructions push (deprecated 2026-05-20)

> 보관용. 동작하지 않음. 참고만.

## 폐기 이유

`paperclipai sync` 의 agent instructions push 로직 (`ops.ts` line 727-762, 2026-05-20 이전).
이 코드는 PaperClip 의 `instructionsBundleMode: "managed"` 가정으로 짜인 것.

PaperClip 은 처음부터 `"external"` 모드를 지원했고, external 모드면 PaperClip 이 workspace 의 instructions 폴더를 **직접 source-of-truth 로 읽음**. 따라서 sync 가 파일을 일일이 PUT 할 이유가 없었음.

오늘 (2026-05-20) Director 가 14 cycle 동안 옛 HEARTBEAT.md 를 들고 헛돌이 + $21 낭비 후 발견. 모든 5 agent (ceo/engineer/architect/writer/editor) 를 external 로 전환하고 push 코드 제거.

## 대체 방안

```ts
// 새 sync 로직:
await ctx.api.patch(`/api/agents/${a.id}/instructions-bundle`, {
  mode: "external",
  rootPath: path.join(paperclipDir, "agents", inferredSlug),
  entryFile: "AGENTS.md",
  clearLegacyPromptTemplate: true,
});
// 끝. 파일 PUT 없음.
```

→ workspace 의 `_ops/agents/<slug>/AGENTS.md` 수정 = 즉시 PaperClip 이 읽음. sync 안 돌려도 됨.

## 옛 코드 (참고용)

```ts
// === fork_mangoclaw sync — managed-mode instructions push (DEPRECATED) ===
// 위치: cli/src/commands/fork_mangoclaw/ops.ts line 727-762
// 제거 시각: 2026-05-20

const dbAgentsRaw = await ctx.api.get<...>(`/api/companies/${companyId}/agents`) ?? [];
for (const a of dbAgentsRaw) {
  const inferredSlug = a.slug ?? (a.name ? a.name.trim().split(/\s+/).pop()?.toLowerCase() ?? "" : "");
  if (!inferredSlug) continue;
  try {
    const nextAdapterConfig = { ...(a.adapterConfig ?? {}), cwd: agentCwd };
    delete nextAdapterConfig.promptTemplate;
    delete nextAdapterConfig.bootstrapPromptTemplate;
    await ctx.api.patch(`/api/agents/${a.id}`, { adapterConfig: nextAdapterConfig });

    // ↓↓ 이 부분이 헛수고였음 — 매번 workspace 파일을 인스턴스로 복사 ↓↓
    const agentPrefix = `agents/${inferredSlug}/`;
    const agentFiles = Object.keys(filesDict).filter((k) => k.startsWith(agentPrefix) && k.toLowerCase().endsWith(".md"));
    let pushedFiles = 0;
    for (const key of agentFiles) {
      const raw = filesDict[key];
      const content = typeof raw === "string" ? raw : "";
      if (!content) continue;
      const relativePath = key.slice(agentPrefix.length);
      await ctx.api.put(`/api/agents/${a.id}/instructions-bundle/file`, {
        path: relativePath, content, clearLegacyPromptTemplate: true,
      });
      pushedFiles++;
    }
    console.log(`  ${inferredSlug}: cwd + ${pushedFiles} instructions file(s)`);
    // ↑↑ 헛수고 종료 ↑↑
  } catch (err) {
    ...
  }
}
```

## 교훈

- adapter 옵션 (`AgentInstructionsBundleMode = "managed" | "external"`) 같은 기본 enum 은 새 fork feature 만들기 전에 반드시 점검.
- "왜 매번 sync 가 필요한 구조인가?" 같은 기본 질문을 일찍 던질 것.
- PaperClip 의 default mode 가 곧 옳은 mode 라는 가정 금지.
