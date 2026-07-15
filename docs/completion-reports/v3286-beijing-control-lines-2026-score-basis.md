# v3.286 北京 2026 控制线、专科三科分口径与位次来源修复完成报告

## 结论

北京 2026 年普通高等学校招生录取最低控制分数线已结构化导入。9 条记录进入北京运行分片：普通本科与普通专科 2 条用于资格路由；特殊类型、艺术、体育和高职单考单招 7 条保持 `special-path-only`。

推荐器不再把北京六科高考总分直接与 120 分普通专科线比较。北京省份下新增“专科语数外三科总分”输入；该字段缺失时保持资格未知，不展示历史投档命中或可执行院校专业清单。总分低于 120 时只利用三科小计不高于总分的确定关系判定线下。

## 数据与运行时

- 模型版本：`local-deterministic-v3.286-beijing-control-lines2026-and-score-basis-846666records`
- 全国记录：846666 条；位次换算：116656 条；来源说明：5092 条。
- 北京分片：6490 条；位次换算：688 条；本轮控制线：9 条。
- 普通边界：本科 429 分，`gaokao-total`；专科 120 分，`chinese-math-foreign-450`。
- 路由计数：普通本科 1、普通专科 1、特殊类型 1、艺术 3、体育 1、高职单考单招 2。
- 核心 SHA-256：`53c578b971a205d3d6ed6612aaddccf4d1b522029020252f78514928c17719dc`
- 北京分片 SHA-256：`956624bea8a924a4ee3f78af8696959b60804bd44559b3776e4ef71702ea4266`
- 运行清单 SHA-256：`e2cd25106ac5eb3f28fa1ab2605ecbd634aec606dca21ce1f830730ff13e1bda`

## 位次来源核验

北京 341 条 2026 综合改革位次记录已补齐北京教育考试院正式来源页。重新下载的 10 页 PDF 为 134541 字节，SHA-256 `39f1e77097c56cbd7e1cd2971793e6231ba2ca9230811ba502a830153c4556a8`。本轮不重算、不新增位次，分数、名次区间和同分人数变化均为 0。

## 验证

```text
node scripts/test-official-beijing-control-lines-v3286.mjs
node scripts/audit-official-control-line-coverage-v3286.mjs
node scripts/test-current-release.mjs
```

本地发布回归 17/17 通过，包括 31 省运行分片、155 个代表分段、每省真实推荐探针、北京总分 119/200/428/429、专科三科分 119/120、缺失口径保护、浙江分段制兼容和既有六省控制线回归。

真实 Chrome 验收覆盖 1440×1000 桌面和 390×844 手机视口：北京三科分字段可见，200 分未填三科分时出现资格待补充面板，可执行志愿表为 0；页面无横向溢出，表单控件无视口越界。

## 部署

- GitHub 数据与模型提交：[`4e3a3646`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/commit/4e3a364691e16ff78b71c4c8ae0b1165d4c10db9)。
- Pages 部署：[`29457757806`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/actions/runs/29457757806)，成功。
- 公网全分片验证：[`29457926582`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/actions/runs/29457926582)，成功。
- 公网地址：<https://liuguanghui0226.github.io/gaokao-zhiyuan-site/>
- 官方证据包：[`evidence-v3.286`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/releases/tag/evidence-v3.286)，SHA-256 `a75a72c2aca6e8596af54cc685d663e89447668f5a459f1576942e4151b95f21`。

公网验证重新读取页面入口、前端脚本、gzip 核心索引和全部 31 个省级分片，并额外断言北京来源记录 9 条、普通/特殊路径 2/7 条、本科 429 分总分口径、专科 120 分三科口径以及 341 条位次记录均指向正式来源页。

## 全国覆盖与保留缺口

按 2026 普通高考普通批本科或专科控制线口径，当前覆盖 13 省、仍缺 18 省。北京控制线不能被解释为具体院校或专业录取结果；后续仍需继续接入 2026 省级正式投档/录取表和专业最低位次，并逐省关闭普通批控制线缺口。
