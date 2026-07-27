---
name: Bootstrap Marketing Studio
assignee: {{studio-owner}}
project: marketing-studio
---

Create the repository-local Marketing Studio contract before producing media.

- Establish `{{workspace-root}}/library`, `inbox`, and `_system/worktrees` boundaries.
- Add an episode registry with explicit draft, selected, mastered, and published states.
- Add a quality baseline and a selection-memory template.
- Add a resource manifest using relative path, byte size, and SHA-256.
- Add a layout check that rejects media in checkout-local output folders and direct
  writes to shared fixed filenames.
- Document begin, catalog, recovery, finalize, and publish commands.

Done means a dry-run episode can move through isolated staging to a checksummed
candidate without committing a binary or claiming publication.
