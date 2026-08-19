# ALFAEr — Bored Pile Site Records

Every bored pile generates a record: pile ID, rig, diameter, toe depth, casing,
cage, concrete poured against theoretical, start and finish times, driller.
Traditionally that's a paper sheet retyped in the office at night.

This is the digital version of that sheet — and everything downstream of it.
A pile is logged once, on a phone, at the rig. That single record then produces
the pile log PDF, the daily site report, the concrete overbreak numbers and the
layout progress board, with nothing retyped.

## What's here

| Area | What it does |
| --- | --- |
| **Pile log** (`/piles/new`) | Mobile-first form: bore, casing, cage, concrete, delivery tickets, strata, remarks. Shows live overbreak while it's being filled in. |
| **Pile register** (`/piles`) | Every pile, filterable by status, rig, reference and overbreak flag. |
| **Overbreak** (`/overbreak`) | Theoretical vs actual m³, distribution, and breakdowns by rig, diameter and driller — with the extra concrete priced. |
| **Layout** (`/layout`) | The setting-out plan drawn from survey coordinates, coloured by status or by overbreak. Becomes the as-built pile map at handover. |
| **Reports** (`/daily`) | One row per worked shift. Production figures are derived; only the narrative is typed. |
| **PDFs** | `/api/piles/<id>/pdf` and `/api/daily/<yyyy-mm-dd>/pdf`. |
| **Settings** (`/settings`) | Contract details, overbreak thresholds, concrete rate, rigs, drillers, and pile schedule import. |

## The one calculation that matters

Theoretical concrete is the nominal bore cylinder between the toe and the top
of the cast concrete:

```
V = π · (d/2)² · (toe depth − depth to top of concrete)
```

Overbreak is what was placed beyond that, as m³ and as a percentage. Piles are
banded green / amber / red against per-contract thresholds, and a pour that
comes in *under* theoretical is called out separately rather than treated as
good news — a shortfall can mean a necked shaft or a mis-recorded pour.

Project and group totals are weighted by volume, not averaged across piles. A
mean of percentages lets one short pile with a wild variance dominate a figure
that's meant to describe the contract.

## Running it

Requires Node 20+ and PostgreSQL 14+.

```bash
docker compose up -d                 # or point DATABASE_URL at your own Postgres
cp .env.example .env                 # then edit DATABASE_URL to match
npm install
npm run db:push                      # create the schema
npm run db:seed                      # optional: a worked demo contract
npm run dev
```

The seed builds a 120-pile contract with 14 shifts of production, deliberately
including a rig and a pile diameter that run hot, so the overbreak dashboard
has a real pattern to surface.

### Commands

| Command | Does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and serve |
| `npm test` | Unit tests for the concrete maths and the schedule parser |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:push` | Sync the Prisma schema to the database |
| `npm run db:seed` | Reset and reseed the demo contract |
| `npm run db:studio` | Prisma Studio |

## Importing a pile schedule

Settings → Pile schedule takes a CSV. Column names are matched loosely, so a
consultant's export usually lands without editing — `Pile ID`, `Diameter (mm)`,
`Design Depth (m)`, `Easting`, `Northing`, `Cut-off Level` and their common
variants all resolve. Rows missing a diameter or depth are skipped and
reported rather than guessed, and duplicate references are rejected.

Re-importing a revised schedule updates design data on piles already in the
register and never touches an as-built log, so revisions are safe to apply
mid-contract.

## Data model

`Pile` is the schedule entry and exists from setting-out — that's what lets the
layout board show piles that haven't been started. `PileLog` is the as-built
record, sharing the pile's primary key, and carries `ConcreteLoad` delivery
tickets. `DailyReport` holds only the per-shift narrative that can't be derived;
the production table on the report is built from `PileLog.workDate`.

There is one database behind every view. Nothing is stored twice.

## Not built yet

Deliberately out of scope for this first release, in rough order of value:

- **Authentication and roles.** The app currently has no login. Anyone who can
  reach it can write a pile log. Put it behind a VPN or an authenticating proxy
  until this lands.
- **Audit trail.** Edits overwrite in place; there is no record of who changed a
  poured volume from 18.5 to 19.0 or why.
- **Offline capture.** The form assumes a connection at the rig.
- **Photographs**, QA/QC hold points, testing register and NCRs.
- **Shoring instrumentation** with trigger levels and breach alerts.
- **Tender estimator** and RFQ intake.
