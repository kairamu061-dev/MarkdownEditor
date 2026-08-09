# Agent Rules

This file defines the common development process and documentation standards for the project.
When given an implementation task, follow these rules to prepare documentation before starting.

---

## Workflow

### Starting a new feature
1. Create `docs/project_overview.md`, `docs/glossary.md`, and `docs/tags.md` if they do not exist
2. Run `/add-feature <feature-area>` to set up the directory, templates, and index.md at once
3. Write content in order: overview.md → spec.md → design.md
4. After writing spec.md, evaluate whether subdivision is needed per the split rules
5. If subdivision is needed, run `/add-feature <sub-item-path>`
6. Write content in tasks.md and begin implementation

Steps 3–6 are also spelled out by the `/add-feature` skill, which is where they actually
land at the right moment. Keep the two in sync when either changes.

### During implementation
7. Record decisions, issues, and changes in dev-notes.md as they occur
8. If skills, permissions, or information are lacking, record the request in dev-notes.md

### After implementation
9. Update the status in tasks.md
10. If the implementation deviates from the design, update design.md and record the diff in dev-notes.md

### Committing
- Commit after each logical unit of work (e.g. per sub-item completed, per doc section written)
- Do not batch multiple unrelated changes into a single commit

---

## Split Rules

**Default is to split. Extract any independently implementable unit into a sub-item immediately.**

### Criteria for splitting

Split if any of the following apply:

- Has its own screen, view, or UI surface
- Has its own data definition or schema
- Can be implemented and tested without the other units existing
- A separate developer could work on it in parallel

### Exception — do NOT make it a sub-item when all of these hold

- It adds **one** new source file
- It has **no** UI surface of its own
- It has **no** data definition or schema of its own

Write it as a section of the parent's documents instead. This is a test, not a judgement
call — check the three and act on the answer.

This exception was under-applied: `editor/code-highlight` is 65 lines in one file with no
surface or schema of its own, and it became a sub-item carrying six documents totalling
188 lines. Documentation should not outweigh the code it describes by 3x.

### Document set

A sub-item that clears the exception but is still small takes a reduced set — three
documents instead of six:

| | Documents | When |
|---|---|---|
| Full | overview / spec / design / tasks / test-cases / dev-notes | Default |
| Small (`/add-feature --small <path>`) | overview / design / dev-notes | One new source file, and no UI surface or schema of its own beyond what the exception above already allows |

In the small set, overview.md absorbs the behaviour and the task list, and test cases go
into the **parent's** test-cases.md. design.md stays in both sets — it is the file the
mechanical drift checks read.

Small is not the default for anything that merely feels minor. Ask the exception question
first (should this be a sub-item at all), and reach for `--small` only for what survives it.
If the behaviour section grows into screen transitions or a state table, it was never
small — recreate it with the full set.

### Procedure

1. Evaluate splitting immediately after writing spec.md
2. When a split target is identified, run `/add-feature <sub-item-path>` without hesitation
3. Parent-level design.md / tasks.md should contain only links to sub-items and cross-cutting concerns
4. After splitting, keep the parent's overview.md and spec.md as-is (do not delete them)
5. `/add-feature` inserts into docs/index.md but does **not** add the link to the parent's
   design.md / tasks.md. Add those by hand — this is where `vault-switch` and `inline-title`
   were both missed

---

## Bug Ticket Workflow

### When a bug is reported
1. Assign the next available ID by checking the highest existing number in `issues/tickets/`
2. Create `issues/tickets/BUG-{NNN}.md` using `issues/templates/BUG-template.md`
3. Add a row to `issues/index.md` with state `Open`
4. Investigate the cause, then fix the code
5. Update the ticket with the cause, fix details, and relevant commit hash; change state to `Fixed`
6. Commit the ticket file together with (or immediately after) the fix commit

### Rules
- All bug tickets go in `issues/tickets/` — never in feature-area `tasks.md` or `dev-notes.md`
- One ticket per distinct root cause; link related tickets if they share a cause
- Do not close a ticket as `Closed` without user confirmation that the fix was verified

---

## Guidelines

- Create documentation before implementation
- If requirements change during implementation, update the relevant documents immediately
- Write dev-notes.md as a record of decisions, not a work log
- Commit and push to GitHub at natural stopping points
- Do not load or reference any files under `_jp/` — that directory is for human reference only
