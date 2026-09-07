# thebreaksurf-site

Public-facing The Break Surf website (`thebreaksurf.co.uk`).

Split out from the old monorepo — this repo contains **only** the public site. Admin, finance, email, and till panels live elsewhere.

## Run it

```bash
cp .env.example .env.production  # fill in real values
docker compose build && docker compose up -d
```

## Layout

- `app/(site)` — public pages
- `app/api` — checkout, reviews, promotions, webhooks, uploads
- `components/`, `content/`, `contexts/`, `helpers/`
- `lib/` — db, r2, erpnext, stripe, resend, content readers
- `infra/` — server watchdog units
- `docs/legacy-d1-schema.sql` — old D1 shapes, reference for MariaDB migration
