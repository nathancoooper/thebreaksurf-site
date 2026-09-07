# thebreaksurf-site — Agent Instructions

**Also read `~/AGENTS.md`** — the global knowledge base with cross-project context, credentials, and lessons learned.

## What this repo is
Public-facing `thebreaksurf.co.uk` only. No admin, finance, email, or till code — those live in `tbs-admin-legacy` (production) and the Hono rewrites.

## Stack
- Next.js 16, React 19, TypeScript, Tailwind
- MariaDB (Docker) for users, purchase data, content metadata — see `docs/legacy-d1-schema.sql` for the old D1 shapes
- R2 for file bytes — never store uploads under `public/`
- ERPNext is source of truth for products/orders (`lib/erpnext.ts`)

## Deploy
- VPS (KVM2): `ssh root@187.7.22.35`, pull, `./deploy.sh`
- `npm run build` first — never deploy until it passes
- Uploads belong in R2, never in git (`public/images/uploads/` is gitignored)

## Rules
- Keep admin/finance/email code out of this repo
- File blobs go to R2; only paths/metadata in MariaDB
- Update `~/AGENTS.md` when you learn something cross-project
