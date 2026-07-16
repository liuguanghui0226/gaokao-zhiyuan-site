#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const GENERATED_AT = "2026-07-16T21:10:00.000Z";
const SOURCE_ID = "official-shanxi-control-lines-2026";
const RANK_SOURCE_ID = "official-shanxi-rank-2026";
const CONTROL_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260625/2293847661.html";
const RANK_INDEX_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260626/2293847320.html";
const EOL_RANK_URL = "https://www.eol.cn/kaoshi/gaokao/fsx/202606/t20260626_2749513.shtml";
const RANK_URLS = {
  "历史类": "http://www.sxkszx.cn/news/2026625/n5905127212.html",
  "物理类": "http://www.sxkszx.cn/news/2026625/n2816127213.html",
};
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/shanxi-2026");
const RELEASE_DIR = path.join(PROJECT_ROOT, "site/data/release-v3.275");
const OUTPUT_FILE = path.join(PROJECT_ROOT, "data/admissions/official-shanxi-control-lines-2026-import.json");

const EXPECTED = {
  chsiControlPage: { file: "chsi-control-lines.html", bytes: 49217, sha256: "659f252c7a34bf61e136e5a34d56e5b461908301b231b96241d3869ef9467146" },
  chsiRankIndex: { file: "chsi-rank-index.html", bytes: 47563, sha256: "74aafbc65e16a577cd351cd3bcd0b54b4c6b24b578715f2a283974a8bffdaf60" },
  eolRankCorroboration: { file: "eol-rank-corroboration.html", bytes: 930284, sha256: "c55404ade9fb2db37ffdb39518a1f6b16c17057b9b3850bd10d358b987e4dbe0" },
};

const ART_THRESHOLDS = [
  ["音乐表演（声乐）类", 229],
  ["音乐教育（声乐主项）类", 217],
  ["音乐表演（器乐）类", 243],
  ["音乐教育（器乐主项）类", 231],
  ["表（导）演类（戏剧影视表演）", 240],
  ["表（导）演类（戏剧影视导演）", 242],
  ["表（导）演类（服装表演）", 220],
  ["播音与主持类", 231],
  ["美术与设计类", 180],
  ["舞蹈类", 180],
  ["书法类", 233],
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function visibleHtmlText(value) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;|&ensp;|&emsp;/gi, "")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, "");
}

function verifyFile(expected) {
  const file = path.join(RAW_DIR, expected.file);
  const bytes = fs.readFileSync(file);
  assert(bytes.byteLength === expected.bytes, `${expected.file} byte count drifted: ${bytes.byteLength}`);
  assert(sha256(bytes) === expected.sha256, `${expected.file} SHA-256 drifted`);
  return { ...expected };
}

