# File storage conventions

All site files live on the VPS (`tbs_uploads` volume, `/app/public/images/uploads`).
Served statically by nginx AND via `/api/r2` + `/api/uploads`. Never in git,
never in MariaDB (only paths/metadata in the DB).

## Layout

```
uploads/
  products/{slug}/{purpose}_{variant}_{V###}.{ext}
  heroes/{slug}_{purpose}_{timestamp}.{ext}
  events/{slug}_{purpose}.{ext}
  posts/{slug}_{purpose}_{date}.{ext}
  designs/{timestamp}-{rand}.{ext}      # print/design working files
  decoration/...                        # decorative site assets
  misc/{timestamp}-{rand}.{ext}         # inbox — triage on touch, don't hoard
```

## Naming

`{area}_{item}_{purpose}[_{variant}][_{V###}].{ext}`

- `area`: products, heroes, events, posts, designs
- `purpose`: cover, gallery-N, thumb
- `variant`: colourway/slug fragment, e.g. `ocean`, `daffodil`
- `V###`: version counter for re-exports (`V001`, `V002`)
- Legacy `thebreaksite_` prefix is grandfathered — don't rename referenced
  files (product JSON in MariaDB points at exact paths); new files omit it.

## Rules

1. No videos in uploads (they broke a deploy at 2.5GB once).
2. `misc/` is an inbox, not an archive — name it or lose it.
3. Unreferenced files go to `/app/data/quarantine/`, never deleted blind.
4. `npm run storage` prints usage by area (see scripts).
