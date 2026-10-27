# Plan Template

Use this structure when drafting plan content before saving.

```markdown
title: <Plan title>
date: <YYYY-MM-DD>
source: <codex|claude|user|other>
status: <draft|final>
owner: <person>

## Summary
Brief objective and expected outcome.

## Implementation
Concrete steps with any API/interface changes.

## Tests
Validation approach, test cases, and failure conditions.

## Assumptions
Explicit defaults, constraints, and unresolved dependencies.
```

## Notes
- Saved files should be named `YYYY-MM-DD-<slug>.md`.
- Keep sections explicit and implementation-ready.
- Use `.agents/plans/` as the default target location in each repository.

- Reuse an established project destination instead of creating a competing directory.
- The helper adds metadata; pass only the body when using it.
