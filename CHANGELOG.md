# Changelog

All notable changes to Kairos are documented in this file.

## [Unreleased]

### Added

- Lossless task-line parsing, scheduled and cancellation dates, safe simple recurrence,
  and protected single-task reschedule undo.
- Natural-language capture dates in Italian and English, configurable Agenda grouping,
  accent-insensitive search, and readable link labels.
- Versioned local plugin API, status summary, navigation commands, index exclusions,
  and a pure snapshot-based index core.

### Changed

- Today, Upcoming, sorting, Agenda, and daily projections now use the due date or fall
  back to the scheduled date while keeping every task in its source note.
- Initial indexing is chunked and guarded against stale generations; vault-event
  notifications are debounced and per-file read failures are isolated.

### Fixed

- Richer or invalid recurrence rules no longer risk a partial series update: Kairos
  leaves the source unchanged and opens it for manual handling.

## [0.2.2] — 2026-08-04

### Added

- Daily-note projections now have a self-contained, collapsible Task header with a
  quick-add button that preselects the daily date while keeping the task in Inbox.
- Existing daily projections migrate away from the Markdown `## Task` heading, so
  collapsing the task list no longer hides notes written below it.

### Fixed

- Long task text now wraps correctly on mobile and expands the full task row instead of
  overflowing into adjacent rows.
- The task editor now uses only Obsidian's native close control, removing the duplicate
  close icon on desktop and mobile.
- Duplicate Live Preview renderers of the same daily projection are deduplicated within
  each Obsidian leaf.
- Daily controls now keep the compact desktop appearance on iOS. Completion and
  source-note icons use CSS rendering independent of Obsidian's mobile SVG behavior.

## [0.2.1] — 2026-07-27

### Fixed

- The compact Kairos view now uses the secondary Obsidian surface, restoring visual
  separation between the editor and the right sidebar.
- Text inside interactive daily-note task rows now has consistent horizontal inset.
- The Live Preview block-edit control no longer covers the source-note action on the
  first task in a `kairos-tasks` block.

## [0.2.0] — 2026-07-27

### Added

- Stable global capture in `_inbox/Inbox.md` and a separate contextual capture command
  for project notes.
- Unified create/edit task interface with text, status, due date, priority, and
  destination controls.
- **Create and open** flow: Inbox tasks can create a linked detail note, while project
  tasks open directly at their new source line.
- Interactive `kairos-tasks` projection inside recognized daily notes.
- Automatic preparation of the right sidebar on mobile.

### Changed

- Primary navigation is now Inbox, Today, Upcoming, and All.
- Due dates control task projections without moving the persistent Markdown line.
- Today is a focused list of open tasks due today or earlier.
- Clicking a task opens the editor; opening the source note is now an explicit action.
- The desktop ribbon opens the compact right sidebar. The full-page view remains
  available from the Command Palette and the sidebar.
- Mobile capture was redesigned around the iOS keyboard, with a visible text field and
  compact date and priority controls.
- Plugin identity now uses the `circle-check` icon.

### Fixed

- Source-line validation now protects update, toggle, move, and delete operations from
  stale task state.
- Selection reconciliation no longer transfers a selection to an unrelated task after
  lines move.
- The saved panel state no longer triggers unnecessary index refreshes.
- Legacy default `Inbox.md` installations migrate once to `_inbox/Inbox.md`; custom
  paths are left unchanged.

### Security

- Updated esbuild and Vitest to patched versions; `npm audit` reports zero
  vulnerabilities.
- Pinned GitHub Actions to immutable commit SHAs and disabled persisted checkout
  credentials.

## [0.1.0] — 2026-07-10

- Initial public release.
- Full task panel and compact sidebar.
- Search, filters, sorting, grouping, saved views, multiselect, and bulk actions.
- Configurable Inbox, Daily Notes integration, priorities, dates, tags, and task status.

[0.2.2]: https://github.com/salvatoreierardisi-hub/kairos/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/salvatoreierardisi-hub/kairos/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/salvatoreierardisi-hub/kairos/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/salvatoreierardisi-hub/kairos/releases/tag/v0.1.0
