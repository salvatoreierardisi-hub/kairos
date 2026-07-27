# Architecture

Kairos treats Markdown task lines as the only persistent source of truth. An in-memory
index observes the vault and rebuilds the task projection; user actions update the
validated source line.

```text
Markdown notes ──▶ TaskIndex ──▶ TaskPanel / daily projection
       ▲                                      │
       └──────────── TaskWriter ◀─────────────┘
```

## Boundaries

- `src/core/` contains pure, synchronous domain logic: parsing, formatting, filtering,
  sorting, placement, safe line resolution, task-detail links, and daily insertion.
  It has no imports from `obsidian` and is covered by Vitest.
- `src/index/TaskIndex.ts` indexes task lines across the vault and reacts to file
  create, modify, delete, and rename events.
- `src/io/TaskWriter.ts` is the only component that creates, moves, updates, or deletes
  persistent task lines.
- `src/io/DailyNotesConfig.ts` resolves the effective Daily Notes configuration and
  recognizes daily-note paths.
- `src/view/TaskPanel.ts` provides the reusable task interface shared by the full-page
  and compact sidebar views.
- `src/view/QuickAddModal.ts` is the unified create/edit interface.
- `src/view/DailyTasksBlock.ts` renders the interactive `kairos-tasks` projection inside
  a recognized daily note.
- `src/settings/` exposes configurable paths, daily-note behavior, and tag prefixes.
- `src/main.ts` registers views, commands, processors, settings, and workspace events.

## Data model

A parsed task keeps its normalized text and metadata together with:

- its Markdown file path;
- its current zero-based line number;
- the exact source line observed by the index.

`file + line` provides a fast lookup hint. The exact source line protects writes against
stale UI state: if the expected line moved, Kairos accepts only one unambiguous match in
the same file. Missing or ambiguous matches fail instead of editing the wrong task.

## Placement

Global capture writes to the configured Inbox. Contextual capture writes to the current
or selected note. Assigning or changing a due date updates only the task metadata; it
does not move the source line.

A due date controls projections such as Today, Upcoming, and the interactive daily-note
block. This keeps physical storage independent from where a task is useful to see.

## Runtime dependencies

Kairos has no runtime dependency beyond the Obsidian API.
