# Change tracker

What has changed, what has not, and what still needs changing in this project.

Last updated: 2026-11-06 · Plan: [WORKFLOW.md](WORKFLOW.md)

**Check it yourself:** inside any of the nine repo folders, `git status --short` lists changed files and `git diff <baseline>` shows the edits. The top-level folder is our own git repo, public on GitHub since 2026-11-06 (section 1), with the nine repos linked as submodules at their baselines: `git status` there shows changes to this file, `WORKFLOW.md`, `CLAUDE.md`, `README.md` and `studio/`. `runtime/` is never committed.

## 1. At a glance

| Component | Folder | Baseline (upstream) | Status | Files changed |
|---|---|---|---|---|
| Floor plan designer | `floorplan-3d/` | `master` @ `730ec09` (2026-10-02) | Not changed · 5 changes planned | 0 |
| Photo restyle | `roomGPT/` | `main` @ `611398c` (2023-09-20) | Not changed · 8 changes planned | 0 |
| Blender control | `mcp-for-blender/` | `main` @ `2e4b0bc` (2026-11-04) | Not changed · setup only | 0 |
| 3D editor (backup) | `pascal-editor/` | `main` @ `dd3c93a` (2026-11-05) | Not changed · none planned | 0 |
| Scan to layout | `SpatialLM/` | `main` @ `8913c44` (2026-06-27) | Not changed · none planned | 0 |
| Buyer and deal CRM | `twenty/` | `main` @ `df05399` (2026-11-05) | Not changed · none planned | 0 |
| Home inventory | `homebox/` | `main` @ `f1435ac` (2026-11-04) | Not changed · none planned | 0 |
| Home maintenance | `micasa/` | `main` @ `1c4b5cd` (2026-10-28) | Not changed · none planned | 0 |
| Smart home | `home-assistant-core/` | `dev` @ `7c5eb2b` (2026-11-05) | Not changed · none planned | 0 |
| Our code | `studio/` | — | Created · N9 and N11 done, 19 items to do | 16 new, plus `.env.local` (keys) and `node_modules/` |
| Programs we run | `runtime/` | Homebox v0.27.1 Windows build (official release) | Downloaded · Homebox's data in `runtime/homebox/.data/` | Downloads, data and Homebox's key secret; no code |
| Project docs | `WORKFLOW.md`, `CHANGES.md`, `CLAUDE.md` | — | Created | 3 new |
| Our repo | Top-level folder | — | On GitHub, public: [kakssjs/3dfangwu](https://github.com/kakssjs/3dfangwu), branch `main`. The nine repos are linked as submodules at the baselines above | `README.md`, `.gitignore`, `.gitmodules` new |

## 2. Changed ✅

| Date | Change | Where | Verified |
|---|---|---|---|
| 2026-11-05 | Downloaded the five repos with full git history | 5 folders. `pascalorg/editor` is in `pascal-editor/` instead of `editor/` | Each HEAD matches GitHub's latest commit |
| 2026-11-05 | Wrote the workflow, this tracker and the AI rules | `WORKFLOW.md`, `CHANGES.md`, `CLAUDE.md` | Line references checked against the code; repos still clean |
| 2026-11-05 | Logged your one-stop housing platform direction; flagged that the plan still describes the studio scope | `WORKFLOW.md` sections 1 and 9 | Both lines found in the file (grep) |
| 2026-11-05 | Downloaded four more repos for the one-stop scope | `twenty/`, `homebox/`, `micasa/`, `home-assistant-core/`. `home-assistant/core` is in `home-assistant-core/` instead of `core/` | Each HEAD was GitHub's latest commit when cloned (Twenty's `main` has gained 2 commits since); `git status` clean; no errors in the clone log |
| 2026-11-05 | Added the four folders to the AI rules and the plan; logged your pick | `CLAUDE.md` rule 3; `WORKFLOW.md` sections 7 and 9 | Lines found in the files (grep); tables checked |
| 2026-11-05 | Planned how Twenty, Homebox, micasa and Home Assistant connect to our platform; added D8 (where it runs) | `WORKFLOW.md` sections 1, 2, 7 and 9; this file, sections 1, 3 and 4 (N9–N13) | API routes and commands checked in each repo's code; tables checked |
| 2026-11-06 | Set up `studio/`: TypeScript run directly by Node.js 24, tests with Node's own test runner | `studio/package.json`, `package-lock.json`, `tsconfig.json`, `.env.example`, `.gitignore`, `README.md` | `npm install`: 4 packages, 0 vulnerabilities; licenses MIT and Apache-2.0 |
| 2026-11-06 | Built the home record (N9): one record per home from floorplan-3d's rooms and furniture. Each piece of furniture goes to the room that contains it; appliances are kept apart for micasa | `studio/src/home-record.ts`, `scripts/home.ts`, `scripts/extract-floorplan-sample.ts`, `samples/floorplan-3d-sample.json`, `test/home-record.test.ts` | 7 unit tests pass; type check passes. The sample apartment gives 13 rooms, 43 pieces of furniture and 3 appliances, none placed by guess |
| 2026-11-06 | Downloaded Homebox v0.27.1 (Windows build) and ran it on this PC | `runtime/homebox/` | SHA-256 of the zip matches the release's `checksums.txt` and GitHub's digest. Listens on 127.0.0.1:7745 only; open sign-up turns off once the studio account exists |
| 2026-11-06 | Built the Homebox connector (N11): one Homebox household per home; rooms become locations, furniture becomes items with price; a one-time sign-up link for the customer. Re-running it only changes what the design changed, so the customer's own edits stay | `studio/src/homebox.ts`, `scripts/homebox.ts`, `test/homebox.test.ts`, `test/live/homebox.live.test.ts`, `orders/demo/home.json` | 6 unit tests and 5 live tests against Homebox on this PC pass; the live test deletes its household afterwards. Demo home synced twice: 56 created, then 56 unchanged |
| 2026-11-06 | Saved your free-and-open-source rule and flagged what in the plan breaks it | `CLAUDE.md` rule 7; `WORKFLOW.md` D4, D8, D9, sections 7, 8 and 9; this file, sections 3 and 4 | Licenses read from each repo's LICENSE file and from GitHub (WSL, Podman, Docker Engine) |
| 2026-11-06 | Logged your approval of the two exceptions to rule 7: the MiMo API, and WeChat Pay / Alipay for real payments | `WORKFLOW.md` D9 and section 9 | Both lines found in the file (grep); tables checked |
| 2026-11-06 | Reworked the plan into one end-to-end framework: the whole journey (attract, viewing, purchase, design, construction, move-in, living) with each stage's inputs, work, outputs, sign-offs and what it passes on; Chinese and English; three new agents; who does what; everything we use, with licenses; what runs today; the demo checklist. Added decisions D10–D14 | `WORKFLOW.md`, all 9 sections. Section numbers, D1–D9 and the old decision log rows are kept, so references from other files still hold | Each stage's inputs traced to an earlier stage or the consult step (section 3.4). Five gaps found and fixed: homes with no plan yet, dates for follow-ups, a folder for uploads, the first agent needed in phase 1, reaching Home Assistant after setup. Script check: every item and decision named is defined, links and anchors resolve, tables are well-formed, the kept rows are unchanged |
| 2026-11-06 | Planned the work for two languages and the whole journey: new items R8 and N14–N18; F2, F5, R2, R4, N1–N7, N9, N12 and N13 updated (N12 raised to P1); rule 7 notes for Twenty and micasa | This file, sections 1 and 4 | Settings read in Twenty's code (telemetry on by default, where it sends, the untagged Redis image) and micasa's (sync relay, AI and postal-lookup defaults) |
| 2026-11-06 | Logged your two decisions: finish the plan before building more; Chinese and English for customers (D10) | `WORKFLOW.md` D10 and section 9 | Rows found in the file (script check) |
| 2026-11-06 | Reviewed the plan end to end and fixed what didn't hold. Because you build the interface last (D15), the plan now runs without it: customers come in by WeChat and in person, you work from the command line, and the API it will call (N19) is planned first. Added what the interface needs (section 10); agent tools and the runner; customers' private links; outbound messages and reminders (D12); payment confirmed before delivery instead of before work; refunds, invoices and how long data is kept (D2, D3, D7); the owner version of the floor plan report, so the first product also fits D1's renovators; free-item caps; the server and backups (N20); one place for image calls (N21); seven new exceptions | `WORKFLOW.md`, all 10 sections; this file, sections 1, 2, 4 and 5 | Customers traced again through every stage, before and after the interface exists. Read in the code: micasa's `status --json` lists due upkeep (`cmd/micasa/status.go:48`); floorplan-3d's furniture format (`index.html:504`); roomGPT's generate route takes `imageUrl`, `theme`, `room` (`app/generate/route.ts:37`). Script check: every item and decision named is defined, links and anchors resolve, tables are well-formed, the kept rows are unchanged |
| 2026-11-06 | Put the project on GitHub, as you asked: [kakssjs/3dfangwu](https://github.com/kakssjs/3dfangwu), public, branch `main`. The top-level folder is now a git repo, and the nine repos are linked as submodules at their baselines instead of copied, so each keeps its own history and license. Kept out: keys (`studio/.env.local`), `runtime/` (Homebox, its data and its key secret), `node_modules/`, the brief, and real customers' folders. That last ignore rule is part of N2, added now because the repo is public; it keeps the demo home. Added the repo's front page (`README.md`). Fixed a dead end found on the way: `npm run homebox -- start` said this file's section 3 explains how to get Homebox, but nothing did; `studio/README.md` now does | `README.md`, `.gitignore`, `.gitmodules` (new); `studio/.gitignore`, `studio/README.md`, `studio/scripts/homebox.ts`; `CLAUDE.md` rule 4; `WORKFLOW.md` D14, sections 8 and 9; this file, sections 1–5 | Staged files searched for the real API key, password and key secret: none found, and no other hard-coded secret or real email address. `git check-ignore`: keys, `runtime/`, the brief and a real order's files are ignored; the demo home and `agents/`, `templates/`, `data/` aren't. Each submodule points at its baseline in section 1, and all nine repos are still clean. Type check and 13 unit tests pass. Script check: references, links and tables |

No file inside the nine repos has been modified.

## 3. Not changed ⬜

Everything in the nine repos is still exactly at its baseline commit. Parts we reuse as they are:

- `floorplan-3d/`: the 2D editor, 3D renderer and walkthrough, the furniture library (`LIB`, about 60 items, `index.html:471`), area statistics, the Chinese/English interface.
- `roomGPT/`: the upload page, the before/after compare slider, the download button.
- `mcp-for-blender/`: used as an installed tool. We never edit its code.
- `pascal-editor/`: untouched backup.
- `SpatialLM/`: untouched, not in the MVP.
- `twenty/`, `homebox/`, `micasa/`, `home-assistant-core/`: untouched. We connect to them as they are (WORKFLOW.md section 7).
- `JUNCTION CHINA 2026.pdf`: the brief. Kept off GitHub: it's the organisers' document.

Known quirks we leave alone:

- Windows checked out 6 symlinks in `pascal-editor/` (`CLAUDE.md`, `GEMINI.md`, `.claude/skills`, `.codex/skills`, `.cursor/skills`, `.github/copilot-instructions.md`) as one-line text files, because `core.symlinks=false`. They only point AI tools at `AGENTS.md` and `skills/`. The build doesn't use them.
- The same happened to `twenty/AGENTS.md` (points at `CLAUDE.md`) and to `home-assistant-core/CLAUDE.md`, `.agents/skills` and `.gemini/skills` (point at `AGENTS.md` and `.claude/skills`).
- `twenty/` and `home-assistant-core/` were cloned without old file versions (`--filter=blob:none`), which saved almost 3 GB of download. Every current file and the full commit list are here, and `git status` and `git diff` work offline. Commands that read old file versions (for example `git log -p`) fetch them from GitHub when needed.
- `twenty/` has file paths up to 242 characters, which goes past Windows' 260-character limit once the folder path is added. Git allows long paths in that repo only (`core.longpaths=true`, set at clone time). Tools without long-path support may fail on those files.
- `homebox/` is the newest `main`, 13 commits past the v0.27.1 release we run. For what our connector uses, the only difference is that v0.27.1 can't read settings from files (`HBOX_*_FILE`, added in #1822). So `npm run homebox -- start` passes the API-key pepper as `HBOX_AUTH_API_KEY_PEPPER`.

## 4. Needs changing 🔧

Status: ☐ to do · ◐ in progress · ☑ done (then add it to section 2).

Before the first commit inside `floorplan-3d/` or `roomGPT/`, fork that repo on GitHub and point its submodule at the fork (`git submodule set-url`). Otherwise our GitHub repo would link to commits that exist only on this PC.

### `floorplan-3d/` (MVP)

| ID | Pri | Change | Where | Why | Status |
|---|---|---|---|---|---|
| F1 | P0 | Load the floor plan, and the home's current design if it has one, from our API by the home's private link (N19), or by import, instead of built-in constants. Keep the current apartment as the sample. Save each plan's design under its own storage key | `index.html:395-459` (`WALLS`, `WINS`, `DOORS`, `SLIDES`, `ROOMS`), `:506` (`defaultFurniture()`), `:544` (`STORE`), `:560` (`BOUNDS`) | One specific apartment is hard-coded. "Export/Import plan" (`:1474-1479`) only saves furniture, room names and materials, removed walls and measurements, so a customer's floor plan can't be loaded | ☐ |
| F2 | P0 | Write down the plan JSON format the Floor-plan agent must produce (walls with type, windows, doors, sliding doors, rooms with a Chinese name and an optional English one, bounds, optional furniture) and validate it on load | New format doc + loader in `index.html` | The agents and the editor must agree on one format. floorplan-3d translates only the room names it knows (`NAMES_EN`, `:356`), so a customer's own room names need their English form in the plan (D10) | ☐ |
| F3 | P1 | Ship Three.js 0.160.0 with the page instead of loading it from `cdn.jsdelivr.net` | Import map, `index.html:217-220` | Works offline and on unreliable venue Wi-Fi | ☐ |
| F4 | P1 | Take flooring prices from our price table instead of the built-in list | `MATS`, `index.html:460-469` | The in-page estimate must match the Quote agent's budget | ☐ |
| F5 | P2 | Interface work, yours (D15): our branding (D11), a per-customer title in the customer's language, an "order / contact" link | Title `:10`, header `:231` (currently names the sample apartment: 三室两厅两卫), footer `:335` | This is the page customers see. Its interface already switches between 简体, 繁體 and English (`LANGS`, `:348`); keep all three working | ☐ |

### `roomGPT/` (MVP)

If you build the free restyle into our own site instead (WORKFLOW.md section 10.4), roomGPT drops out, and so do these items.

| ID | Pri | Change | Where | Why | Status |
|---|---|---|---|---|---|
| R1 | P0 | Send restyles to our image calls (N21) instead of Replicate, and show a clear error when one fails or times out | `app/generate/route.ts:40-69`: Replicate ControlNet with a pinned `version` (`:47`); `while (!restoredImage)` (`:69`) polls with no time limit | Replicate is a paid closed service, which rule 7 (free and open source only) rules out. An endless poll never fails over. And one place in `studio/` that calls the image model serves both this page and the Render agent | ☐ |
| R2 | P0 | Styles and rooms that fit Chinese homes, named in both languages: 现代简约 modern minimalist, 奶油风 cream, 原木风 natural wood, 新中式 new Chinese, 北欧 Nordic, 轻奢 modern luxury, 侘寂 wabi-sabi; 客厅 living room, 卧室 bedroom, 餐厅 dining room, 厨房 kitchen, 卫生间 bathroom, 书房 study, 儿童房 children's room. Rewrite the prompts | `utils/dropdownTypes.ts` (whole file); prompts at `app/generate/route.ts:51-58` | Currently 5 English styles and 6 rooms, including "Gaming Room". Customers use it in Chinese or English (D10) | ☐ |
| R3 | P0 | Replace the Bytescale uploads with our API (N19), which stores them with the order. Allow uploads only after the customer accepts the privacy notice (N18) | `app/dream/page.tsx:7-25, 56`; `NEXT_PUBLIC_UPLOAD_API_KEY` in `.example.env` | Customer photos should be stored with the order, and Bytescale is a paid closed service (rule 7) | ☐ |
| R4 | P1 | Interface work, yours (D15): text in Chinese and English with a language switch, and our branding (D11) | `app/page.tsx`, `app/dream/page.tsx`, `components/Header.tsx`, `components/Footer.tsx`, `app/layout.tsx` | Customers see it, and today it's English only (D10) | ☐ |
| R5 | P1 | Interface work, yours (D15): after a restyle, offer the paid design pack (link to the intake form) | `app/dream/page.tsx` | Turns the free hook into orders | ☐ |
| R6 | P2 | Install dependencies and confirm it builds before editing. Upgrade only what breaks | `package.json` (Next.js ^13.4.4, from 2023) | Old dependencies may not install cleanly | ☐ |
| R7 | P2 | Remove Vercel Analytics, and drop the 5-per-day rate limit (Upstash Redis): our API's daily cap on free items replaces it (N19) | `app/generate/route.ts:10`, `utils/redis.ts`, `app/layout.tsx:1, 42` | Both are closed hosted services that need their own accounts (rule 7) | ☐ |
| R8 | P1 | Interface work, yours (D15): show "AI 生成 · AI-generated" next to every restyled image. The file itself is labelled when it's made (N21), so every copy carries the label | `app/dream/page.tsx` (shows the result; download button at `:262-269`) | China's rules for labelling AI-generated content (in force since 2025-09-01); a restyle isn't a photo of a real room (WORKFLOW.md section 3.5) | ☐ |

### `mcp-for-blender/` (stretch: set up, don't edit)

| ID | Pri | Change | Where | Why | Status |
|---|---|---|---|---|---|
| B1 | P2 | Install Blender 3.0+ and uv, run `uvx mcp-for-blender setup`, set `DISABLE_TELEMETRY=true` in the MCP config | MCP client config (not this repo) | By default it sends an anonymous usage record; your content is only collected if you opt in. Keep both off for customer data | ☐ |
| B2 | P2 | Script: plan JSON + design JSON → Blender room → render | `studio/` (new code, not this repo) | Photoreal renders | ☐ |

### `pascal-editor/` and `SpatialLM/`

No changes planned.

- Pascal: revisit only if floorplan-3d can't handle a customer's plan. Run it with `npx @pascal-app/cli editor` (Node.js 22.23.4+).
- SpatialLM: revisit only if customers send 3D scans and we have an NVIDIA GPU. It needs Python 3.11, PyTorch 2.4.1, CUDA 12.4 and model weights from Hugging Face. Its license fails rule 7: the code is under the Llama 3.2 Community License (`LICENSE.txt`), and its point-cloud encoder weights are CC-BY-NC-4.0, which bans commercial use (README, "License"). Don't use it for customers unless you approve an exception (D9).
- The other four (floorplan-3d, roomGPT, Pascal editor, MCP for Blender) are MIT-licensed, which meets rule 7.

### `twenty/`, `homebox/`, `micasa/`, `home-assistant-core/` (one-stop parts: connect, don't edit)

No changes planned. Our connectors in `studio/` (N9–N13) use them as they are; WORKFLOW.md section 7 shows how they fit. Before building on them:

- Twenty: mostly AGPL-3.0, with an exception for apps that only use its APIs, webhooks and SDK; those apps can stay ours under any license. If we modify Twenty itself and run it for customers, we must offer them our modified source. Files marked `/* @license Enterprise */` need a paid Twenty subscription in production, so rule 7 rules out those features. Running it needs containers: server, worker, Postgres 16 and Redis (`packages/twenty-docker/docker-compose.yml`; there is also a `podman/` folder). Two settings before we run it: set `TELEMETRY_ENABLED=false`, because telemetry is on by default and sends usage events to `twenty-telemetry.com` (`packages/twenty-server/src/engine/core-modules/twenty-config/config-variables.ts:980`, `telemetry/telemetry.service.ts:29`); and pin the Redis image, which the compose file leaves untagged (`docker-compose.yml:136`). Redis 8 and later can be used under AGPL-3.0, but Redis 7.4 isn't open source (rule 7); Valkey (BSD-3-Clause) is an open-source alternative to try.
- Homebox: AGPL-3.0, the same rule if we modify it and run it for customers. Runs on this PC from the official Windows build (v0.27.1) in `runtime/homebox/`: see `studio/README.md`. Also runs in containers.
- micasa: Apache-2.0. A terminal app for one household (Go, SQLite), not a web service. Has a ready-made Windows build (release v2.8.2), or `go install`. Its MCP server (`micasa mcp <database>`) is read-only; records are added through its command line (`add --data`). Customers don't use it; you and the agents do. Leave two features unused: micasa Pro, which syncs through micasa's hosted relay (`https://relay.micasa.dev`, `cmd/micasa/pro.go:26`; the relay's own code is in `cmd/relay/` if we ever need sync), and its AI chat and document extraction, which talk to a model server on the same machine by default (`http://localhost:11434`, `internal/config/config.go:91`) and to OpenAI, Anthropic or others only if configured. Our agents read micasa through its MCP server instead. Its postal-code lookup sends codes to `api.zippopotam.us`, but only when turned on; it is off by default (`config.go:51`).
- Home Assistant: Apache-2.0. Refuses to start on Windows (`validate_os` in `homeassistant/__main__.py`); it needs WSL, Docker or a separate Linux device, and Python 3.14.2+.
- Xiaomi devices: use Home Assistant's built-in integrations (`xiaomi_miio`, `xiaomi_ble` and others, Apache-2.0). Xiaomi's own `XiaoMi/ha_xiaomi_home` is licensed only for personal, non-commercial use and forbids building apps or web services on it.
- This PC has no container engine, WSL or Go yet (checked 2026-11-05). Twenty and Home Assistant need containers: install WSL 2 (MIT) here, then Podman or Docker Engine (both Apache-2.0) inside it, or use the server from D8. Installing WSL needs admin rights and a restart. Not Docker Desktop: it isn't open source (rule 7).

### `studio/` (new: our own code)

| ID | Pri | Build | Status |
|---|---|---|---|
| N1 | P0 | Customer site, part of the interface (yours, built last, D15): the screens in WORKFLOW.md section 10.2 (home page, chat with the Consultant agent, uploads, orders and payment, deliverables, my home, my data), in Chinese and English, on our API (N19) | ☐ |
| N2 | P0 | Customer, home and order records, laid out as in WORKFLOW.md section 5: customers (contact, channel, language, consent, private link stored as a hash), homes (home record, plan JSON, design), orders (package, price, payment: paid, free, simulated or covered by a pass; requirements; uploads; deliverables; task records). Move the demo home to `studio/homes/demo/`. `studio/.gitignore` already keeps real customers' folders out of git and lets the demo home through | ☐ |
| N3 | P0 | The runner and the agents on the MiMo API (WORKFLOW.md section 4). The runner (our code) keeps the task queue, starts tasks on their `due` date, gives each agent only its own tools, stops tasks that run too long, retries, and sends prepared messages when MiMo is down. The agents' instructions go in `studio/agents/`, and the Orchestrator agent plans each order's tasks. Task records with usage (WORKFLOW.md section 5); your sign-offs as tasks to you; a daily check for upkeep due in micasa (N12) and warranties ending in Homebox. Every agent writes in the customer's language | ☐ |
| N4 | P0 | Floor plan image → plan JSON with MiMo vision, checked against the F2 format, plus an overlay image so a person can check it by eye (WORKFLOW.md section 6) | ☐ |
| N5 | P1 | Price table (local materials and labour) and budget sheet generator, in both languages | ☐ |
| N6 | P1 | QA checks: load-bearing walls (a wall of unknown type counts as load-bearing), clearances, budget limit, completeness, and that each deliverable is in the customer's language; our pages opened in a headless browser in both languages | ☐ |
| N7 | P1 | Delivery package in the customer's language, with AI-made images labelled (WORKFLOW.md section 3.5) and only a preview until the payment is confirmed; your daily report; run-record export for the judges | ☐ |
| N8 | P1 | Your console, part of the interface (yours, built last, D15): the screens in WORKFLOW.md section 10.3 (your queue of sign-offs, payments and escalations; messages to send; orders and their task timelines; the daily report), on our API (N19). Until then, the same actions run from the command line (N19) | ☐ |
| N9 | P1 | Home record: one per customer home, shared by every stage. Holds the customer, plan, design, stage and each connected service's IDs. Puts each piece of furniture in the room that contains it, and keeps appliances apart from furniture. Built: rooms with areas, furniture and appliances from the design, the stage, and Homebox's IDs. Twenty's IDs for the customer come with N10, reading a customer's own design with N14, and the language with N15 | ☑ |
| N10 | P1 | Twenty connector: create the person, the home (custom object) and the deal; move the deal stage; receive Twenty's webhooks. Needs containers (D8) and a Twenty API key | ☐ |
| N11 | P1 | Homebox connector: one group per home; rooms → locations, furniture → items with price; invite the customer to the group. Needs a Homebox API key | ☑ |
| N12 | P1 | micasa connector: one database per home; house profile; during construction, the renovation as a project, contractors as vendors, their quotes, and problems as incidents (N17); at move-in, appliances and their maintenance schedule (for example, clean the AC filter every 3 months); later, repairs | ☐ |
| N13 | P2 | Home Assistant connector: rooms → floors and areas, named in the customer's language; a device plan per room. Needs a running Home Assistant (D8) and a long-lived access token. Runs while we set up the customer's Home Assistant, before it goes to their home; after that only if they allow remote access (WORKFLOW.md section 3.3) | ☐ |
| N14 | P1 | Home record from a customer's own design: rooms from the plan JSON (F2), and furniture, room names and walls to remove from floorplan-3d's exported design, instead of only our sample. Needs F1 and F2 | ☐ |
| N15 | P1 | Two languages in our code (D10): a `language` on each customer and home record; room, furniture and appliance names in that language (English from floorplan-3d's `NAMES_EN`, `index.html:356`); Homebox descriptions in it (today `roomDescription` and `itemDescription`, `src/homebox.ts:307-312`, write Chinese only) | ☐ |
| N16 | P0 | Templates for each stage's deliverables in Chinese and English, filled in by the agents and delivered as web pages customers can print to PDF: the free floor plan reading; the floor plan report (buyer and owner versions), viewing checklist and comparison; purchase checklist, cost summary and handover inspection checklist; construction schedule and an acceptance checklist per phase; move-in checklist; the smart-home setup guide. The cost summary takes tax and fee rules from a table we keep for each city, each rule with its source and date. The free reading comes first (phase 1), then the floor plan report (first order, WORKFLOW.md D2) | ☐ |
| N17 | P1 | Construction coordination: compare contractors' quotes with our budget (MiMo reads the quote; a PDF is turned into page images first if MiMo can't read PDFs), check phase photos against the acceptance checklists, keep the problem list, and remind the customer which phase must pass before each payment. Records go to micasa through N12 | ☐ |
| N18 | P0 | Privacy notice and consent in both languages (WORKFLOW.md D7): shown before any upload, consent saved with the customer (which notice, and when). Files deleted a set time after the last order (D7). On request, give customers a copy of their data, or delete it everywhere (files in `studio/`, the Homebox household, Twenty, micasa; backups age out) after you confirm | ☐ |
| N19 | P0 | API and command line: the one way into `studio/` for the interface (WORKFLOW.md section 10.5), roomGPT's page and you. Customers sign in by a private link, you by a key in `.env.local`. Chat with the Consultant agent; uploads checked by content and size, with photo location data removed, and only after consent (N18); orders, payment confirmation, deliverables and previews; your sign-off queue; a daily cap on free items. Until the interface exists, the same actions run as `npm run` commands | ☐ |
| N20 | P0 | The server (WORKFLOW.md D8): our API and runner, floorplan-3d, roomGPT and Homebox (and Twenty once N10 runs) behind Caddy with HTTPS. A daily backup of the customer, home and order folders and Homebox's data to a second place, kept 30 days (D7) | ☐ |
| N21 | P0 | Image calls: restyles and renders through the model chosen in D4, with a time limit and a clear error; the "AI 生成 · AI-generated" label stamped into every image file; results stored with the order. Used by the Render agent and by roomGPT's page (R1). Needs an image library: open source only, license checked when it's added (rule 7) | ☐ |

What `studio/` needs (rule 7): Node.js 24 or later (MIT). For development only: TypeScript 7.0.2 (Apache-2.0) and `@types/node` (MIT). Homebox (AGPL-3.0) runs as its own program. The interface's framework is your pick (D15), and it must be open source too.

Limits of N9 and N11 today:

- Until N10 exists, the deal stage lives in the home record. Once Twenty is connected, Twenty owns it (WORKFLOW.md section 7) and the record keeps only a copy.
- If a sync is cut off mid-request, at most one item can be created twice. Every other rerun is safe.
- Furniture removed from the design stays in Homebox; the sync lists it as "no longer in the design". The customer decides what to delete.
- The invitation link works only on this PC until Homebox runs on a server (D8).
- The record is built from our sample apartment only, not yet from a customer's own design (N14).
- Room and item names and the Homebox descriptions are in Chinese only (N15).

## 5. Change log

Newest first. One line per change.

| Date | Change | Files | How it was checked |
|---|---|---|---|
| 2026-11-06 | Put the project on GitHub (`kakssjs/3dfangwu`, public): our files, with the nine repos as submodules; keys, `runtime/`, real customers' files and the brief kept out. Added `README.md` and how to get Homebox | `README.md`, `.gitignore`, `.gitmodules`, `studio/`, `CLAUDE.md`, `WORKFLOW.md`, `CHANGES.md` | Staged files searched for secrets (none); ignore rules tested; submodules at their baselines; type check and 13 unit tests pass; script check |
| 2026-11-06 | Reviewed the plan end to end and fixed its gaps: what the interface needs (section 10) and your decision to build it last (D15); N19–N21 added; F1, F5, R1, R3–R5, R7, R8, N1–N3, N6–N8 and N16–N18 updated (N8 raised to P1); seven new exceptions | `WORKFLOW.md`, `CHANGES.md` | Customers traced through every stage; facts read in the code; script check |
| 2026-11-06 | Logged your decisions: finish the plan first; Chinese and English (D10) | `WORKFLOW.md` | Rows found (script check) |
| 2026-11-06 | Added R8 and N14–N18; updated F2, F5, R2, R4, N1–N7, N9, N12 and N13; Twenty and micasa notes for rule 7 | `CHANGES.md` | Settings read in Twenty's and micasa's code; tables checked |
| 2026-11-06 | Reworked the plan into one end-to-end journey in two languages, with D10–D14 | `WORKFLOW.md` | Inputs traced stage by stage (5 gaps fixed); references, links and tables checked by script |
| 2026-11-06 | Logged your approval of the two D9 exceptions (MiMo API; WeChat Pay / Alipay) | `WORKFLOW.md`, `CHANGES.md` | Lines found in the file (grep); tables checked |
| 2026-11-06 | Saved the free-and-open-source rule; flagged SpatialLM, Replicate, Bytescale, Upstash, Vercel Analytics, Docker Desktop and Twenty Enterprise; added D9 | `CLAUDE.md`, `WORKFLOW.md`, `CHANGES.md` | Licenses read from LICENSE files and GitHub; tables checked |
| 2026-11-06 | Built the Homebox connector (N11) and a demo home | `studio/` | 6 unit + 5 live tests pass; demo synced twice (56 created, then 56 unchanged) |
| 2026-11-06 | Downloaded and started Homebox v0.27.1 | `runtime/homebox/` | SHA-256 matches the release; status healthy on 127.0.0.1:7745 |
| 2026-11-06 | Built the home record (N9) and set up `studio/` | `studio/` | 7 unit tests pass; type check passes |
| 2026-11-05 | Planned the connectors for the four one-stop parts (N9–N13) and decision D8 | `WORKFLOW.md`, `CHANGES.md` | API routes and commands checked in each repo's code; tables checked |
| 2026-11-05 | Cloned Twenty, Homebox, micasa and Home Assistant core; added them to the rules, the plan and the decision log | 4 folders, `CHANGES.md`, `CLAUDE.md`, `WORKFLOW.md` | HEAD matched GitHub when cloned; `git status` clean; tables checked |
| 2026-11-05 | Logged the one-stop platform direction and the scope note | `WORKFLOW.md` | Both lines found in the file (grep) |
| 2026-11-05 | Created the workflow, tracker and AI rules | `WORKFLOW.md`, `CHANGES.md`, `CLAUDE.md` | Line references checked against the code; `git status` clean in all five repos |
| 2026-11-05 | Cloned the five repos | 5 folders | HEAD matches GitHub's latest commit; `git status` clean |

## 6. How to update this file

1. Before starting an item, set it to ◐.
2. After changing anything, in the same session:
   - set the item to ☑ and add a row to section 2 (date, change, exact files, how it was checked),
   - add a line to section 5,
   - update "Files changed" in section 1 (`git -C <folder> status --short`).
3. A change that isn't listed in section 4 gets a new ID and a reason there first.
4. Never record a check that wasn't actually run.
