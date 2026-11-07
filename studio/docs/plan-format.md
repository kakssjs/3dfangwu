# The plan JSON format (`studio.plan/1`)

One floor plan in one JSON document, in millimetres. This is the format the Floor-plan agent (N4)
must produce, the API checks (`studio/src/api/homes/plan-format.ts`), and floorplan-3d loads (F1,
F2: `floorplan-3d/index.html`). The shapes are floorplan-3d's own data shapes, so its loader assigns
them straight to `WALLS`, `WINS`, `DOORS`, `SLIDES` and `ROOMS`. Written down 2026-11-07 (F2).

```json
{
  "schema": "studio.plan/1",
  "units": "mm",
  "name": "三室两厅两卫",
  "nameEn": "3BR 2LR 2BA",
  "bounds": { "x": -1850, "y": -1750, "w": 15600, "h": 14100 },
  "walls": [[1580, -240, 2120, 0, "b"], [2120, -240, 4580, 0, "e"]],
  "windows": [[5140, -240, 5760, 0]],
  "doors": [
    { "name": "入户门", "rect": [4580, 8310, 4820, 9200], "h": [4820, 9200], "c": [0, -1], "o": [1, 0], "len": 890, "entry": true }
  ],
  "slidingDoors": [{ "rect": [10270, 7400, 10510, 9770], "v": true }],
  "rooms": [
    { "id": "master", "name": "主卧室", "nameEn": "master bedroom", "poly": [[6600, 0], [10270, 0], [10270, 3370], [6600, 3370]], "mat": "wood", "at": [8435, 2420] }
  ],
  "furniture": [
    { "id": "f1", "type": "bed", "name": "双人床", "cx": 8300, "cy": 1000, "w": 1800, "d": 2000, "rot": 0, "color": "#c9d6df" }
  ]
}
```

Every number is in millimetres; the origin is the inside face of the outer wall at the top left, as
in floorplan-3d (`index.html`, "户型数据"). Unknown fields are refused anywhere, so a typo is
reported instead of ignored.

| Field | Needed | Shape |
|---|---|---|
| `schema` | yes | `"studio.plan/1"` |
| `units` | yes | `"mm"` |
| `name` | no | The home's title in Chinese, for example 三室两厅两卫. Shown as the page's title (F5) |
| `nameEn` | no | Its English form, for the reader's language (D10) |
| `bounds` | no | `{x, y, w, h}`: the drawing's extent. Computed from the walls and rooms when left out |
| `walls` | yes | Wall segments `[x0, y0, x1, y1, type]`. May be empty only if the plan has no walls yet |
| `windows` | yes | Window openings `[x0, y0, x1, y1]`. May be empty |
| `doors` | yes | Hinged doors (below). May be empty |
| `slidingDoors` | yes | `{rect: [x0,y0,x1,y1], v: true|false}`. May be empty |
| `rooms` | yes | At least one room (below) |
| `furniture` | no | Pieces placed by their centre point (below) |

**Wall types** (`walls[i][4]`): `b` 承重 bearing · `e` 外墙 exterior · `n` 可拆非承重 removable
non-bearing · `low` 矮墙 low wall. Stick to these four. A wall of unknown type is refused on load,
and if one ever slips through it counts as load-bearing (N6): only `n` and `low` walls may be
demolished — floorplan-3d's own rule (`toggleWall`).

**Doors**: `{name, rect, h, c, o, len, entry?}` — `rect` is the opening; `h` the hinge point; `c` and
`o` the closed and open directions, each one of `[-1,0] [1,0] [0,-1] [0,1]`; `len` the leaf width;
`entry: true` marks 入户门, the entrance.

**Rooms**: `{id, name, nameEn?, poly, mat?, at?, counted?}` — `id` unique in the document; `name` in
Chinese (needed); `nameEn` its English form (D10: the customer's own room names need it, because
floorplan-3d only translates the names it knows); `poly` at least 3 points `[x, y]`; `mat` the
default flooring key (one of floorplan-3d's `MATS`: `wood`, `walnut`, `tile800`, `tile600`,
`marble`, `antislip`, `terrazzo`, `carpet`), which the homeowner changes in the design; `at` where
the label goes (defaults to the polygon's centre); `counted: false` for areas that don't count
toward the floor area (bay windows 飘窗).

**Furniture** (optional): `{id?, type, name, cx, cy, w, d, rot?, color?}` — `type` is one of
floorplan-3d's furniture types (`bed`, `sofa`, `table`, `fridge`, ...); `cx, cy` the centre point;
`w, d` width and depth; `rot` degrees, default 0; `id` unique when given (the home record and the
Homebox connector keep it across syncs); `color` a CSS colour, default the type's colour.

## Design versions (F6)

A saved design version is not a plan document: it is the state floorplan-3d's "导出方案 JSON" writes,
checked by `validateDesignState`:

```json
{
  "furniture": [ { "id": "f1", "type": "bed", "name": "双人床", "cx": 8300, "cy": 1000, "w": 1800, "d": 2000, "rot": 0 } ],
  "rooms": { "master": { "name": "主卧室", "nameEn": "master bedroom", "mat": "wood" } },
  "demolished": ["w42"],
  "measures": [{ "a": { "x": 0, "y": 0 }, "b": { "x": 3370, "y": 0 } }]
}
```

It holds what the homeowner changes: furniture, room names and flooring, the demolished non-bearing
walls (`w` + the wall's index in `plan.walls`), and their measurements. The walls, windows, doors
and rooms of the plan itself are changed only by a new plan document (N4, N25), never by a version.

## Where it is used

| Step | Where |
|---|---|
| Produced from a floor plan image | N4 (the Floor-plan agent), checked against this format |
| Checked on the way in | `POST /api/homes`, `validatePlan` in `studio/src/api/homes/plan-format.ts` |
| Loaded and edited, versions saved | floorplan-3d (F1, F6), opened by the home's private 3D link |
| Turned into the home record | N9 / N14, `studio/src/home-record.ts` (rooms and furniture) |
| Drawn by hand | N25 (Pascal editor), saved as this format |

The sample apartment floorplan-3d keeps built in is exported in this format at
`studio/samples/plan-sample.json` (`npm run sample`).
