#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE_ID = "official-fujian-control-lines-2026";
const CONTROL_URL = "https://www.eeafj.cn/gkptgkgsgg/20260624/14697.html";
const CONTROL_IMAGE_URL = "https://www.eeafj.cn/u/cms/default/202606/20260624151636_4.jpg";
const RANK_URLS = {
  "历史类": "https://www.eeafj.cn/gkptgkgsgg/20260625/14698.html",
  "物理类": "https://www.eeafj.cn/gkptgkgsgg/20260625/14699.html",
};
const RANK_IMAGE_URLS = [
  "https://www.eeafj.cn/u/cms/default/202606/20260625091641_469.jpg",
  "https://www.eeafj.cn/u/cms/default/202606/20260625091642_980.jpg",
  "https://www.eeafj.cn/u/cms/default/202606/20260625091642_682.jpg",
  "https://www.eeafj.cn/u/cms/default/202606/20260625091642_527.jpg",
  "https://www.eeafj.cn/u/cms/default/202606/20260625091744_154.jpg",
  "https://www.eeafj.cn/u/cms/default/202606/20260625091744_318.jpg",
  "https://www.eeafj.cn/u/cms/default/202606/20260625091744_501.jpg",
  "https://www.eeafj.cn/u/cms/default/202606/20260625091744_834.jpg",
];
const TITLE = "福建省2026年普通高考录取控制分数线公布";
const QUALITY = "official-fujian-control-line-image-verified";
const GENERATED_AT = "2026-07-16T00:45:00.000Z";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/official-fujian-control-lines-2026");

const evidence = {
  controlPage: {
    url: CONTROL_URL,
    cache: "tmp/official-fujian-control-lines-2026/control-page.html",
    raw: "control-page.html",
    bytes: 16211,
    sha256: "c2acd98f9bd57a7031fb3e28de51849d5f2427b5535108abc418e22c71391a3b",
  },
  controlImage: {
    url: CONTROL_IMAGE_URL,
    cache: "tmp/official-fujian-control-lines-2026/control-lines.jpg",
    raw: "control-lines.jpg",
    bytes: 1297816,
    sha256: "3e02438605e2703d2a86be08eec2fddfa797e2b313c8795a2082e9418245e645",
  },
  rankHistoryPage: {
    url: RANK_URLS["历史类"],
    cache: "tmp/official-fujian-control-lines-2026/rank-history-page.html",
    raw: "rank-history-page.html",
    bytes: 16105,
    sha256: "87831249b32f866217c490fde278319be38e2b4e400a9a20b000b12d7000e7e5",
  },
  rankPhysicsPage: {
    url: RANK_URLS["物理类"],
    cache: "tmp/official-fujian-control-lines-2026/rank-physics-page.html",
    raw: "rank-physics-page.html",
    bytes: 16107,
    sha256: "340b729d2a28e7e9eb648b0989869a56dd7c9170c7c64321fd0bdf1b35507107",
  },
  rank01: { url: RANK_IMAGE_URLS[0], cache: "tmp/official-fujian-control-lines-2026/rank-01.jpg", raw: "rank-01.jpg", bytes: 941643, sha256: "cd3171a0d1a20d917bd07ec76128f719ab20caccfcaceb604ad3810e8a8681e9" },
  rank02: { url: RANK_IMAGE_URLS[1], cache: "tmp/official-fujian-control-lines-2026/rank-02.jpg", raw: "rank-02.jpg", bytes: 1027070, sha256: "b5d097cf46da309e4e531a136f1f64927e7d7a28b73c59ebe0341f48f9085a89" },
  rank03: { url: RANK_IMAGE_URLS[2], cache: "tmp/official-fujian-control-lines-2026/rank-03.jpg", raw: "rank-03.jpg", bytes: 1014994, sha256: "2b04287960e3a18a8f132a0aa306ab127ce9f6016b4a9304697a4a149464258c" },
  rank04: { url: RANK_IMAGE_URLS[3], cache: "tmp/official-fujian-control-lines-2026/rank-04.jpg", raw: "rank-04.jpg", bytes: 907839, sha256: "ab7ad78fa4d94fa8843c38b9f0741633c444a8e55a0af985476ca6744c14564e" },
  rank05: { url: RANK_IMAGE_URLS[4], cache: "tmp/official-fujian-control-lines-2026/rank-05.jpg", raw: "rank-05.jpg", bytes: 973201, sha256: "7d1a23683ef5f3358f0dc56db5ab9259df14652b8513481af9d19b5176cc2e25" },
  rank06: { url: RANK_IMAGE_URLS[5], cache: "tmp/official-fujian-control-lines-2026/rank-06.jpg", raw: "rank-06.jpg", bytes: 1013594, sha256: "b5ad7c44e2c3ea41c5bbd73e0b43e643fbb89f6200a6cfce019fd070974ee632" },
  rank07: { url: RANK_IMAGE_URLS[6], cache: "tmp/official-fujian-control-lines-2026/rank-07.jpg", raw: "rank-07.jpg", bytes: 1006062, sha256: "f3bd3bdd42c2d24cd92b330f32ecbf090826019a7cb8a90271d948b31c17afa0" },
  rank08: { url: RANK_IMAGE_URLS[7], cache: "tmp/official-fujian-control-lines-2026/rank-08.jpg", raw: "rank-08.jpg", bytes: 993690, sha256: "75e3778bc018329a92f8e34a530bc4d10ec7ce1ae68ec436beef2218cc92594a" },
};

