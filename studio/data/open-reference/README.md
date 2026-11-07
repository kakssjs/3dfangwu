# 真实开放参考数据快照

采集/核对：2026-11-07。快照格式：`homora.reference/1`。数据文件：`snapshot.json`。

## 内容与来源

| 类别 | 条数 | 来源 | 许可 | 范围/限制 |
| --- | ---: | --- | --- | --- |
| business | 80 | OpenStreetMap / Overpass | ODbL-1.0 | 上海边界框内有名称的家具、五金、建材、厨卫类商店；不是平台注册施工团队；全部未核验 |
| building | 20 | OpenStreetMap / Overpass | ODbL-1.0 | 上海中心区有名称的建筑外围轮廓；不是室内户型，不包含真实施工测量 |
| material | 9 | Wikidata | CC0-1.0 | 木材、砖、玻璃、钢、铝、铜、大理岩、石灰岩、混凝土；保留来源标签/说明和选定声明，不包含编造的价格或性能参数 |
| floorplan | 3 | Smithsonian / Cooper Hewitt / National Postal Museum | CC0-1.0 | 历史建筑平面图的真实馆藏目录元数据，保留原文标题和出处；不是现代住宅库存，不含可直接编辑的毫米几何，也没有伪造房间数 |
| region | 3514 | 项目已安装的 china-area-data@5.0.1 | MIT | 现有真实地区代码/名称快照；未宣称为 2026 年最新官方区划；排除市辖区、县这类占位名称 |

### 可复核的查询与原始入口

- OSM 商家：`https://overpass-api.de/api/interpreter`，查询：`[out:json][timeout:25];nwr["shop"~"^(furniture|doityourself|hardware|kitchen|bathroom_furnishing)$"]["name"](30.7,120.8,31.7,122.0);out center 80;`
- OSM 建筑：同一接口，查询：`[out:json][timeout:25];way["building"]["name"](31.22,121.45,31.24,121.49);out geom 20;`
- 每条 OSM 记录均保留 node/way/relation 的原始 ID 与 `https://www.openstreetmap.org/{type}/{id}` 链接。商家只保存名称、类型、坐标和已公开的地址标签，不导入私人账号或电话号码。
- Wikidata：`https://www.wikidata.org/wiki/Special:EntityData/{QID}.json`；QID：Q287、Q40089、Q11469、Q11427、Q663、Q753、Q40861、Q23757、Q22657；保留 `lastrevid` 和 modified 时间。
- Smithsonian：`https://www.si.edu/object/floor-plan-building:chndm_1964-12-1`；`https://www.si.edu/object/alternate-scheme-ground-floor-plan-country-house:chndm_1963-47-4`；`https://postalmuseum.si.edu/object/npm_0.052985.513.32`。本轮通过官方页面的索引内容核对 CC0 和馆藏信息，直接抓取部分页面收到 403，不声称批量下载了原图。
- 地区：`https://github.com/airyland/china-area-data`，项目内 `node_modules/china-area-data/data.json`；对应 MIT 许可全文保存在 `china-area-data-LICENSE.txt`。

### 许可与署名

- OSM：© OpenStreetMap contributors。版权和 ODbL 条款：`https://www.openstreetmap.org/copyright`。公开分发这些记录或衍生数据应保留署名及相应 ODbL 要求。API 保留逐条许可与署名，可按 source/kind 分离参考资料；客户业务表没有被改写。
- Wikidata 结构化数据 CC0：`https://www.wikidata.org/wiki/Wikidata:Licensing`。
- Smithsonian 记录逐项标为 CC0，保留机构署名和源记录链接。
- CubiCasa5K 的实际许可证是 CC BY-NC 4.0（`https://github.com/CubiCasa/CubiCasa5k/blob/master/LICENSE`），没有导入；RPLAN 等尚未确认满足商业使用条件的资料同样没有拿来凑数。

## 字段与真实性

每条记录含稳定 source ID、类别、来源 URL、许可、署名、收集时间、源版本和 data 校验摘要。`retrievedAt` 是本轮收集时间，不是事件发生时间。`sourceHash` 是对保留字段的 JSON 序列化做 SHA-256，用于发现快照意外改动，不代表第三方数字签名。

没有生成用户、公司账号、资质、历史施工案例、报价、评价、联系方式或授权记录。公开商家可能停业或标签过时，只有地图收录证据，不能据此授予 verified 身份。地区和历史图纸均保留时间/范围限制。

## 导入与查询

1. `npm run build`
2. `node scripts/import-reference-data.mjs --dry-run`：校验数据结构、重复 ID 和摘要，不写库。
3. 停止本地 API并备份数据库，然后 `node scripts/import-reference-data.mjs --apply`。脚本检查本地 API 是否仍运行；PGlite 不允许并发开库。
4. 重启 API。导入采用事务与稳定 ID upsert，重复执行不会增殖；不删除其他表记录。

只读 API：`GET /api/reference-data/stats`、`GET /api/reference-data?kind=business&limit=30&offset=0`、`GET /api/reference-data/{encodeURIComponent(id)}`。kind 支持以上五类，limit 为 1–100。所有响应包含 `referenceOnly: true`。

前端原有施工团队列表仍只展示真实入驻并人工核验的账号；这批参考资料不会冒充团队进入报价流程。本轮按数据库补充需求增加只读接口，没有擅自改动首页或前端布局。

## 实际导入验证

- 生产本地库：`runtime/studio-db`，已导入 3626 条。
- 导入前完整目录备份：`runtime/backups/studio-db-before-reference-20261107-065434`（不在 Git 中）。
- 连续导入两次后仍为 3626 条；现有 users、projects、contractor_profiles、homes、invitations、design_versions 数量与导入前一致。
- 真实运行中的 API 已核对五类统计与代表记录；非法分页被拒绝。
- 类型检查、构建、定向参考资料测试已通过；完整测试 `npm test` 共 144 项全部通过（0 失败、0 跳过）。
