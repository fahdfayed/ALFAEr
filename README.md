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
| **Lost time** (`/delays`) | Delays recorded in two taps at the point they happen, grouped by cause, reason and rig. |
| **Productivity** (`/productivity`) | Metres per hour, piles per day, cycle time, waiting time and utilisation, derived from the pile logs. |
| **Audit** (`/audit`) | Every change to every record: who, when, and the values before and after. |
| **Settings** (`/settings`) | Contract details, overbreak thresholds, concrete rate, shift hours, rigs, drillers, and pile schedule import. |
| **Admin** (`/admin`) | People, roles and projects. |

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

## Access control

Sign-in is required for everything, including the PDF routes. Passwords are
stored as salted scrypt hashes; sessions are random tokens stored only as
hashes, so a leaked database does not hand over live sessions. Changing a
password or deactivating an account revokes every existing session at once.

Each person holds a role **per project**:

| Role | Can |
| --- | --- |
| **Viewer** | Read everything, including the audit trail. Change nothing. |
| **Foreman** | Record pile logs and delays. Cannot change contract settings. |
| **Engineer** | Everything on the project, including settings and imports. |

A separate system-administrator flag governs creating projects and managing
people. An administrator without a project role can configure a project but
cannot write site records against it — work is recorded by whoever actually
holds a role on the job, so the audit trail always names a real person in a
real position.

The first visit to a fresh installation asks for a name, email and password
and creates the administrator account. That route refuses once any user
exists.

**What this is not:** there is no MFA, no self-service password reset, and no
SSO. Failed sign-ins are throttled per email, not per network. This is
proportionate for an internal tool on a private network; it is not enough to
put on the open internet.

## The audit trail

Every write records who did it, what changed, and the value before and after.
Editing a pile log asks for a reason, because a quantity that changes without
one is the quantity a QS will challenge:

```
Layla Haddad updated the record · 2026-08-19 12:36
Missing final delivery ticket added
  Concrete poured (m³): 19.28 → 20.78
```

The diff ignores bookkeeping columns, treats float noise from the database as
no change, and skips writing an entry when a form is saved without altering
anything — so the log holds only real events. Entries are written in the same
transaction as the change itself.

## Projects

Each contract is a project, and everything is scoped to it. The switcher in
the header only lists projects you hold a role on. Archived projects stay
readable but drop out of the switcher.

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

On first run, open the app and create the administrator account.

If you serve the app over **plain HTTP** on an internal network, set
`AUTH_COOKIE_SECURE=false`. Browsers refuse to store a Secure cookie from a
plain-HTTP origin that is not localhost, so without it sign-in appears to
succeed and then bounces straight back with nothing in the logs to explain
it.

The seed builds a 120-pile contract with 14 shifts of production, deliberately
including a rig and a pile diameter that run hot, so the overbreak dashboard
has a real pattern to surface. It also creates one account per role —
`admin@`, `engineer@`, `foreman@` and `client@alfaer.test`, password
`alfaer-demo-2026` — so the permission model can be seen working. Delete them
before using the install for real work.

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

- **Photographs** attached to a pile. Piling disputes are settled by photos of
  the cage, the tremie and the obstruction; this is the largest remaining gap.
- **Concrete reconciliation** — ordered against delivered against allocated to
  piles. The overbreak dashboard sees concrete that reached a pile; it is blind
  to concrete paid for that never got allocated to one.
- **Shoring instrumentation** with trigger levels and breach alerts.
- **QA/QC hold points**, testing register and NCRs.
- **Offline capture.** The form assumes a connection at the rig.
- **Programme forecast**, tender estimator and RFQ intake.
