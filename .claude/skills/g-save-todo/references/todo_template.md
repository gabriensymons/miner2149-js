# Todo Template

```markdown
title: <List title>
date: <YYYY-MM-DD>
source: <codex|claude|user|other>
status: <open|done>
owner: <person>

# <What this list gets done>

<One or two sentences of context: why this list exists and what "done" means.>

- [ ] <Action, phrased as something to do>
  - <Optional note: a file, command, or dependency>
- [ ] <Action>
- [ ] <Action>
```

## Notes
- Default save location is `.agents/todo/`.
- Filename format is `YYYY-MM-DD-<slug>.md`.
- Order items by priority or by the order they must happen in.
- The helper adds the metadata lines; pass only the body when using it.