function tableRows(tableHtml) {
  const rows = [];
  for (const rowMatch of tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...rowMatch[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .map((match) => visibleHtmlText(match[1]));
    if (cells.length !== 7 || cells[0] === "分数") continue;
    for (const offset of [0, 4]) {
      const scoreMatch = cells[offset].match(/^(\d+)(?:分以上)?$/);
      if (!scoreMatch || !/^\d+$/.test(cells[offset + 1]) || !/^\d+$/.test(cells[offset + 2])) continue;
      const score = Number(scoreMatch[1]);
      const sameRankScore = Number(cells[offset + 1]);
      const rankEnd = Number(cells[offset + 2]);
      rows.push({
        score,
        topBucket: /分以上/.test(cells[offset]),
        sameRankScore,
        rankEnd,
        rankStart: rankEnd - sameRankScore + 1,
      });
    }
  }
  return rows.sort((left, right) => right.score - left.score);
}

function verifyRankInventory() {
  const eolHtml = fs.readFileSync(path.join(RAW_DIR, EXPECTED.eolRankCorroboration.file), "utf8");
  const tables = [...eolHtml.matchAll(/<table\b[^>]*>[\s\S]*?<\/table>/gi)].map((match) => match[0]);
  assert(tables.length === 2, `Expected two corroboration tables, got ${tables.length}`);
  const parsedBySubject = {
    "物理类": tableRows(tables[0]),
    "历史类": tableRows(tables[1]),
  };

  const shard = readGzipJson(path.join(RELEASE_DIR, "shanxi.json.gz"));
  const core = readGzipJson(path.join(RELEASE_DIR, "knowledge-core.json.gz"));
  const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === RANK_SOURCE_ID);
  assert(note?.parsedRecords === 555, "Shanxi rank source inventory drifted");
  assert(note.quality === "official-shanxi-rank-conversion-html-table", "Shanxi rank quality drifted");
  assert(note.pageUrls?.includes(RANK_URLS["历史类"]) && note.pageUrls?.includes(RANK_URLS["物理类"]), "Shanxi official rank page URLs drifted");
  assert(note.subjects?.find((row) => row.subjectType === "历史类")?.sha256 === "75c48ef3422b33a91b68c1127990dcab15ace8ba687ada3cca8119ee15220412", "Stored official history-page hash drifted");
  assert(note.subjects?.find((row) => row.subjectType === "物理类")?.sha256 === "4e38e5e71ed970a25ec8826a111a268587ea1dacb8075c9ccadef852f3268daf", "Stored official physics-page hash drifted");

  const diagnostics = [];
  for (const spec of [
    { subjectType: "历史类", rows: 260, scoreMin: 409, scoreMax: 668, topStart: 10, topEnd: 13, finalRank: 35387 },
    { subjectType: "物理类", rows: 295, scoreMin: 401, scoreMax: 695, topStart: 13, topEnd: 13, finalRank: 129364 },
  ]) {
    const parsed = parsedBySubject[spec.subjectType];
    const runtime = shard.rankConversions
      .filter((row) => row.year === 2026 && row.sourceId === RANK_SOURCE_ID && row.subjectType === spec.subjectType)
      .sort((left, right) => right.score - left.score);
    assert(parsed.length === spec.rows && runtime.length === spec.rows, `${spec.subjectType} rank row count drifted`);
    assert(parsed[0].topBucket && parsed[0].score === spec.scoreMax && parsed[0].rankStart === spec.topStart && parsed[0].rankEnd === spec.topEnd, `${spec.subjectType} top bucket drifted`);
    assert(parsed.at(-1).score === spec.scoreMin && parsed.at(-1).rankEnd === spec.finalRank, `${spec.subjectType} final row drifted`);
    const expectedUrl = RANK_URLS[spec.subjectType];
    assert(runtime.every((row) => !row.sourceUrl) || runtime.every((row) => row.sourceUrl === expectedUrl), `${spec.subjectType} rank URLs are partially applied or unexpected`);
    for (let index = 0; index < parsed.length; index += 1) {
      const expected = parsed[index];
      const actual = runtime[index];
      assert(actual.score === expected.score, `${spec.subjectType}/${index} score drifted`);
      assert(actual.rankStart === expected.rankStart && actual.rankEnd === expected.rankEnd && actual.sameRankScore === expected.sameRankScore, `${spec.subjectType}/${expected.score} rank values drifted`);
      assert(index === 0 || runtime[index - 1].rankEnd + 1 === actual.rankStart, `${spec.subjectType}/${expected.score} rank continuity drifted`);
    }
    assert(runtime[0].scoreRange?.min === spec.scoreMax && runtime[0].scoreRange?.max === 750, `${spec.subjectType} top scoreRange drifted`);
    diagnostics.push({
      subjectType: spec.subjectType,
      rowsFullCorroborationCrossChecked: parsed.length,
      rowsContinuityChecked: runtime.length,
      scoreMin: spec.scoreMin,
      scoreMax: spec.scoreMax,
      topRankStart: spec.topStart,
      topRankEnd: spec.topEnd,
      finalCumulative: spec.finalRank,
      valueDifferences: 0,
      rankRowsNeedingSourceUrlOnV3302Base: spec.rows,
      directOfficialPageRedownloadStatus: "blocked-current-session-tls-and-http-403",
    });
  }
  return diagnostics;
}

