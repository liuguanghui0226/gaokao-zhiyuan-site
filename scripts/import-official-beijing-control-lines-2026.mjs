#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE_ID = "official-beijing-control-lines-2026";
const SOURCE_URL = "https://www.bjeea.cn/html/gkgz/tzgg/2026/0624/88239.html";
const RANK_SOURCE_URL = "https://www.bjeea.cn/html/gkgz/tzgg/2026/0624/88238.html";
const RANK_PDF_URL = "https://www.bjeea.cn/uploads/soft/260625/2026%E5%B9%B4%E5%8C%97%E4%BA%AC%E5%B8%82%E9%AB%98%E8%80%83%E8%80%83%E7%94%9F%E5%88%86%E6%95%B0%E5%88%86%E5%B8%83.pdf";
const TITLE = "北京市2026年普通高等学校招生录取最低控制分数线";
const QUALITY = "official-beijing-control-line-html-verified";
const GENERATED_AT = "2026-07-16T07:20:00.000Z";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/official-beijing-control-lines-2026");

const evidence = {
  controlPage: {
    url: SOURCE_URL,
    cache: "tmp/beijing-2026-control-lines.html",
    raw: "control-lines.html",
    bytes: 39436,
    sha256: "d6770b626bc7399ba50924b56be892867b5576e4ee667f957238e0dbc08fef3c",
  },
  rankPage: {
    url: RANK_SOURCE_URL,
    cache: "tmp/beijing-2026-rank-source.html",
    raw: "rank-source.html",
    bytes: 12943,
    sha256: "b140391d70126bf52e82b5d1818443edafd144017555293f49be174e9fc2c009",
  },
  rankPdf: {
    url: RANK_PDF_URL,
    cache: "tmp/beijing-2026-rank.pdf",
    raw: "rank-distribution.pdf",
    bytes: 134541,
    sha256: "39f1e77097c56cbd7e1cd2971793e6231ba2ca9230811ba502a830153c4556a8",
  },
};

const rows = [
  {
    section: "本科",
    category: "普通类",
    kind: "普通本科录取控制分数线",
    score: 429,
    route: "ordinary-bachelor",
    ordinary: true,
    scoreBasis: "gaokao-total",
  },
  {
    section: "本科",
    category: "特殊类型招生",
    kind: "特殊类型招生控制分数线",
    score: 521,
    route: "special",
  },
  {
    section: "本科",
    category: "艺术类（不含舞蹈类、戏曲类）",
    kind: "艺术类（不含舞蹈类、戏曲类）本科录取控制分数线",
    score: 322,
    route: "art",
  },
  {
    section: "本科",
    category: "舞蹈类、戏曲类",
    kind: "舞蹈类、戏曲类本科录取控制分数线",
    score: 215,
    route: "art",
  },
  {
    section: "本科",
    category: "体育类",
    kind: "体育类本科录取控制分数线",
    score: 369,
    professionalMinScore: 60,
    professionalScoreDimension: "beijing-sports-score",
    route: "sports",
  },
  {
    section: "专科",
    category: "普通类",
    kind: "普通专科录取控制分数线",
    score: 120,
    route: "ordinary-vocational",
    ordinary: true,
    scoreBasis: "chinese-math-foreign-450",
  },
  {
    section: "专科",
    category: "艺术类",
    kind: "艺术类专科录取控制分数线",
    score: 84,
    route: "art",
    scoreBasis: "chinese-math-foreign-450",
  },
  {
    section: "高职单考单招",
    category: "普通类",
    kind: "高职单考单招控制分数线",
    score: 120,
    route: "single-exam",
    scoreBasis: "chinese-math-foreign-450",
  },
  {
    section: "高职单考单招",
    category: "艺术类",
    kind: "高职单考单招艺术类专业控制分数线",
    score: 84,
    route: "single-exam-art",
    scoreBasis: "chinese-math-foreign-450",
  },
];

