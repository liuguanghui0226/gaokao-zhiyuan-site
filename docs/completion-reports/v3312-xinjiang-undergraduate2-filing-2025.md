# v3.312 新疆 2025 普通类本科二批投档数据完成报告

## 结论

新疆教育考试院 2025 年普通类本科二批次院校投档数据已完成官方页面与 7 张原图下载、OCR 结构化、189 行人工复核、证据分层、新疆运行分片更新、GitHub Pages 发布和公网验证。运行版本为 `local-deterministic-v3.312-xinjiang-official-2025-undergraduate2-score-only-868426records`，全国结构化记录增至 868426 条，位次换算记录保持 116656 条，来源说明增至 5117 条。

7 张官方图片形成 1076 条唯一记录，历史类 472 条、物理类 604 条，涉及 616 所院校。1060 条有实际投档结果，16 条官方显示投档人数为 0；源行跳过、重复 ID、缺学校、缺计划/投档人数和跨科类院校名称不一致均为 0。

## 数据边界

1060 条实际投档记录保存为 `institution-admission`，最低分范围 280-529，并保留计划数、投档人数、最高分、最低分、平均分和同分排序项。16 条未投档记录只保存为 `admission-plan`，`minScore`、`maxScore` 和位次字段为空，且不进入推荐分数池。

官方表是院校投档线，不是最终专业录取结果，也没有公开最低位次、专业名称或选科要求。因此 1076 条记录全部保持 `rankUnavailable=true`、`rankDerivedFromScore=false`，没有用最低分补造位次；网站只提供历史边界、证据层级、风险提示和推荐理由，不生成数值录取概率。

全国录取分覆盖审计目前包含 794743 条院校/专业/专业组/高职录取记录，其中 684004 条为 2023 年及以后记录，337839 条具有某种位次证据，333035 条为原生位次，4804 条为明确标注的分数一分一段换算位次。当前继续优先补强的十个省级口径是西藏、青海、上海、北京、宁夏、天津、海南、吉林、新疆和甘肃。

## 验证

- 严格导入：7 张官方图片、1076 个候选行、1076 条记录、189 行人工修正和 0 跳过行全部通过。
- 本地回归：`node scripts/test-current-release.mjs` 58 项通过，0 失败。
- GitHub Pages 部署：运行 `29647347402` 成功，发布提交 `921f5b0b01d3ae3767ad7518b13f8920b847b635`。
- 公网验证：运行 `29647578375` 成功，独立下载并检查首页、UI、核心索引、全部 31 省分片、新疆新来源和未投档计划隔离。
- 手工公网复核：首页加载 `app.js?v=3.312.0`；核心索引为 868426 条、116656 条位次换算和 5117 条来源说明；新疆分片为 11518 条，新来源计数为 1076/1060/16，带数值位次的新增行数为 0。

## GitHub 交付

- 网站：<https://liuguanghui0226.github.io/gaokao-zhiyuan-site/>
- 仓库：<https://github.com/liuguanghui0226/gaokao-zhiyuan-site>
- 部署运行：<https://github.com/liuguanghui0226/gaokao-zhiyuan-site/actions/runs/29647347402>
- 公网验证：<https://github.com/liuguanghui0226/gaokao-zhiyuan-site/actions/runs/29647578375>
- 证据 Release：<https://github.com/liuguanghui0226/gaokao-zhiyuan-site/releases/tag/evidence-v3.312>
- Release 资产：`evidence-v3.312-xinjiang-2025-undergraduate2.tar.gz`，281 个归档条目、12747585 字节，SHA-256 `280955759341a0f936ffada666decf3c41fe3c36b1b507a118fb8b042b7bb9b9`。
- GitHub digest、本地 SHA-256 和重新下载后的逐字节比较一致，隐藏 sidecar 数为 0。

原始证据目录包含 249 个官方页面、图片和 OCR 中间文件，已随 Release 保存。外置 `mac_2T` 本轮没有挂载、重连或扫描；解析、运行数据和证据打包均在内部 APFS 与 GitHub 完成。
