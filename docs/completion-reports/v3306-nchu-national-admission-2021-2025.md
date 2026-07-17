# v3.306 南昌航空大学 2021-2025 全国录取数据完成报告

## 结论

南昌航空大学本科招生网 2021-2025 年全国分专业录取数据已完成下载、结构化导入、证据分层、31 省运行分片更新、推荐语义升级和 GitHub Pages 发布。运行版本为 `local-deterministic-v3.306-national-school-official-nchu2021-2025-derived-rank-852098records`，全国结构化记录增至 852098 条，来源说明增至 5111 条。

新增 4860 条记录覆盖 29 个省级口径；3955 条普通单校边界为 `school-official-only`，905 条限定路径为 `special-path-only`。官方接口没有返回西藏、宁夏记录，运行层未补造数据。

## 位次事实边界

南昌航空大学官方说明明确指出页面排位由相应分数按各省一分一段表换算，不是学校录取最低位次。运行层因此把 4804 条排位标为 `rankDerivedFromScore=true`、`rankEvidenceScope=score-derived-provincial-segment` 和 `nativeAdmissionRankUnavailable=true`；另外 56 条保持 `rankUnavailable=true`。

推荐器对这类记录显示“最低分换算位次”，并明确提示“非校录取最低位次”；学校官网证据最高仍为 A-。换算位次只辅助同省同年分数对齐，不生成学校真实录取位次或录取概率。

## 验证

- `node scripts/test-current-release.mjs`：39 项通过，0 失败。
- GitHub Pages：运行 `29546265337` 成功，发布提交 `34f8a3df6cf259f9504164152bfd22cbc2dd4682`。
- 公网验证：运行 `29546505427` 成功，重新下载首页、核心索引和 31 省分片后核验。
- 直接字节比对：首页、`app.js`、`styles.css`、核心 gzip、清单 gzip、江西 gzip 共 6 个文件与本地发布树完全一致。
- 桌面 1440x1000、手机 390x844 均为 HTTP 200；推荐真实生成，横向溢出 0，控制台错误 0，页面错误 0，失败请求 0。
- 江西 2025 年计算机科学与技术样本为最低分 562、平均分 565、最高分 573、录取 46 人、最低分换算位次 26975；运行测试与公网工作流均验证免责声明。

验收截图：

- `docs/evidence/v3306/desktop-recommendation.png`
- `docs/evidence/v3306/mobile-recommendation.png`

## GitHub 交付

- 网站：<https://liuguanghui0226.github.io/gaokao-zhiyuan-site/>
- 仓库：<https://github.com/liuguanghui0226/gaokao-zhiyuan-site>
- 证据 Release：<https://github.com/liuguanghui0226/gaokao-zhiyuan-site/releases/tag/evidence-v3.306>
- Release 资产：`evidence-v3.306-nchu-national-admission.tar.gz`，214 个归档条目，42511602 字节，SHA-256 `e383dbe5aeb734ecd53b11f9eba4e5bc7e72146858587da8c787508c1ea89e02`。
- Release 资产已重新下载，GitHub digest、本地 SHA-256 和逐字节比较三者一致。

原始官网证据共 161 个文件、6099161 字节，随 Release 保存。外置 `mac_2T` 当前未挂载，本轮没有重连、扫描或声称同步外置镜像；运行源和证据均保存在内部 APFS 与 GitHub。
