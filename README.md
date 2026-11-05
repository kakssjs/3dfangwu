# 3dfangwu

A one-person AI home company, built for JUNCTION CHINA 2026 (Xiaomi MiMo track, "OPC · 一人公司"). One human, the boss, and a team of MiMo agents take each customer from a floor plan through viewing, purchase, design, construction and move-in, in Chinese and English.

Work in progress: the plan is written, the home record (N9) and the Homebox connector (N11) are built, and the rest is planned item by item in `CHANGES.md`.

| Read | For |
|---|---|
| [WORKFLOW.md](WORKFLOW.md) | The plan: the business, the customer journey, the agent team, and the decisions the human made |
| [CHANGES.md](CHANGES.md) | What has been built and how it was checked, and what is still to do |
| [studio/README.md](studio/README.md) | Our code, and how to run and test it |
| [CLAUDE.md](CLAUDE.md) | The rules the AI coding assistant follows in this repo |

## Get it

Nine of the folders are other people's projects that we build on: `floorplan-3d`, `roomGPT`, `pascal-editor`, `mcp-for-blender`, `SpatialLM`, `twenty`, `homebox`, `micasa` and `home-assistant-core`. They're linked as git submodules at the commits recorded in `CHANGES.md` section 1, not copied, so each keeps its own history and license. `WORKFLOW.md` section 7 says what each one is for, and `CHANGES.md` section 4 gives its license.

Clone, then fetch only the parts you need:

```bash
git clone https://github.com/kakssjs/3dfangwu.git
cd 3dfangwu
git submodule update --init floorplan-3d roomGPT
```

`twenty` and `home-assistant-core` are large: add `--filter=blob:none` to skip their old file versions.

## Not in this repo

Keys (`studio/.env.local`), the programs we run and their data (`runtime/`), real customers' files, and the event's brief.

## License

Not chosen yet (`WORKFLOW.md` D14). Until there's a `LICENSE` file, the code here can be read but not reused. Each linked project keeps its own license.
