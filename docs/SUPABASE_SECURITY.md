# Supabase Security Verification

The repository contains a dormant adapter for Supabase Auth and the `game_states` table. The public build disables account and remote-save operations while production policy remains unverified. When enabled, the adapter supplies the authenticated user's ID and filters reads by that ID as defense in depth. These checks do not replace database-enforced Row Level Security (RLS).

Production RLS has not been independently verified. Cloud saves are out of scope for the local-save-only public preview, so treat this as a blocker to re-enabling account and remote-save features rather than a blocker to the preview itself. Do not inspect or manipulate production records to complete this checklist.

## 1. Inspect metadata only

In the Supabase SQL editor, confirm RLS and policies without selecting from `game_states`:

```sql
select
  c.relrowsecurity as rls_enabled,
  c.relforcerowsecurity as rls_forced
from pg_catalog.pg_class c
join pg_catalog.pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname = 'game_states';

select
  policyname,
  roles,
  cmd,
  qual,
  with_check
from pg_catalog.pg_policies
where schemaname = 'public'
  and tablename = 'game_states'
order by policyname;
```

Expected properties:

- RLS is enabled.
- Policies target the `authenticated` role, not `anon` or `public`.
- `SELECT` permits rows only when `(select auth.uid()) = user_id`.
- `INSERT` has `WITH CHECK ((select auth.uid()) = user_id)`.
- `UPDATE` has both `USING ((select auth.uid()) = user_id)` and `WITH CHECK ((select auth.uid()) = user_id)`.
- No broad policy uses `true`, trusts a client-supplied email, or grants cross-user access.
- No browser-delivered code contains a `service_role` key.
- `DELETE` is denied unless the product intentionally supports deletion and has the same ownership check.

`FORCE ROW LEVEL SECURITY` is useful defense in depth for table-owner access but does not replace correct role policies.

## 2. Review table constraints

Inspect schema metadata and confirm:

- `user_id` is non-null and references `auth.users(id)` as intended;
- `save_slot` is non-null and restricted to `autoSave`, `save1`, `save2`, or `save3`;
- the row identifier or a unique constraint prevents duplicate slots per user;
- grants do not permit unauthenticated writes.

A recommended uniqueness rule is `(user_id, save_slot)`. Changing constraints on an existing production table is a data/security decision and requires a reviewed migration; do not apply it ad hoc.

## 3. Test in a disposable staging project

Use two disposable users in a non-production Supabase project with the same schema and policies:

1. User A can insert and read A's own four allowed slots.
2. User B cannot select, update, upsert, or delete A's rows, even when B supplies A's `user_id` or deterministic row ID.
3. An unauthenticated client cannot read or write any game state.
4. A user cannot change an owned row's `user_id` to another user.
5. Invalid save-slot values are rejected by the database constraint.
6. Auth and policy errors do not reveal another user's row contents.

Record the policy definitions, staging test date, and reviewer. Do not copy production records into staging.

## 4. Release decision

Cloud saves should not be described as secure or production-ready until all checks pass. If any ownership policy is absent or ambiguous, disable cloud-save UI or fix the policies through a reviewed migration before release. The public anonymous key does not need rotation merely because it is visible; rotate only for evidence of key misuse, accidental publication of a privileged key, or a deliberate project-key lifecycle event.
