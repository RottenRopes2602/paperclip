# Marketing Studio Starter

Use this optional starter when a new company or project produces social video,
product captures, motion graphics, or other media whose source, render, review,
and publication states must remain reproducible.

## What to copy

Copy `assets/marketing-studio/` into the generated company package, preserving its
relative layout:

```text
skills/marketing-studio/SKILL.md
projects/marketing-studio/PROJECT.md
projects/marketing-studio/tasks/bootstrap-studio/TASK.md
projects/marketing-studio/tasks/produce-first-episode/TASK.md
```

Attach `marketing-studio` to the agent that owns production. Replace:

- `{{studio-owner}}` with that agent's slug.
- `{{company-name}}` with the generated company name.
- `{{workspace-root}}` with a repo-relative, portable media workspace such as
  `_studio/marketing-studio`; never write an absolute local path into the package.

If the package already has a content or marketing project, merge the starter tasks
into that project instead of creating a duplicate project.

## Invariants to preserve

1. Git tracks production code, specs, manifests, and decision records. Large media
   lives in a shared workspace outside per-worktree output folders.
2. Every run gets its own worktree-keyed staging directory. Never render directly
   to a shared fixed filename.
3. Drafts remain cheap. A selection decision is the gate that requires a durable
   reason, evidence path, and reusable lesson.
4. A selected master and a published item are different states. Publication is
   true only when a platform URL is recorded.
5. Large media is represented in Git by a manifest containing relative path, byte
   size, and SHA-256; binaries are not silently committed.
6. New projects adapt naming and platform files, but keep the storage boundaries
   and lifecycle unchanged.

## Generated project contract

The project lifecycle is:

```text
context -> isolated run -> candidates -> selection memory -> master -> publication URL
```

The bootstrap task establishes the workspace layout, manifest format, episode
registry, decision-memory template, and layout check. The first-episode task
exercises checksums and a recorded selection decision. It must not claim
publication unless the real platform URL is available.

## Deliberately not included

The starter does not prescribe Remotion, p5.js, ffmpeg, a cloud drive, a social
platform, or a specific agent adapter. Add only tools the generated company really
uses. The storage and decision contracts are tool-independent.
