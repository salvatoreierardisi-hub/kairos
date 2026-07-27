# Contributing to Kairos

Thanks for your interest in Kairos. Before starting a substantial change, open an issue
that describes the user problem and the proposed behavior.

## Local setup

```bash
npm install
npm test
npx tsc --noEmit
npm run build
```

## Project boundaries

- Keep domain logic in `src/core/` pure, synchronous, and independent from `obsidian`.
- Add or update Vitest coverage when changing domain behavior.
- Keep Obsidian integration in `src/index/`, `src/io/`, `src/view/`, `src/settings/`,
  or `src/main.ts`.
- Do not introduce runtime dependencies beyond `obsidian`.
- Do not persist a second copy of a task outside `TaskIndex`; the Markdown line is the
  source of truth.
- Keep Inbox paths, daily-note configuration, and tag prefixes configurable.

## Pull requests

- Keep each pull request focused on one user-visible outcome.
- Explain what changed, why it changed, and how it was verified.
- Include screenshots for visual changes.
- Run the full test, type-check, and build sequence before opening the pull request.
- Do not commit generated `main.js`, local vault paths, private notes, or development
  context.