function parseArgs(argv) {
  const args = {
    useCache: false,
    out: "data/admissions/official-beijing-control-lines-2026-import.json",
  };
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

async function fetchBuffer(url) {
  const response = await fetch(url, {
    redirect: "follow",
    headers: { "user-agent": "Mozilla/5.0 gaokao-evidence/3.286" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

async function loadEvidence(item, useCache) {
  const bytes = useCache
    ? fs.readFileSync(path.join(PROJECT_ROOT, item.cache))
    : await fetchBuffer(item.url);
  assert(bytes.length === item.bytes, `${item.raw} byte count drifted: ${bytes.length}`);
  assert(sha256(bytes) === item.sha256, `${item.raw} SHA-256 drifted`);
  fs.mkdirSync(RAW_DIR, { recursive: true });
  fs.writeFileSync(path.join(RAW_DIR, item.raw), bytes);
  return bytes;
}

function recordId(row) {
  return `2026-beijing-control-${sha256([
    row.section,
    row.category,
    row.kind,
    row.score,
    row.professionalMinScore ?? "",
    row.route,
    row.scoreBasis || "gaokao-total",
  ].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinaryCautions = [
    "这是北京2026年普通本科或普通专科录取最低控制分数线，只用于判断对应普通批资格边界。",
    "北京普通专科线按语文、数学、外语三科总分判断，不能直接拿六科高考总分与120分比较。",
    "控制线不是院校专业组投档线、专业录取最低分或最低位次，不能单独生成录取概率。",
  ];
  const specialCautions = [
    "这是北京2026年对应特殊类别控制线，不适用于普通类考生直接推荐。",
    "艺术、体育和高职单考单招均有独立资格与成绩口径，须按当年招生办法逐项核验。",
    "文化课分、专业分和单考成绩是不同维度，不得相加或互相替代。",
  ];
  return {
    id: recordId(row),
    province: "北京",
    year: 2026,
    subjectType: "综合",
    batch: row.kind,
    schoolName: TITLE,
    schoolTags: ["北京官方控制线", row.ordinary ? "普通类" : "特殊路径", row.category, row.section],
    city: "北京",
    dataType: "control-line",
    majorName: row.kind,
    majorGroup: row.category,
    minScore: row.score,
    cultureScoreLine: row.score,
    professionalMinScore: row.professionalMinScore ?? null,
    scoreDimension: "culture-score",
    scoreBasis: row.scoreBasis || "gaokao-total",
    professionalScoreDimension: row.professionalScoreDimension || "",
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: QUALITY,
    sourceUrl: SOURCE_URL,
    formalScoreScope: row.ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: row.kind,
    controlLineSection: row.section,
    cautions: row.ordinary ? ordinaryCautions : specialCautions,
    sourceFile: "data/admissions/raw/official-beijing-control-lines-2026/control-lines.html",
    sourcePublishedAt: "2026-06-24",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = {};
  for (const [key, item] of Object.entries(evidence)) loaded[key] = await loadEvidence(item, args.useCache);
  const controlText = loaded.controlPage.toString("utf8");
  for (const phrase of [
    "北京市2026年普通高等学校招生录取最低控制分数线",
    "普通本科录取",
    "429分",
    "特殊类型",
    "521分",
    "322分",
    "215分",
    "369分",
    "体育成绩",
    "60分",
    "普通",
    "专科录取控制分数线",
    "120分",
    "语数外三科总分",
    "84分",
    "高职",
    "单考单招",
  ]) assert(controlText.includes(phrase), `Official control-line page is missing: ${phrase}`);
  assert(loaded.rankPage.toString("utf8").includes("北京市2026年高考考生分数分布"), "Rank source page title drifted");
  assert(loaded.rankPdf.subarray(0, 4).toString("ascii") === "%PDF", "Rank evidence is not a PDF");

  const records = rows.map(makeRecord);
  assert(records.length === 9, `Expected 9 records, got ${records.length}`);
  assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
  assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 2, "Expected two ordinary records");
  assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 7, "Expected seven special-path records");

  const payload = {
    dataset: "official-beijing-control-lines-2026-import",
    generatedAt: GENERATED_AT,
    sourceNotes: [{
      id: SOURCE_ID,
      title: TITLE,
      publisher: "北京教育考试院",
      publishedAt: "2026-06-24",
      url: SOURCE_URL,
      quality: QUALITY,
      usage: "抽取北京2026普通本科、普通专科及特殊类型、艺术、体育、高职单考单招控制线9条；仅普通本科429分和普通专科120分参与普通资格路由，专科线按语数外三科总分判断。",
      parsedRecords: records.length,
      pageHtmlBytes: evidence.controlPage.bytes,
      pageHtmlSha256: evidence.controlPage.sha256,
      rankPageHtmlBytes: evidence.rankPage.bytes,
      rankPageHtmlSha256: evidence.rankPage.sha256,
      rankPdfBytes: evidence.rankPdf.bytes,
      rankPdfSha256: evidence.rankPdf.sha256,
      evidenceBoundary: "control-line-only; ordinary=2; special-path-only=7; Beijing vocational line uses Chinese+Math+Foreign Language subtotal out of 450; not filing or admission score",
    }],
    records,
    diagnostics: {
      recordCount: records.length,
      ordinaryRecords: 2,
      specialPathRecords: 7,
      routeCounts: Object.fromEntries([...new Set(records.map((record) => record.controlLineRouteKind))]
        .map((route) => [route, records.filter((record) => record.controlLineRouteKind === route).length])),
      ordinaryBoundaries: { bachelor: 429, vocational: 120 },
      scoreBasisCounts: Object.fromEntries([...new Set(records.map((record) => record.scoreBasis))]
        .map((basis) => [basis, records.filter((record) => record.scoreBasis === basis).length])),
      professionalScoreRecords: records.filter((record) => Number.isFinite(record.professionalMinScore)).length,
    },
  };
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    status: "ok",
    out: path.relative(PROJECT_ROOT, outFile),
    sourceId: SOURCE_ID,
    ...payload.diagnostics,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