function parseArgs(argv) {
  const args = { useCache: false, out: "data/admissions/official-fujian-control-lines-2026-import.json" };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--use-cache") args.useCache = true;
    else if (argv[index] === "--out") args.out = argv[++index];
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function compactHtml(value) {
  return String(value)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#10;|&#13;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, "");
}

async function fetchBuffer(url) {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(90_000),
    headers: { "user-agent": "Mozilla/5.0 gaokao-evidence/3.289" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function loadEvidence(item, useCache) {
  const bytes = useCache ? fs.readFileSync(path.join(PROJECT_ROOT, item.cache)) : await fetchBuffer(item.url);
  assert(bytes.length === item.bytes, `${item.raw} byte count drifted: ${bytes.length}`);
  assert(sha256(bytes) === item.sha256, `${item.raw} SHA-256 drifted`);
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(path.join(RAW_DIR, item.raw), bytes);
  return bytes;
}

const rows = [];

function addRow({ category, subjectType, section, cultureScore, professionalScore, route, professionalMetric = "professional-unified-exam", scope = "special-path-only" }) {
  rows.push({ category, subjectType, section, cultureScore, professionalScore, route, professionalMetric, scope });
}

for (const [subjectType, bachelor, vocational, special] of [["物理类", 446, 235, 528], ["历史类", 458, 235, 533]]) {
  addRow({ category: "普通类", subjectType, section: "本科", cultureScore: bachelor, route: "ordinary-bachelor", scope: "control-line-only" });
  addRow({ category: "普通类", subjectType, section: "高职（专科）", cultureScore: vocational, route: "ordinary-vocational", scope: "control-line-only" });
  addRow({ category: "特殊类型招生", subjectType, section: "特殊类型", cultureScore: special, route: "special" });
}

function addArtSubject(subjectType, groupOneBachelor, groupTwoBachelor) {
  const groupOne = "音乐教育类、戏剧影视导演类、播音与主持类、美术与设计类、书法类";
  const groupTwo = "音乐表演类、戏剧影视表演类、服装表演类、舞蹈类";
  for (const [category, bachelorCulture, metric] of [
    [groupOne, groupOneBachelor, "professional-unified-exam"],
    [groupTwo, groupTwoBachelor, "professional-unified-exam"],
    ["戏曲类", groupTwoBachelor, "xiqu-interprovincial-joint-exam"],
  ]) {
    addRow({ category, subjectType, section: "本科", cultureScore: bachelorCulture, professionalScore: metric === "professional-unified-exam" ? 195 : 180, route: "art", professionalMetric: metric });
    addRow({ category, subjectType, section: "高职（专科）", cultureScore: 165, professionalScore: 180, route: "art", professionalMetric: metric });
  }
}

addArtSubject("艺术类（物理科目组）", 335, 312);
addArtSubject("艺术类（历史科目组）", 344, 321);

for (const [subjectType, bachelorCulture] of [["体育类（物理科目组）", 290], ["体育类（历史科目组）", 298]]) {
  addRow({ category: "体育类", subjectType, section: "本科", cultureScore: bachelorCulture, professionalScore: 60, route: "sports" });
  addRow({ category: "体育类", subjectType, section: "高职（专科）", cultureScore: 165, professionalScore: 60, route: "sports" });
}

function recordId(row) {
  return `2026-fujian-control-${sha256([row.category, row.subjectType, row.section, row.cultureScore, row.professionalScore || "", row.professionalMetric].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinary = row.scope === "control-line-only";
  const professional = Number.isFinite(row.professionalScore);
  return {
    id: recordId(row),
    province: "福建",
    year: 2026,
    subjectType: row.subjectType,
    batch: `${row.category}${row.section}录取控制分数线`,
    schoolName: TITLE,
    schoolTags: ["福建官方控制线", ordinary ? "普通类" : "特殊路径", row.category, row.section],
    city: "福建",
    dataType: "control-line",
    majorName: `${row.category}${row.section}录取控制分数线`,
    majorGroup: row.category,
    minScore: row.cultureScore,
    cultureScoreLine: row.cultureScore,
    scoreDimension: "culture-score",
    scoreBasis: "gaokao-total",
    ...(professional ? { professionalMinScore: row.professionalScore, professionalScoreMetric: row.professionalMetric } : {}),
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: QUALITY,
    sourceUrl: CONTROL_URL,
    formalScoreScope: row.scope,
    controlLineRouteKind: row.route,
    controlLineKind: `${row.category}录取控制分数线`,
    controlLineSection: row.section,
    cautions: ordinary ? [
      "这是福建省2026年普通类本科或高职（专科）录取控制分数线，只用于对应首选科目的普通批资格边界。",
      "达到控制线不等于达到任何具体院校专业组、院校或专业的实际投档录取线。",
      "历史类和物理类不得混用；特殊类型、艺术类和体育类控制线不参与普通类推荐路由。",
    ] : [
      "这是福建省2026年特殊类型、艺术类或体育类控制线，不适用于普通类考生直接推荐。",
      professional ? "文化课分与专业统考或省际联考分是两个必须分别达到的门槛，不得相加或互相替代。" : "该分数只适用于对应特殊类型招生路径。",
      "控制线不是具体院校专业组、院校或专业的实际投档录取线。",
    ],
    sourceFile: "data/admissions/raw/official-fujian-control-lines-2026/control-lines.jpg",
    sourcePublishedAt: "2026-06-24",
  };
}

function assertOfficialPages(loaded) {
  const controlHtml = loaded.controlPage.toString("utf8");
  const controlText = compactHtml(controlHtml);
  assert(controlText.includes(TITLE), "Control-line title drifted");
  assert(controlText.includes("来源：福建省教育考试院"), "Control-line publisher drifted");
  assert(controlText.includes("发布时间：2026-06-2416:32"), "Control-line publish time drifted");
  assert(controlHtml.includes("20260624151636_4.jpg"), "Control-line image link drifted");
  for (const [subjectType, key, expectedTitle, imageNames] of [
    ["历史类", "rankHistoryPage", "2026年高考考生成绩分布（历史科目组）", RANK_IMAGE_URLS.slice(0, 4)],
    ["物理类", "rankPhysicsPage", "2026年高考考生成绩分布（物理科目组）", RANK_IMAGE_URLS.slice(4)],
  ]) {
    const html = loaded[key].toString("utf8");
    const text = compactHtml(html);
    assert(text.includes(expectedTitle), `${subjectType} rank title drifted`);
    assert(text.includes("来源：福建省教育考试院"), `${subjectType} rank publisher drifted`);
    assert(text.includes("发布时间：2026-06-2509:50"), `${subjectType} rank publish time drifted`);
    for (const imageUrl of imageNames) assert(html.includes(path.basename(imageUrl)), `${subjectType} rank image link drifted: ${imageUrl}`);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = {};
  for (const [key, item] of Object.entries(evidence)) loaded[key] = await loadEvidence(item, args.useCache);
  assertOfficialPages(loaded);

  const records = rows.map(makeRecord);
  assert(records.length === 22, `Expected 22 records, got ${records.length}`);
  assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
  assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary records");
  assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 18, "Expected eighteen special-path records");
  assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 16, "Expected sixteen culture-plus-professional records");

  const payload = {
    dataset: "official-fujian-control-lines-2026-import",
    generatedAt: GENERATED_AT,
    scope: { province: "福建", year: 2026, sourceKind: "official-control-lines" },
    notes: [
      "官方正文以图片发布；本导入器锁定正文和原图字节数及SHA-256，再按原图逐项结构化。",
      "普通类本科/高职（专科）4条只作资格路由；特殊类型、艺术、体育18条保持特殊路径隔离。",
      "艺术和体育文化课、专业课门槛分字段保存；戏曲省际联考与其他艺术省统考分开。",
    ],
    sourceNotes: [{
      id: SOURCE_ID,
      province: "福建",
      title: TITLE,
      publisher: "福建省教育考试院",
      publishedAt: "2026-06-24 16:32",
      url: CONTROL_URL,
      attachmentUrls: [CONTROL_IMAGE_URL],
      relatedUrls: Object.values(RANK_URLS),
      quality: QUALITY,
      usage: "抽取福建2026普通类、特殊类型、艺术类和体育类控制线22条；仅普通物理/历史本科与高职（专科）4条参与普通资格路由。",
      parsedRecords: records.length,
      controlPageBytes: evidence.controlPage.bytes,
      controlPageSha256: evidence.controlPage.sha256,
      controlImageBytes: evidence.controlImage.bytes,
      controlImageSha256: evidence.controlImage.sha256,
      rankPageEvidence: [
        { subjectType: "历史类", url: RANK_URLS["历史类"], bytes: evidence.rankHistoryPage.bytes, sha256: evidence.rankHistoryPage.sha256 },
        { subjectType: "物理类", url: RANK_URLS["物理类"], bytes: evidence.rankPhysicsPage.bytes, sha256: evidence.rankPhysicsPage.sha256 },
      ],
      rankImageEvidence: Object.entries(evidence).filter(([key]) => /^rank\d+$/.test(key)).map(([, item], index) => ({
        subjectType: index < 4 ? "历史类" : "物理类",
        pageNumber: (index % 4) + 1,
        url: item.url,
        bytes: item.bytes,
        sha256: item.sha256,
      })),
      evidenceBoundary: "control-line-only=4; special-path-only=18; culture-plus-professional=16; not institution-group, institution or major admission score",
    }],
    records,
    diagnostics: {
      recordCount: records.length,
      ordinaryRecords: 4,
      specialPathRecords: 18,
      cultureProfessionalRecords: 16,
      routeCounts: Object.fromEntries([...new Set(records.map((record) => record.controlLineRouteKind))]
        .map((route) => [route, records.filter((record) => record.controlLineRouteKind === route).length])),
      ordinaryBoundaries: {
        "物理类": { bachelor: 446, vocational: 235 },
        "历史类": { bachelor: 458, vocational: 235 },
      },
      professionalMetricCounts: Object.fromEntries([...new Set(records.filter((record) => record.professionalScoreMetric).map((record) => record.professionalScoreMetric))]
        .map((metric) => [metric, records.filter((record) => record.professionalScoreMetric === metric).length])),
    },
  };
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "ok", out: path.relative(PROJECT_ROOT, outFile), sourceId: SOURCE_ID, ...payload.diagnostics }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
