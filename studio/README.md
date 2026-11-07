# studio

Our own code for I Renovation, the renovation design and contractor-matching platform. So far:

- **API (N19, N22, N23):** one NestJS app (D20). Homeowners and contractors register; you verify the contractors; a homeowner saves renovation requirements as a project and sees the verified teams that fit it, each with its reasons; they invite up to three, each team answers with a decline or one sealed quote within 7 days, and the homeowner picks one. PostgreSQL runs inside the app. Every route is in `WORKFLOW.md` section 6.4.
- **Home record (N9):** one JSON file per customer home, built from floorplan-3d's rooms and furniture. Each piece of furniture is placed in the room that contains it; appliances are kept apart for micasa (N12).
- **Homebox connector (N11):** gives each home its own Homebox household. Rooms become locations, furniture becomes items with price, and the customer gets a one-time sign-up link.

Needs Node.js 24 or later. Everything it uses is free and open source (`CLAUDE.md` rule 7).

## Run it

Run these in this folder, `studio/`.

```bash
npm install
```

Turn floorplan-3d's sample apartment into a home record. Running `home` again on the same file keeps the home's Homebox links:

```bash
npm run sample
```

```bash
npm run home -- samples/floorplan-3d-sample.json orders/demo/home.json --id demo --name "样板间 · 三室两厅两卫"
```

Homebox itself isn't in the repo. The first time only, download `homebox_Windows_x86_64.zip` and `checksums.txt` from the [Homebox v0.27.1 release](https://github.com/sysadminsmedia/homebox/releases/tag/v0.27.1). Check that the zip's SHA-256 matches its line in `checksums.txt`, then unzip it into `../runtime/homebox/v0.27.1/`, so that `homebox.exe` is there.

Start Homebox and leave it running in its own terminal. Ctrl+C stops it. It listens on this PC only, at http://127.0.0.1:7745:

```bash
npm run homebox -- start
```

The first time only: create the studio's Homebox account and API key. They are saved in `.env.local`, where you'll also find the password for signing in on the website. Then restart Homebox to turn open sign-up off.

```bash
npm run homebox -- setup
```

Copy a home into Homebox. Safe to repeat: it only changes what the design changed, so the customer's own edits in Homebox stay.

```bash
npm run homebox -- sync orders/demo/home.json
```

Make a one-time sign-up link for the customer (valid 7 days by default):

```bash
npm run homebox -- invite orders/demo/home.json
```

To see a home on the website, sign in as the studio account, then switch to that home's household.

## Run the API

The API needs `npm install` (above) and nothing else: PostgreSQL runs inside it.

The first time only: write the sign-in secret and your admin key to `.env.local`. It doesn't print them. Changing `STUDIO_JWT_SECRET` later signs everyone out:

```bash
npm run api -- setup
```

Start it. The interface is at http://127.0.0.1:3100/ and the API at http://127.0.0.1:3100/api. Ctrl+C stops it. Its database is in `../runtime/studio-db/`, which isn't in git; set `STUDIO_DB_DIR` to use another folder:

```bash
npm run api
```

