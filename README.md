# 3dfangwu

I Renovation: an AI renovation design and contractor-matching platform, run as a one-person company and built for JUNCTION CHINA 2026 (Xiaomi MiMo track, "OPC · 一人公司"). One human, the boss, and a team of MiMo agents turn a homeowner's floor plan into a design package, let verified contractors bid on it on one bid sheet, and follow the contract, the construction, the final acceptance and after-sales, in Chinese and English.

Work in progress: the plan is final, and the first parts are built and tested in `studio/`: a NestJS API where homeowners and contractors register, homeowners save renovation requirements and invite up to three matched verified teams, each team gives one sealed quote, and the homeowner picks one (N19, N22, N23); the home record (N9); and the Homebox connector (N11). The rest is planned item by item in `CHANGES.md`.

| Read | For |
|---|---|
| [WORKFLOW.md](WORKFLOW.md) | The plan, to develop from: what the JUNCTION brief asks for, the business, the renovation journey and the contractors' side, the agent team, the platform and its API, what the interface needs, the build order, and the decisions the human made |
| [CHANGES.md](CHANGES.md) | What has been built and how it was checked, and what is still to do |
| [studio/README.md](studio/README.md) | Our code, and how to run and test it |
| [CLAUDE.md](CLAUDE.md) | The rules the AI coding assistant follows in this repo |

## Get it

Nine of the folders are other people's projects that we build on: `floorplan-3d`, `roomGPT`, `pascal-editor`, `mcp-for-blender`, `SpatialLM`, `twenty`, `homebox`, `micasa` and `home-assistant-core` (no longer used: the smart home scene was dropped). They're linked as git submodules at the commits recorded in `CHANGES.md` section 1, not copied, so each keeps its own history and license. `WORKFLOW.md` section 7 says what each one is for, and `CHANGES.md` section 4 gives its license.

Clone, then fetch only the parts you need:

```bash
git clone https://github.com/kakssjs/3dfangwu.git
cd 3dfangwu
git submodule update --init floorplan-3d roomGPT
```

`twenty` and `home-assistant-core` are large: add `--filter=blob:none` to skip their old file versions.

## Not in this repo

Keys (`studio/.env.local`), the programs we run and their data (`runtime/`), real homeowners' and contractors' files, and the event's brief.

## License

Not chosen yet (`WORKFLOW.md` D14). Until there's a `LICENSE` file, the code here can be read but not reused. Each linked project keeps its own license.
