# v3.307 江西理工大学 2023-2025 全国录取数据完成报告

## 结论

江西理工大学本科招生信息网 2023-2025 年全国分专业录取数据已完成下载、结构化导入、证据分层、31 省运行分片更新、GitHub Pages 发布和公网回读。运行版本为 `local-deterministic-v3.307-national-school-official-jxust2023-2025-native-rank-855003records`，全国结构化记录增至 855003 条，位次换算记录保持 116656 条，来源说明增至 5112 条。

新增 2905 条记录覆盖全部 31 个省级口径；2596 条普通单校边界为 `school-official-only`，309 条艺体、预科、专项、定向、征集、合作办学等限定路径为 `special-path-only`。5 条港澳台联合招生行只进入跳过审计，没有混入内地 31 省模型。

## 位次事实边界

官网表格直接公布了 2704 条最低分位次，运行层保存为 `rankEvidenceScope=school-recorded-min-score-rank`、`rankDerivedFromScore=false`。另外 201 条源表未给位次的记录保持 `rankUnavailable=true` 和 `scoreOnly=true`，没有生成假位次。

这批学校表列位次与 v3.306 南昌航空大学的最低分换算位次严格区分。学校官网单校分数与位次最高只作为 A- 候选复核，不能替代省考试院全量投档/录取表，也不能单独生成录取概率。西藏 9 条记录均无最低位次和 A/B 类口径，西藏省级正式分数层缺口仍未关闭。

## 验证

- `node scripts/test-current-release.mjs`：42 项通过，0 失败；移除本地 raw 目录后的干净检出路径也通过。
- GitHub Pages 部署：运行 `29549188501` 成功，数据部署提交 `a85fa3a6983f79e619728573b76931b5ffa390c1`。
- 公网验证：运行 `29549395436` 成功，独立下载并检查首页、核心索引和全部 31 省分片。
- 直接字节比对：36/36 个发布文件与本地发布树完全一致。
- 桌面 1440x1000、手机 390x844 均为 HTTP 200；推荐真实生成，可见江西理工大学候选，横向溢出 0，控制台错误 0，页面错误 0，失败请求 0。
- 江西 2025 年计算机科学与技术样本为最低分 554、平均分 557.96、最高分 574、录取 73 人、学校官网最低分位次 32276；运行测试和公网工作流均验证其原生位次语义。

验收截图：

- `docs/evidence/v3307/desktop-recommendation.png`
- `docs/evidence/v3307/mobile-recommendation.png`

## GitHub 交付

- 网站：<https://liuguanghui0226.github.io/gaokao-zhiyuan-site/>
- 仓库：<https://github.com/liuguanghui0226/gaokao-zhiyuan-site>
- 证据 Release：<https://github.com/liuguanghui0226/gaokao-zhiyuan-site/releases/tag/evidence-v3.307>
- Release 资产：`evidence-v3.307-jxust-national-admission.tar.gz`，59 个归档条目，42641323 字节，SHA-256 `073e81b5a6897ea247541ce1e5f20709428664eadba2424be12eb95681f21246`。
- Release 资产已重新下载；GitHub digest、本地 SHA-256 和逐字节比较三者一致，隐藏 sidecar 数为 0。

原始官网证据共 3 个文件、2013606 字节，随 Release 保存。外置 `mac_2T` 当前未挂载，本轮没有重连或扫描外置盘；运行源和证据均保存在内部 APFS 与 GitHub。