`STUDIO_API_HOST`, `STUDIO_API_PORT` and `STUDIO_SITE_URL` (the interface's address, used in the project and invitation links) are optional: `.env.example` lists them.

**Database.** PostgreSQL runs inside the app by default (nothing to install). To use a PostgreSQL server instead, set `DATABASE_URL=postgres://user:password@host:5432/name` in `.env.local`; the app applies its migrations on start and says which database it is using. `npm run test:postgres` runs the database tests over a real PostgreSQL connection (a throwaway server unless you set `STUDIO_TEST_DATABASE_URL` to a database whose name contains "test": it is wiped).

**Map.** The map and community search use Amap (高德地图). Put your Web (JS API) key in `.env.local` as `AMAP_KEY` and its security code as `AMAP_SECURITY_CODE`: the page gets the key, the code stays on the server. Without the key there is no map and the city and district are picked from the list; without the code the map shows but search is off. "Use my location" needs no key.

Every route is in `WORKFLOW.md` section 6.4, and `test/api/marketplace.test.ts` uses them in order. By hand, use curl in a bash shell (in PowerShell, use `curl.exe` and put the JSON in a file: `-d @body.json`).

Register a homeowner. A contractor is the same with `"role":"contractor"`. The reply holds a token to send as `Authorization: Bearer <token>`:

```bash
curl -X POST http://127.0.0.1:3100/api/auth/register -H "content-type: application/json" -d '{"role":"homeowner","phone":"13800138000","password":"a long password","displayName":"Li","language":"zh-CN","acceptTerms":true}'
```

Your side: contractors wait at `pending` until you verify them. List the waiting ones, then decide on one with its `id` (`verified`, `rejected` or `suspended`; the contractor sees the note). Check the licence first (D17):

```bash
ADMIN_KEY=$(grep '^STUDIO_ADMIN_KEY=' .env.local | cut -d= -f2)
curl -H "X-Admin-Key: $ADMIN_KEY" "http://127.0.0.1:3100/api/admin/contractors?status=pending"
curl -X POST -H "X-Admin-Key: $ADMIN_KEY" -H "content-type: application/json" -d '{"decision":"verified","note":"Licence checked"}' http://127.0.0.1:3100/api/admin/contractors/<id>/review
```

## Check it

Email registration verification and code login are available once an SMTP sender is configured and explicitly enabled. They are off by default; existing phone/password accounts keep working. See [email-verification.md](docs/email-verification.md) for setup, limits, and tests. There is no real email delivery until the sender is configured.

```bash
npm run typecheck
```

`npm test` builds the API into `dist/` and runs every test. The API's tests start it on a free port with PostgreSQL in memory, so they need no setup:

```bash
npm test
```

After changing the tables in `src/api/db/schema.ts`, write the migration (it is applied when the API starts), and commit it with the code:

```bash
npm run db:generate
```

The live tests need Homebox running. They create a test household and delete it at the end:

```bash
npm run test:live
```

## Files

| Path | What it is |
|---|---|
| `src/home-record.ts` | The home record: types, room areas, which room each item is in |
| `src/homebox.ts` | Homebox API client and the sync |
| `src/api/` | The NestJS API: `main.ts` (`npm run api`), `app.ts` (the app), `config.ts` (settings), `domain.ts` (shared words and rules), `validation.ts` (request checks), `db/` (tables and the database), and one folder per area: `auth/`, `consent/`, `contractors/`, `matching/`, `uploads/` |
| `web/` | The interface (D25): plain JavaScript modules and CSS, served by the API app at `/`. `js/views/` has the homeowner, contractor and console screens; `js/i18n.js` has the Chinese and English text |
| `templates/legal/` | The privacy notice, the terms of use and the contractor terms, in Chinese and English, served at `GET /api/legal` |
| `src/env-file.ts` | Writes keys to `.env.local`, for both setup commands |
| `drizzle/`, `drizzle.config.ts` | The database's migrations, written by `npm run db:generate` |
| `tsconfig.build.json` | How `npm run build` compiles the API into `dist/` (not in git) |
| `test/api/` | The API's end-to-end tests |
| `scripts/` | The Homebox and home record commands above |
| `samples/floorplan-3d-sample.json` | floorplan-3d's sample apartment, read from its `index.html` without running it |
| `orders/demo/home.json` | The demo home, linked to the Homebox on this PC |
| `.env.local` | Homebox address, studio account and API key; the API's sign-in secret and your admin key. Private: never share it |
| `../runtime/studio-db/` | The API's database (PostgreSQL run by PGlite). Not in git. One API per folder |
| `../runtime/studio-files/` | The files people upload (N19), with their metadata cleaned off. Not in git |
| `../runtime/homebox/` | Homebox itself (v0.27.1), its data (`.data/`) and its API-key secret (`api-key-pepper.txt`). Changing that secret cancels every API key |
