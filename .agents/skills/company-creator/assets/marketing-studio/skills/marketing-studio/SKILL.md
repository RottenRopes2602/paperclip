---
name: marketing-studio
description: Run reproducible media production with isolated renders, explicit selection memory, checksum manifests, and publication records.
---

# Marketing Studio

Use this skill for social video, product capture, motion, and other media work.

## Start

1. Read the project's quality baseline and the current episode brief.
2. Read at most three relevant prior selection-memory records.
3. Create a run directory under `{{workspace-root}}/_system/worktrees/<worktree-key>`.
4. Write all temporary renders, downloads, and captures only inside that run.

## Storage boundary

- Track source code, specs, registries, manifests, and decision memory in Git.
- Keep large inputs, candidates, captures, and masters under `{{workspace-root}}`.
- Never create per-checkout `out/` or `renders/` folders.
- Never overwrite a shared fixed filename; promote complete versioned runs.
- Record each durable media file by relative path, byte size, and SHA-256.

## Production lifecycle

1. Produce candidates without requiring a decision record.
2. When an owner selects a version, record intent, constraints, accepted and
   rejected reasons, evidence paths, and the rule worth carrying forward.
3. Promote the selected artifact to a versioned `masters/` location only after the
   decision record and manifest agree.
4. Record publication only after receiving the real external platform URL.
   Selection is not publication.

## Finish

- Catalog checksums and verify that recorded files exist.
- Run the project's layout check.
- Recover stale worktree payloads into an inbox; never delete the shared staging
  root wholesale.
- Leave the episode registry in an honest state: draft, selected, mastered, or
  published.
