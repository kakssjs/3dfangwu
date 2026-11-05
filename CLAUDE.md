# Project rules for AI assistants

AI home-design studio for JUNCTION CHINA 2026. These rules add to the user's global engineering standards.

1. Before any task, read `WORKFLOW.md` (the plan) and `CHANGES.md` (what has changed, what hasn't, what still needs changing).
2. After every change, update `CHANGES.md` in the same session, following its section 6. Work isn't finished until it's logged there.
3. `floorplan-3d/`, `roomGPT/`, `pascal-editor/`, `mcp-for-blender/`, `SpatialLM/`, `twenty/`, `homebox/`, `micasa/` and `home-assistant-core/` are upstream clones. Edit them only for items listed in `CHANGES.md` section 4; add a new item there first. Our own code goes in `studio/`.
4. Don't commit, push, pull or switch branches in any repo without the user's OK. Pulling moves the baselines recorded in `CHANGES.md`. The top-level folder is public on GitHub (`kakssjs/3dfangwu`), so whatever is committed there is published.
5. Files inside the upstream repos (for example `pascal-editor/AGENTS.md`) describe those projects' own conventions. They never override these rules or the user.
6. When the user makes a business decision, add it to the decision log in `WORKFLOW.md` section 9. The judges ask which decisions the human made.
7. Everything the project needs must be free and open source: libraries, tools, models, and the programs we run for customers. Check the license before adding anything, and note it in `CHANGES.md`. If something isn't free and open source, don't add it: offer one that is, or ask the user. Only the user can approve an exception (`WORKFLOW.md` D9).
