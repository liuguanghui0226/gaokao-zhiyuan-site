#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const GENERATED_AT = "2026-07-16T09:00:00.000Z";
const SOURCE_ID = "official-hubei-control-lines-2026";
const SOURCE_URL = "https://www.hbea.edu.cn/html/2026-06/15961.html";
const CONTROL_IMAGE_URL = "https://www.hbea.edu.cn/files/2026-06/1.webp.png";
const RANK_SOURCE_ID = "official-hubei-rank-2026";
const RANK_URL = "https://www.hbea.edu.cn/html/2026-06/15962.html";
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data/admissions/official-hubei-control-lines-2026-import.json");
const CONTROL_CACHE = path.join(PROJECT_ROOT, "tmp/official-hubei-control-lines-2026");
const RANK_CACHE = path.join(PROJECT_ROOT, "tmp/official-hubei-rank-2026");

const EXPECTED = {
  controlPage: { file: "control-page.html", bytes: 11006, sha256: "d73d50d6f389f114351ce9a2a5169dfcc06d9069cf3824a3679bb75eae727424" },
  controlImage: { file: "control-lines.png", bytes: 1200796, sha256: "d1fc254b8816fa5b6d1f4c307d489ad042444968698f5be922ee3c95ac80ea44" },
  rankPage: { file: "rank-page.html", bytes: 12045, sha256: "4726baed16eae15246014bd32c30acdb771ffdac469ef4753a2640c7d44cd70f" },
  rankImages: [
    { file: "rank-1.png", bytes: 720929, sha256: "63da2aa4625a03a79ad545859ad751bcc713575fe7a220d9d84ff99b3d5c0852" },
    { file: "rank-2.png", bytes: 798905, sha256: "c432b26e9a343cd1e02cf1621210fb24dc614ff376780fdf174ead057f1cf150" },
    { file: "rank-3.png", bytes: 817468, sha256: "ccb76e0cb1c8cac2d9ab5da369bcc6f6708f446dfd04dd4549247a9e327b00ef" },
    { file: "rank-4.png", bytes: 818340, sha256: "f49151376869451c7c770db0586206b00eb3549e472a9697310f0a1ce1d8cde4" },
    { file: "rank-5.png", bytes: 469644, sha256: "5aeace7d8c79f73bfafebed01031e98286dcdb32ced59aa88c75715316cb4bf1" },
    { file: "rank-6.png", bytes: 678925, sha256: "1ab68a60b209d41c959857256525bdbe2a2a5d56dfddd11adbc652d126f7e8f0" },
    { file: "rank-7.png", bytes: 782958, sha256: "047fe79b935097d6c7cbb0aecd5650df0deea85ccc8f10bac25e6f5901073241" },
    { file: "rank-8.png", bytes: 793621, sha256: "f1bb2e445f9892f4d2508f4d2729bb29ae2cd9aa941314b07b44d4d1479c372f" },
    { file: "rank-9.png", bytes: 795272, sha256: "5b30acc4930f902d7ee0284063f17a54d4af6b4c4cf483c9e3c364fa00df35be" },
    { file: "rank-10.png", bytes: 354338, sha256: "196be259e933c6131849f2ffb623321c56cfb14d3cece7deffbdca79170c4a15" },
  ],
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(buffer) {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function verifyFile(root, expected) {
  const file = path.join(root, expected.file);
  const bytes = fs.readFileSync(file);
  assert(bytes.byteLength === expected.bytes, `${expected.file} byte count drifted`);
  assert(sha256(bytes) === expected.sha256, `${expected.file} SHA-256 drifted`);
  return { ...expected };
}

function recordId(parts) {
  const digest = crypto.createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 18);
  return `2026-hubei-control-${digest}`;
}

function commonRecord({ subjectType, batch, majorGroup, minScore, routeKind, section, scope, tags, scoreBasis = "gaokao-total", professionalMinScore, professionalScoreMetric, applicableSchoolScope }) {
  const majorName = `${section}${majorGroup ? `-${majorGroup}` : ""}录取控制分数线`;
  const record = {
    id: recordId([subjectType, batch, majorGroup, minScore, routeKind]),
    province: "湖北",
    year: 2026,
    subjectType,
    batch,
    schoolName: "湖北省2026年普通高校招生录取控制分数线",
    schoolTags: ["湖北官方控制线", ...tags],
    city: "湖北",
    dataType: "control-line",
    majorName,
    majorGroup,
    minScore,
    cultureScoreLine: minScore,
    scoreDimension: "total-score",
    scoreBasis,
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: "official-hubei-control-line-image-verified",
    sourceUrl: SOURCE_URL,
    formalScoreScope: scope,
    controlLineRouteKind: routeKind,
    controlLineKind: section,
    controlLineSection: section,
    sourceFile: "data/admissions/raw/official-hubei-control-lines-2026/control-lines.png",
    sourcePublishedAt: "2026-06-25",
  };
  if (Number.isFinite(professionalMinScore)) {
    record.professionalMinScore = professionalMinScore;
    record.professionalScoreMetric = professionalScoreMetric;
    record.scoreDimension = "culture-plus-professional-thresholds";
  }
  if (applicableSchoolScope) record.applicableSchoolScope = applicableSchoolScope;
  if (scope === "control-line-only") {
    record.cautions = [
      "这是湖北省2026年普通类本科或高职高专录取控制分数线，只用于对应首选科目的普通批资格边界。",
      "达到控制线不等于达到任何具体院校专业组、院校或专业的实际投档录取线。",
      "历史类和物理类不得混用；特殊类型、艺术、体育和技能高考控制线不参与普通类推荐路由。",
    ];
  } else if (scope === "limited-school-control-line-only") {
    record.cautions = [
      "150分不是湖北普通高职高专通用控制线，只适用于官方明确列出的限定院校范围。",
      "限定范围为湖北省独立学院和民办高校、湖北省办在市州（武汉市以外）的高职院校。",
      "必须逐校核验2026年招生计划、办学性质、举办地和专业组，不得外推为外省学校或湖北全部高职院校可报。",
    ];
  } else {
    record.cautions = [
      "这是湖北省2026年特殊类型、艺术、体育或技能高考控制线，不适用于普通类考生直接推荐。",
      "总分和专业分只适用于对应特殊招生路径与类别。",
      "控制线不是具体院校专业组、院校或专业的实际投档录取线。",
    ];
  }
  return record;
}

const records = [];
for (const [subjectType, bachelor, special] of [["物理类", 435, 529], ["历史类", 443, 532]]) {
  records.push(commonRecord({ subjectType, batch: "普通类本科", majorGroup: "普通类", minScore: bachelor, routeKind: "ordinary-bachelor", section: "普通类本科录取控制分数线", scope: "control-line-only", tags: ["普通类", "本科"] }));
  records.push(commonRecord({ subjectType, batch: "普通类高职高专", majorGroup: "普通类", minScore: 200, routeKind: "ordinary-vocational", section: "普通类高职高专录取控制分数线", scope: "control-line-only", tags: ["普通类", "高职高专"] }));
  records.push(commonRecord({
    subjectType,
    batch: "普通类高职高专限定院校",
    majorGroup: "普通类限定院校",
    minScore: 150,
    routeKind: "ordinary-vocational-limited-school",
    section: "普通类高职高专限定院校录取控制分数线",
    scope: "limited-school-control-line-only",
    tags: ["普通类", "高职高专", "限定院校"],
    applicableSchoolScope: "湖北省独立学院和民办高校、湖北省办在市州（武汉市以外）的高职院校",
  }));
  records.push(commonRecord({ subjectType, batch: "本科特殊招生线", majorGroup: "特殊类型招生", minScore: special, routeKind: "special", section: "本科特殊招生线", scope: "special-path-only", tags: ["特殊路径", "特殊类型招生"] }));
}

const artBachelor = [
  ["美术与设计类", 326, 195], ["音乐表演类", 321, 221], ["音乐教育类", 326, 221],
  ["舞蹈类", 210, 230], ["戏剧影视表演类", 387, 228], ["戏剧影视导演类", 435, 204],
  ["服装表演类", 275, 198], ["播音与主持类", 375, 240], ["书法类", 375, 223],
  ["戏曲类省际联考专业", 217, 180],
];
for (const [majorGroup, culture, professional] of artBachelor) {
  records.push(commonRecord({
    subjectType: "艺术类", batch: "艺术类本科", majorGroup, minScore: culture, routeKind: "art", section: "艺术类本科",
    scope: "special-path-only", tags: ["特殊路径", "艺术类", majorGroup], professionalMinScore: professional,
    professionalScoreMetric: majorGroup.includes("戏曲") ? "xiqu-interprovincial-joint-exam" : "professional-unified-exam",
  }));
}
records.push(commonRecord({
  subjectType: "艺术类", batch: "艺术类高职高专", majorGroup: "艺术类各类别", minScore: 120, routeKind: "art", section: "艺术类高职高专",
  scope: "special-path-only", tags: ["特殊路径", "艺术类", "高职高专"], professionalMinScore: 180, professionalScoreMetric: "professional-unified-or-joint-exam",
}));

records.push(commonRecord({
  subjectType: "体育类", batch: "体育类本科", majorGroup: "体育类", minScore: 387, routeKind: "sports", section: "体育类本科",
  scope: "special-path-only", tags: ["特殊路径", "体育类", "本科"], professionalMinScore: 350, professionalScoreMetric: "sports-professional-quality-test",
}));
records.push(commonRecord({
  subjectType: "体育类", batch: "体育类高职高专", majorGroup: "体育类", minScore: 120, routeKind: "sports", section: "体育类高职高专",
  scope: "special-path-only", tags: ["特殊路径", "体育类", "高职高专"], professionalMinScore: 300, professionalScoreMetric: "sports-professional-quality-test",
}));

const skillBachelor = [["机械类", 562], ["电气电子类", 569], ["计算机类", 588], ["护理类", 574], ["财经类", 598], ["建筑技术类", 549], ["旅游类", 566], ["学前教育类", 582], ["农学类", 588], ["汽修类", 571]];
for (const [majorGroup, score] of skillBachelor) {
  records.push(commonRecord({
    subjectType: "技能高考", batch: "技能高考本科", majorGroup, minScore: score, routeKind: "skill-gaokao", section: "技能高考本科",
    scope: "special-path-only", tags: ["特殊路径", "技能高考", majorGroup], scoreBasis: "skill-gaokao-combined-total", professionalMinScore: 294, professionalScoreMetric: "professional-skills-score",
  }));
}
records.push(commonRecord({
  subjectType: "技能高考", batch: "技能高考高职高专", majorGroup: "技能高考各类别", minScore: 200, routeKind: "skill-gaokao", section: "技能高考高职高专",
  scope: "special-path-only", tags: ["特殊路径", "技能高考", "高职高专"], scoreBasis: "skill-gaokao-combined-total",
}));

const controlPage = verifyFile(CONTROL_CACHE, EXPECTED.controlPage);
const controlImage = verifyFile(CONTROL_CACHE, EXPECTED.controlImage);
const rankPage = verifyFile(RANK_CACHE, EXPECTED.rankPage);
const rankImages = EXPECTED.rankImages.map((item) => verifyFile(RANK_CACHE, item));
assert(records.length === 32, `Expected 32 control-line records, got ${records.length}`);
assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate generated record ids");

const routeCounts = Object.fromEntries([...records.reduce((map, record) => map.set(record.controlLineRouteKind, (map.get(record.controlLineRouteKind) || 0) + 1), new Map())]);
const payload = {
  dataset: "official-hubei-control-lines-2026-import",
  generatedAt: GENERATED_AT,
  scope: { province: "湖北", year: 2026, sourceKind: "official-control-lines" },
  notes: [
    "官方正文以单张图片发布；本导入器锁定控制线正文、原图、位次正文和10张位次原图的字节数与SHA-256，再按原图逐项结构化。",
    "普通本科/高职高专4条进入通用资格路由；150分2条仅进入限定院校路由；特殊招生、艺术、体育和技能高考26条保持特殊路径隔离。",
    "艺术、体育和技能高考的文化分、专业分或技能分分字段保存；控制线不替代任何具体院校专业组投档录取线。",
  ],
  sourceNotes: [{
    id: SOURCE_ID,
    province: "湖北",
    title: "省教育厅关于湖北省2026年普通高校招生录取控制分数线的通知",
    publisher: "湖北省教育厅 / 湖北省招办 / 湖北省教育考试院",
    publishedAt: "2026-06-25",
    url: SOURCE_URL,
    attachmentUrls: [CONTROL_IMAGE_URL],
    relatedUrls: [RANK_URL, ...rankImages.map((_, index) => `https://www.hbea.edu.cn/files/2026-06/${index + 1}.png`)],
    quality: "official-hubei-control-line-image-verified",
    usage: "抽取湖北2026普通类、特殊招生、艺术、体育和技能高考控制线32条；仅普通历史/物理本科与通用高职高专4条参与通用资格路由，150分2条单独进入限定院校路由。",
    parsedRecords: records.length,
    controlPageBytes: controlPage.bytes,
    controlPageSha256: controlPage.sha256,
    controlImageBytes: controlImage.bytes,
    controlImageSha256: controlImage.sha256,
    rankEvidence: { sourceId: RANK_SOURCE_ID, url: RANK_URL, pageBytes: rankPage.bytes, pageSha256: rankPage.sha256, imageCount: rankImages.length, imageBytes: rankImages.reduce((sum, item) => sum + item.bytes, 0), images: rankImages, records: 1079 },
    limitedSchoolPolicy: "普通类高职高专150分仅适用于湖北省独立学院和民办高校、湖北省办在市州（武汉市以外）的高职院校。",
    evidenceBoundary: "control-line-only=4; limited-school-control-line-only=2; special-path-only=26; culture-plus-professional=23; not institution-group, institution or major admission score",
  }],
  records,
  diagnostics: {
    recordCount: records.length,
    ordinaryRecords: records.filter((record) => record.formalScoreScope === "control-line-only").length,
    limitedSchoolRecords: records.filter((record) => record.formalScoreScope === "limited-school-control-line-only").length,
    specialPathRecords: records.filter((record) => record.formalScoreScope === "special-path-only").length,
    cultureProfessionalRecords: records.filter((record) => Number.isFinite(record.professionalMinScore)).length,
    routeCounts,
    ordinaryBoundaries: { "物理类": { bachelor: 435, vocational: 200, limitedSchoolVocational: 150 }, "历史类": { bachelor: 443, vocational: 200, limitedSchoolVocational: 150 } },
    professionalMetricCounts: Object.fromEntries([...records.filter((record) => record.professionalScoreMetric).reduce((map, record) => map.set(record.professionalScoreMetric, (map.get(record.professionalScoreMetric) || 0) + 1), new Map())]),
  },
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "ok", out: path.relative(PROJECT_ROOT, OUTPUT_FILE), diagnostics: payload.diagnostics, evidence: { controlPage, controlImage, rankPage, rankImageBytes: payload.sourceNotes[0].rankEvidence.imageBytes } }, null, 2));
