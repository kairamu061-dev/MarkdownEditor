---
name: add-feature
description: Add a feature area or sub-item to docs/, then walk through the document-writing order that follows. Use when creating a new feature area or sub-item directory.
argument-hint: <path> (e.g. auth or auth/login)
allowed-tools: Bash
---

Run the following command:

```bash
bash "${CLAUDE_SKILL_DIR}/add-feature.sh" $ARGUMENTS
```

Report the result briefly, then state the following as the plan for what comes next.
Do not start writing the documents inside this skill — carry the plan out afterwards.

## What to do after scaffolding

1. **Write in this order: overview.md → spec.md → design.md.** Each one constrains the
   next, so do not write them in parallel or fill in headings speculatively.

2. **The moment spec.md is finished, evaluate the split rules** in `agent-rules.md`
   before touching design.md. This is the step most often skipped, and skipping it is
   expensive — once design.md and the code exist, splitting means rewriting both.

   Default is to split. Extract a sub-item if any of these hold:
   - it has its own screen, view, or UI surface
   - it has its own data definition or schema
   - it can be implemented and tested without the other units existing
   - a separate developer could work on it in parallel

   Integration is allowed only when **both**: neither half can be verified in
   isolation after splitting, **and** the code is roughly 1 class / 1 file.

   If it splits, run this skill again with the sub-item path (`<area>/<sub-item>`).
   The parent's design.md and tasks.md then hold only links to sub-items plus
   cross-cutting concerns — but keep the parent's overview.md and spec.md as they are.

3. **Write tasks.md, then begin implementing.**

4. **When implementation ends, close the loop:** update the status in tasks.md, and if
   the implementation ended up differing from design.md, **update design.md itself** and
   record the difference in dev-notes.md. A deviation recorded only in dev-notes leaves
   design.md stating something the code does not do.

5. **If a parent area gained a sub-item, add it to the parent's design.md and tasks.md,
   and to `docs/index.md`.** The scaffold does not backfill these links.

Commit as you go — per sub-item, or per document written. Do not batch unrelated changes.
