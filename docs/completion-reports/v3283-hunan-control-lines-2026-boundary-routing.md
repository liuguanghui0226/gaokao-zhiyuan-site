# v3.283 湖南 2026 控制线与全分数段边界完成报告

## 结论

湖南省教育考试院 2026 年录取控制分数线已从公开页的三张官方原图导入。37 条记录全部进入湖南运行分片：普通类 4 条用于本专科资格路由；特殊类型、体育、艺术和职高对口 33 条保持 `special-path-only`，文化分、专业分和普通类总分不混算。

推荐器已覆盖历史类 199/200/445/446 分和物理类 199/200/399/400 分边界。低于普通专科线时不再展示历史投档命中或可执行院校专业清单，只保留路径调研，模型最高 42 分、可信度 C；达到本科线时明确说明只是本科批次资格边界，不等于任何具体院校或专业投档线。

## 数据与运行时

- 模型版本：`local-deterministic-v3.283-hunan-control-lines2026-and-boundary-routing-846556records`
- 全国记录：846556 条；位次换算：116656 条；来源说明：5089 条。
- 湖南分片：31914 条；本轮控制线 37 条；同年位次换算 1137 条。
- 普通边界：历史本科/专科 446/200，物理本科/专科 400/200。
- 路由计数：普通本科 2、普通专科 2、特殊类型 2、体育 4、艺术 9、职高对口 18。
- 核心 SHA-256：`172c13c2c7d023cb98f6a94c14650cffc1aa5d7939bc2b5b07b82ce17093ad46`
- 湖南分片 SHA-256：`09daaded4890a6bd57d22ce9e7e83e94a37bde43a23582ae02e94a96fb7f0f01`
- 运行清单 SHA-256：`17b4679e9ffabc7d0a9f97f3145ea94959e30e883147c063ed4606c808f80fbb`

## 验证

```text
node scripts/import-official-hunan-control-lines-2026.mjs --use-cache
node scripts/apply-official-hunan-control-lines-2026-v3283.mjs
node scripts/test-official-hunan-control-lines-v3283.mjs
node scripts/test-current-release.mjs
```

本地 13 项当前发布回归通过。浏览器逐项复核 199/200、399/400、445/446 分：199 分页面没有“可执行院校专业清单”和历史投档命中；200 分恢复专科候选；399/445 分进入专科路径；400/446 分退出专科候选并显示本科资格边界说明。

## 部署

- GitHub 数据与模型提交：`bed38de07ccc46d9049e27fa84c8e8954fb2a652`
- Pages 部署：[`29451099351`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/actions/runs/29451099351)，成功。
- 公网全分片验证：[`29451310406`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/actions/runs/29451310406)，成功。
- 公网地址：<https://liuguanghui0226.github.io/gaokao-zhiyuan-site/>
- 官方证据包：[`evidence-v3.283`](https://github.com/liuguanghui0226/gaokao-zhiyuan-site/releases/tag/evidence-v3.283)，SHA-256 `c712f4451fd08038b8542b471a9dd653efcbc6b9a71b40fbe250399add264f51`。

公网验证重新读取页面入口、gzip 核心索引和全部 31 个省级分片，并额外断言湖南来源记录 37 条、普通/特殊路径 4/33 条、本科边界 400/446 和专科边界 200/200。

## 保留缺口

湖南控制线不能被解释为具体院校或专业录取结果；2026 年省级正式投档/录取表发布后仍需继续接入。全国建设继续逐省补齐 2026 控制线、最新投档录取表和专业最低位次，并保持特殊路径口径隔离。
