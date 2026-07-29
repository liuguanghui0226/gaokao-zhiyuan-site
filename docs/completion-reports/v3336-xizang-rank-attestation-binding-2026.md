# v3.336 西藏官方位次确认输入绑定完成报告

- 完成日期：2026-07-30
- 模型版本：`local-deterministic-v3.336-xizang-rank-attestation-input-binding-required-868426records`
- GitHub 仓库：`liuguanghui0226/gaokao-zhiyuan-site`
- 网站内容提交：`ce39ad41c6a04de04070ce9c443705ab1c54cb24`
- 公开网站：<https://liuguanghui0226.github.io/gaokao-zhiyuan-site/>

## 本轮完成

1. 核查西藏教育考试院公告目录前 12 页，覆盖 2021-06-30 至 2026-07-19，其中 2025 年公告 42 条。
2. 在所核官方公开页面未发现普通本科/专科省级投档表、录取最低位次表或公开一分一段表；该结论不扩张为“绝对不存在”，不生成缺失数据。
3. “西藏官方个人查询”确认绑定当前分数、位次、省份、科类、A/B 类和成绩口径，任一字段变化即清空确认和旧推荐。
4. 其他兴趣、城市、预算等偏好变化也会立即清空旧结果，但不清空仍有效的官方位次来源确认。

## 数据边界

- 结构化记录：868426
- 位次换算：133640
- 来源说明：5136
- 西藏记录：28458
- 西藏公开位次换算：0
- 本轮新增录取或位次记录：0

证据清单：`data/admissions/evidence-v3336-xizang-public-disclosure-and-attestation-manifest.json`。

权威页面：

- <http://zsks.edu.xizang.gov.cn/71/74/index.html>
- <https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250603/2293383313.html>
- <https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250627/2293393158.html>
- <https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250625/2293390719.html>

## 验证结果

- 全国回归：122/122 通过。
- 本地浏览器：确认位次后生成“高位段”及 8 个候选；修改位次后来源清空、候选归零并显示“输入已变化，请重新生成推荐”。
- A/B 类变化：来源清空、旧结果失效。
- 普通偏好变化：旧结果失效，已确认来源保持。
- 390px 手机端：`documentWidth = viewportWidth = 390`，无横向溢出。
- 本地浏览器控制台：0 个错误或警告。
- GitHub Pages：运行 `30475214446` 成功。
- 公开站点全分片核验：运行 `30475717903` 成功。
- 公开页浏览器已加载 v3.336 更新时间和全国总览；后续交互控制两次在浏览器通道超时，不影响已通过的本地交互和独立线上下载核验。

## 外部设备

尝试通过私网把公开站点打开到 Ki Mac 时，`kis-MacBook-Air.local:2222` 连接超时。本轮没有改走 Tailscale，也没有修改 VPN、代理、路由或 DNS。
