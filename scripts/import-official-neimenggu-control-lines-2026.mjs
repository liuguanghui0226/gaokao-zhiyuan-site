#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE_ID = "official-neimenggu-control-lines-2026";
const CONTROL_URL = "https://www.nm.zsks.cn/zxyw/202606/t20260624_46442.html";
const RANK_INDEX_URL = "https://www.nm.zsks.cn/fzlm/26gktj/";
const RANK_HISTORY_URL = "https://www.nm.zsks.cn/fzlm/26gktj/202606/t20260624_46464.html";
const RANK_PHYSICS_URL = "https://www.nm.zsks.cn/fzlm/26gktj/202606/t20260624_46462.html";
const TITLE = "2026年内蒙古自治区普通高考录取控制分数线";
const QUALITY = "official-neimenggu-control-line-html-verified";
const GENERATED_AT = "2026-07-16T00:30:00.000Z";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/official-neimenggu-control-lines-2026");

const evidence = {
  controlPage: {
    url: CONTROL_URL,
    cache: "tmp/official-neimenggu-control-lines-2026/control-lines.html",
    raw: "control-lines.html",
    bytes: 31525,
    sha256: "46a797ff4eb016f8db7cadc7410491a12934c1fd04a35b244577157210eec8c8",
  },
  rankIndex: {
    url: RANK_INDEX_URL,
    cache: "tmp/official-neimenggu-control-lines-2026/rank-index.html",
    raw: "rank-index.html",
    bytes: 18163,
    sha256: "b2b9a34d2556d1f89fb2160bcc05818b540c034cc0ae5fea2bffe1ce614c27c2",
  },
  rankHistory: {
    url: RANK_HISTORY_URL,
    cache: "tmp/official-neimenggu-control-lines-2026/rank-history.html",
    raw: "rank-history.html",
    bytes: 76594,
    sha256: "9479d472ed9c58b94a1071b8f0174c0c56612f2e4b369185dc996c2f2b820ac1",
  },
  rankPhysics: {
    url: RANK_PHYSICS_URL,
    cache: "tmp/official-neimenggu-control-lines-2026/rank-physics.html",
    raw: "rank-physics.html",
    bytes: 80888,
    sha256: "fe27c70886ba49833956c58c23a1f9c4003ad3d7fd3baeac2d761244781e1954",
  },
};

