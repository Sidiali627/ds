# Milestone 1 Implementation Note (Security + Youth House Directory Foundation)

## Changed files (high-level)
- Security/config hardening:
  - `/home/runner/work/ds/ds/js/config.js`
  - `/home/runner/work/ds/ds/js/supabase.js`
  - `/home/runner/work/ds/ds/services/email_service.js`
  - `/home/runner/work/ds/ds/services/reminder_service.js`
  - `/home/runner/work/ds/ds/supabase/migrations/20240101000002_seed_admin.sql`
  - `/home/runner/work/ds/ds/.env.example`
- Role/authorization helper centralization:
  - `/home/runner/work/ds/ds/js/roles.js`
  - updated role checks in `auth.js`, `guard.js`, `specialist/*`, `doctor_profile.js`, `components.js`
- Content workflow + public visibility:
  - `/home/runner/work/ds/ds/js/data.js`
  - `/home/runner/work/ds/ds/js/homepage.js`
  - `/home/runner/work/ds/ds/supabase/migrations/20240101000023_content_workflow_and_youth_houses.sql`
- Youth House Directory module:
  - `/home/runner/work/ds/ds/youth-houses.html`
  - `/home/runner/work/ds/ds/youth-house.html`
  - `/home/runner/work/ds/ds/my-youth-house.html`
  - `/home/runner/work/ds/ds/js/youth_houses.js`
  - `/home/runner/work/ds/ds/js/youth_house_profile.js`
  - `/home/runner/work/ds/ds/js/my_youth_house.js`
  - `/home/runner/work/ds/ds/js/youth_houses_shared.mjs`
- Tooling/tests:
  - `/home/runner/work/ds/ds/package.json`
  - `/home/runner/work/ds/ds/audit_project.js`
  - `/home/runner/work/ds/ds/scratch/test_youth_house_foundation.cjs`

## Migrations added/updated
1. `20240101000002_seed_admin.sql` (updated)
   - Removed hardcoded admin credentials.
   - Uses secure provisioning pattern based on runtime setting `app.settings.seed_super_admin_email`.
2. `20240101000023_content_workflow_and_youth_houses.sql` (new)
   - Adds moderation statuses and review metadata for articles/media visibility.
   - Introduces `youth_houses` and `youth_house_communes` with RLS, approval workflow fields, and manager ownership constraints.

## Required environment variables (non-secret in repo)
- `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_ANON_KEY`
- `APP_PUBLIC_BASE_URL`
- `EMAIL_FROM`
- `SEED_SUPER_ADMIN_EMAIL`

## Required external actions
- Rotate any previously exposed credentials outside the repository (Supabase keys, email-provider keys, SMTP credentials, old admin seed password).
- Apply Supabase migrations in order, including:
  - `20240101000023_content_workflow_and_youth_houses.sql`
- Provision secrets in secure deployment environment (not source files):
  - `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY`, SMTP secrets.
- Configure Auth/account provisioning for initial super admin before role promotion SQL.

## Known remaining gaps
- Existing repository contains broad legacy modules/routes; only milestone-scope RBAC centralization and Youth House foundation paths were incrementally updated.
- Real institutional records must be onboarded through verified operational process; no fabricated records are inserted by this change set.
