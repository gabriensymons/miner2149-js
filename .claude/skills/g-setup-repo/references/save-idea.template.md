Save a <domain noun> idea for this repo. Usage: `<title> <optional idea instruction>`.

Follow the `g-save-idea` skill for where the idea is saved, its filename, and its
metadata. This command adds only the domain guidance below. If `g-save-idea` is not
available, save to `.agents/ideas/YYYY-MM-DD-<slug>.md`.

## Arguments

- **title** (required): a short name for the idea, for example `<domain example>`.
- **idea instruction** (optional): what the idea is about. When given, draft the
  idea from it first, then save it. When omitted, save the idea from the current
  conversation; do not save an unrelated last response.

## Examples

- `/save-idea <example-title>`: saves the idea discussed in this conversation.
- `/save-idea <example-title> <one-sentence example instruction>`: drafts and saves it.

## Domain

This repo is about **<domain>**. An idea should cover whichever of these apply:

- **<Facet 1>**: <what to capture>
- **<Facet 2>**: <what to capture>
- **<Facet 3>**: <what to capture>

## Rules

- Start the body with a `#` heading naming the idea.
- Open with a short **Concept** section stating the core idea in a sentence or two.
- Include only the domain sections that apply; do not force empty ones.
- Report the saved path.
