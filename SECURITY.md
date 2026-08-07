# Security Policy

## Supported version

This repository is an incomplete project rather than a released product. Security fixes are applied to the `main` branch.

## Reporting a vulnerability

Do not include account details, session data, save-game contents, credentials, or proof-of-concept attacks against production services in a public issue.

Use GitHub's private vulnerability-reporting feature on this repository when available. If that is unavailable, contact the maintainer through the GitHub profile before sharing sensitive details. Non-sensitive defects may be reported in a normal issue.

Include the affected files or URL, expected impact, reproduction steps that use local fixtures or a disposable test environment, and a suggested mitigation if known.

## Supabase boundary

The Supabase project URL and anonymous browser key are public client identifiers, not secrets. Authorization must be enforced by Row Level Security (RLS). Do not rotate the anonymous key solely because it appears in browser code or repository history.

The production RLS configuration has not been independently verified, so the public build disables account and remote-save operations. Do not probe, enumerate, modify, or delete production records. Follow `docs/SUPABASE_SECURITY.md` using metadata inspection and disposable test accounts in a staging project before re-enabling those features.
