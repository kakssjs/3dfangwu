# Workflow: I Renovation, AI renovation design and contractor matching (one-person company)

JUNCTION CHINA 2026 · Xiaomi MiMo track · "OPC · 一人公司"

You are the boss and the only human. Two MiMo agents do the work (D22): one looks after the homeowner from requirements to after-sales, the other matches each inquiry with suitable teams and content. Plain code does the rest. This file is the whole plan, and the final version to build from. It covers:

- what the brief asks for;
- who we serve, and in which languages;
- how a homeowner goes from their requirements to a finished renovation by a contractor they chose;
- how contractors join and are matched with homeowners, with no bidding (D23);
- who does each step, and how the platform is built (one NestJS app);
- what runs today, and what to build next, in order.

- [CHANGES.md](CHANGES.md): what has changed, what has not, and what still needs changing. The item IDs used here (F1, R2, N9 and so on) are defined in its section 4.
- [CLAUDE.md](CLAUDE.md): rules the AI follows in this folder.
- [studio/README.md](studio/README.md): how to run and test what is built.

Last updated: 2026-11-06.

Two words are used throughout:

- A **project** is one renovation of one home, from requirements to after-sales. The API calls it a project (`/api/projects`); earlier versions of this plan called it an order.
- An **order** is a package a homeowner buys for a project: the renovation report or the design package. It can be paid, free or simulated. The first order (第一单) is the first one.