function recordId(row) {
  return `2026-shanxi-control-${sha256([row.subjectType, row.route, row.category, row.minScore, row.professionalMinScore ?? "", row.professionalQualification ?? ""].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinary = row.route === "ordinary-bachelor";
  const hasProfessional = Number.isFinite(row.professionalMinScore);
  const hasQualification = Boolean(row.professionalQualification);
  const batch = ordinary
    ? "普通本科批录取最低控制分数线"
    : row.route === "special"
      ? "特殊类型录取控制分数线"
      : row.route === "art-school-exam"
        ? "艺术本科提前批（使用校考成绩）录取最低控制分数线"
        : row.route === "art-opera"
          ? "艺术本科提前批（戏曲类省际联考）录取最低控制分数线"
          : row.route === "sports"
            ? "体育本科批录取最低控制分数线"
            : `艺术本科批（${row.category}）录取最低控制分数线`;
  return {
    id: recordId(row),
    province: "山西",
    year: 2026,
    subjectType: row.subjectType,
    batch,
    schoolName: "山西省2026年普通高校招生本科录取最低控制分数线",
    schoolTags: ["山西招生考试网控制线", ordinary ? "普通类" : "特殊路径", row.category, "本科"],
    city: "山西",
    dataType: "control-line",
    majorName: batch,
    majorGroup: row.category,
    minScore: row.minScore,
    cultureScoreLine: row.minScore,
    professionalMinScore: row.professionalMinScore,
    professionalScoreMaximum: row.route === "sports" ? 100 : undefined,
    professionalQualification: row.professionalQualification,
    scoreDimension: hasProfessional ? "culture-and-professional" : hasQualification ? "culture-and-qualification" : "total-score",
    professionalScoreDimension: hasProfessional ? row.professionalScoreDimension : undefined,
    scoreBasis: ordinary || row.route === "special" ? "gaokao-total" : "culture-score",
    scoreMaximum: 750,
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: "official-chsi-mirror-shanxi-admission-committee-control-lines-html-verified",
    sourceUrl: CONTROL_URL,
    formalScoreScope: ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: batch,
    controlLineSection: "本科",
    cautions: ordinary ? [
      `这是山西省2026年普通${row.subjectType}本科批最低控制分数线，只用于判断普通本科基本资格边界。`,
      "2026年普通专科（高职）控制线截至本轮尚未发布，不使用2025年100分控制线补造。",
      "控制线不是院校专业组、院校或专业投档线、录取最低分、最低位次或录取概率。",
    ] : [
      `这是山西省2026年${batch}，只适用于对应特殊类型、艺术或体育路径。`,
      hasProfessional ? `文化成绩和专业成绩必须分别达到 ${row.minScore} 分与 ${row.professionalMinScore} 分，两个维度不得相加或互相替代。` : hasQualification ? "文化成绩须达线且校考成绩须合格；合格要求不是数值专业分，不补造专业线。" : "本记录保持 special-path-only，不进入普通类本科或专科资格计算。",
      "该边界不是具体院校专业组或专业录取分，仍须核对招生章程、选科、体检和资格要求。",
    ],
    sourceFile: "data/admissions/raw/shanxi-2026/chsi-control-lines.html",
    sourcePublishedAt: "2026-06-25",
  };
}

const evidence = Object.fromEntries(Object.entries(EXPECTED).map(([key, expected]) => [key, verifyFile(expected)]));
const controlHtml = fs.readFileSync(path.join(RAW_DIR, EXPECTED.chsiControlPage.file), "utf8");
const controlText = visibleHtmlText(controlHtml);
const rankIndexHtml = fs.readFileSync(path.join(RAW_DIR, EXPECTED.chsiRankIndex.file), "utf8");
assert(controlText.includes("山西：2026年普通高校招生本科录取最低控制分数线公告") && controlText.includes("来源：山西招生考试网"), "Shanxi control title or publisher drifted");
for (const text of ["普通本科批：409分", "普通本科批：401分", "特殊类型录取控制分数线：538分", "特殊类型录取控制分数线：524分", "体育（历史组）327分", "21分", "专业成绩最低控制分数线85分"]) {
  assert(controlText.includes(text), `Shanxi control evidence missing: ${text}`);
}
assert(rankIndexHtml.includes(RANK_URLS["历史类"]) && rankIndexHtml.includes(RANK_URLS["物理类"]), "Shanxi CHSI rank index links drifted");
const rankVerification = verifyRankInventory();

const records = [
  makeRecord({ subjectType: "历史类", route: "ordinary-bachelor", category: "普通类", minScore: 409 }),
  makeRecord({ subjectType: "物理类", route: "ordinary-bachelor", category: "普通类", minScore: 401 }),
  makeRecord({ subjectType: "历史类", route: "special", category: "普通类特殊类型招生", minScore: 538 }),
  makeRecord({ subjectType: "物理类", route: "special", category: "普通类特殊类型招生", minScore: 524 }),
  makeRecord({ subjectType: "历史类", route: "art-school-exam", category: "艺术本科提前批-校考", minScore: 409, professionalQualification: "艺术类本科专业校考成绩合格" }),
  makeRecord({ subjectType: "物理类", route: "art-school-exam", category: "艺术本科提前批-校考", minScore: 401, professionalQualification: "艺术类本科专业校考成绩合格" }),
  makeRecord({ subjectType: "历史类", route: "art-opera", category: "戏曲类本科专业", minScore: 205, professionalMinScore: 180, professionalScoreDimension: "shanxi-opera-interprovincial-score" }),
  makeRecord({ subjectType: "物理类", route: "art-opera", category: "戏曲类本科专业", minScore: 201, professionalMinScore: 180, professionalScoreDimension: "shanxi-opera-interprovincial-score" }),
  ...["历史类", "物理类"].flatMap((subjectType) => ART_THRESHOLDS.map(([category, professionalMinScore]) =>
    makeRecord({ subjectType, route: "art", category, minScore: subjectType === "历史类" ? 307 : 301, professionalMinScore, professionalScoreDimension: "shanxi-art-provincial-unified-score" })
  )),
  makeRecord({ subjectType: "历史类", route: "sports", category: "体育类", minScore: 327, professionalMinScore: 85, professionalScoreDimension: "shanxi-sports-professional-score" }),
  makeRecord({ subjectType: "物理类", route: "sports", category: "体育类", minScore: 321, professionalMinScore: 85, professionalScoreDimension: "shanxi-sports-professional-score" }),
];

assert(records.length === 32, `Expected 32 records, got ${records.length}`);
assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 2, "Expected two ordinary records");
assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 30, "Expected 30 special-path records");
assert(records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 26, "Expected 26 numeric professional thresholds");
assert(records.filter((record) => record.professionalQualification).length === 2, "Expected two school-exam qualification records");

const routeCounts = Object.fromEntries([...new Set(records.map((record) => record.controlLineRouteKind))]
  .map((route) => [route, records.filter((record) => record.controlLineRouteKind === route).length]));
const payload = {
  dataset: "official-shanxi-control-lines-2026-import",
  generatedAt: GENERATED_AT,
  scope: { province: "山西", year: 2026, sourceKind: "official-chsi-mirror-control-lines-html" },
  notes: [
    "山西2026普通历史/物理本科409/401分共2条进入普通资格路由；普通专科线尚未发布，不使用2025年100分替代。",
    "特殊类型2条、艺术26条和体育2条共30条保持 special-path-only。",
    "艺体26条数值专业线与文化线分列；校考2条只保存合格要求，不补造专业分。",
    "既有555条普通类位次以阳光高考官方链接索引、库存官方页哈希和教育在线双表逐行交叉复核，数值零差异并补官方科类页URL。",
  ],
  sourceNotes: [{
    id: SOURCE_ID,
    province: "山西",
    title: "山西省2026年普通高校招生本科录取最低控制分数线",
    publisher: "山西招生考试网 / 阳光高考",
    publishedAt: "2026-06-25",
    url: CONTROL_URL,
    relatedUrls: [RANK_INDEX_URL, ...Object.values(RANK_URLS), EOL_RANK_URL],
    quality: "official-chsi-mirror-shanxi-admission-committee-control-lines-html-verified",
    usage: "抽取山西2026普通、特殊类型、艺术和体育本科控制线32条；仅2条普通本科记录参与普通考生资格路由。",
    parsedRecords: records.length,
    scoreMaximum: 750,
    originalPublisher: "山西招生考试网",
    directChsiMirrorRetrievalStatus: "success",
    directOfficialRetrievalStatus: "blocked-current-session-tls-and-http-403",
    ordinaryVocationalStatus: "pending-official-release",
    ordinaryVocationalExpectedPublicationAt: null,
    ordinaryVocationalReason: "截至2026-07-17，山西只发布本科各类控制线；2025年普通专科线到8月15日才发布，本轮不以往年100分补造2026普通专科资格线。",
    evidence,
    rankEvidence: {
      sourceId: RANK_SOURCE_ID,
      records: 555,
      indexUrl: RANK_INDEX_URL,
      officialPageUrls: RANK_URLS,
      fullCorroborationRowCrossCheck: rankVerification,
      valueChanges: 0,
      controlBoundaryCrossCheck: {
        history: { bachelorScore: 409, bachelorRankEnd: 35387, specialScore: 538, specialRankEnd: 8512, score600RankEnd: 1649, topBucketMin: 668, topBucketMax: 750, topBucketRankEnd: 13 },
        physics: { bachelorScore: 401, bachelorRankEnd: 129364, specialScore: 524, specialRankEnd: 53482, score600RankEnd: 14366, topBucketMin: 695, topBucketMax: 750, topBucketRankEnd: 13 },
      },
    },
    evidenceBoundary: "control-line-only=2; special-path-only=30; numeric art/sports dual-threshold rows=26; school-exam qualification-only rows=2; ordinary vocational line=pending; ordinary rank rows=555 corroboration full-table cross-checked and values unchanged; not institution, major or admission probability",
  }],
  records,
  diagnostics: {
    recordCount: records.length,
    ordinaryRecords: 2,
    specialPathRecords: 30,
    professionalNumericRecords: 26,
    professionalQualificationRecords: 2,
    routeCounts,
    ordinaryBoundaries: { historyBachelor: 409, historyVocational: null, physicsBachelor: 401, physicsVocational: null },
    ordinaryVocationalStatus: "pending-official-release",
    rankRecords: 555,
    rankRowsFullCorroborationCrossChecked: rankVerification.reduce((sum, row) => sum + row.rowsFullCorroborationCrossChecked, 0),
    rankRowsContinuityChecked: rankVerification.reduce((sum, row) => sum + row.rowsContinuityChecked, 0),
    rankValueChanges: 0,
    scoreMaximum: 750,
  },
};

fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
fs.writeFileSync(OUTPUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(JSON.stringify({ status: "ok", out: path.relative(PROJECT_ROOT, OUTPUT_FILE), diagnostics: payload.diagnostics, evidence, rankVerification }, null, 2));
