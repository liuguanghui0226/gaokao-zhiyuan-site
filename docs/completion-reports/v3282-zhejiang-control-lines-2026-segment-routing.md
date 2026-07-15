# v3.282 浙江 2026 各类别分数线与普通类分段路由完成报告

## 结论

浙江省教育考试院 2026 年各类别分数线已从公开 HTML 的五张表逐行解析，57 条记录全部进入浙江运行分片。普通类第一段 494 分、第二段 266 分按考生分段独立路由，不冒充本科/专科控制线；其余 55 条特殊类型、艺体与单独考试招生记录保持特殊路径隔离。

推荐器已通过 265/266/493/494 分四个临界点：265 分只作路径调研且最高 42/C，266-493 分同步比较剩余本科和高职计划，494 分及以上显示“普通类第一段”并继续按位次和具体投档线判断。

## 数据与运行时

- 模型版本：`local-deterministic-v3.282-zhejiang-control-lines2026-and-segment-routing-846519records`
- 全国记录：846519 条；位次换算：116656 条；来源说明：5088 条。
- 浙江分片：110946 条；2026 分数线 57 条；同年位次换算 428 条。
- 路由计数：普通分段 2、特殊类型 1、艺术文化 5、艺术综合分 22、体育综合分 2、单独考试招生 25。
- 核心 SHA-256：`61454a9410ea27bf44e964856d325ed6650b399f88e02edb2e39294bd1eb18d9`
- 浙江分片 SHA-256：`58237d1ba3990da74515d467e82b3e34f91305732aa5f007c31d383c77d8a0fe`
- 运行清单 SHA-256：`fdce185907a2591cf4a1fdced6337f724bc3f6afa6e3bb67d36744db2222cf16`
- 官方 HTML 与 mac_2T 镜像 SHA-256：`ecbb3531e9dfed98bb6ae4e31a18d5e9979fe789e04bdad39f7bf6648a5a0550`

## 验证

```text
node scripts/import-official-zhejiang-control-lines-2026.mjs
node scripts/apply-official-zhejiang-control-lines-2026-v3282.mjs
node scripts/test-official-zhejiang-control-lines-v3282.mjs
node scripts/test-current-release.mjs
```

本地 12 项当前发布回归通过。浏览器复核浙江 265/266/493/494 分临界行为通过；493 分页面同时保留本科与高职方案，但高职卡片内部没有本科记录；494 分显示“普通类第一段”；控制台错误为 0。

## 部署

- GitHub 数据与模型提交：`16638fb5aedb6af9e5f73d36e386074108f64205`。
- Pages 部署：[`29448089471`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/actions/runs/29448089471)，成功。
- 公网全分片验证：[`29448298058`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/actions/runs/29448298058)，成功。
- 公网地址：<https://liuguanghui0226.github.io/gaokao-zhiyuan-site/>

公网验证重新读取页面入口、gzip 核心索引和全部 31 个省级分片，并额外断言浙江来源记录 57 条、普通分段分数为 266/494、特殊路径 55 条及 v3.282 模型版本。

## 保留缺口

浙江分段线不能被解释为学历层次保证线或具体院校专业录取结果。全国数据建设继续按省补齐最新年度正式投档/录取表；西藏可计算一分一段和省级全量普通/高职投档录取缺口继续保留。