function parseArgs(argv) {
  const args = { useCache: false, out: "data/admissions/official-neimenggu-control-lines-2026-import.json" };
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
    headers: { "user-agent": "Mozilla/5.0 gaokao-evidence/3.288" },
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

function addRow({ category, subjectType, section, cultureScore, professionalScore, route, scope = "special-path-only", candidateCategory = "", scoreBasis = "gaokao-total" }) {
  rows.push({ category, subjectType, section, cultureScore, professionalScore, route, scope, candidateCategory, scoreBasis });
}

for (const [subjectType, bachelor, vocational, special] of [["物理类", 363, 160, 488], ["历史类", 403, 160, 512]]) {
  addRow({ category: "普通类", subjectType, section: "本科", cultureScore: bachelor, route: "ordinary-bachelor", scope: "control-line-only" });
  addRow({ category: "普通类", subjectType, section: "专科", cultureScore: vocational, route: "ordinary-vocational", scope: "control-line-only" });
  addRow({ category: "特殊类型招生", subjectType, section: "特殊类型", cultureScore: special, route: "special" });
}

function addArtPair(category, bachelorCulture, bachelorProfessional, vocationalCulture, vocationalProfessional, candidateCategory = "") {
  addRow({ category, subjectType: "艺术类", section: "本科", cultureScore: bachelorCulture, professionalScore: bachelorProfessional, route: candidateCategory ? "special-category" : "art", candidateCategory });
  addRow({ category, subjectType: "艺术类", section: "专科", cultureScore: vocationalCulture, professionalScore: vocationalProfessional, route: candidateCategory ? "special-category" : "art", candidateCategory });
}

addArtPair("音乐教育类", 273, 210, 160, 181);
addArtPair("音乐表演类（声乐方向）", 273, 190, 160, 174);
addArtPair("音乐表演类（器乐方向）", 273, 170, 160, 159);
addArtPair("舞蹈类", 253, 196, 160, 186);
addArtPair("表（导）演类-戏剧影视表演", 348, 235, 160, 194);
addArtPair("表（导）演类-服装表演", 332, 185, 160, 157);
addRow({ category: "表（导）演类-戏剧影视导演", subjectType: "艺术类", section: "本科", cultureScore: 435, professionalScore: 198, route: "art" });
addArtPair("播音与主持类", 343, 219, 160, 199);
addArtPair("美术与设计类", 273, 196, 160, 181);
addArtPair("书法类", 320, 239, 160, 170);
addRow({ category: "戏曲类", subjectType: "艺术类", section: "本科", cultureScore: 182, professionalScore: 180, route: "art" });
addRow({ category: "体育类", subjectType: "体育类", section: "本科", cultureScore: 317, professionalScore: 76, route: "sports" });
addRow({ category: "体育类", subjectType: "体育类", section: "专科", cultureScore: 298, professionalScore: 70, route: "sports" });

for (const [subjectType, bachelor] of [["物理类", 323], ["历史类", 326]]) {
  addRow({ category: "普通类（专项类）", subjectType, section: "本科", cultureScore: bachelor, route: "special-category", candidateCategory: "专项类" });
  addRow({ category: "普通类（专项类）", subjectType, section: "专科", cultureScore: 160, route: "special-category", candidateCategory: "专项类" });
}
addArtPair("音乐教育类（专项类）", 270, 210, 160, 181, "专项类");
addArtPair("音乐表演类（声乐方向）（专项类）", 270, 190, 160, 174, "专项类");
addArtPair("音乐表演类（器乐方向）（专项类）", 270, 170, 160, 159, "专项类");
addArtPair("舞蹈类（专项类）", 253, 196, 160, 186, "专项类");
addArtPair("美术与设计类（专项类）", 273, 196, 160, 181, "专项类");
addRow({ category: "体育类（专项类）", subjectType: "体育类", section: "本科", cultureScore: 317, professionalScore: 76, route: "special-category", candidateCategory: "专项类" });
addRow({ category: "体育类（专项类）", subjectType: "体育类", section: "专科", cultureScore: 297, professionalScore: 70, route: "special-category", candidateCategory: "专项类" });

function addCounterpart(category, bachelorScore, vocationalScore = 120, bachelorProfessional, vocationalProfessional) {
  if (Number.isFinite(bachelorScore)) addRow({ category, subjectType: "对口招生", section: "本科", cultureScore: bachelorScore, professionalScore: bachelorProfessional, route: "counterpart", candidateCategory: category, scoreBasis: "counterpart-total" });
  addRow({ category, subjectType: "对口招生", section: "专科", cultureScore: vocationalScore, professionalScore: vocationalProfessional, route: "counterpart", candidateCategory: category, scoreBasis: "counterpart-total" });
}

addCounterpart("计算机类", 476);
addCounterpart("农学类", 396);
addCounterpart("牧医类", 516);
addCounterpart("烹饪类", null);
addCounterpart("财会类", 514);
addCounterpart("美工设计类", 375, 120, 200, 181);
addCounterpart("旅游类", 506);
addCounterpart("汽驾类", 394);
addCounterpart("建筑类", 440);
addCounterpart("机电类", 476);
addCounterpart("牧医类（专项类）", 314);
addCounterpart("化工类", 458);
addCounterpart("幼师类", 485);
addCounterpart("医学类", 465);
addCounterpart("体育类", null);
addCounterpart("采矿类", 569);

function recordId(row) {
  return `2026-neimenggu-control-${sha256([row.category, row.subjectType, row.section, row.cultureScore, row.professionalScore || "", row.candidateCategory].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinary = row.scope === "control-line-only";
  const professional = Number.isFinite(row.professionalScore);
  return {
    id: recordId(row),
    province: "内蒙古",
    year: 2026,
    subjectType: row.subjectType,
    batch: `${row.category}${row.section}录取控制分数线`,
    schoolName: TITLE,
    schoolTags: ["内蒙古官方控制线", ordinary ? "普通类" : "特殊路径", row.category, row.section],
    city: "内蒙古",
    dataType: "control-line",
    majorName: `${row.category}${row.section}录取控制分数线`,
    majorGroup: row.category,
    minScore: row.cultureScore,
    cultureScoreLine: row.cultureScore,
    scoreDimension: "culture-score",
    scoreBasis: row.scoreBasis,
    ...(professional ? { professionalMinScore: row.professionalScore, professionalScoreMetric: "professional-unified-exam" } : {}),
    ...(row.candidateCategory ? { candidateCategory: row.candidateCategory } : {}),
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
      "这是内蒙古2026年普通类本科或高职（专科）录取控制分数线，只用于对应首选科目的普通批资格边界。",
      "达到控制线不等于达到任何具体院校专业组、院校或专业的实际投档录取线。",
      "历史类和物理类不得混用；专项类、艺术类、体育类和对口招生线不参与普通类推荐路由。",
    ] : [
      "这是内蒙古2026年特殊类型、艺体类、专项类或对口招生控制线，不适用于普通类考生直接推荐。",
      professional ? "文化课分与专业统考分是两个必须分别达到的门槛，不得相加或互相替代。" : "该分数只适用于对应特殊类别、科类和层次。",
      "控制线不是具体院校专业组、院校或专业的实际投档录取线。",
    ],
    sourceFile: "data/admissions/raw/official-neimenggu-control-lines-2026/control-lines.html",
    sourcePublishedAt: "2026-06-24",
  };
}

const officialStatements = [
  "物理类，本科363分，专科160分，本科特殊类型招生录取控制分数线488分",
  "历史类，本科403分，专科160分，本科特殊类型招生录取控制分数线512分",
  "音乐教育类，本科文化课273分、音乐教育统考210分，专科文化课160分、音乐教育统考181分",
  "音乐表演类（声乐方向），本科文化课273分、音乐表演（声乐方向）统考190分，专科文化课160分、音乐表演（声乐方向）统考174分",
  "音乐表演类（器乐方向），本科文化课273分、音乐表演（器乐方向）统考170分，专科文化课160分、音乐表演（器乐方向）统考159分",
  "舞蹈类，本科文化课253分、舞蹈统考196分，专科文化课160分、舞蹈统考186分",
  "戏剧影视表演，本科文化课348分、戏剧影视表演统考235分，专科文化课160分、戏剧影视表演统考194分",
  "服装表演，本科文化课332分、服装表演统考185分，专科文化课160分、服装表演统考157分",
  "戏剧影视导演，本科文化课435分、戏剧影视导演统考198分",
  "播音与主持类，本科文化课343分、播音与主持统考219分，专科文化课160分、播音与主持统考199分",
  "美术与设计类，本科文化课273分、美术与设计统考196分，专科文化课160分、美术与设计统考181分",
  "书法类，本科文化课320分、书法统考239分，专科文化课160分、书法统考170分",
  "戏曲类，本科文化课182分、戏曲省际联考180分",
  "体育类，本科文化课317分、体育统考76分，专科文化课298分、体育统考70分",
  "物理类，本科323分，专科160分",
  "历史类，本科326分，专科160分",
  "计算机类，本科476分，专科120分",
  "美工设计类，本科375分、美术与设计统考200分，专科120分、美术与设计统考181分",
  "采矿类，本科569分，专科120分",
];

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = {};
  for (const [key, item] of Object.entries(evidence)) loaded[key] = await loadEvidence(item, args.useCache);
  const controlText = compactHtml(loaded.controlPage.toString("utf8"));
  assert(controlText.includes(TITLE), "Control-line title drifted");
  for (const statement of officialStatements) assert(controlText.includes(compactHtml(statement)), `Control page is missing: ${statement}`);
  assert(compactHtml(loaded.rankHistory.toString("utf8")).includes("2026年内蒙古普通高校招生考试各分数段人数统计表-历史类"), "History rank page title drifted");
  assert(compactHtml(loaded.rankPhysics.toString("utf8")).includes("2026年内蒙古普通高校招生考试各分数段人数统计表-物理类"), "Physics rank page title drifted");
  assert(loaded.rankIndex.toString("utf8").includes("2026年高考统计信息"), "Rank index title drifted");

  const records = rows.map(makeRecord);
  assert(records.length === 74, `Expected 74 records, got ${records.length}`);
  assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
  assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary records");
  assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 70, "Expected seventy special-path records");
  assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 36, "Expected 36 culture-plus-professional records");

  const payload = {
    dataset: "official-neimenggu-control-lines-2026-import",
    generatedAt: GENERATED_AT,
    sourceNotes: [{
      id: SOURCE_ID,
      province: "内蒙古",
      title: TITLE,
      publisher: "内蒙古自治区教育考试院 / 内蒙古招生考试信息网",
      publishedAt: "2026-06-24",
      url: CONTROL_URL,
      relatedUrls: [RANK_INDEX_URL, RANK_HISTORY_URL, RANK_PHYSICS_URL],
      quality: QUALITY,
      usage: "抽取内蒙古2026普通类、特殊类型、艺体类、专项类和对口招生控制线74条；仅普通物理/历史本科与专科4条参与普通资格路由。",
      parsedRecords: records.length,
      controlPageBytes: evidence.controlPage.bytes,
      controlPageSha256: evidence.controlPage.sha256,
      rankIndexBytes: evidence.rankIndex.bytes,
      rankIndexSha256: evidence.rankIndex.sha256,
      rankHistoryBytes: evidence.rankHistory.bytes,
      rankHistorySha256: evidence.rankHistory.sha256,
      rankPhysicsBytes: evidence.rankPhysics.bytes,
      rankPhysicsSha256: evidence.rankPhysics.sha256,
      evidenceBoundary: "control-line-only=4; special-path-only=70; culture-plus-professional=36; not institution-group, institution or major admission score",
    }],
    records,
    diagnostics: {
      recordCount: records.length,
      ordinaryRecords: 4,
      specialPathRecords: 70,
      cultureProfessionalRecords: 36,
      routeCounts: Object.fromEntries([...new Set(records.map((record) => record.controlLineRouteKind))]
        .map((route) => [route, records.filter((record) => record.controlLineRouteKind === route).length])),
      ordinaryBoundaries: {
        "物理类": { bachelor: 363, vocational: 160 },
        "历史类": { bachelor: 403, vocational: 160 },
      },
      scoreBasisCounts: Object.fromEntries([...new Set(records.map((record) => record.scoreBasis))]
        .map((basis) => [basis, records.filter((record) => record.scoreBasis === basis).length])),
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
