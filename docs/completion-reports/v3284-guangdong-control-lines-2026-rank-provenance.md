# v3.284 广东 2026 控制线与位次来源修复完成报告

## 结论

广东省教育考试院 2026 年录取最低分数线已结构化导入。49 条记录进入广东运行分片：普通类历史/物理本科与专科 4 条用于资格路由；专项、军警消防、师范卫生、民族预科和艺体等 45 条保持 `special-path-only`。

推荐器覆盖历史 199/200/439/440 分和物理 199/200/424/425 分边界。低于普通专科线时不展示历史投档命中或可执行院校专业清单，只保留路径调研，模型最高 42 分、可信度 C；达到本科线时明确说明只是本科资格边界，不等于具体院校、专业组或专业录取线。

## 数据与运行时

- 模型版本：`local-deterministic-v3.284-guangdong-control-lines2026-and-rank-provenance-846605records`
- 全国记录：846605 条；位次换算：116656 条；来源说明：5090 条。
- 广东分片：17644 条；位次换算：8816 条；本轮控制线：49 条。
- 普通边界：历史本科/专科 440/200，物理本科/专科 425/200。
- 路由计数：普通本科 2、普通专科 2、特殊路径 45。
- 专业成绩记录 19 条；仅专业资格要求记录 2 条。
- 核心 SHA-256：`260b625a092def93aca94a011318170b1f2a27032ddec63bc98915fd74cb87ca`
- 广东分片 SHA-256：`4f2855a5ce46569604bc69878b57e8846d8c5c9325cba32530798022264d226e`
- 运行清单 SHA-256：`7372ec004e6c18bf5ba06dd5df951f0f55f9b6327d65a23952d35d933031c2c5`

## 来源换版核验

广东物理类位次 PDF 在同一官方网址下发生字节换版。当前 PDF 为 550540 字节，SHA-256 `9bde2c4aaddf28cf3c294e2fdde3fa76981ae2ec4c6df39185d34d6d31044f9f`；重新解析 600 个展示行，生成普通本科/专科 1200 条规范记录，缺失为 0、与运行层逐字段差异为 0，最终累计位次为 433366。因此本轮只修订来源和证据哈希，不宣称位次数据发生变化。

## 验证

```text
node scripts/test-official-guangdong-control-lines-v3284.mjs
node scripts/audit-official-control-line-coverage-v3284.mjs
node scripts/test-current-release.mjs
```

本地当前发布回归 15/15 通过，包括 31 省运行分片、155 个代表分段、每省真实推荐探针、广东八个临界分以及江西、西藏、浙江、湖南既有控制线回归。部署后的公网验证仍将在 Pages 发布完成后执行。

## 部署

- GitHub 数据与模型提交：[`f8da4719`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/commit/f8da4719f7c236a59db2633d8655ff3a62b8e923)。
- Pages 部署：[`29454220941`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/actions/runs/29454220941)，成功。
- 公网全分片验证：[`29454448927`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/actions/runs/29454448927)，成功。
- 公网地址：<https://liuguanghui0226.github.io/gaokao-zhiyuan-site/>
- 官方证据包：[`evidence-v3.284`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/releases/tag/evidence-v3.284)，SHA-256 `b15189ce855785a8c3731a2edf1155bf9f08cabdc83519945ac65d02e42f6805`。

公网验证重新读取页面入口、gzip 核心索引和全部 31 个省级分片，并额外断言广东来源记录 49 条、普通/特殊路径 4/45 条、本科边界 425/440、专科边界 200/200，以及 8816 条位次记录均指向考试院官方来源页。

## 全国覆盖与保留缺口

按 2026 普通高考普通批本科或专科控制线口径，当前覆盖 11 省、仍缺 20 省。广东控制线不能被解释为具体院校或专业录取结果；后续仍需接入 2026 省级正式投档/录取表和专业最低位次，并继续逐省关闭普通批控制线缺口。
