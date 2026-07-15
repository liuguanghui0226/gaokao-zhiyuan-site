# v3.281 西藏 2026 控制线来源闭合与低分安全路由完成报告

## 结论

现有 22 条西藏 2026 控制线已由自治区政府公开 HTML 逐行复核，并原位补齐公开镜像、SHA-256、考生类别、控制线类型和推荐路由；没有重复新增记录。12 条普通生源控制线进入本专科资格判断，8 条艺体和 2 条部队生源线继续隔离。

推荐器已新增普通专科线以下保护：以西藏物理 B 类为例，194 分低于 195 分专科线时只输出路径探索，模型分最高 42、可信度为 C，并明确说明普通批资格尚未达到；195 分不再触发该警告。

## 数据与运行时

- 模型版本：`local-deterministic-v3.281-xizang-control-provenance-and-low-score-safety-846462records`
- 全国记录：846462 条；位次换算：116656 条；来源说明：5087 条。
- 西藏分片：28315 条；本轮核验 22 条，普通/艺体/部队路由为 12/8/2。
- 核心 SHA-256：`5070573622d34dca99860dc377eed91db5ab78ea3e3cb9fa36a4887a75ceb98d`
- 西藏分片 SHA-256：`409cffbaa734b8102e6bf696be31e778255184a913ce53c5c0abd6af399945ea`
- 政府 HTML 与 mac_2T 镜像 SHA-256：`44f9d2c2145b5155a352bbeafe5dd35e7eeb101915a5549344a8258b2a5bbb5b`

## 验证

```text
node scripts/verify-official-xizang-control-lines-2026-government.mjs --use-cache
node scripts/apply-official-xizang-control-lines-2026-v3281.mjs
node scripts/test-official-xizang-control-lines-v3281.mjs
node scripts/test-current-release.mjs
```

本地 11 项当前发布回归全部通过。浏览器复核西藏物理 B 类 194/195 分、历史 A 类 236/237/293/294 分临界行为通过，控制台错误为 0。

## 部署

- GitHub 提交：`bd570d851ba3045aec921c159938b0aec9f4055a`
- Pages 部署：[`29444426579`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/actions/runs/29444426579)，成功。
- 公网全分片验证：[`29444565672`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/actions/runs/29444565672)，成功。
- 公网地址：<https://liuguanghui0226.github.io/gaokao-zhiyuan-site/>

公网验证读取页面入口、gzip 核心索引和全部 31 个省级分片，并额外断言西藏来源记录 22 条、普通路由 12 条、特殊路径 10 条及 v3.281 模型版本。

## 保留缺口

西藏仍缺可计算一分一段和省级全量普通/高职投档录取表，正式普通录取缺口继续保留为 `西藏`。本轮控制线来源闭合不能被解释为省级录取结果闭合，也不能据此生成录取概率。