| Section | What it answers |
|---|---|
| [1. The brief, and how we answer it](#1-the-brief-and-how-we-answer-it) | What JUNCTION CHINA 2026 asks for and scores, and where this plan answers each point |
| [2. What the company sells](#2-what-the-company-sells) | Who it's for, what they get, in which languages, and where this plan differs from the team leaders' proposal |
| [3. Boss decisions](#3-boss-decisions-decide-these-first) | What you decide, and what is still open |
| [4. The renovation journey](#4-the-renovation-journey) | Every stage from first contact to after-sales, the contractor's side, and what passes between stages |
| [5. Agent team](#5-agent-team) | Which agent does what, its tools, and what stays with you |
| [6. The platform](#6-the-platform) | How it's built: one NestJS app, its modules, records, API, task records and security |
| [7. Components and everything we use](#7-components-and-everything-we-use) | Every program and service, its license, and what you need to get |
| [8. When things go wrong](#8-when-things-go-wrong) | What happens when a step fails |
| [9. What the interface needs](#9-what-the-interface-needs) | What each screen you build must show and do, and which API routes it calls |
| [10. Development plan](#10-development-plan) | What runs today, how to build the rest, the build order with what "done" means, and the demo checklist |
| [11. Decision log](#11-decision-log) | Every decision you made |

## 1. The brief, and how we answer it

The brief comes from JUNCTION CHINA 2026's AI track, set by Xiaomi MiMo. It's the organisers' document, so it stays off GitHub. In short:

- **The task:** really run a one-person company (OPC) during the 40+ hours.
  - You are its only employee. You lead a team of MiMo agents through market research, product development, content and marketing, customer service and daily operations.
  - Launch a product or service people can reach, find real customers, and close the business loop.
  - A first order (第一单), real or simulated, done at the event, makes the entry stronger.
- **What counts:** not how many agents there are, but how they split the work, hand it over and handle errors, and which decisions only you, the boss, could make.
- **What each team does:**
  - Set the business need: target users, the core need, the product direction and the key tasks.
  - Design how the agents work together: roles, handoffs and what happens on errors.
  - Use AI in real work: code generation and debugging, office documents, brand and interface design, market research and competitor analysis, content and marketing, basic security checks, and browser and desktop operation.
  - Combine these into workflows that run, with products, content, data or run records as proof.
  - Say which work the agents did, which decisions you made, what the team built, how well it works and where it falls short.
- **Support:**
  - MiMo API credits for each team.
  - Integration docs, agent orchestration samples and best practices.
  - MiMo-V2.6-Pro: tool calling, long tasks, multi-agent work and a 1M-token context. It understands and generates text, images, speech and video.
- **Submission (details still to come):** entries go on hackjunction.app, then the best teams give a live demo. An entry needs:
  - a product or service people can reach, shown working;
  - the whole business process (getting customers, delivery, customer service or transactions), with the loop running;
  - a clear human/AI split: how the agents work together, who made the key decisions, and what the team built itself;
  - demo materials or run records the judges can check.
- **Scoring (100 points):**
  - Innovation, 35: the company's form, its organisation and its business loop; the value AI staff bring.
  - Commercial potential, 25: pricing, customer acquisition, unit economics, and whether it can keep running.
  - Completeness, 25: a product people can reach, a loop that can be demonstrated, and real delivery quality rather than a demo.
  - Originality, 15: our own solution, not off-the-shelf tools or agent orchestration put on show.
  - Bonus: a real or simulated first order; a clear human/AI split; a loop that spans several kinds of work; a project others can reuse.

| The brief asks for | Our answer | Where |
|---|---|---|
| Target users, core need, product direction | Homeowners renovating in one city, and the contractors there; a design that contractors can price, and sealed quotes that compare, from teams the platform matched to the job | Sections 2 and 3 (D1, D2, D16, D21, D23) |
| Agents working together: roles, handoffs, errors | Two agents (one for the homeowner, one for matching) with their own tools, a runner in plain code, a task record for every handoff, and a plan for each step that fails. The brief says the key is not the number of agents but the division of work, the exception handling, and the decisions the human makes | Sections 5, 6.5 and 8 (D22) |
| Real productivity work | Code (this repo and its tests), documents (reports, quote sheets, contracts), brand and interface, market and price research, posts, security checks, a headless browser | Section 5 (work types) |
| Workflows that run, with proof | The journey's stages on one API, each handoff a task record, the end-to-end tests | Sections 4, 6 and 10 |
| Who did what | Who does what, and the decision log | Sections 5 and 11 |
| A product people can reach | Our site, the contractor portal and your console on the API; floorplan-3d and Homebox | Sections 9 and 10 |
| The loop running | Attract → requirements → design → matching → contract → construction → acceptance → after-sales, and reviews and referrals back to attract | Section 4 |
| Run records | Task records, the daily report, CHANGES.md | Sections 6.5 and 10.5 |
| Commercial potential | Homeowners pay for design work; after the event, contractors pay per won project; every task record counts its cost | Sections 2 and 3 (D2) |
| Bonus: a first order | The renovation report, paid or simulated, in phase 2 | Section 10.3 |
| Bonus: reusable | `studio/`, the plan format, the quote sheet and the agent instructions, as open source | D14 |

What the judges score (100 points), and where each point is earned:

| Dimension | Points | The scoring asks | Our answer | Where |
|---|---|---|---|---|
| 创新性 Innovation | 35 | Whether the company form, the organisation and the business loop are novel, and whether the AI employees show unique value | A one-person company where two MiMo agents run a whole trade's workflow — design, matching, contracts, construction follow-up — with matching by readable rules instead of open bidding (D23), so the value is the business, not a chatbot | Sections 2, 4 (D16, D22, D23) |
| 商业化潜力 Commercial potential | 25 | Pricing, customer acquisition and unit economics; whether it can keep running | Homeowners pay for design work; contractors pay a fee per won project after the event; every task record counts its tokens and image calls, so the unit economics are measured from real runs before prices are set | Sections 2, 3 (D2), 6.5 |
| 完成度 Completion | 25 | An accessible product, a demonstrable loop, a real delivery standard — not just a demo | One API runs the whole journey with end-to-end tests; the demo walks one project stage by stage; deliverables are print-ready pages in two languages | Sections 4, 6, 10.5 |
| 原创性 Originality | 15 | The team's own solution, not just plugging existing tools or showing agent orchestration | `studio/` is our own code — the API, the fit rules, the home record, the connectors — with tests; the open-source parts are connected, never copied, and the agent team is built to our plan, not wired from a stock framework | Section 7 (`studio/` row) |
| Bonus: a first order | — | A real or simulated transaction | The renovation report, paid or simulated, in phase 2 | Section 10.3 |
| Bonus: clear human/AI split | — | Who decided, who executed | Who does what, the decision log, and every handoff as a task record | Sections 5, 6.5, 11 |
| Bonus: a loop across work types | — | Several productivity scenarios in one loop | Code, office documents, brand and UI, research, content, security checks, browser work | Section 5 (work types) |
| Bonus: reusable | — | Usable by others | `studio/`, the plan format, the quote sheet and the agent instructions, open source | D14 |

## 2. What the company sells

I Renovation (D16) is an AI renovation design and contractor-matching platform, run by two agents (D22):

- Homeowners and contractors register their own accounts (D21).
- A homeowner saves their renovation requirements as a project. **Agent 1**, the homeowner's agent, helps with that: it plans the renovation with them and reads their floor plan.
- Agent 1 can then turn the floor plan into a design package in a full-home style: 2–3 layouts, a 3D view, renders, a material list with quantities, the scope of work and a budget.
- **Agent 2**, the matching agent, matches the project with suitable verified teams in that district, and with relevant content: guides, price references and past cases.
- The homeowner invites up to three of those teams (D23). Each gives one sealed quote on the same job, and nobody sees anyone else's. There is no public board and no bidding.
- The homeowner compares the quotes, each with its contractor's verified profile, and picks one.
- The platform then follows the contract, the construction, the final acceptance and after-sales, with Agent 1 alongside the homeowner.

You approve what matters. Homeowners and contractors use it in Chinese or English.

The journey: requirements (需求) → design (设计, optional) → matching (匹配) → contract (签约) → construction (施工) → acceptance (验收) → after-sales (售后).

What makes it different:

- **The design is a construction reference, not only a picture.** It comes with the scope of work and the quantities that contractors price, so the design and the quotes describe the same job.
- **Matched, not bid for.** Open bidding invites a race to the lowest price, low-balling and malicious competition between contractors, so there is no public board (D23).
  - Agent 2 shortlists the verified teams that fit the project (district, renovation type, budget, style, experience), with the reasons. The homeowner invites up to three.
  - Each invited team has 7 days to decline or give one sealed quote. It can revise it until the pick, never sees another team's quote, and gets no price feedback if it isn't picked.
  - With our design package, every quote prices the same items on one quote sheet, so quotes compare line by line.
  - Our agents flag missing items (漏项), items likely to be added later (增项), and prices far from local rates.
- **One record from the first sketch to the warranty.** The design, quotes, contract, change orders, phase photos and acceptance stay with the project, so both sides have the evidence if something goes wrong.

The nearest competitors are design software (酷家乐, 三维家) and renovation marketplaces (土巴兔, 齐家网). Agent 2 checks what each offers today before any post compares us with them.

### Who it's for (D1)

- Homeowners renovating a home in China, all of it or part: new homes (毛坯) and old ones (旧房翻新). We start in one city, because contractors work locally.
- Chinese speakers first. English speakers living in China get the whole journey in English.
- Owners abroad who are renovating a home in China, in either language. They can rarely visit the site, so comparable quotes and the contractor's progress photos matter most to them.
- Contractors: renovation companies and construction teams (装修公司, 施工队) in that city, who join, get verified and are matched with projects (D17, D23). They are the platform's second side: without enough of them, a project gets no matches.
- Later: more cities, and partners such as independent inspectors and material suppliers (D13).

### What homeowners and contractors get (D2)

| Stage | Free | Paid | Later income |
|---|---|---|---|
| 0 Attract | A restyle of one room photo; a reading of one floor plan (户型解读) | — | — |
| 1 Requirements | The requirement sheet (需求单), checked with the floor plan; saving it as a project, which stays private until the homeowner invites a team | — | — |
| 2 Design | — | Renovation report (also sold alone; the first paid order). Design package: 2–3 layouts, 3D links, renders, material list with quantities, scope of work, budget (报价单), one free revision | — |
| 3 Matching | A shortlist of verified teams that fit, with reasons; inviting up to 3 (D23); one sealed quote from each; comparing them and picking one. With a design package, the quotes on one quote sheet, with flags | — | Contractors pay a fee per won project, after the event (D2) |
| 4 Contract | Final quote checked against the picked quote; the contract from our template, with payment milestones (D18) | — | — |
| 5 Construction | Progress from the contractor, a check at each phase, change orders, a problem list | — | — |
| 6 Acceptance | Acceptance checklist, punch list (整改清单), handover record in Homebox | — | An independent inspector at acceptance, through a partner (D13) |
| 7 After-sales | Upkeep and warranty reminders; repairs sent to the contractor; reviews | — | Referral fees from partners we've vetted (D13) |

Homeowners pay for the design work. Matching, quotes, and everything after them, are free to them.

- With our design package, contractors price the same scope, so the quotes compare line by line.
- Without it, the quotes compare on price, time and each contractor's verified facts.

That difference is what sells the design package. After the event, contractors who win work pay the platform. Prices are yours to set (D2).

### Chinese and English (D10)

You decided customers get the product in both languages (section 11). How it works:

- **One language per person:** each homeowner and contractor sets it when they register (or with the switch on our site). It's saved with their account and with each home record. Agents write to them in it.
- **Templates in both languages:** every template exists in both (reports, design package, quote sheet, comparison, checklists, messages, privacy notice). Agents fill in the template in the reader's language; they don't translate a finished document line by line.
- **Projects and quotes:** each invited contractor reads a project's brief in their language, and the homeowner reads the quotes in theirs. Both come from the same project and invitation records, not from translating one document into the other.
- **The contract:** a contract with a contractor who works in Chinese is signed in Chinese. An English-speaking homeowner gets an English reading copy, which says the Chinese text is the one that counts (D18).
- **Names:** names the reader sees (rooms, furniture, materials) appear in their language. floorplan-3d already has English names for its rooms, materials and furniture (`NAMES_EN`, `floorplan-3d/index.html:356`).
- **Money:** prices are in yuan in both languages (¥ / CNY).
- **Posts:** written for each audience, not translated (D5).
- **Checks:** the deliverable checks (N6) send back any deliverable with text in the wrong language.
- **Later:** Simplified Chinese first. Traditional Chinese can follow cheaply: floorplan-3d, Homebox and Twenty already have it.

| Part | Who sees it | Chinese | English | What's needed |
|---|---|---|---|---|
| Our site, the contractor portal and chat | Homeowners, contractors | To build | To build | Both, with a language switch (N1, N26: you build them, section 9) |
| The API's messages | Shown by the interface | — | Yes (errors) | Each account's language is stored (built); the interface shows its own text for each error, in the reader's language (N15) |
| floorplan-3d | Homeowners, contractors | Yes (简体 and 繁體) | Yes | Keep all three working through F1–F6; the home's title in the reader's language (F5) |
| roomGPT | Homeowners | No | Yes | Chinese text, styles and rooms (R2, R4) |
| Reports, design package, quote sheet, comparison, checklists, messages | Homeowners, contractors | To write | To write | Both templates for every deliverable (N5, N7, N16, N22) |
| Contract | Homeowners, contractors | To write | Reading copy | The template in Chinese, with an English reading copy (N24, D18) |
| Homebox | Homeowners | Yes | Yes | Our room and item names and descriptions are Chinese only today (N15) |
| Privacy notice and terms | Homeowners, contractors | To write | To write | Both, approved by you (N18, D17) |
| Twenty | You and agents | Yes | Yes | Nothing |
| micasa | You and agents | No | Yes | Nothing: homeowners don't use it; they get our reminders in their language |

### Where this plan differs from the team leaders' proposal

The plan follows the leaders' business process (D16). Where a step doesn't fit the event's 40 hours, rule 7 (free and open source only) or China's rules, it does this instead:

| The proposal | This plan | Why |
|---|---|---|
| Sign up with a phone number or WeChat | Accounts with a mobile number and a password, as a homeowner or a contractor (D21); text-message codes and WeChat sign-in later (D12) | Text-message codes and WeChat sign-in are closed services, so each needs a D9 exception |
| Import CAD drawings, or draw the plan by hand | A photo of the floor plan first; CAD and drawing by hand later (N25) | floorplan-3d can't draw walls. The Pascal editor can, but wiring in a second editor doesn't fit 40 hours |
| Drag walls, doors and windows in the online editor | Move furniture, change each room's flooring, remove non-bearing walls, and save versions (F6); other changes by asking in the chat | That's what floorplan-3d does today; it has no tools to draw or move walls, doors or windows |
| Prices from regional labour and material databases | A price table for the first city, collected by Agent 2 and approved by you (N5) | We know of no free, open database of local renovation prices |
| Credit scores and intelligent matching | Matching by rules anyone can read: verified teams in the project's city and district that offer its kind of renovation, each shown with how well its stated price band, styles, experience and local work fit (a tier and the reasons, no score) (D23); verified facts on each profile; a score later (D17) | A new platform has no history to score, and a score built on little data misleads homeowners and is unfair to contractors. Rules anyone can read are easier to trust |
| Competitive bidding (招标): contractors submit bids on published projects | No public board and no open bidding. The homeowner invites up to 3 matched teams, and each gives one sealed quote on the same scope within 7 days. The platform ranks nothing by price, and a team that isn't picked learns nothing about the others (D23) | Open bidding rewards the lowest price over the best fit, invites low-balling that is made up later through change orders, and lets contractors undercut each other. Invitations keep the price comparison and drop the race |
| Electronic contracts | A contract from a template, reviewed by a lawyer; signed on paper during the event; open-source signing later (D18) | A signature must hold up under China's Electronic Signature Law, and most e-signature services are closed (rule 7) |
| Escrow: the platform holds payments and releases them | We never hold money. Homeowners pay the contractor at each milestone, after its check (D19) | Holding other people's money without a payment licence isn't allowed in China (二清). Escrow needs a bank or a licensed payment company, a closed service (D9) |
| AI checks of structure and pipes | Checks for load-bearing walls and wet rooms on the plan; pipes and wiring checked by the contractor on site | A floor plan image doesn't show pipes or wiring. The proposal's own safety note says the AI can't replace an inspection on site |
| Dispute handling and penalties for contractors | Both sides get the same records and we help them talk; the contract and the law settle it. Warnings and suspension are yours (D13, D17) | We aren't a party to the contract. Independent inspectors come later, through partners (D13) |
| Three apps: homeowner, contractor, administration | Three sets of screens on one NestJS API (D20), built by you last (D15); until then, WeChat and the API from this PC | D15. One API keeps prices, quotes and statuses in one place |
| Prototypes in Figma or Axure | Penpot (MPL-2.0), or straight to code | Figma and Axure are closed (rule 7) |
| How the platform earns isn't covered | Homeowners pay for the design work; after the event, contractors pay a fee per won project (D2) | The brief scores commercial potential and unit economics |

## 3. Boss decisions (decide these first)

| # | Decision | Proposal | Status |
|---|---|---|---|
| D1 | Target customer | Homeowners renovating a home in China, all of it or part, new (毛坯) or old, starting in one city because contractors work locally (you pick the city). Chinese speakers first; English speakers living in China; owners abroad renovating a home in China. Contractors in that city are the second side (D17) | Proposed, confirm |
| D2 | Packages and prices | Homeowners: the free reading and restyle; saving a project, matching, the quotes, the contract check, construction tracking, acceptance and after-sales are free (D21, D23); paid: the renovation report and the design package (section 2). First paid order: the renovation report, which needs only MiMo and a template, so it can sell early. The design package (layouts + 3D links + renders + material list + scope of work + budget) is the main product: it makes the quotes comparable line by line. Contractors: free during the event, so the first ones join; after it, a fee per won project (proposal: a share of the contract's value, invoiced by us after signing; no money passes through us, D19). Prices and the refund rule are your call (proposal: a full refund before work starts; after delivery, the free revision instead) | Open |
| D3 | Payment | What homeowners pay us; they pay contractors directly (D19). Real (WeChat Pay / Alipay QR) or a simulated order for the demo. You confirm each payment by hand, so no payment code is needed yet. Foreign visitors can link a foreign bank card in both apps, so English speakers in China can pay the same way (test it with our account first). Homeowners outside China: a simulated order, or another payment service, which would need a new D9 exception. Check whether a merchant account needs a business licence (个体户 or a company), and how a homeowner who asks for an invoice (发票) can get one. Contractors' fees, after the event, come by bank transfer against our invoice, which needs the business licence too | Open |
| D4 | Image model for restyles | MiMo first: the brief confirms MiMo-V2.6-Pro understands and generates images (多模态理解与生成), so it is the first choice once we confirm from the API docs that it edits a photo. Otherwise an image model with an open-source license that we run ourselves (needs an NVIDIA GPU; not picked yet). Replicate, which roomGPT uses now, is a paid closed service, so `CLAUDE.md` rule 7 (free and open source only) rules it out | Open |
| D5 | Channels | Homeowners in Chinese: Xiaohongshu posts, WeChat groups, people at the event. In English: people at the event, expat WeChat groups in big cities, and English posts on Xiaohongshu, which many English speakers joined in 2025. Contractors: you call or visit renovation companies and teams in the first city, and meet them at building-material markets (建材市场) and the event, with a pitch Agent 2 drafts. These are places we post and people we meet, not programs we run, so rule 7 doesn't cover them (confirm) | Proposed, confirm |
| D6 | Human review | You approve every post, every deliverable before it is sent (at least the first 10 orders), and every contractor before they can be matched or invited; you can suspend a contractor at any time; and always anything about money, contracts, disputes or safety. A homeowner's invitation reaches a verified team at once (D23), with no list for you to approve; you see every project and invitation and can close a project that breaks the rules (your console, N8) | Proposed, confirm |
| D7 | Customer data | Floor plans, photos and documents stay in our own storage; third-party telemetry off (Twenty sends usage data to its makers unless `TELEMETRY_ENABLED=false`). A privacy notice in both languages for homeowners and contractors, accepted when they register (which version and when is saved with the account), and deletion on request across every connected part (N18). The notice says the MiMo API reads what agents work on (D9). We ask only for what a stage needs (for children, ages, not names) and remove the location data that phone photos carry. A contractor sees a project only inside an invitation to them, and only its city, district, floor area, layout, renovation type, style, budget range, start date, description and, if there is one, its design package; never the homeowner's name, contact or exact address until the homeowner picks them; the homeowner agrees to this when inviting a team, and the API refuses text with a phone number or email in projects, invitations and quotes. We keep files while the homeowner uses the service and delete them a set time after their last project, unless they keep reminders on (proposal: 12 months); the contract, change orders and acceptance records stay until the warranty ends, because both sides may need them. A contractor's documents stay while they are on the platform and are deleted a set time after they leave (proposal: 12 months). Backups age out after 30 days (N20) | Proposed, confirm |
| D8 | Where it runs | Build and test on this PC. For homeowners and contractors: one Linux cloud server running our site, the contractor portal and the NestJS app with its database (D20), Homebox, and later Twenty in containers (Podman or Docker Engine, both Apache-2.0; N20). You decided the server is Aliyun (阿里云). A mainland server needs ICP filing (备案) before a domain works, which takes days or weeks, so it can't finish during the event unless you file before it; a Hong Kong server doesn't, but it keeps mainland users' data outside the mainland, which China's personal information law (PIPL) treats as a cross-border transfer: the privacy notice must say so and ask for separate consent. Check the current rules before choosing the region | Aliyun decided 2026-11-06; the region is still open (mainland with ICP filing, or Hong Kong) |
| D9 | Exceptions to "free and open source" (rule 7) | The plan still names closed or paid services. Drop Replicate (D4, R1), Bytescale (R3), Upstash and Vercel Analytics (R7), Docker Desktop, SpatialLM and Twenty's Enterprise features. Keep two exceptions only: the MiMo API, which the track requires, and WeChat Pay / Alipay if D3 takes real payments | Decided 2026-11-06 |
| D10 | Languages | Everything homeowners and contractors see, in Chinese and English (section 2). Simplified Chinese first; Traditional later | Both languages decided 2026-11-06; the rest proposed |
| D11 | Brand | The name I Renovation comes from the team leaders' proposal. Still to choose: a Chinese name, a logo and a domain (where it's hosted: D8). Before using a name in public, search 中国商标网 for registered trademarks that clash with it. Agent 2 proposes options; you pick | Name decided 2026-11-06; the rest open |
| D12 | How homeowners and contractors reach us, and how we reach them | Our site's chat is the main channel once the interface exists (D15): Agent 1 answers homeowners there and Agent 2 answers contractors, each in their language, and every message is kept with the project. A homeowner and the contractor they picked message each other on the platform too, so the record is complete if there's a dispute. On WeChat and Xiaohongshu, agents draft replies and you send them: automating a personal WeChat account breaks WeChat's rules. Until the site is up, that's how everyone reaches us, and you introduce a homeowner to the contractor they picked on WeChat. Each person signs in with their own account: their mobile number and a password (D21). Nothing checks yet that the number is theirs: text-message codes, and signing in with WeChat, need closed services, so each would need a new D9 exception; until then you check a contractor's number when you call them (D17). The other way, deliverables, invitations for contractors, follow-ups and reminders go by the channel each person picked: their page on our site, or a WeChat message you send from the drafts in your queue. A WeChat Official Account (公众号) or WeCom (企业微信) could send them automatically, but it's a closed service, so it would need a new D9 exception | Accounts decided 2026-11-06 (D21); the rest open |
| D13 | What we don't do | We design, match and keep the records. We aren't a party to the renovation contract (the homeowner and the contractor are), we don't do building work, we don't hold anyone's money (D19), and we don't certify safety: people licensed for it do and sign off structural, gas and electrical work. In a dispute, both sides get the same records and we help them talk; the contract and the law settle it (section 8). Partner inspectors and suppliers, and referral fees, come later, once you've vetted them | Proposed, confirm |
| D14 | Share our work | Publish `studio/`, the plan format (F2) and the agent instructions as open source so others can reuse them, which the brief rewards. The whole project went on GitHub on 2026-11-06, as you asked: [github.com/kakssjs/3dfangwu](https://github.com/kakssjs/3dfangwu), public, with the nine parts linked rather than copied. Each later push still waits for your OK (`CLAUDE.md` rule 4). Still open: the license. Until there's a `LICENSE` file, others can read the code but not reuse it. Proposal: MIT | Published 2026-11-06; license open |
| D15 | The interface | You build the screens homeowners, contractors and you use (our site, the contractor portal and your console) yourself, last. The AI builds everything behind them, including the API they call (N19), and keeps section 9 up to date with what each screen needs. The brief scores an accessible product shown live, so the API is finished by the end of phase 3 and phase 4 keeps its time for the interface (section 10) | Decided 2026-11-06; the first version is built by the AI now (D25) |
| D16 | What the company is | I Renovation: AI renovation design and contractor matching (section 2), from the team leaders' proposal, replacing the one-stop housing journey. Viewing (看房), purchase (购房) and the handover inspection (验房) are dropped, and so is the smart home scene (Home Assistant). What was built for move-in now serves acceptance and after-sales: Homebox holds the handover record | Decided 2026-11-06; smart home dropped the same day |
| D17 | Contractors | Who joins: renovation companies and construction teams working in the first city (D1). They register a contractor account and send their business licence (营业执照), which you check on the national enterprise credit system (国家企业信用信息公示系统), the construction qualifications they claim, and at least 3 real past projects with photos. You verify each one before they can be matched or invited; changing a fact you checked sends them back to you. On their profile they also state the styles they work in and their usual price per m², which Agent 2's matching uses (D23). Contractor terms, in both languages and approved by you: quotes only on our forms; no fake projects or reviews; no contact with a homeowner before being picked; prices change only through a change order the homeowner approves; no paid placement in shortlists or comparisons; warnings and suspension decided by you. Profiles show verified facts and reviews from projects finished on the platform; a score comes once there are enough of them. Free during the event (D2) | Proposed, confirm |
| D18 | Contract and signing | A template based on the model contract for home renovation that local authorities publish (示范文本): scope, materials (brand and model), schedule, payment milestones tied to each phase's acceptance, how changes are approved and priced, delays, and the warranty periods the law sets. A lawyer reviews it before any real use. We aren't a party (D13). During the event, the test project's contract is a filled-in sample. Later, online signing with a tool we run ourselves, open source only (DocuSeal is AGPL-3.0), once a lawyer confirms its signatures count under China's Electronic Signature Law. The Chinese text is the one that counts; English speakers get a reading copy | Open |
| D19 | Payment protection | We never hold homeowners' or contractors' money (D13). Homeowners pay the contractor directly at each milestone, once that phase has passed its check on the platform; the last payment comes after acceptance. Collecting money for others and paying it out without a payment licence is unlicensed payment business in China (the "二清" problem), so the proposal's escrow can only come later, through a bank or a licensed payment company: a new D9 exception, after a lawyer checks the current rules. Until then we say what we check, not that the money is safe | Open |
| D20 | The backend | NestJS (MIT) runs the whole backend as one app in `studio/`: the API for the interface, floorplan-3d and roomGPT's page; the runner with the agents' tools; the connectors; and your console's routes. Records live in PostgreSQL through Drizzle ORM (Apache-2.0). On this PC, PostgreSQL runs inside the app's own process (PGlite, Apache-2.0), so no database server is needed; on the server (D8) it can stay that way or move to a PostgreSQL server by changing one file. Uploads and deliverables are files next to it (section 6) | NestJS decided 2026-11-06; the database proposed, confirm |
| D21 | Accounts | Two kinds of account, registered with a mobile number and a password: homeowners, who renovate, and contractors, who take the work. Signed-in homeowners can browse verified contractors and their qualifications. A homeowner saves their renovation requirements as a project, with or without our design package. Every project and every invitation has its own link on our site. How teams are matched to a project, who sees what, the quotes and the pick are D23, which replaced the open board this decision first described | Decided 2026-11-06; the board replaced by D23 |
| D22 | Two agents | Exactly two MiMo agents, replacing the eleven this plan had. **Agent 1, the homeowner's agent,** takes a homeowner from requirements to after-sales: renovation planning, floor plan upload and reading, full-home design styles, quotes read side by side, the contract draft, construction follow-up, acceptance and after-sales. **Agent 2, the matching agent,** matches each inquiry with suitable verified teams and with relevant content, and does the supply-side work: contractor verification sheets, profiles, replies and posts. What the old Orchestrator did is plain code in the runner, the old QA's checks are code (N6), and the rest stays with you (section 5). Fewer agents means fewer handoffs to fail and one place to look when something does | Two agents and their two jobs decided 2026-11-06 (your message); how the work divides, proposed, confirm |
| D23 | Matching instead of bidding | Open bidding is removed. It rewards the lowest price over the best fit, invites low-balling that is made up later through change orders, and lets contractors undercut each other in public. Instead: (1) a project is private to its homeowner, with no public board; (2) Agent 2 shortlists the verified teams in the project's city and district that offer its renovation type, each with a fit tier (strong, good or possible) and the reasons, from rules anyone can read: the team's stated price per m² against the budget, its styles, its years in business and its past projects in the district. The platform never sorts or filters by price, and a place in the list can't be bought (D17); (3) the homeowner invites up to 3 teams at once, each at most once per project; (4) an invited team has 7 days to decline or give one sealed quote on the same scope, which it can revise until the pick, and a team whose open invitations already equal what it can take at once (`maxConcurrentProjects` on its profile) isn't offered; (5) no team sees another team, another's price or who else was invited; (6) the homeowner picks one quote, then the two get each other's name and phone (D7), and every other open invitation closes as not selected, with no word on prices. Proposed with it: the numbers 3 and 7, no way for a homeowner to withdraw an invitation, a price guard against low-balling (the scope sheet and price table, N5, N22), and a reminder then closing for a homeowner who never picks | Removing bidding decided 2026-11-06 (your message); the replacement is my proposal, adopted for now, confirm |
| D24 | Agent framework | Our NestJS runner stays the orchestrator of the two agents (D22): it owns the queue, the retries, your sign-offs and the run records. Inside Agent 1's design work (tasks at the `design` stage) the agent runs on Deep Agents JS (`deepagents`, MIT, on LangGraph.js): a planning list, an in-memory scratch file system and a sub-agent per room. It gets only the agent's own tools, never the disk or a shell, and LangSmith tracing stays off (D7). Not chosen: DeerFlow (research flows; optional later for Agent 2's price research, as a separate Python service), CrewAI and AutoGen (they would duplicate the runner) | Deep Agents decided 2026-11-07 (your message); the split with the runner is my proposal, confirm |
| D25 | The interface is built now, by the AI | The first working version of the three sets of screens (homeowner, contractor and your console) is built now, in `studio/web/`, and served by the NestJS app at `/` next to the API at `/api`, so no cross-site access is needed. It is plain JavaScript modules and CSS: no build step, no frontend framework and no new runtime package, so every file stays readable and rule 7 isn't touched. It covers what the API already does, in both languages and sized for a phone: registering with the notices, the contractor's application and review, projects, matches, invitations, sealed quotes, the pick, browsing contractors, and the console (review, the task queue with your decisions, the runner). Screens for what isn't built yet (chat, uploads, orders, design, contract, construction, acceptance, after-sales) come with their modules. A framework can replace the modules later if you want one. The page's content policy allows scripts and styles from our own address only | Decided 2026-11-07 (your message); plain modules rather than a framework is my proposal, confirm |

Prices must cover what an order costs us (MiMo tokens + image calls). Every task record counts both (section 6.5), so the free readings and test orders in phase 1 give the real cost per package before you set D2's prices. Matching and construction tracking are free to homeowners but still cost tokens (reading quotes and phase photos), so after the event the contractor fee must cover them. The judges score unit economics.

## 4. The renovation journey

### 4.1 The whole journey

```mermaid
flowchart LR
    A["0 Attract · 获客"] -->|leads| R["1 Requirements · 需求"]
    R --> D["2 Design · 设计"]
    R -->|match without a design| B["3 Matching · 匹配"]
    D -->|match with the design package| B
    K["Contractors join · 入驻"] -->|verified| B
    B --> C["4 Contract · 签约"]
    C --> W["5 Construction · 施工"]
    W --> X["6 Acceptance · 验收"]
    X --> S["7 After-sales · 售后"]
    S -.->|review, referral| A
    S -.->|reviews, finished projects| K
    S -.->|new project, same home| R
```

A homeowner can stop after any stage: the design package is useful on its own. There are several ways through:

- Save the requirements as a project and go straight to matching (D23), or get the design package first, so the quotes price the same scope.
- A homeowner who already has a contractor can bring them onto the platform (D17), have them verified, and invite them directly, skipping the shortlist.
- A homeowner who starts with a design from elsewhere gives us what the earlier stages would have produced (4.5).

Each stage runs the same work cycle (4.2) with its own work (4.3). Contractors join and answer invitations through their own steps (4.4).

Stages 1–7 are the project's stages, and the home record's: `requirements`, `design`, `matching`, `contract`, `construction`, `acceptance`, `after-sales`.

- Attract comes before a project exists.
- After acceptance, the home stays at `after-sales` until a new project starts again at `requirements`.
- Today the API's project records cover matching: a project is open, then awarded or closed, with its invitations and quotes. The other stages get their records as they are built (section 10).

### 4.2 The work cycle (every stage)

```mermaid
flowchart LR
    A["1 Lead · Agent 2"] --> B["2 Consult · Agent 1"]
    B --> C["3 Order · Agent 1"]
    C --> D["4 Work · Agent 1 or Agent 2"]
    D --> E{"5 Check · code"}
    E -->|fail| D
    E -->|pass| F["6 Deliver ★ · runner"]
    F -->|you send it back| D
    F --> G["7 Follow-up · Agent 1"]
    G -->|revision| D
    G -->|next stage| B
    G -.->|review becomes content| A
```

★ = waits for you.

- You approve the deliverables. A paid order's deliverables are released only once you've confirmed the payment.
- Work starts as soon as the order is placed, so your payment check never holds the agents up.
- A deliverable you send back returns to Work with your note.
- From matching on, the stages are free: they run the same cycle without a payment, and part of the work comes from contractors (4.4).

| Step | What happens | Agent | Uses | Output | You |
|---|---|---|---|---|---|
| 1 Lead | A post, a free item, a referral or a follow-up brings someone in | Agent 2 | Posts (D5), free items (section 2) | Lead: name, contact, language, stage, where they came from | Approve posts before they go out |
| 2 Consult | Find the homeowner's account, or help them register (D21), and the home if we already know it; collect what this stage needs (4.5); explain the packages; consent is given at registration (D7) | Agent 1 | Site chat and intake form (N1), or WeChat through you until then (D12) | Requirement sheet (需求单), or what this stage adds to it | |
| 3 Order | Confirm the package; the homeowner pays by QR, or the order is free or simulated. Work starts at once | Agent 1 | Payment QR (D3), order record (N2) | Order record | Confirm the payment by hand, before step 6 |
| 4 Work | The stage's agent makes its deliverables, from the homeowner's input and, from matching on, the contractors' | Agent 1, or Agent 2 in matching (4.3) | Section 4.3 | Deliverables and task records (section 6.5) | Only on exceptions (section 8) |
| 5 Check | Check the deliverables against the stage's checklist, the requirement sheet and the reader's language | The runner's code | Checklists (N6) | Pass, or back to the agent at fault | |
| 6 Deliver | Release the deliverables in the homeowner's language, on their page on our site or by their channel (D12). Unpaid: a preview only | Runner | Delivery package (N7) | Delivery message | Approve before it goes out (D6), or send it back with a note |
| 7 Follow-up | One free revision; feedback; offer the next stage when it's due (for example matching, once the design is confirmed); ask for a review or referral | Agent 1 | Follow-ups the runner schedules (N3) | Review (reused as content in step 1), next order | Handle complaints |

### 4.3 Stage by stage

Every stage needs the agents and the runner, our code that runs their tasks (N3, section 5). Each stage's "Built today" line says what exists and what else it needs.

#### 0 Attract (获客)

- **Agent:** Agent 2.
- **Does:**
  - Posts in both languages: before/after restyles, floor plan readings, price references from our price table (N5), and finished projects from real projects, with the homeowner's and the contractor's OK. Posts are drafted from the content library (N28).
  - Drafts replies to comments; you send them (D12).
  - Watches competitors (酷家乐, 三维家, 土巴兔, 齐家网).
  - Drafts the pitch for contractors (D5, D17).
- **Free items:** restyle one room photo (roomGPT's page, through our image calls, N21); read one floor plan (MiMo: a short version of the renovation report, N16). After a restyle, the page offers the design package and links to registration (R5).
- **Limits:** one free item per person, and a daily cap on all free items so the MiMo credits last (N19).
- **Passes on:** leads → Agent 1; contractors who want to join → the verification steps in 4.4.
- **You:** approve every post (D6), then post it yourself. Check each platform's rules before automating any posting.
- **Built today:** nothing. Needs N16, N19, N21, R1–R8, D4, D5, D11.

#### 1 Requirements (需求)

- **For:** homeowners about to renovate, signed in with their own account (D21).
- **Homeowner gives:**
  - The home: its city and district, floor area (建筑面积) and usable area (套内面积), and whether it's new (毛坯) or old.
  - A floor plan image (the developer's plan, a photo of it, or a listing screenshot) and 2–3 measured walls. For an old home, photos of the rooms.
  - The household: how many people, older people, children's ages, pets, special needs.
  - The renovation type (whole home, part of it, old home, new home), and the walls they want removed.
  - Style (for example 现代简约, 北欧, 奶油风, 轻奢, 新中式, 工业风), budget, and material preferences (flooring, tiles, paint, cabinets, bathroom fittings).
  - Wishes (storage, smart-home wiring, pets, a home office, a children's room), and when they want to start.
- **Agent:** Agent 1, which also reads the floor plan; the code checks (N6).
- **Does:**
  - MiMo reads the plan image: rooms, labelled sizes, areas, and which walls the plan marks as load-bearing. Once F2, F1 and N4 work, it becomes plan JSON, which gives exact areas (N9) and a 3D view in floorplan-3d.
  - Agent 1 checks the requirement sheet is complete and asks for what's missing. A wish that breaks a rule (removing a load-bearing wall, turning a bedroom or balcony into a bathroom or kitchen) is noted with the reason it can't be done as asked.
  - No usable floor plan image: the homeowner measures the rooms with our guide, or the contractor measures at the site visit (stage 4). Importing CAD files and drawing by hand come later (N25).
  - Saving (D21): once the sheet is complete, the homeowner saves it as a project, then goes on to design first or straight to matching (stage 3). A project holds:
    - a title, the city and district, the floor area and layout;
    - the renovation type and style;
    - the budget range and the desired start;
    - a description of what to do.
  - A project is private to its homeowner: a team sees a brief of it only inside an invitation (D7, D23).
  - The API refuses a project whose text carries a phone number or email address (D7).
- **Homeowner gets:** the requirement sheet to confirm; the free floor plan reading if they asked for it; the project's link once it's saved.
- **Passes on:** the requirement sheet, plan JSON and home record (stage `requirements`) → design; or the saved project → matching.
- **You:** only when the plan can't be read (section 8).
- **Done when:** the requirement sheet is complete and the plan JSON passes its check, or the project is saved.
- **Built today:** registering, and saving requirements as a project, on the API (N19, N22); room areas from a plan (N9). Needs N2, N16, N18; F2, F1 and N4 for plan JSON and 3D.

#### 2 Design (设计)

- **For:** homeowners with a complete requirement sheet who want the design work, and quotes that price the same job (the paid product, D2).
- **Homeowner gives:** answers to Agent 1's questions; later, their own edits in floorplan-3d and change requests in the chat.
- **Agent:** Agent 1, for the design, the renders, the budget and the revision; the code checks (N6).
- **Does:**
  - The renovation report (户型与改造报告, D2), sold alone or as the start of the design package. It covers what works in the home; what the renovation can change and what it can't (load-bearing walls, wet rooms); whether the household's furniture fits; and what to settle before design.
  - 2–3 layouts, each in a full-home style (全屋风格) applied to every room: with the homeowner, Agent 1 picks the styles (for example 现代简约, 奶油风, 北欧) and writes design JSON for each.
    - Each piece of furniture is one of floorplan-3d's furniture types (`LIB`, `floorplan-3d/index.html:471`), with its centre, size and rotation in mm (`:504`).
    - Each room has its name and flooring. The walls to remove are marked (non-bearing only).
    - floorplan-3d shows each layout in 2D and 3D, opened through our API (F1).
  - Editing: in floorplan-3d the homeowner moves and adds furniture, changes each room's flooring and removes non-bearing walls, then saves the result as a new version (F6).
    - It can't draw or move walls, doors or windows. For those, and for anything else (colours, lighting, style), the homeowner asks in the chat and Agent 1 makes a new version.
    - Every version is kept, so versions can be compared.
  - Renders: each layout's rooms restyled by the image model, from the 3D view or a photo of the room (N21). Photoreal renders with Blender are a stretch.
  - Material list and budget (报价单): quantities from the layout × our price table for the first city (N5), each line with its source. floorplan-3d's own flooring estimate uses the same table (F4), so the two always agree.
  - Scope of work (施工范围): what is done in each room and trade (demolition, plumbing and electrics, waterproofing, tiling, carpentry, painting, installation), with quantities. This is what contractors price (stage 3).
  - The code checks (N6) test the design:
    - no load-bearing wall is removed or cut into;
    - no room without waterproofing becomes a bathroom or kitchen;
    - doors open, and walkways are wide enough;
    - the quantities add up, and the budget fits.
    - A wall the plan doesn't mark as load-bearing or not counts as load-bearing, until the homeowner shows the developer's or property management's drawings.
- **Homeowner gets:** renovation report; design package: layouts, 3D links, renders, material list, scope of work, budget; one free revision.
- **Passes on:** the confirmed version (design JSON, scope of work, quantities, budget) → the project, for matching (N22); furniture and appliances → home record (N14) → handover record at acceptance.
- **You:** approve before delivery (D6).
- **Done when:** the homeowner confirms one version (one free revision included).
- **Built today:** nothing of ours. floorplan-3d, unchanged, lays out furniture, changes each room's flooring and removes non-bearing walls for its one built-in sample flat. Needs N16, F2, F1, F6, N4, N5, N6, N21, N14, D4, and the server for the 3D link to work outside this PC (N20).

#### 3 Matching (匹配)

- **For:** homeowners with a saved project, with or without a design package.
- **Homeowner gives:**
  - the project (stage 1), with the budget range they accept and when they want to start;
  - their agreement that a brief of the project goes to each team they invite (D7).
- **Agents:** Agent 2 matches; Agent 1 reads the quotes for the homeowner; the code checks (N6).
- **Why not bidding (D23):** a public board where contractors bid for projects rewards the lowest price over the best fit. It invites low-balling, with the difference made up later through change orders, and contractors undercutting each other. So a project is never shown to a contractor who hasn't been invited: the homeowner sees a shortlist, invites a few, and compares sealed quotes.
- **Does:**
  - **Match the inquiry with teams.** Agent 2 reads the project and asks the API for its shortlist (`GET /api/projects/<id>/matches`):
    - Only verified teams (D17) that work in the project's city and district and offer its renovation type are listed. A team that already has as many open invitations as it can take at once is not.
    - Each team comes with a fit tier (strong, good or possible) and the reasons: how its stated price per m² compares with the budget, whether it works in the style, its years in business, and its past projects in that district. No score is shown.
    - Rules decide the list and its order, not Agent 2. Agent 2 explains the shortlist in the homeowner's language and can say what would change it (for example a wider budget), but it can't add, drop or reorder a team. Ties go to the team with fewer open invitations, then to a shuffle fixed per project, so no team is always first. Nobody can pay for a place (D17).
    - The platform never sorts or filters by price.
  - **Match the inquiry with content.** Agent 2 picks what is relevant to the homeowner's question from our content library (N28): guides (for example what a quote should include), price references for the city, style references, and cases from teams' past projects. It names the source of each item.
  - **Invite:** the homeowner invites up to 3 teams at once, each at most once per project.
    - An invitation carries a short message and a brief of the project: no name, contact or exact address (D7), and the design package if there is one.
    - Text with a phone number or email is refused.
    - A team sees only its own invitation: not the other teams, and not their quotes.
  - **Answer:** each team has 7 days to decline, or to give one sealed quote on the same scope. It can revise the quote until the homeowner picks. A quote has:
    - the total price, with labour, materials and the management fee if they split it out;
    - how many days the work takes, and the earliest start;
    - the main materials (brand and model);
    - their note and suggestions on the design.

    An invitation nobody answers in 7 days counts as expired, and its place is free again.
  - **With a design package, the quote sheet:** one standard sheet per project, prefilled with the scope of work's items and quantities (N5).
    - Each team fills in unit prices for labour, main and auxiliary materials, demolition, and design and management fees; anything extra; the brand and model of each main material; the start date and schedule; and their suggestions on the design.
    - A team that sends its own quote instead gets it turned into our sheet by Agent 1, and confirms it.
  - **Questions** from invited teams go through Agent 2. The homeowner's answer goes to every invited team, without saying who they are, so all quotes rest on the same facts.
  - **Comparison:** the homeowner reads the quotes side by side, in the order they came in and never sorted by price, with each team's verified profile next to its quote: licence number, qualifications, years in business, team size, past projects and, later, reviews from projects on the platform (D17).
    - With a quote sheet there are flags too: missing items (漏项), items priced "as measured later" (按实结算) or likely to be added later (增项), prices far above or below our price table, schedules that don't fit the work, and design suggestions worth a look.
    - We show facts and flags. We don't rank teams or pick one for the homeowner.
  - **The pick:** the homeowner picks one quote.
    - Only then do the two get each other's name and phone.
    - Every other open invitation is marked not selected, and those teams are told and thanked, with no word on the price that won.
    - Or the homeowner closes the project without a pick.
  - **Links:** every project and every invitation has its own link on our site (`<site>/projects/<id>` and `<site>/invitations/<id>`). A project's link opens only for its homeowner, and an invitation's only for the team invited and the homeowner.
- **Homeowner gets:** the shortlist with its reasons, and relevant content; the quotes, each with its team's profile; the chosen team's contact.
- **Passes on:** the chosen quote and team → contract.
- **You:** verify every contractor before it can be matched or invited (D6, D17); suspend one who breaks the terms; anything a contractor disputes.
- **Done when:** the homeowner picks a quote, or closes the project.
- **Limits:**
  - A quote is the team's offer from the requirements or the drawings; the price in the contract comes after they measure the site (stage 4).
  - Sealed quotes and 3 invitations make a race to the bottom harder, not impossible: a team can still quote low and ask for more later. The scope sheet, the flags and the homeowner's approval of every change order (stage 5) are the guard. A price guard on the quote sheet (N22) is still to build.
  - Where few verified teams work in a district, the shortlist may be short or empty. The homeowner then waits for more teams, or brings their own contractor (4.1).
  - A homeowner can't withdraw an invitation yet. One who never picks keeps the quoted teams' places occupied: the runner will remind them, then close the project (N3).
  - A team's capacity counts its open invitations only, not jobs already under way, because the API doesn't track construction yet.
- **Built today:** the shortlist rules, invitations, sealed quotes, the pick with the contact exchange, closing and the links, on the API (N22, N19), with end-to-end tests. Still to build:
  - Agent 2's explanation of the shortlist, and the content library with its matching (N28);
  - telling teams about an invitation, and thanking those not picked;
  - questions and answers;
  - attaching the design package; the quote sheet and its flags (N22, N5);
  - reading a team's own quote with MiMo;
  - the reminder, then closing, for a homeowner who never picks.

#### 4 Contract (签约)

- **For:** a homeowner and the contractor they picked.
- **Homeowner gives:** a time for the site visit; then their OK on the final drawings, the final quote and the contract.
- **Contractor gives:** the site's measurements and findings (walls, pipes, wiring, damp), the design changes the site needs, the construction drawings (施工图), the final quote, the schedule and the team.
- **Agents:** Agent 1 (updates the plan and design to the measurements, checks the final quote); Agent 2 (arranges the visit with the contractor); the code checks (N6).
- **Does:**
  - Site visit (上门量房): the contractor measures and inspects. Their measurements correct the plan JSON, and Agent 1 makes the confirmed design fit the site, marking what changed and why.
  - Final quote check: line by line against the picked quote. Every difference needs a reason (a measurement, a site finding, a change the homeowner asked for), and the homeowner sees each one before signing.
  - Contract from our template (D18): scope, materials with brand and model, schedule with start and finish dates, payment milestones tied to each phase's acceptance, how changes are approved and priced, delays, and the warranty.
  - Before work starts: the homeowner registers the renovation with property management (装修申报), which China's renovation rules require (N24); the contractor uploads photos of the home as it is.
  - Signing: during the event, a filled-in sample on the test project; later on paper or online (D18). We aren't a party to the contract (D13).
- **Homeowner gets:** the final drawings, the final quote with its differences from the picked quote, the contract to sign, the payment schedule.
- **Passes on:** contract, schedule, payment milestones, final quote → construction.
- **You:** approve the contract template (D18) and anything that departs from it.
- **Done when:** both have signed.
- **Built today:** nothing. Needs N24, N22, N16, D18.

#### 5 Construction (施工)

- **For:** homeowners whose contract is signed.
- **Contractor gives:**
  - Progress at each phase, in the usual order: demolition 拆改 → plumbing and electrics 水电 → waterproofing 防水, with a water test 闭水试验 → tiling 泥瓦 → carpentry 木工 → painting 油漆 → installation 安装 → cleaning 保洁.
  - Photos and videos, and material deliveries (brand, model, quantity).
  - A new finish date whenever it moves.
- **Homeowner gives:** feedback and change requests; their OK or no on each change order; their own photos when they visit.
- **Agent:** Agent 1, which follows the construction and prices change orders; the code checks (N6).
- **Does:**
  - Phase checks: the contractor's photos against that phase's acceptance checklist, plus what the homeowner should check by hand on site (for example tapping tiles for hollow spots, or watching the water test). Pipes and wiring are photographed before they are covered.
  - Material checks: deliveries against the contract's brands, models and quantities.
  - Change orders (变更, 增项): the contractor writes up any change to scope or price with its reason; Agent 1 checks the price against our table; the homeowner approves it on the platform before the work is done.
  - Problem list: each problem with photos, who fixes it, and when it was fixed.
  - Delays: a phase that runs late gets a reason and a new date from the contractor, and the homeowner is told.
  - Payment reminders: which phase must pass before the homeowner pays the contractor's next instalment. Homeowners pay contractors directly, never through us (D19).
- **Homeowner gets:** the schedule, a report per phase, change orders to approve, the problem list.
- **Passes on:** installed items (brand, model, warranty) and the finish date → acceptance.
- **You:** anything about safety (structure, gas, electrics); work done without an approved change order; disputes (section 8).
- **Done when:** the contractor asks for final acceptance.
- **Limits:** we check photos against checklists; we don't certify safety. People licensed for it do and sign off structural, gas and electrical work (D13).
- **Built today:** nothing. Needs N17, N24, N16. A renovation takes months, so during the event this stage runs on a test project with sample photos (section 7).

#### 6 Acceptance (验收)

- **For:** homeowners whose contractor has finished.
- **Contractor gives:** the request for final acceptance, final photos, photos or drawings of where the hidden pipes and wiring run, and the documents for installed items (warranty cards, manuals).
- **Homeowner gives:** what they found walking through the home with our checklist; their acceptance.
- **Agent:** Agent 1, for the acceptance checks and the handover record; the code checks (N6).
- **Does:**
  - Final acceptance checklist (竣工验收): electrics (every socket and switch), plumbing (pressure, leaks, drains), waterproofing, walls, floors and tiles, doors and windows, cabinets, cleaning.
  - Punch list (整改清单): each problem the homeowner finds, with a photo and a date; the contractor fixes it and shows a photo; the homeowner checks it again.
  - Acceptance: the homeowner confirms, the last payment is due under the contract, and the warranty starts (its minimum periods: N24).
  - Handover record:
    - The home's rooms, furniture and installed items go into the homeowner's own Homebox household (N11, N27), with price, brand, model and warranty.
    - Appliances go into micasa with their upkeep schedule (N12).
    - The homeowner gets a one-time sign-up link.
- **Homeowner gets:** the acceptance report, the punch list until it's closed, the Homebox invitation, the warranty dates.
- **Passes on:** warranty dates, the upkeep schedule, and the project's record for the contractor's profile (on time, phases passed first time) → after-sales.
- **You:** approve each invitation link before it is sent (it opens the homeowner's household); a homeowner who won't accept (section 8).
- **Done when:** the homeowner has accepted and the punch list is closed (or they accept with items still open).
- **Built today:** N11 (Homebox: rooms, furniture, prices, sign-up link), tested on the sample flat on this PC. Needs N17, N27, N14, N15, N12, N16, and the server, so links work outside this PC (D8, N20).

#### 7 After-sales (售后)

- **For:** homeowners whose renovation is accepted.
- **Agents:** Agent 1 (reminders and repairs); Agent 2 (reviews into profiles, and cases into content).
- **Does:**
  - Reviews: the homeowner rates the contractor on quality, service, clear prices and keeping to time, with photos. Only homeowners with a project finished on the platform can review, so every review is real. It goes on the contractor's profile (D17).
  - Cases: with the homeowner's OK, the finished project becomes a case on our site, and Agent 2 uses it in posts and in the content library (N28). A case shows the before and after, the design, the budget range, and the district without the address.
  - Warranty and repairs: a repair request goes to the contractor with its photos and the warranty terms, and we follow it until it's fixed. Repairs are logged as micasa incidents.
  - Upkeep: every day the runner asks each home's micasa database what is due (`micasa status --json`, `micasa/cmd/micasa/status.go:48`) and asks Homebox which warranties end soon. Agent 1 writes the reminders, which go by the homeowner's channel (D12).
  - A new project in the same home (for example a child's room) starts again at requirements, with the same home record.
- **Homeowner gets:** reminders and help with repairs, in their language.
- **Passes on:** reviews and cases → attract and the contractor's profile; new projects → requirements.
- **You:** complaints; a repair the contractor won't do; publishing a case or review (only with the homeowner's OK).
- **Done when:** ongoing. The homeowner can stop reminders at any time.
- **Built today:** nothing. Needs N23, N12; warranty dates are read with N11's Homebox client.

### 4.4 The contractor side

Contractors are the platform's second side. Their steps run alongside the homeowner's stages.

| Step | What happens | Agent | Output | You |
|---|---|---|---|---|
| Join | A company or team registers a contractor account (D21) and applies: company name, company or team, licence number (统一社会信用代码), the construction qualifications they claim, city, districts, renovation types, the styles they work in, their usual price per m², years in business, team size, how many projects they can take at once, a description, and past projects (D17: at least 3, with photos). They accept the contractor terms and the privacy notice when they register (N18) | Agent 2 | Application (built); the licence and project photos as uploads (N23, planned) | |
| Verify | Checks that the documents are complete and agree with each other (names, licence number, dates), and flags past projects that look doubtful | Agent 2 | Verification sheet (planned) | Check the licence on 国家企业信用信息公示系统, then verify or reject it, with a note the contractor sees ★ (built) |
| Profile | The verified facts, qualifications and past projects, shown to signed-in homeowners and next to each quote (built); later, reviews; both languages (N15) | Agent 2 | Profile | |
| Be matched and invited | Agent 2 matches each project with suitable teams (the shortlist, 4.3 stage 3) and the homeowner invites up to 3. The team sees only its own invitation's brief, and answers within 7 days: decline, or one sealed quote, revisable until the pick (built); asks questions (planned) | Agent 2 | Decline or quote (built) | |
| Win | Gets the homeowner's name and phone (built); visits the site; sends the final drawings and quote; signs the contract (stage 4) | Agent 2 | Final quote, contract | |
| Build | Uploads progress, deliveries and change orders; fixes problems; asks for acceptance (stages 5 and 6) | Agent 1 | Phase records | Disputes |
| Get paid | The homeowner pays each milestone directly, once its phase has passed (D19) | Agent 1 | Payment reminders | |
| Reputation | Reviews and each project's record (on time, phases passed first time, complaints upheld) build the profile; a score comes once there are enough finished projects (D17) | Agent 2 | Updated profile | Warnings and suspension ★ (suspension built) |

- **Before the pick:** a contractor never gets a homeowner's name, contact or exact address (D7).
- **Changes after verification:** changing a fact you checked sends a verified contractor back to review: company name, kind, licence number, qualifications, city, years in business or past projects. A rejected contractor who saves their application again is reviewed again. Both are built.
- **Suspension (built):**
  - A contractor you suspend can't be matched, invited, answer an invitation or be picked.
  - Their un-picked invitations stop showing to homeowners.
  - A quote already picked stays, and those homeowners are told (the telling is planned).
- **Before the contractor portal (N26):** contractors register and answer invitations with your help. You send them an invitation's link by WeChat; you enter a quote they send you with a route of your console (N8, planned).

### 4.5 What each stage passes on

The journey has no gaps: every input below comes from an earlier stage or from a contractor, or Agent 1 collects it when a homeowner starts later in the journey.

| Input | Used by | Comes from | When the homeowner starts later |
|---|---|---|---|
| Homeowner account: mobile number, name, language, consent (built); channel | Every stage | Registration (N19, N18; D21) | They register at first contact, or Agent 1 helps them |
| Requirement sheet: the home, household, renovation type, style, budget, materials, wishes | Design, matching | Requirements stage (N2, N16) | Collected in the consult step |
| Project: the saved requirements (built) | Matching, every later stage | Requirements stage (N22) | Saved from the requirement sheet |
| Floor plan image | Requirements, design | Homeowner | The developer's plan, a photo of it, or a listing screenshot; or the rooms measured by hand |
| Plan JSON: walls, doors, windows, rooms, in mm (F2) | Design, matching, home record | Agent 1 (N4) | Made from the image; 2–3 measured walls fix the scale. Corrected by the contractor's site measurements (stage 4) |
| Home record: rooms and areas, furniture, appliances, stage, links (N9) | Design to after-sales | Made with the plan JSON; design adds the furniture (N14) | Made when the plan JSON is first made; until then, the project holds the home's facts |
| Design versions, and the one confirmed (design JSON) | Matching, contract, home record | Agent 1, and the homeowner's own edits (F6) | A design from elsewhere: later (stage 3) |
| Scope of work, quantities, budget | Quote sheet, final quote check, change orders | Agent 1 (N5) | As above |
| Verified contractors (built) | Matching | Contractor side (4.4, N23) | — |
| Quotes (built) | Comparison, contract | Invited teams (N22) | — |
| Final drawings, final quote, contract, payment milestones | Construction, acceptance, after-sales | Contract stage (N24) | A homeowner who brings their own contractor: the contractor joins (D17) and is invited directly; the shortlist is skipped |
| Phase records, deliveries, change orders, problems | Acceptance, disputes | Contractor and Agent 1 (N17) | — |
| Installed items: brand, model, warranty | Handover record, after-sales | Final quote, deliveries and the contractor's documents (N27) | The homeowner sends photos of the labels |
| Furniture with prices | Handover record | Design and budget, through the home record | The homeowner lists them, or adds them in Homebox |
| Upkeep schedule, warranty dates | After-sales | micasa (N12), Homebox | Made at acceptance |
| Reviews, cases | Attract, contractors' profiles | After-sales | — |

### 4.6 Rules for every stage

- **Language:** each reader's language, everywhere (section 2).
- **Consent first:** no floor plan, photo or document is taken before the homeowner or contractor accepts the privacy notice, which they do when they register (D7, N18). Ask only for what the stage uses.
- **What contractors see:** a project never shows the homeowner's name, contact or exact address, and the API refuses text with a phone number or email in projects, invitations and quotes. Contacts go only to the contractor the homeowner picks (D7).
- **Free items:** one per person, within a daily cap (N19), because MiMo credits are limited.
- **What Agent 1 can promise:** only the published packages, prices and delivery times (D2). Discounts, other dates and anything else about money go to you. Nobody promises anything about a contractor's work: the contract does.
- **Neutral comparison:** agents show facts and flags about quotes and contractors; they don't rank them or recommend one. The shortlist's order comes from the fit rules in the code (D23), and the quotes are shown in the order they arrive, never sorted by price: no score, and no contractor pays for a better place (D17).
- **Files are data:** agents treat text inside uploads, quotes and web pages as material to read, never as instructions to follow. The checks flag any text that tries.
- **Labels on images:** every image an AI model makes (restyles, AI renders) carries a visible "AI 生成 · AI-generated" label in deliverables and posts, as China's rules for labelling AI-generated content require (in force since 2025-09-01). 3D views and renders say they show a design, not the finished home.
- **Numbers:** every area, quantity and price says where it came from and how exact it is. A budget from drawings is an estimate; the contract's price comes from the contractor's final quote.
- **Sign-off:** ★ steps wait for you (D6).
- **Money:** we never hold homeowners' or contractors' money (D19).
- **Records:**
  - Every handoff is a task record (section 6.5).
  - The database is the record of each project, with its quotes, contract and phase records; uploads and deliverables are files next to it (section 6).
  - The connected programs hold copies of the parts they're good at (section 7). If one of them is down, work goes on and the sync runs later.

## 5. Agent team

Two agents, each a MiMo-V2.6-Pro call with its own instructions (`studio/agents/`) and tools (D22). The brief lists what MiMo offers: tool calling, long tasks, multi-agent work, a 1M-token context, and text, image, audio and video understanding and generation. Both agents write in the reader's language.

The runner is our code, not an agent: a module of the NestJS app (N3, section 6).

- It keeps the task queue and starts dated tasks on time (follow-ups, deadlines, reminders).
- It gives each agent only its own tools.
- It stops a task that runs too long, and retries a failed one once before it comes to you.
- If MiMo is down, it keeps working and sends prepared messages in both languages.

What the old Orchestrator agent did — planning each project's tasks from its stage, routing them, scheduling follow-ups — is plain code in the runner (D22). What the old QA agent checked is code too: the checks in N6 run on every deliverable at each stage's check step. What the code can't settle comes to you.

| Agent | Job | Stages | Hands off to |
|---|---|---|---|
| Agent 1, the homeowner's agent (业主代理) | Looks after the homeowner from requirements to after-sales: renovation planning and the requirement sheet; the floor plan upload and reading (N4); the free reading and restyle; full-home design styles, layouts and the design package; the material list, scope of work and budget; the quotes read side by side; the contract draft and the final quote check; construction follow-up, change orders and phase checks; acceptance, the handover record, after-sales and repairs | 1–7 | Agent 2 (matching, contractors), you (★) |
| Agent 2, the matching agent (匹配代理) | Matches each inquiry with suitable verified teams — the shortlist and its reasons — and with relevant content (N28); runs the invitation flow's messages; does the supply-side work: contractor verification sheets, profiles, replies, questions between the two sides, and posts (D5); reviews and cases into profiles and content | 0, 3, 4, 7, contractor side (4.4) | Agent 1 (homeowners), you (★) |

Both agents start when their stage is built (section 10), each with just the tools that stage needs:

- Phase 1: Agent 1 on requirements and reports; Agent 2 on matching and contractor replies.
- Phase 2: Agent 2's verification sheets and posts; Agent 1's renovation report and plan reading.
- Phase 3: Agent 1's design package, budgets and quote comparison.
- Phase 4: Agent 1's construction, acceptance and after-sales work.

D22 already merges what this plan first wrote as eleven agents. The brief scores how the work is split and handed off, not how many agents there are.

### Agent tools

Tools are methods of the NestJS services (section 6) that the runner offers through MiMo's tool calling. Each agent gets only its own.

| Tool | What it does | Agents | Item |
|---|---|---|---|
| Read the project | Read the project's records and uploads; images go to MiMo's image understanding | Both | N2, N3 |
| Save a result | Save a deliverable or record to the project, checked against its format | Both | N2, N3 |
| Hand off | Create the next task for the other agent or for you | Agent 1, Agent 2 | N3 |
| Ask you | Put a sign-off, payment check or escalation in your queue | Both | N3, N19 |
| Reply in chat | Answer a homeowner or a contractor on our site at once | Agent 1 (homeowners), Agent 2 (contractors) | N19 |
| Draft a message | A message for you to approve or send (D6, D12) | Both | N3, N19 |
| Fill a template | A reading, report, checklist, quote sheet or schedule in the reader's language | Both | N16 |
| Check a plan | Validate plan JSON (F2) and draw the overlay image | Agent 1 | F2, N4 |
| Price it | Material list, scope of work and budget from the layout's quantities and the price table; the prefilled quote sheet | Agent 1 | N5 |
| Compare quotes | Read quotes into the standard sheet; flag missing items, likely add-ons and prices far from the table; check final quotes and change orders | Agent 1 | N22, N24 |
| Match the project | Ask the API for the shortlist and its reasons (built), and the content library for what fits (N28); explain both to the homeowner | Agent 2 | N22, N23, N28 |
| Run the QA checks | Layout, budget, completeness and language checks; open our pages in a headless browser | Both, and the runner runs them at every check step | N6 |
| Make an image | Restyle or render, labelled as AI-made | Agent 1 | N21 |
| Homebox | Sync a home, make an invitation, read warranty dates | Agent 1 | N11, N27 |
| micasa | Add appliances, upkeep and repairs; read what's due | Agent 1 | N12 |
| Twenty | Create homeowners, contractors and projects; move a project's stage | Agent 1 (homeowners), Agent 2 (contractors) | N10 |

This is how the rule below is kept: no tool takes or sends money, signs anything, verifies a contractor or deletes data, and everything marked ★ goes through your queue.

### Who does what

| Who | Does |
|---|---|
| You (the boss) | The decisions in sections 3 and 11; approve posts, deliverables (D6), payments, contractors and invitation links; complaints, refunds and disputes; warn or suspend contractors (D17); vet partners (D13); send the WeChat and Xiaohongshu messages that agents draft (D12); build the interface (D15, section 9) |
| The two MiMo agents | The rest of section 4: reading plans, designs, budgets, quote sheets and comparisons, records, reminders, drafts |
| Homeowners | Register; send plans, photos and requirements; edit and confirm the design; save the project and invite teams; pick a quote; sign the contract; approve or refuse change orders; check work on site; accept the work; pay the contractor; review |
| Contractors | Register, apply and get verified; answer invitations with a decline or a sealed quote; measure the site; sign the contract; do all the building work and upload its records; fix problems; honour the warranty. People licensed for it sign off structural, gas and electrical work |
| The AI coding assistant in this folder | Writes everything in `studio/` behind the interface, including the NestJS API it calls (N19, D20), with its tests, and these documents, as you direct (`CLAUDE.md`) |

Agents never take payment, sign anything, verify a contractor, certify safety, or send anything that a ★ step covers without your OK.

### Work types in the brief

| Brief scenario | Where |
|---|---|
| Code generation and debugging | Building `studio/`: the NestJS API with its end-to-end tests, the connectors, and the changes in CHANGES.md |
| Office documents | Requirement sheets, reports, design packages, quote sheets and comparisons, contracts, checklists, schedules, delivery packages, in both languages |
| Brand and UI design | Brand (D11); the interface you build (section 9); floorplan-3d and roomGPT branding |
| Market research and competitor analysis | Agent 2; local prices for the price table (N5); the contractors in the first city |
| Content creation and marketing | Agent 2's posts in both languages, cases and reviews |
| Basic security checks | The API's own checks (section 6.7); the N6 checks on our site |
| Browser and desktop operations | The N6 checks open our pages in a headless browser to check both languages and the AI labels; driving Blender (stretch) |

## 6. The platform

### 6.1 How it's built (D20)

One NestJS app in `studio/` runs the whole backend. It holds:

- the API that the interface, floorplan-3d and roomGPT's page call;
- the runner that gives agents their tasks and tools;
- the connectors to the parts (Homebox now; micasa and Twenty later);
- your console's routes.

It's TypeScript, compiled to `studio/dist/` (`npm run build`) and run on Node.js 24 or later.

```mermaid
flowchart LR
    U["Our site, contractor portal, your console<br/>you build them (D15)"] -->|/api| API["NestJS app · studio/<br/>auth, contractors, matching, ..."]
    F["floorplan-3d"] -->|plans and design versions| API
    G["roomGPT's page"] -->|restyles| API
    API --> DB["PostgreSQL<br/>PGlite on this PC"]
    API --> FS["Files<br/>uploads, deliverables"]
    API -->|tasks and tools| M["MiMo agents"]
    API --> H["Homebox<br/>handover record"]
    API -.->|later| MC["micasa"]
    API -.->|later| T["Twenty"]
```

- **Modules:** one per area, each with its controller (the routes), its service (the rules) and its DTOs (the checks on each request). `auth`, `contractors` and `matching` are built (6.2); the build order of the rest is in section 10.
- **Database (D20):** PostgreSQL through Drizzle ORM.
  - The tables are in `studio/src/api/db/schema.ts`. `npm run db:generate` writes each change as a migration in `studio/drizzle/`, and the app applies new migrations when it starts.
  - On this PC, PostgreSQL runs inside the app's own process (PGlite), in `runtime/studio-db/`. The tests use one in memory.
  - On the server, the same, or a PostgreSQL server: only `studio/src/api/db/database.ts` changes (N20). Run one app per database folder.
- **Files:** uploads and deliverables are kept on disk (planned: `runtime/studio-files/`), and the database records what each one is and who may see it.
- **Settings:** in `studio/.env.local`, never in git.
  - `npm run api -- setup` writes `STUDIO_JWT_SECRET` and `STUDIO_ADMIN_KEY` there, without printing them.
  - Optional: `STUDIO_API_HOST` and `STUDIO_API_PORT` (default 127.0.0.1:3100); `STUDIO_SITE_URL`, the interface's address, used in project and invitation links; `STUDIO_DB_DIR`.
- **The parts** keep running as their own programs and are reached through their APIs (section 7). The home record (N9) and the Homebox connector (N11) are plain TypeScript in `studio/src/`, run by `npm run` commands today; the handover module will call them.

### 6.2 Modules

| Module | Does | Status | Items |
|---|---|---|---|
| `auth` | Registration as a homeowner or contractor, with consent; sign-in; who's signed in; the guard every route goes through (roles, your admin key) | Built | N19, N18 |
| `consent` | The privacy notice and terms by version and language, served before registration; a copy of a person's data; deleting it on request | Built (the documents and their routes); the copy and deletion planned | N18 |
| `contractors` | Applications, your review (verify, reject, suspend), public profiles for homeowners | Built | N23 |
| `matching` | Projects, the shortlist of teams that fit with tiers and reasons, invitations, sealed quotes, the pick, closing, links | Built | N22 |
| `uploads` | Images, PDFs and spreadsheets checked by content and size, photo location data removed, stored under `runtime/studio-files/`, fetched back by their owner | Built (storing and fetching; attaching to a contractor's application comes with N23) | N19, N23 |
| `orders` | Packages and prices; orders and their payment (paid, free or simulated); your confirmation | Planned | N2, D2, D3 |
| `homes` and `designs` | Home records, plan JSON and design versions, for floorplan-3d to load and save | Planned | N2, N9, N14, F1, F2, F6 |
| `tasks` and `agents` | The runner, task records, your queue; the agents' instructions and tools on MiMo | Planned | N3 |
| `chat` | Messages with Agent 1 and Agent 2, and their replies as they're written | Planned | N19 |
| `deliverables` | Templates filled in by agents, as web pages; a preview until the payment is confirmed; the daily report | Planned | N7, N16 |
| `pricing` | Price table, material list, scope of work, budget; the quote sheet prefilled from them | Planned | N5, N22 |
| `qa` | The checks in N6 | Planned | N6 |
| `images` | Restyles and renders, labelled as AI-made | Planned | N21 |
| `contracts`, `construction`, `handover` | Final quote check, contract, phases, deliveries, change orders, problems, acceptance and punch list; the handover record in Homebox and micasa | Planned | N24, N17, N27, N11, N12 |
| `admin` | Beyond contractors: your queue, every project, accounts, entering a quote for a contractor, the daily report | Planned | N8, N19 |
| `events` | Live updates for the interface (a new quote, a reply, a finished task) as a stream | Planned | N19 |

### 6.3 Records

Built (`studio/src/api/db/schema.ts`, first migration `studio/drizzle/0000_init.sql`):

| Table | Holds | Rules the database keeps |
|---|---|---|
| `users` | Every account: homeowner or contractor, mobile number, password hash, display name, language, which terms they accepted and when | One account per mobile number |
| `contractor_profiles` | A contractor's application and profile: company, kind, licence number, qualifications, city, districts, renovation types, the styles they work in, their usual price per m² (a range), years in business, team size, how many projects at once, description, past projects; status (pending, verified, rejected, suspended), your note and when you reviewed it | One per contractor account; the price range's minimum is no more than its maximum |
| `projects` | A homeowner's saved requirements: title, city, district, floor area, layout, renovation type, style, budget range, desired start, description; status (open, awarded, closed) | The budget's minimum is no more than its maximum |
| `invitations` | One invitation to one matched team — the homeowner's message, when it expires — and that team's answer: a decline with its reason, or its one sealed quote (total, with labour, materials and management fee; days, earliest start, main materials, note); status (invited, declined, quoted, selected, not-selected) | One invitation per team per project; at most one selected per project; a quoted or selected invitation carries its price, days and earliest start |
| `uploads` | A file someone sent: its name, what its bytes really are after the content check, its size and where it is under the files folder; the owner, and the project it was sent for | — |

How the statuses move:

- A project goes from open to awarded (a quote was picked) or closed (the homeowner ended it), and stays there.
- An invitation is invited until the team declines or quotes. One nobody answers in 7 days reads as expired and frees its place (expired is never stored). A quote can be revised until the pick. The pick makes one invitation selected and every other open one not-selected.
- A contractor starts at pending. You move them to verified or rejected, and you can suspend a verified one; verifying a suspended one again restores them.
- A contractor goes back to pending when a verified one changes a fact you checked, or a rejected one saves the application again (4.4).

Planned (N2, with the module that needs each):

- homes (the home record, N9); plans and design versions (F2, F6);
- orders and payments (D2, D3); deliverables;
- tasks (6.5); messages;
- questions and answers, and quote sheet lines (N22, N5);
- reviews and project records (N23);
- contracts and change orders (N24); phases, deliveries and problems (N17);
- consents with each notice version (N18);
- notifications.

### 6.4 The API (N19)

All routes are under `/api` and take and return JSON.

- **Signing in:** `POST /api/auth/login` returns a token. Send it as `Authorization: Bearer <token>`; it lasts 7 days.
- **Your routes:** they take the admin key in the `X-Admin-Key` header instead, and are off while `STUDIO_ADMIN_KEY` isn't set.
- **From this PC:** you can call every route with curl; `studio/README.md` shows how.

Built:

| Route | Who | Does |
|---|---|---|
| `POST /auth/register` | Anyone | Creates a homeowner or contractor account and signs it in: role, mobile number, password (8–128 characters), display name, language, and `acceptTerms: true` |
| `POST /auth/login` | Anyone | Mobile number and password → token |
| `GET /auth/me` | Signed in | The account; for a contractor, where their application stands |
| `GET /contractors/me` | Contractor | Their application, its status and your note |
| `PUT /contractors/me` | Contractor | Sends or updates the application, including the styles they work in and their usual price per m² |
| `GET /contractors` | Homeowner | Verified contractors; filters `city`, `district`, `renovationType` |
| `GET /contractors/:id` | Homeowner | One verified contractor's profile |
| `POST /projects` | Homeowner | Saves the renovation requirements as a project; private to them (D23) |
| `GET /projects/mine` | Homeowner | Their projects, each with its open invitations, quote count and, once picked, the chosen quote with the team's contact |
| `GET /projects/:id` | The owner | The project behind its link |
| `POST /projects/:id/close` | The owner | Ends the search without a pick |
| `GET /projects/:id/matches` | The owner | The shortlist: verified teams that fit, each with a tier (strong, good, possible) and its reasons; `limit` 1–10 (default 5). Never sorted by price |
| `POST /projects/:id/invitations` | The owner | Invites one matched team, with a message; at most 3 open at once, each team once per project, a team at capacity is refused |
| `GET /projects/:id/invitations` | The owner | Every invitation with its team's profile and answer, in the order they were sent |
| `POST /projects/:id/selection` | The owner | Picks a quote (`invitationId`): the project is awarded, contacts are exchanged, the other open invitations are not-selected |
| `GET /invitations/mine` | Verified contractor | Their invitations, each with the project's brief and, once picked, the homeowner's contact |
| `GET /invitations/:id` | The invitation's team, or the homeowner who sent it | The invitation behind its link |
| `POST /invitations/:id/decline` | The invited team | Declines, with an optional reason, while it waits for an answer |
| `PUT /invitations/:id/quote` | The invited team | Sends the one sealed quote: total, optional labour, materials and management fee (which can't add up to more than the total), days, earliest start (today or later), main materials, note. Sending it again replaces it until the pick |
| `GET /admin/contractors` | You | Applications, newest first; `status=pending` is your review queue |
| `POST /admin/contractors/:id/review` | You | `decision` (verified, rejected or suspended) and an optional `note` |
| `GET /legal` | Anyone | The current version and the documents with their titles; `role` narrows to one side's, `lang` picks the language |
| `GET /legal/:document` | Anyone | One document (`privacy`, `terms`, `contractor-terms`) in `lang` (default zh-CN): its title, its text and the version it is |
| `POST /uploads` | Signed in | Stores one file: `filename`, `contentType`, `dataBase64`, optional `projectId` (yours). Checked by content and size (8 MB); photo metadata removed before storing (GPS first of all) |
| `GET /uploads/:id` | The upload's owner | The file back, with its bytes in base64: photos come back with their metadata already gone |

| Answer | Means |
|---|---|
| 200, 201 | Done; 201 when something was created |
| 400 | A field is missing or wrong, and the message lists which. Unknown fields are refused too |
| 401 | Not signed in, the sign-in expired, a wrong mobile number or password, or a wrong admin key |
| 403 | The wrong kind of account; a contractor not verified yet, rejected or suspended (the message says which); your routes are off |
| 404 | Not found, or not yours to see |
| 409 | The number is registered already; the team was already invited to this project; 3 invitations are already open; the team is at capacity; the project no longer takes invitations or picks; an invitation is expired, already answered or already decided; the contractor is no longer verified |
| 429 | Too many requests: 120 a minute from one address; 10 sign-ups or sign-ins |

What each side gets back (D7):

- **Contractors:** the project's brief and their own invitation and quote. The homeowner's name and phone come only once their quote is picked.
- **Homeowners:** their own projects; the shortlist with its reasons; each invitation with its team's public profile and quote, with no phone and no personal name. The team's name and phone come only for the quote they pick. Invitations to teams no longer verified are hidden, unless already picked.
- **You:** every application, with the contractor's name and phone.

Planned:

| For | The API will |
|---|---|
| Homeowners and contractors | Change their settings and password; give them a copy of their data; take a deletion request (N18) |
| Contractors | Take the licence and past projects' photos with their application (uploads are stored now; the link to the application comes with N23); return their verification sheet (N23) |
| Chat | Take a message or file and stream the agent's reply (Agent 1's for homeowners, Agent 2's for contractors); return the history |
| Packages and orders | Return the packages, prices and refund rule in either language (D2); create an order; take "I've paid"; return its step, who it waits on and the promised time; take a revision request |
| Designs | Return each version with its 3D link, renders, material list, scope of work and budget; save a version from floorplan-3d (F6); confirm one; attach it to the project |
| Matching | Questions and answers, with each answer sent to every invited team; telling teams about their invitation and thanking those not picked; the quote sheet and its flags; reviews (with permission to use them publicly) |
| Contract and construction | Return the final quote's differences from the picked quote, the contract and the payment schedule; take the contractor's uploads, change orders and request for acceptance; take the homeowner's answer to a change order, problem reports, punch-list items and acceptance |
| Deliverables | List them; return each one, or its preview until the payment is confirmed |
| Homes | Return each home's stage, its 3D link and its Homebox invitation |
| Free items | Run a free reading or restyle, within the daily cap |
| Your console | Return your queue; take an approval or a send-back; confirm a payment; see every project and close one; enter a quote for a contractor; return the messages to send, projects, timelines, disputes, the daily report and post drafts |
| Updates | Tell the interface when something changes (a reply, a new quote, a finished task, a new item for you) as a live stream |

### 6.5 Task records (the run records)

Every handoff is one task record, a row of the planned tasks table (N3). These records are also the run records (运行记录) the judges ask for.

```json
{
  "id": "<task uuid>",
  "project_id": "<project uuid>",
  "order_id": null,
  "home_id": "demo",
  "contractor_id": null,
  "stage": "design",
  "language": "zh-CN",
  "task": "layout",
  "from": "floor-plan",
  "to": "designer",
  "inputs": ["plan", "requirements"],
  "expected": "design version",
  "status": "todo | doing | done | failed | escalated",
  "due": null,
  "attempts": 0,
  "usage": {"input_tokens": 0, "output_tokens": 0, "images": 0},
  "log": [{"at": "2026-11-07T10:02:00+08:00", "by": "designer", "event": "started"}]
}
```

- `stage` is one of the project's stages: `requirements`, `design`, `matching`, `contract`, `construction`, `acceptance`, `after-sales`.
- `order_id` names the order a task works on (a paid package); `contractor_id` the contractor a task is about (an application, a quote, a phase record). Otherwise they are `null`.
- `language` is the reader's: `zh-CN` or `en` (D10).
- `due` is the date a task should start. Follow-ups, deadlines and reminders are tasks with a date (for example "invitations close" on their expiry), and the runner starts them when that date arrives.
- `usage` counts MiMo tokens and image calls, which gives each order's cost (D2).
- Each `log` entry records when it happened, who did it and what happened.
- Your sign-offs (★) are tasks too, with `"to": "you"`:
  - Approving one marks it `done`; sending it back marks it `failed`, with your note in the log.
  - Your queue is every task to you that is still `todo`: in your console (N8), or with the API from this PC until then (N19).
- Work for no particular home (posts, research, a contractor's application) leaves out `home_id` and `stage`.

### 6.6 Files

- **What people send and what we make:** uploads are kept in `runtime/studio-files/` (N19, built), and deliverables join them (N7), outside git. The database records each file's project and who may see it.
- **What we publish (D14):** our reusable files live in `studio/`:
  - `agents/`: each agent's instructions (N3);
  - `templates/`: deliverable and contract templates, in Chinese and English (N16, N24);
  - `data/`: the price table for each city (N5).
- **The demo home:** its record is `studio/orders/demo/home.json` until the homes table exists (N2).
- **Real people's files stay out of git:** `studio/.gitignore` already keeps out the folders a real homeowner's or contractor's files could land in.
- **Backups (N20):** the database folder and the files, daily, to a second place, kept 30 days (D7).

### 6.7 Security and privacy

Built:

- **Passwords:** kept only as scrypt hashes, each with its own salt. A wrong number and a wrong password get the same answer, in the same time.
- **Sign-in tokens:**
  - Signed with `STUDIO_JWT_SECRET` (HS256) and valid for 7 days.
  - The account is read again on every request, so a deleted account stops working at once.
  - Changing the secret signs everyone out.
- **Your admin key:** compared in constant time. Your routes are off without it.
- **Rate limits:** 120 requests a minute from one address, and 10 sign-ups or sign-ins. Behind Caddy on the same server, they count the visitor's address.
- **Every request is checked field by field:**
  - Unknown fields are refused, and nothing is converted silently: numbers must be numbers, and dates real dates.
  - Mobile numbers must be mainland numbers; licence numbers, 18-character 统一社会信用代码.
- **Contact details:** text carrying a phone number or email is refused in projects, invitations and quotes (D7).
- **The database and the transactions enforce:**
  - one account per number;
  - one invitation per team per project, at most 3 open invitations per project, and at most one pick per project;
  - a quoted or picked invitation carries its price, days and start;
  - budget ranges that make sense.
  - The pick happens in one transaction, and so does an invitation, so two sent at the same moment still count one after the other.
- **Secrets:** they stay in `studio/.env.local`, never in git or in logs.

Not yet:

- checking that a mobile number is really the person's (text-message codes need a closed service: a D9 exception);
- resetting a forgotten password (you, after checking who it is; planned with your console, N8);
- signing out on every device;
- HTTPS (Caddy, N20);
- serving the interface from the same address as `/api`, so the API needs no cross-site access (N20);
- a log of what you do with your admin key (with the tasks table, N3);
- deleting an account and everything about it on request (N18).

## 7. Components and everything we use

| Component | Role | Stages | Phase | Changes |
|---|---|---|---|---|
| `studio/` | Our own code: the NestJS app (the API, the runner, every module in section 6) and its PostgreSQL records; agents, templates, price table, quote comparison, checks (N6), image calls, the connectors; and the interface you build (N1, N8, N26) | All | MVP (API started) | N1–N28, except N13 (dropped). This is where the originality score comes from |
| `floorplan-3d/` | Design editor for homeowners, and the view contractors get: 2D layout, 3D walkthrough, furniture, each room's flooring, removing non-bearing walls, areas, flooring cost. Chinese and English | 1–4 | MVP | F1–F6 in CHANGES.md |
| `roomGPT/` | The public free-restyle page; its image calls go through our API (N21). You can build this screen into our site instead (section 9.5) | 0 | MVP | R1–R8 |
| `homebox/` | Handover record: the finished home's rooms become locations; its furniture and installed items become items with price, brand, model, warranty and receipts, in the homeowner's own household | 6, 7 | MVP (built) | Connected, not edited: N11, N27 |
| `mcp-for-blender/` | Photoreal renders driven by an agent | 2 | Stretch | Setup only (B1–B2) |
| `pascal-editor/` | Candidate for drawing a plan by hand (walls, doors, windows) when there's no usable image; agents can drive it over MCP. Without WebGPU it falls back to WebGL2 and skips its WebGPU-only effects (`pascal-editor/packages/viewer/src/components/viewer/post-processing.tsx:438`), so it may run in WeChat's browser: test it first | 1 | Later (N25) | None planned |
| `micasa/` | Upkeep and repairs after handover: appliances and their maintenance schedule; repairs as incidents, with the contractor as the vendor. You and the agents use it | 6, 7 | Later | Connected, not edited: N12 |
| `twenty/` | Back office: homeowners, contractors and projects as a pipeline you can see at a glance. You and the agents use it; homeowners and contractors never see it | All | Later | Connected, not edited: N10 |
| `SpatialLM/` | 3D scan to layout | — | Not in MVP (needs an NVIDIA GPU, and its license fails rule 7: CHANGES.md section 4) | None planned |
| `home-assistant-core/` | Was the smart home scene, dropped on 2026-11-06 (D16). Still linked in the repo until you decide whether to remove it | — | Dropped | None |

### How the parts connect

Each part keeps running as its own program, unchanged, and our platform talks to it through its API.

- Homeowners and contractors use our site and floorplan-3d.
- Homeowners also get Homebox for their handover record, with its own sign-in, reached from our site.
- Twenty and micasa are only for you and the agents.

Connecting instead of copying code also keeps our own code ours under their licenses (CHANGES.md section 4).

The marketplace itself lives in our own database (section 6): accounts, contractors, projects, quotes, contracts and phase records. It is the core of the platform, so no outside program owns it. One home record per home (N9) carries the design's rooms and furniture to the parts that need them, so nobody types the same room or sofa twice.

```mermaid
flowchart LR
    F["Plan, design and budget<br/>floorplan-3d, Agent 1"] --> H["Home record · studio/<br/>one per home"]
    F --> O["Project · studio/<br/>quotes, contract, phase records"]
    K["Contractors · studio/<br/>verified profiles"] --> O
    O -->|installed items, warranties| H
    H -->|rooms, furniture, installed items| B["Homebox<br/>handover record"]
    H -->|appliances, repairs| M["micasa<br/>upkeep and repairs"]
    O -->|homeowners, contractors, stage| T["Twenty<br/>back office, later"]
```

| Data | Comes from | Goes to | How it connects |
|---|---|---|---|
| Homeowners, contractors and projects, with each project's stage (需求 → 设计 → 匹配 → 签约 → 施工 → 验收 → 售后) | Registration, Agent 1 and Agent 2 | Twenty: people, companies (contractors), a custom "home" object, opportunities (projects) | REST or GraphQL API with an API key. Agents also use Twenty's MCP server. Twenty's webhooks tell the runner when you move a project |
| Rooms | Plan JSON (F1, F2) | Homebox locations | Homebox REST API (`/v1/entities`) |
| Furniture, with prices | The confirmed design and budget | Homebox items, each in the room that contains it | The room is found from the item's position on the plan |
| Installed items: brand, model, warranty end | Final quote, deliveries, the contractor's documents (N27) | Homebox items (manufacturer, model number, warranty fields) | Homebox REST API, through the same connector (N11) |
| Appliances (the 家电 category, plus stove, washer, water heater) | The confirmed design, the final quote | micasa: appliances and their maintenance schedule, one database per home | micasa's command line writes them (`add --data`). Its MCP server is read-only and lets agents answer questions |
| Repairs | The homeowner's request, the contractor's fix | micasa incidents, with the contractor as vendor | micasa's command line (`add --data`) |

Each record has one owner, so nothing is tracked twice:

- **`studio/`**, in its database and files: accounts, contractors, projects with their quotes, contracts and phase records, and the work files (plan, designs, renders, budget, task records) (section 6).
- **Twenty, once N10 runs:** a copy of who's who and each project's stage, for your pipeline view.
- **Homebox:** the home's furniture, installed items and belongings, with their warranties.
- **micasa:** upkeep of appliances, and repairs.

Built so far:

- the API with its database (section 6);
- the home record (N9) and the Homebox connector (N11).

Homebox runs on this PC (`studio/README.md` says how), and so can micasa. Twenty needs containers: Podman or Docker Engine inside WSL 2 here, or the server from D8.

### Everything else we use

Rule 7: free and open source only, except what D9 allows. Every package `npm install` puts in `studio/` was checked on 2026-11-06 (CHANGES.md section 4).

| What | For | Stages | License | Status |
|---|---|---|---|---|
| Node.js 24 or later | Runs `studio/` | All | MIT | Installed (24.15.0) |
| TypeScript 7.0.2, `@types/node` | Compiling the API (`npm run build`) and type checks | — | Apache-2.0, MIT | Installed in `studio/` |
| NestJS 12.3.3 (`@nestjs/common`, `@nestjs/core`, `@nestjs/platform-express`, with Express 5) | The backend's framework (D20) | All | MIT | Installed in `studio/` |
| `@nestjs/jwt` 12.0.3, `@nestjs/throttler` 6.7.1 | Sign-in tokens; rate limits | All | MIT | Installed in `studio/` |
| class-validator 0.15.1, class-transformer 0.5.1 | Checking every request | All | MIT | Installed in `studio/` |
| reflect-metadata 0.2.2, RxJS 7.8.2 | Needed by NestJS | All | Apache-2.0 | Installed in `studio/` |
| Drizzle ORM 0.45.4; drizzle-kit 0.31.11 (development only) | Tables, queries and migrations | All | Apache-2.0; MIT | Installed in `studio/` |
| PGlite 0.5.15 | PostgreSQL inside the app's own process, on this PC and in the tests | All | Apache-2.0 | Installed in `studio/` |
| PostgreSQL 16 or later, with the `pg` driver | The database on the server, if PGlite isn't enough there (D20, N20) | All | PostgreSQL License; MIT | Not needed yet |
| MiMo-V2.6-Pro API | Both agents: chat, reading plans, photos, quotes and documents | All | Closed: exception (D9) | Needs a key and credits (given at the event) |
| Image model for restyles | Restyles and AI renders | 0, 2 | MiMo (D9), or an open-licensed model we run ourselves | D4 open |
| Image, PDF and spreadsheet libraries | Stamping the AI label (N21); reading quotes sent as PDFs or spreadsheets if MiMo can't (N22) | 0, 2, 3 | Open source only; license checked when one is added | Not chosen |
| Headless browser (for example Playwright) | QA opens our pages in both languages (N6) | All | Apache-2.0 | Not installed |
| Your interface's framework | Our site, the contractor portal and your console (section 9) | All | Your pick, with an open-source license (rule 7) | Yours to choose (D15) |
| Penpot | Drawing the screens before you build them, if you want to (the proposal's Figma or Axure step) | — | MPL-2.0 | Optional. Figma and Axure are closed (rule 7) |
| Three.js 0.160.0 | floorplan-3d's 3D view | 1–4 | MIT | Loaded from a CDN today; F3 ships it with the page |
| Next.js 13, React | roomGPT's site | 0 | MIT | Not installed yet (R6) |
| Homebox v0.27.1 | Handover record | 6, 7 | AGPL-3.0 | Runs on this PC |
| Twenty, PostgreSQL 16, Redis | Back office (later) | All | AGPL-3.0 (Twenty's Enterprise files excluded); PostgreSQL License; Redis 8 or later under AGPL-3.0 | Needs containers. Turn telemetry off and pin Redis (CHANGES.md section 4) |
| micasa v2.8.2 | Upkeep and repairs | 6, 7 | Apache-2.0 | Windows build to download (N12). Leave its sync and AI features unused (CHANGES.md section 4) |
| Blender, uv | Photoreal renders (stretch) | 2 | GPL; MIT or Apache-2.0 | Not installed (B1) |
| E-signature tool (for example DocuSeal) | Signing contracts online, later (D18) | 4 | DocuSeal: AGPL-3.0 | Not before a lawyer's OK (D18) |
| WSL 2, then Podman or Docker Engine | Containers on this PC, for Twenty | — | MIT; Apache-2.0 | Not installed: needs admin rights and a restart (you) |
| Caddy | HTTPS in front of our site, the contractor portal, the API, Homebox and Twenty on the server | All | Apache-2.0 | When D8 is decided |
| Linux server | Runs everything for homeowners and contractors | All | Rented machine; everything on it is open source | D8 |
| WeChat Pay / Alipay | Real payments from homeowners to us | Order step | Closed: exception (D9) | D3 |
| Xiaohongshu, WeChat | Where we post and meet homeowners and contractors | 0, all | Channels, not programs we run (D5) | Accounts to open (you) |

### What you need to get

| What | For | When | Decision |
|---|---|---|---|
| MiMo API key and credits | Every agent | Start of the event | — |
| A payment account, or the choice of a simulated first order | First order | Before the first order (phase 2) | D3 |
| A Chinese name, logo and domain (I Renovation is the name) | Site, posts | Phase 0 | D11, D8 |
| Server, and ICP filing for a mainland server | Homeowners and contractors outside this PC | Start early: ICP filing takes days to weeks | D8 |
| Xiaohongshu account, a WeChat for customers, English channels | Attract | Phase 0, because posts need time to get views | D5, D12 |
| The first city, and 2–3 contractors there with checked licences who will quote on a test project | Matching | Phase 0: contractors take time to sign up | D1, D17. If none in time, simulated contractors, marked as simulated in the demo |
| Local material and labour prices for that city | Budgets, quote sheets and quote checks | Phase 2 | N5: Agent 2 collects them; you approve |
| Privacy notice and terms for homeowners and contractors, in both languages | Before any real person registers | Phase 0 | D7, D17, N18: agents draft, you approve, a lawyer reviews if you can |
| A contract template, reviewed by a lawyer | Contract stage | Before any real contract | D18 |
| WSL 2 and Podman on this PC (admin rights, restart) | Twenty here | Before N10 | D8 |
| NVIDIA GPU | Only if D4 picks a model we run ourselves | — | D4 |
| A test project: sample quotes, phase photos, deliveries and a punch list | Running matching, construction and acceptance during the event (section 4.3) | Phase 3 (quotes), phase 4 (the rest) | Real ones used with permission, or AI-made and labelled (4.6) |

## 8. When things go wrong

| Situation | Caught by | What happens | Goes to you when |
|---|---|---|---|
| Floor plan unreadable or dimensions missing | Agent 1 | Agent 1 asks the homeowner for a clearer image or 2–3 measured walls. No plan at all: the homeowner measures the rooms with our guide, or the contractor measures at the site visit | Still failing after 2 tries; you correct the plan JSON by hand against the overlay image (N4) |
| An upload isn't an image, PDF or spreadsheet, is too large, or won't open | API (N19) | Refused, with what to send instead, in the sender's language | Never |
| A field in a request is missing or wrong (a date that doesn't exist, a number sent as text, an unknown field) | API (built) | Refused with a 400 that lists the fields; the interface shows it in the reader's language | Never |
| The daily cap on free items is reached | API (N19) | The homeowner is told when to try again and offered the paid package | Never; the daily report counts them |
| A wish breaks a rule (removing a load-bearing wall, a bathroom or kitchen where there's no waterproofing) | Agent 1, the code checks (N6) | Explain why, and offer what can be done instead | The homeowner insists. They're told it needs a plan from a qualified structural designer and property management's approval, which we don't provide (D13) |
| Layout breaks a rule (load-bearing wall removed, door blocked, walkway too narrow) | The code checks (N6) | Back to Agent 1 with the failed checks | Still failing after 2 rounds |
| Render fails or the image quota runs out | Agent 1 | Fall back to screenshots of the floorplan-3d 3D view, which you take | Always |
| Budget more than 15% over the homeowner's limit | Agent 1 | Suggest cheaper materials or a smaller scope, and ask the homeowner | Homeowner says no; you decide on scope or discount |
| Payment not confirmed when the deliverables are ready | The runner | The homeowner gets a preview only (the report's summary, or watermarked images); the rest waits | You confirm payment by hand. Still unpaid after 2 days: the order closes |
| The homeowner stops answering | Agent 1 | Follow-ups after 2 and 7 days; then the order closes as stopped and can reopen later. An open project stays open until the homeowner picks or closes it; the invited teams are told if it closes (the telling is planned) | Never |
| Complaint or refund request | Agent 1 | Acknowledge and collect details; refunds follow the rule in D2 | Always |
| The homeowner asks for a discount, another date, or anything outside the packages | Agent 1 | Says you'll answer, and asks you | Always |
| A contractor's application is incomplete, or its documents don't agree (name, licence number, dates) | Agent 2 | The application waits as pending, and the contractor is told what's missing | Always: you decide, after checking the licence yourself (D17) |
| A verified contractor changes a fact you checked (company, licence, qualifications, city, years, past projects) | API (built) | Back to pending: they can't be matched, invited or quote until you review them again | Always: it's in your review queue |
| A homeowner or contractor puts a phone number or email in a project, an invitation or a quote | API (built) | Refused, with the rule explained (D7) | Never |
| A contractor asks for a homeowner's contact before being picked, or contacts them some other way | Agent 2 | Refused, with the rule explained (D17) | A second time: you decide on a warning |
| The shortlist is empty or too short, or an invited team lets its invitation lapse | Agent 2 | The homeowner widens what they'll accept (budget, district, style), brings their own contractor (4.1), or waits for more teams to be verified; a lapsed invitation frees its place (D23) | Still empty after a week: you look for contractors |
| Every quote is over the homeowner's budget range | Agent 1 | Show where the money goes; Agent 1 offers a cheaper version (materials, scope); the homeowner decides | Never; the daily report counts it |
| A quote misses items, or a price is far above or below our price table | Agent 1 | Flagged in the comparison once the quote sheet is built (N22); Agent 2 asks the team to fix or explain it before the pick | Never |
| You suspend a contractor with open invitations | API (built) | They can't be matched, invited, answer or be picked; their un-picked invitations stop showing to homeowners; a quote already picked stays, and that homeowner is told (planned) | It's your decision already |
| The chosen contractor drops out before signing | Agent 2 | Offer the homeowner the other quoted teams, or a new shortlist | Always: it goes in the contractor's record |
| The final quote differs from the picked quote | Agent 1 | Every difference listed with the contractor's reason; the homeowner decides before signing | The homeowner disputes it |
| A phase fails its check (for example a leak in the water test) | Agent 1 | Tell the homeowner and the contractor what failed; the phase stays open until it's fixed and checked again, and the next payment waits | Anything about structure, gas or electrics: at once, and the homeowner is told to stop that work until someone licensed for it checks it |
| Photos don't show enough to judge | Agent 1 | Ask the contractor for specific photos, or tell the homeowner what to check by hand | Third try |
| Work changed without an approved change order | Agent 1 | The homeowner is told it wasn't approved; the contractor is asked for a change order; the contract's terms for changes apply | Always |
| A phase or the finish date runs late | Agent 1 | The contractor gives a reason and a new date; the homeowner is told | More than 7 days late, or a second delay |
| The homeowner won't accept the work | Agent 1 | Each problem goes on the punch list; the contractor fixes it and shows it; the homeowner checks again | After two rounds, or when the two disagree on whether something is a defect |
| A dispute about quality, price, delay or the contract | Agent 1 | The runner gathers the records (contract, quotes, change orders, phase photos, messages) and both sides get the same copy; we help them talk, but we don't decide who is right (D13) | Always. You may suggest an independent inspector (partners later, D13) |
| A homeowner or contractor asks for legal advice (whether a clause is fair or lawful, who is at fault, whether to sue) | Agent 1, Agent 2 | Explain that we give the template, the records and the checklists, not legal advice; point to a lawyer, and homeowners also to the 12315 consumer complaint platform | They insist |
| A warranty repair the contractor ignores | Agent 1 | Remind the contractor, with the warranty terms; tell the homeowner | After 7 days: you, and it goes in the contractor's record |
| Agent returns broken output (invalid JSON, missing file) | The runner | Retry once with the error attached | Second failure |
| Deliverable in the wrong language, or mixed | The code checks (N6) | Back to the agent | Second failure |
| A sign-off (★) has waited more than 2 hours | The runner | Reminds you; whoever is waiting gets a prepared message with the new time | It's already yours: first in your queue and in the daily report |
| MiMo API down, slow or out of credits | The runner | Pause the queue; send the people waiting a prepared message with the new time, in their language (no MiMo needed) | At once (credits are limited during the event) |
| Homebox, Twenty or micasa down | The runner | Work goes on: the database in `studio/` is the record; sync again later (the syncs are safe to repeat) | Still down at the daily report |
| Too many sign-in attempts from one address | API (built) | After 10 in a minute, the 11th is refused with 429 until the minute passes | Never; the daily report counts them, once it exists (N7) |
| This PC or the server loses its data | You | Restore the database folder and the files from the latest backup (N20) | Always |
| Homebox invitation link expired before the homeowner joined | Agent 1 | Make a new one | You approve the new link (D6) |
| A homeowner or contractor forgets their password | Agent 1, Agent 2 | You set a new one after checking it's them, by the number they registered with (planned with your console, N8) | Always |
| Someone asks us to delete their data | Agent 1, Agent 2 | List what will be deleted: their account and records in the database, their files, the Homebox household, Twenty records, the micasa database. What both sides of a project need (contract, change orders, acceptance) stays until the warranty ends (D7) | Always: you confirm before anything is deleted (N18) |

## 9. What the interface needs

The first version of the interface is built (D25, `studio/web/`): the screens marked built below exist and are tested in a real browser; the others come with their modules. This section says what each screen must show and do. Change it as you decide, and the API (N19) will follow. Routes marked "built" exist today (section 6.4); the others are planned.

### 9.1 Rules for every screen

- **Two languages:** a language switch on every screen, saved with the person (D10). The interface's own text exists in Chinese and English; the records come from the API in the reader's language. The API's error messages are in English, so the interface shows its own text for each one.
- **Phone first, inside WeChat:** most homeowners and contractors will open our links in WeChat. Test every screen in WeChat's built-in browser, which often won't download files. So deliverables are web pages (N16), and uploads come from the camera or the photo album.
- **Everything through the API (N19):** the interface never reads the database or files, calls MiMo or the image model, or works out a price, a comparison or who may see what itself. Packages, prices, quotes and statuses come from the API, so each has one source.
- **Sign-in:**
  - Homeowners and contractors register and sign in with their mobile number and a password (D21). The interface keeps the token the API returns and sends it with every request.
  - Keep the token out of addresses and out of anything shared. Signing out forgets it.
  - The project and invitation links the API returns are pages of the interface: one that opens a link without a signed-in session asks the person to sign in first, then shows it.
  - You use your console with the admin key kept in `.env.local`.
- **Serve it from the same address as the API:** behind Caddy, the interface at `/` and the API at `/api` (N20), so no cross-site access is needed. Set `STUDIO_SITE_URL` to that address so the links point at it.
- **Consent first:** the registration screen shows the privacy notice and the terms for that side, and registration needs them accepted (N18). Uploads stay off until then.
- **What each side sees:** contractors never see another team's quote or who else was invited, or a homeowner's name, contact or exact address before the homeowner picks them (D7). The API already enforces this; the interface mustn't work around it.
- **Labels and sources:** every AI-made image shows "AI 生成 · AI-generated"; 3D views and renders say they show a design; every number shows its source (4.6).
- **Who it waits on:** every order and project shows its step (4.2), whether it is waiting for the homeowner, a contractor, the agents or you, and the time we promised.
- **Every state:** loading, empty, waiting, error and offline, in both languages.
- **Rules 3 and 7:** a framework with an open-source license, with its code in `studio/`, in a folder of its own.

### 9.2 Homeowner screens (N1)

| Screen | Shows | The homeowner can | API | Stages |
|---|---|---|---|---|
| Home page | What we do, the free items, packages and prices (D2), how matching works, cases (only with the homeowners' OK) | Start a chat; try a free item; register; go to the contractors' sign-up | Packages (planned) | 0 |
| Register and sign in | The privacy notice and terms (N18); language | Register with mobile number, password and name, accepting the terms; sign in | `POST /auth/register`, `POST /auth/login`, `GET /auth/me` (built) | 0 |
| Chat | The conversation with Agent 1, with files | Ask; send files; pick a package | Chat (planned) | All |
| Free restyle | Before and after, with the AI label | Upload a room photo; pick a style and room; go on to the design package | Free items (planned) | 0 |
| Requirements | The requirement sheet as it fills in, and what's still missing, with examples (a usable floor plan photo, how to measure a wall) | Fill it in; upload from the camera or album; see each file accepted or refused, and why | Uploads (planned) | 1 |
| Save as a project | What an invited team will see inside its invitation (no name, contact or address), the budget range and the start date | Change them; agree to share; save | `POST /projects` (built) | 1, 3 |
| Contractors | Verified contractors and their qualifications, by city, district and renovation type | Open a profile | `GET /contractors`, `GET /contractors/:id` (built) | 3 |
| My projects | Each project, its stage on the journey (4.1), how many quotes, the pick, what comes next | Open a project; start the next stage | `GET /projects/mine`, `GET /projects/:id` (built) | All |
| Matches | The shortlist of verified teams that fit, each with its tier and the reasons | Invite up to 3; ask Agent 2 what would change the list | `GET /projects/:id/matches`, `POST /projects/:id/invitations` (built) | 3 |
| Quotes | The invitations and quotes in the order they came in, each with its team's profile; later the comparison with its flags | Ask a question; pick a quote; close the project | `GET /projects/:id/invitations`, `GET /invitations/:id`, `POST /projects/:id/selection`, `POST /projects/:id/close` (built); questions (planned) | 3 |
| Order and payment | Package, price, what's included, delivery time, refund rule (D2), the payment QR (D3) | Pay; say they've paid | Orders (planned) | 2 |
| Order | Its step, who it waits on, the promised time, questions from the agents | Answer the questions | Orders (planned) | 2 |
| Design | The layouts and versions side by side, with their 3D links, renders, material lists, scope of work and budgets; a preview until the payment is confirmed | Open a version in floorplan-3d; ask for changes; compare versions; confirm one; attach it to the project | Designs (planned) | 2 |
| Contract | The final drawings, the final quote with its differences from the picked quote, the contract and the payment schedule | Ask about a difference; accept; get the contract to sign | Contract (planned) | 4 |
| Construction | The schedule, each phase's records and check, change orders, the problem list, delays, which payment is due | Approve or refuse a change order; report a problem; send photos | Construction (planned) | 5 |
| Acceptance | The acceptance checklist, the punch list, the warranty dates, the Homebox invitation | Tick off the checklist; add to the punch list; accept | Construction, homes (planned) | 6 |
| After-sales | Upkeep and warranties coming up; repairs | Ask for a repair; review the contractor; allow their project as a case; stop reminders | Planned | 7 |
| Deliverables | Reports and checklists as web pages; a preview until the payment is confirmed | Open; print to PDF; ask for the free revision; accept | Deliverables (planned) | 1–6 |
| My data | What we hold, and the consent they gave | Change language, channel or password; get a copy of their data; ask us to delete everything | Planned (N18) | All |

### 9.3 Contractor screens (N26)

| Screen | Shows | The contractor can | API | Stages |
|---|---|---|---|---|
| Join | What the platform offers contractors, the contractor terms (D17), the privacy notice (N18), what to send | Register a contractor account, accepting the terms | `POST /auth/register` (built) | Contractor side (4.4) |
| Application | The application, its status (pending, verified, rejected, suspended) and your note | Fill it in or fix it: company, licence number, qualifications, city, districts, types, styles, price per m², years, team, capacity, past projects; add documents and photos | `GET /contractors/me`, `PUT /contractors/me` (built); uploads (planned) | Contractor side (4.4) |
| Profile | Their verified facts, past projects and reviews, as homeowners see them | Update their description, districts and capacity (a change to a checked fact goes back to review) | `PUT /contractors/me` (built) | Contractor side (4.4) |
| Invitations | Each invitation with the project's brief (no name, contact or address) and how long is left to answer | Decline with a reason, or give one sealed quote; ask a question | `GET /invitations/mine`, `GET /invitations/:id`, `POST /invitations/:id/decline` (built); questions (planned) | 3 |
| Quote | Their quote form; with a design package, the quote sheet prefilled with the design's items and quantities | Fill in the total and its parts, days, earliest start, main materials and a note, or upload their own quote; send it; revise it until the pick | `PUT /invitations/:id/quote` (built); quote sheet (planned) | 3 |
| My quotes and projects | Each invitation and its status; won projects with the homeowner's contact, the site visit, the contract, the schedule | Send the final drawings and quote; confirm the contract | `GET /invitations/mine`, `GET /invitations/:id` (built); contract (planned) | 3, 4 |
| Site log | Each phase's checklist, what has been checked, problems, change orders | Upload photos, videos and deliveries; write a change order; mark a problem fixed; ask for acceptance | Construction (planned) | 5, 6 |
| Reviews | Their reviews and project records (on time, phases passed first time) | Reply to a review | Planned (N23) | 7 |

### 9.4 Your console (N8)

| Screen | Shows | You can | API |
|---|---|---|---|
| Queue | Everything waiting for you, oldest first: sign-offs (★), payments to confirm, contractors to review, escalations and disputes, deletion requests | Open each one with its deliverable or message; approve; send back with a note | Tasks (planned) |
| Contractors | Applications with their documents and verification sheets, profiles, quotes and project records, warnings | Verify, reject or suspend, with a note (D17) | `GET /admin/contractors`, `POST /admin/contractors/:id/review` (built) |
| Projects | Every project, its invitations and quotes and its pick | Close one that breaks the rules; enter a quote a team sent you | Admin (planned) |
| Messages to send | The agents' drafts for WeChat and Xiaohongshu (D12), in each reader's language | Copy; mark as sent | Planned |
| Orders | Every order by stage and step, who it waits on, what it cost (task usage) | Open one; confirm a payment | Orders (planned) |
| Timeline | A project's task records: which agent did what, the handoffs, the retries and your sign-offs | Show the judges the human/AI split (section 5) | Tasks (planned) |
| Accounts | Homeowners and contractors: contact, language, consent, homes | Set a new password after checking who it is; change the language | Admin (planned) |
| Disputes | Each dispute with its records (contract, quotes, change orders, photos, messages) | Read both sides; note what you suggested | Planned |
| Today | The daily report (N7): projects, quotes, orders, money in, cost, failures, MiMo credits left | Read it | Deliverables (planned) |
| Posts | Agent 2's drafts in both languages | Approve them, then post | Planned |

The console shows what needs you today. Once Twenty runs (N10), it gives you a pipeline view of homeowners, contractors and projects, and the console links to it instead of copying it.

### 9.5 The parts' own screens

| Part | What people see | Interface work |
|---|---|---|
| floorplan-3d | Homeowners: their home's layouts in 2D and 3D, opened through our API (F1), where they edit and save versions (F6). Contractors: the same view, from a project open to them | Our branding and the home's title (F5); keep 简体, 繁體 and English working |
| roomGPT | The free restyle page | R2, R4, R5, R8. Or build the free restyle into our site and leave roomGPT out: one or the other, not both |
| Homebox | Homeowners: their handover record, with its own sign-in, under the Homebox name (we don't modify it: section 7) | A link from After-sales; the invitation (N11) |

## 10. Development plan

### 10.1 What runs today (2026-11-06)

Built and tested on this PC:

- **The API (N19), the start of the backend (D20).** NestJS, with accounts, contractor verification, projects, matching, invitations and sealed quotes (N22, N23), on PostgreSQL run by PGlite.
  - A homeowner and a contractor register; the contractor states the styles they work in and their usual price per m².
  - You verify the contractor.
  - A homeowner saves a project and sees the shortlist of teams that fit it, each with a fit tier and the reasons.
  - They invite up to 3; each team answers within 7 days with a decline or one sealed quote, which it can revise until the pick.
  - The homeowner compares the quotes side by side (never sorted by price) and picks one; the two get each other's contact.
  - Every project and invitation has its link.
  - 15 end-to-end tests run the marketplace against a real database in memory, and 12 more test the fit rules. A smoke test ran the built API on a database folder through a restart.
- **The interface (N1, N26 and N8 started, D25).** `studio/web/`, served by the app at `/`:
  - Homeowners: register with the notices; save a project; the shortlist with its reasons; invite up to 3; the quotes in the order they came; the pick and the contact; browsing verified contractors.
  - Contractors: register; the application and its review status; invitations with the project's brief; a sealed quote that can be revised; declining.
  - You: the console with the admin key: contractor review, the task queue with your decisions, the runner.
  - Chinese and English, phone-sized, with a strict content policy. Missing: chat, uploads, orders and payment, design, contract, construction, acceptance, after-sales, my data.
  - 94 tests in all: 4 check the interface's text, and 11 click a whole journey through in a real browser (Edge or Chrome, driven by `playwright-core`): a contractor applies, you verify it, a homeowner is matched, invites, receives a sealed quote and picks it, with the contact exchange only then.
- **The home record (N9) and the Homebox connector (N11)**, on floorplan-3d's sample flat:
  - the sample flat becomes a home record: 13 rooms with areas, 43 pieces of furniture, 3 appliances;
  - that becomes a Homebox household (56 records), with a one-time sign-up link that works on this PC only.
  - In the journey, this is the start of the handover record (stage 6).
- **floorplan-3d itself is unchanged.** It lays out furniture, changes each room's flooring and removes non-bearing walls for that one sample flat. We haven't run it here yet.

How to run each of them: `studio/README.md`.

What each step still needs:

| Step | Runs today | Missing | Items |
|---|---|---|---|
| Attract | — | Posts in both languages; the free reading (agents and its template); the free restyle (image calls and roomGPT's page) | N3, N16, N21, R1–R8, D4, D5, D11 |
| Accounts and consent | Registration as homeowner or contractor, sign-in, consent version saved; the notice and terms drafted in both languages and served at `GET /api/legal` | Your approval of the drafts; a copy of one's data; deletion; password reset | N18, N8 |
| Consult and order | — | Orders and payments, your confirmation; later, the site's intake and chat | N2, N19, D3, D12; then N1 |
| Agents | — | The runner, the two agents' instructions and tools on MiMo; task records | N3, MiMo key |
| Requirements and the floor plan | Publishing requirements as a project (only the built-in sample flat for plans) | The requirement sheet; the plan format, loading a plan into floorplan-3d, reading a plan from an image | N2, N16, F2, F1, N4 |
| Design | floorplan-3d's sample flat (unchanged) | Renovation report, layouts as design JSON and saved versions, material list, scope of work and budget, QA checks, renders, the design into the home record | N16, F6, N5, N6, N21, N14 |
| Contractors | Applications, your review, public profiles, suspension | Documents and photos, the verification sheet, contractor terms, reviews and project records | N23, D17 |
| Matching | The shortlist with its reasons, invitations, sealed quotes, the pick, links | Agent 2's explanation and the content library (N28); telling invited teams and thanking those not picked; questions; the quote sheet and its flags; attaching the design | N22, N5, N28 |
| Contract | — | Final quote check, contract template, payment milestones | N24, D18 |
| Construction | — | Schedule, phase and material checks, change orders, problem list | N17, N16 |
| Acceptance | Home record → Homebox → sign-up link, for the sample flat, in Chinese only | Acceptance checklist and punch list; installed items and warranties in Homebox; English names; upkeep in micasa | N17, N27, N15, N12 |
| After-sales | — | Reviews and cases; daily checks of what's due; reminders and repairs | N23, N3, N12 |
| Deliver and records | — | Delivery package, run records, daily report | N7 |
| The interface | Only the parts' own pages (floorplan-3d, roomGPT, Homebox) | Our site, the contractor portal and your console | N1, N26, N8 (yours) |
| Reaching people outside this PC | — | Server, domain, HTTPS, backups | D8, D11, N20 |

### 10.2 How to build the rest

These rules keep every new piece in the same shape as what's built:

- **One NestJS module per area** in `studio/src/api/<area>/`: a controller for the routes, a service for the rules, DTOs for the checks, registered in `src/api/app.ts`.
  - Shared words and rules (roles, statuses, the contact-details check) live in `src/api/domain.ts` and `src/api/validation.ts`. Reuse them instead of writing them again.
- **Tables:** edit `src/api/db/schema.ts`, then `npm run db:generate`. Commit the migration with the code. Never edit a migration that has run; write a new one.
- **Rules belong in the API:** who may see what, prices, statuses. Each rule lives in one place:
  - The fit rules (which teams suit a project, and how well) are plain functions in `src/api/matching/fit.ts`, with no database, clock or randomness, so anyone can read and test them on their own.
  - The "who sees what" rules (`visibleToOwner`, `openInvitation`, the project's brief) live in `src/api/matching/views.ts`, next to the links.
- **Every route gets an end-to-end test** in `studio/test/api/`, with its refusals as well as its success. `npm test` builds and runs them all.
- **TypeScript as this repo uses it:**
  - ES modules, with imports ending in `.ts`.
  - Constructor dependencies as fields assigned in the constructor (no parameter properties: `erasableSyntaxOnly`).
  - `import type` for types used only in decorated signatures.
  - Run `npm run typecheck` before `npm test`.
- **Licenses:** before adding a package, check its license and note it in CHANGES.md (rule 7).
- **Log it:** every change goes into CHANGES.md in the same session (`CLAUDE.md` rule 2), and every decision you make goes into section 11.

Shortest path to the first paid order:

1. D2 and D3 (yours), then the MiMo key.
2. The privacy notice and terms (N18). Accounts already exist.
3. Orders and payments, and the runner with the first agents (N2, N3, N19).
4. The requirement sheet and the renovation report's template (N16).
5. A homeowner sends a floor plan and their requirements on WeChat or in person, and registers (or Agent 1 helps them).
6. The agents write the renovation report. You approve it, confirm the payment, and send the report as a PDF printed from its page.

None of this needs a server or a contractor. After it:

- The design package needs F2 → F1 → N4 → N5 → N6 → N21, with F6 for saved versions; its 3D link needs the server (N20).
- Matching is built; it needs verified contractors (N23) and, for line-by-line comparison, the quote sheet (N22).

### 10.3 Build phases (about 40 hours)

| Phase | Hours | Goal | Done when |
|---|---|---|---|
| 0 Prep (now) | Before the event | Decide what's still open in section 3, starting with D1 (the first city), D2, D3, D5, D8, D11, D12 and D17 (a mainland server's ICP filing takes longer than the event); confirm D6, D20, D21, D22 and D23's rules; get MiMo API access; agree the plan format (F2); draft the privacy notice and the contractor terms (N18, D17); start talking to contractors in the first city; open the accounts; run floorplan-3d and roomGPT locally (R6). Done so far: N9, N11, and the API's accounts and matching (part of N19, N22, N23) | floorplan-3d and roomGPT run on this machine; your decisions are logged; at least 2 contractors have said they'll try it |
| 1 Open for business | 0–8 | The privacy notice and terms in the API (N18). The runner and the two agents (D22), with task records and your queue (start of N3). Uploads, and orders with their payments (N19, N2). The templates for the requirement sheet and the free reading (start of N16). Homeowners reach us on WeChat and in person (D12). The first posts go out early in both languages, because they need time to get views | A floor plan sent on WeChat, in Chinese or English, gets the free reading back, with consent saved and every step in the task records |
| 2 First order, first contractors | 8–20 | Renovation report (N16); plan format, loading and reading (F2, F1, N4); contractors' documents and the verification sheet, with Agent 2 (N23); telling invited teams, questions and answers (N22) | First order (paid or simulated): a renovation report delivered and logged, with its cost from the task records (D2); at least 2 contractors verified by you |
| 3 Design package, quote sheet and the rest of the API | 20–30 | Design package: layouts and versions, 3D, renders, material list, scope of work, budget, QA (F6, N5, N6, N21); design → home record (N14, N15); the design attached to the project, the quote sheet and its flags (N22); delivery package and daily report (N7); the rest of the API for the interface (N19); the server (N20) | One project runs from floor plan to design package to a comparison of at least 2 quotes (real, or simulated and marked), through the API, with only your sign-offs done by hand |
| 4 Interface and the whole journey | 30–40+ | You: the interface (N1, N26, N8, F5, R4, R5, R8; section 9). At the same time, the two agents and the AI coding assistant: contract, construction and acceptance on the test project (N24, N17, N27, the rest of N16), reviews and after-sales (N23, N12), Twenty if containers run (N10), and the demo script | A stranger can use our site in either language, from registering to picking a quote; a contractor can answer an invitation from the portal; every stage has run at least once (real or simulated) and is in the task records |

The interface comes last, but the brief scores an accessible product shown live. So:

- The API is finished by hour 30. If phase 3 runs late, cut Twenty (N10) and micasa (N12) before you cut the interface's time.
- You don't have to wait for phase 4: the accounts, contractor and matching screens (sections 9.2–9.4) can start now, on the routes that are built.

### 10.4 The build order

Each line is one piece of work, in the order to build it. "Done when" is what its tests or its run must show. Routes are proposals until built.

| # | Build | Where | Items | Done when |
|---|---|---|---|---|
| 1 | Accounts, contractor verification, projects, matching, invitations, sealed quotes, the pick, links | `auth`, `contractors`, `matching` | N19, N22, N23 (part) | Done 2026-11-06: 15 end-to-end tests and 12 fit-rule tests pass |
| 2 | The privacy notice and terms by version and language; registration records the version shown | `consent` (`GET /api/legal/:document?lang=`) | N18, D7, D17 | Done 2026-11-06: the drafts in both languages are served with their version, 5 tests pass, and a test registers with the version shown. Your approval of the drafts is still yours to give |
| 3 | Uploads: content and size checked, photo location data removed, stored under `runtime/studio-files/` | `uploads` (`POST /api/uploads`) | N19 | Done 2026-11-06: a photo with location data comes back without it and keeps its display orientation; a file that isn't what it claims is refused; 8 end-to-end and 11 unit tests pass |
| 4 | Task records, the runner, your queue; the MiMo client and the two agents' instructions and tools | `tasks`, `agents`; `studio/agents/` | N3 | A task runs on MiMo, hands off, retries once on broken output, and a ★ task waits in your queue until you approve it |
| 5 | Packages, orders, "I've paid" and your confirmation | `orders` | N2, D2, D3 | A renovation report ordered, paid or simulated, confirmed by you, and only then released |
| 6 | The requirement sheet, the free reading and the renovation report, as web pages in both languages | `deliverables`; `studio/templates/` | N16, N7 | The first order delivered, with a preview until the payment is confirmed |
| 7 | Contractors' documents and photos; Agent 2's verification sheet in your queue | `contractors`, `uploads`, `tasks` | N23 | An application with its licence photo reaches you with the sheet; your decision reaches the contractor |
| 8 | Telling invited teams about their invitation, and thanking those not picked; questions and answers; the reminder, then closing, for a homeowner who never picks | `matching`, `events` | N22, N3 | Each invited team is told once; an answer reaches every invited team; a homeowner who never picks is reminded, then the project closes |
| 9 | The plan format, a plan read from an image, and floorplan-3d loading it from the API | `homes`, `designs`; floorplan-3d | F2, N4, F1, N2 | A floor plan photo becomes plan JSON that passes its check and opens in floorplan-3d |
| 10 | Design versions saved from floorplan-3d; price table, material list, scope, budget; QA checks; renders | `designs`, `pricing`, `qa`, `images` | F6, N5, N6, N21, N14, N15 | A design package delivered for one home, with every number's source |
| 11 | The design attached to a project; the quote sheet prefilled from it; the comparison's flags; a team's own quote read into the sheet | `matching`, `pricing` | N22, N5 | Two quotes on one sheet, with missing items and far-off prices flagged |
| 12 | Delivery package, daily report, run-record export | `deliverables`, `tasks` | N7 | The judges' export lists every task of one project |
| 13 | The server: the app, the interface, Homebox behind Caddy with HTTPS; daily backups | — | N20, D8 | A phone outside this network registers and sends a quote |
| 14 | The interface (yours) | Your pick (D15) | N1, N26, N8 | Section 9's screens on the routes above |
| 15 | Contract, construction, acceptance and handover on the test project | `contracts`, `construction`, `handover` | N24, N17, N27, N11 | Every stage has run once, and the handover reaches Homebox |
| 16 | Reviews and project records on profiles | `contractors` | N23 | A review from a finished project shows on the profile |
| 17 | micasa and Twenty, if time allows | Connectors | N12, N10 | Upkeep reminders from micasa; your pipeline in Twenty |

### 10.5 Demo and submission checklist (from the brief)

| The brief asks for | Our answer | Where it comes from |
|---|---|---|
| An accessible product, shown live | Our site, the contractor portal and your console (your interface) on the API, a floorplan-3d link and a Homebox invitation, in both languages | N1, N26, N8, N19, F1–F6, N11; a public address needs D8 and N20 |
| The whole business process running: customer acquisition, delivery, customer service, transactions | The journey in section 4, with real or simulated homeowners and contractors at every stage; a real project matched, invited and quoted on | Section 4; N2, N22 |
| A clear human/AI split: how the agents work together, which key decisions the human made, original development | Who does what (section 5), the decision log (section 11), the task records shown as each project's timeline in your console | Sections 5, 6.5 and 11; N3, N8 |
| Run records (运行记录) | Task records, daily reports, the end-to-end tests, the change log | Section 6.5; N7; CHANGES.md |
| Bonus: a first order | The first paid or simulated order, logged | D2, D3; N2 |
| Bonus: a loop across several kinds of work | The work types table (section 5) | Section 5 |
| Bonus: work others can reuse | `studio/`, the plan format, the quote sheet and the agent instructions, published as open source | D14 |

### 10.6 After the event

- Traditional Chinese.
- The contractor fee (D2).
- Text-message checks of mobile numbers and WeChat sign-in, each a D9 exception (D12).
- Online signing (D18) and escrow (D19), once a lawyer has checked them.
- CAD import and drawing by hand (N25).
- More cities.
- Partners and referral fees (D13).

## 11. Decision log

The judges ask which key decisions the human made. Add every boss decision here.

| Date | Decision | Made by | Why |
|---|---|---|---|
| 2026-11-05 | Company idea: one-person AI home-design studio | You | |
| 2026-11-05 | Build on floorplan-3d, roomGPT, Pascal editor, MCP for Blender and SpatialLM | You | Picked from the GitHub shortlist |
| 2026-11-05 | Aim for a one-stop housing platform: floor plans while buying, viewings, purchase, decoration, move-in | You | Asked first whether an open-source platform already exists (GitHub search: none covers the whole journey) |
| 2026-11-05 | Download Twenty (CRM), Homebox (home inventory), micasa (home maintenance) and Home Assistant (smart home) for the one-stop scope | You | Picked from the one-stop GitHub search |
| 2026-11-05 | Make Twenty, Homebox, micasa and Home Assistant parts of our own platform, connected to it, instead of separate tools | You | One product for customers, not four separate apps |
| 2026-11-05 | Build the home record (N9) and the Homebox connector (N11) first | You | The AI proposed it as the next step; you approved |
| 2026-11-05 | Every prerequisite must be free and open source | You | Your rule for the whole project (now `CLAUDE.md` rule 7). Exceptions are D9 |
| 2026-11-06 | Allow two exceptions to that rule: the MiMo API, and WeChat Pay / Alipay if you take real payments (D9) | You | You approved the AI's proposal: the track requires MiMo, and real payments need one of these |
| 2026-11-06 | Finish the plan before building more: one end-to-end framework, up to date with what's built, in which every step has its inputs | You | So the agent team works from one complete plan; the remaining builds can wait |
| 2026-11-06 | Offer the product in Chinese and English (D10) | You | To reach more users |
| 2026-11-06 | You build the interface yourself, last; the AI builds everything behind it and writes down what the interface needs (D15, section 9) | You | |
| 2026-11-06 | Publish the project on GitHub now, as a public repo: github.com/kakssjs/3dfangwu (D14) | You | You asked for the upload. The AI linked the nine parts as submodules instead of copying them, and kept out the keys, Homebox's data, real customers' files and the event's brief. The license is still to choose |
| 2026-11-06 | Change the company to I Renovation, AI renovation design and contractor matching, from the team leaders' proposal. Viewing, purchase and the handover inspection are dropped (D16) | You, with the team leaders | The leaders discussed it and replaced those parts of the plan. You asked the AI not to take the proposal's technical parts on trust and to fit them to the situation; section 2 lists where the plan differs |
| 2026-11-06 | Name the platform I Renovation (D11) | The team leaders | The name of their proposal. A Chinese name, the logo and the domain are still open |
| 2026-11-06 | Use NestJS as the framework for the whole backend (D20) | You | Your call. The AI proposed the database: PostgreSQL through Drizzle, run inside the app by PGlite on this PC, so nothing else needs installing |
| 2026-11-06 | Two kinds of account at registration: homeowners who renovate, and contractors who take the work (D21) | You | Your call. The AI proposed signing in with a mobile number and a password, because text-message codes and WeChat sign-in are closed services (D12) |
| 2026-11-06 | Homeowners publish their renovation requirements; contractors choose which to bid on; each project and bid gets a link; homeowners filter the bids and make the final pick; signed-in homeowners can see contractors' qualifications (D21) | You | Your call, replacing the contractor lists you would have approved for each bid request (D6). The AI proposed the rules that go with it: only verified contractors in that area see a project, bids are sealed, nothing is ranked, and contacts are shared only after the pick |
| 2026-11-06 | Drop the smart home scene (D16) | You | No longer needed. Home Assistant leaves the plan; its folder stays until you decide whether to remove it |
| 2026-11-06 | Rearrange the plan into one final version to develop against: the brief first, then the business, the journey, the platform and the build order | You | So that you can develop from this file |
| 2026-11-06 | Exactly two MiMo agents: Agent 1 looks after the homeowner from requirements to after-sales; Agent 2 matches each inquiry with suitable teams and content and does the supply-side work (D22) | You | Your message: one agent for the homeowner, one for matching. The AI proposed how the work divides: the old Orchestrator's planning is plain code in the runner, the old QA's checks are code (N6), and the rest is split between the two agents |
| 2026-11-06 | No bidding: matched invitations instead (D23) | You | Your message: open bidding rewards the lowest price over the best fit, invites low-balling made up later through change orders, and lets contractors undercut each other in public. The AI proposed the replacement — private projects, a rule-based shortlist with reasons, up to 3 invitations, 7 days to answer, one sealed quote each, no price sorting — adopted for now |
| 2026-11-06 | The server is Aliyun (阿里云) (D8) | You | Your message. The region is still open: a mainland server needs ICP filing (备案), which the plan already says to start early, and a Hong Kong one keeps mainland users' data outside the mainland (PIPL cross-border transfer) |
| 2026-11-06 | Build the multi-agent framework now — no fewer than two agents working together (Agent 1 and Agent 2 stand, D22), on NestJS and the database — and write the final agent-system design document in Markdown to match the challenge brief | You | Your message. The brief scores how the agents divide work, hand off and handle exceptions, and says the key is not the number of agents |
| 2026-11-07 | Use Deep Agents JS for Agent 1's design work, inside the NestJS runner (D24) | You | Your message, choosing it from the options in DESIGN_AGENT.md section 9. The AI proposed keeping the runner as the one orchestrator, so there are not two in parallel |
| 2026-11-07 | The AI builds the frontend now, and tests the whole thing end to end in a real browser (D25) | You | Your message: set up the framework from the documents, finish the frontend, backend and database, then test end to end. This replaces D15's "you build it last". The AI proposed plain modules without a framework |
