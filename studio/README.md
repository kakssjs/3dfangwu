# studio

Our own code for the one-stop housing platform. So far:

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

## Check it

```bash
npm run typecheck
```

```bash
npm test
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
| `scripts/` | The `npm run` commands above |
| `samples/floorplan-3d-sample.json` | floorplan-3d's sample apartment, read from its `index.html` without running it |
| `orders/demo/home.json` | The demo home, linked to the Homebox on this PC |
| `.env.local` | Homebox address, studio account and API key. Private: never share it |
| `../runtime/homebox/` | Homebox itself (v0.27.1), its data (`.data/`) and its API-key secret (`api-key-pepper.txt`). Changing that secret cancels every API key |
