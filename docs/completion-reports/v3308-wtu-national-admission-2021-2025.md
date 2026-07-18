# v3.308 武汉纺织大学 2021-2025 全国录取数据完成报告

## 结论

武汉纺织大学本科招生网 2021-2025 年全国分专业录取数据已完成下载、结构化导入、官网汇总对账、证据分层、31 省运行分片更新、GitHub Pages 发布和公网验证。运行版本为 `local-deterministic-v3.308-national-school-official-wtu2021-2025-native-rank-857225records`，全国结构化记录增至 857225 条，位次换算记录保持 116656 条，来源说明增至 5113 条。

155 个分省分年官方查询页共形成 2222 条分专业记录和 481 个官网汇总行，全部覆盖 31 个省级口径和 2021-2025 五个年份。1633 条普通单校边界为 `school-official-only`；589 条专项、艺体、中外合作、预科、定向等限定路径为 `special-path-only`。专业录取人数与官网汇总按原科类、计划类型、批次、选科备注逐组核对，差异为 0。

## 位次和选科边界

官网表格直接公布的 1921 条最低分位次保存为 `rankEvidenceScope=school-recorded-min-score-rank`、`rankDerivedFromScore=false`。另外 301 条源表没有位次，保持 `rankUnavailable=true` 和 `scoreOnly=true`，没有生成替代位次。

来源中的“艺文/艺理”在检索层归一为艺术类，但保留原始科类并全部隔离到特殊路径，避免 8 条艺术记录误入普通推荐。江西 2025 年计算机类样本为最低分 554、平均分 560.1、最高分 572、录取 7 人、官网最低分位次 32276、化学必选；默认江西物理类且含化学的画像可召回，去掉化学后会被排除。

学校官网单校分数和最低分位次最高只作为 A- 候选复核，不能替代省考试院全量投档/录取表，也不能单独生成录取概率。西藏 17 条记录均无 A/B 类口径和最低位次，西藏省级正式分数层缺口仍未关闭。

## 验证

- `node scripts/test-current-release.mjs`：45 项通过，0 失败；导入、边界和运行测试均通过。
- GitHub Pages 部署：运行 `29631373359` 成功，数据部署提交 `34136c1502eed45507760854a69c769c71347f30`。
- 公网验证：运行 `29631522058` 成功，独立下载并检查首页、核心索引、全部 31 省分片、江西样本、西藏边界和既有官方控制线。
- 桌面 1440x1000 与手机 390x844 均成功生成推荐；武汉纺织大学、计算机类、化学必选与最低位次 32276 可见，横向溢出 0，页面控制台错误 0。
- 本地命令行到 Pages 的 TLS 连接被当前网络环境重置，因此没有改动 VPN/代理；GitHub Actions 的外部公网校验和应用内浏览器实测均已通过。

验收截图：

- `docs/evidence/v3308/desktop-recommendation.png`
- `docs/evidence/v3308/mobile-recommendation.png`

## GitHub 交付

- 网站：<https://liuguanghui0226.github.io/gaokao-zhiyuan-site/>
- 仓库：<https://github.com/liuguanghui0226/gaokao-zhiyuan-site>
- 证据 Release：<https://github.com/liuguanghui0226/gaokao-zhiyuan-site/releases/tag/evidence-v3.308>
- Release 资产：`evidence-v3.308-wtu-national-admission.tar.gz`，205 个文件、219 个归档条目、42675027 字节，SHA-256 `38904d1f125f97928116522974d160b4b2eb49d2b072a525136d5a92d9d4b7df`。
- GitHub digest、本地 SHA-256 和重新下载后的逐字节比较一致，隐藏 sidecar 数为 0。

原始官网证据含 155 个查询页和 1 个原始清单，查询页共 4737036 字节，随 Release 保存。外置 `mac_2T` 当前未挂载，本轮没有重连或扫描外置盘；运行源和证据均保存在内部 APFS 与 GitHub。
