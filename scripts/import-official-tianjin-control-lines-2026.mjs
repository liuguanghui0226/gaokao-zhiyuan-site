#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const SOURCE_ID = "official-tianjin-control-lines-2026";
const UNDERGRADUATE_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260624/2293845896.html";
const ART_SPORTS_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260624/2293845918.html";
const RANK_SOURCE_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260624/2293845980.html";
const RANK_PDF_URL = "https://t4.chei.com.cn/news/getfile/2293845981-2293845980-ceda0163fd4fad87e9fe561da1f1c735.pdf";
const TITLE = "天津市2026年普通高考录取控制分数线";
const QUALITY = "official-content-mirror-tianjin-control-line-html-verified";
const GENERATED_AT = "2026-07-16T08:00:00.000Z";
const RAW_DIR = path.join(PROJECT_ROOT, "data/admissions/raw/official-tianjin-control-lines-2026");

const evidence = {
  undergraduatePage: {
    url: UNDERGRADUATE_URL,
    cache: "tmp/tianjin-2026-control-lines-chsi.html",
    raw: "undergraduate-control-lines-chsi.html",
    bytes: 55901,
    sha256: "dccf00c366229eb359e6837abf57efe053b618e25cea197a71815337cde1bb87",
  },
  artSportsPage: {
    url: ART_SPORTS_URL,
    cache: "tmp/tianjin-2026-art-sports-chsi.html",
    raw: "art-sports-control-lines-chsi.html",
    bytes: 49152,
    sha256: "1f4b7fabbfd0bb5dfe4cf23ef1dbe1f6ee93735100ddce679ca4569e5f1c75af",
  },
  rankPage: {
    url: RANK_SOURCE_URL,
    cache: "tmp/tianjin-2026-rank-source.html",
    raw: "rank-source-chsi.html",
    bytes: 44159,
    sha256: "6237d13873da2c099969bdc3bfeb16e56d194ae906a6f04d94304c56777f4905",
  },
  rankPdf: {
    url: RANK_PDF_URL,
    cache: "tmp/tianjin-2026-rank-current.pdf",
    raw: "rank-distribution.pdf",
    bytes: 622036,
    sha256: "768a8cf5bc3c07d1a1d390c5040394192314c6845e4383cfdba2e01d4b9dec1d",
  },
};

const rows = [
  { category: "普通类", kind: "普通本科录取控制分数线", score: 458, route: "ordinary-bachelor", ordinary: true, sourceUrl: UNDERGRADUATE_URL, sourceFile: evidence.undergraduatePage.raw },
  { category: "特殊类型招生", kind: "特殊类型资格考生最低录取控制参考线", score: 547, route: "special", sourceUrl: UNDERGRADUATE_URL, sourceFile: evidence.undergraduatePage.raw },
  { category: "艺考类（不含舞蹈类、戏曲类）", kind: "艺考类（不含舞蹈类、戏曲类）本科文化课录取控制分数线", score: 343, route: "art", sourceUrl: ART_SPORTS_URL, sourceFile: evidence.artSportsPage.raw },
  { category: "艺考类（舞蹈类）", kind: "艺考类（舞蹈类）本科文化课录取控制分数线", score: 297, route: "art", sourceUrl: ART_SPORTS_URL, sourceFile: evidence.artSportsPage.raw },
  { category: "艺考类（戏曲类）", kind: "艺考类（戏曲类）本科文化课录取控制分数线", score: 229, route: "art", sourceUrl: ART_SPORTS_URL, sourceFile: evidence.artSportsPage.raw },
  { category: "体育类", kind: "体育类本科文化课录取控制分数线", score: 407, route: "sports", sourceUrl: ART_SPORTS_URL, sourceFile: evidence.artSportsPage.raw },
];

function parseArgs(argv) {
  const args = { useCache: false, out: "data/admissions/official-tianjin-control-lines-2026-import.json" };
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
    headers: { "user-agent": "Mozilla/5.0 gaokao-evidence/3.287" },
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

function recordId(row) {
  return `2026-tianjin-control-${sha256([row.category, row.kind, row.score, row.route].join("|")).slice(0, 18)}`;
}

function makeRecord(row) {
  const ordinaryCautions = [
    "这是天津2026年普通本科录取控制分数线，只用于判断普通本科批资格边界。",
    "截至本次核验日，天津2026年普通高职（专科）录取控制分数线尚未在同批官方公告中发布；本科线以下不能据此认定已达到专科资格线。",
    "控制线不是院校专业组投档线、专业录取最低分或最低位次，不能单独生成录取概率。",
  ];
  const specialCautions = [
    "这是天津2026年特殊类型、艺考类或体育类本科文化课控制线，不适用于普通类考生直接推荐。",
    "艺考类和体育类还须满足对应专业考试合格、专业成绩及院校章程要求。",
    "文化课分与专业综合分属于不同维度，不得相加或互相替代。",
  ];
  return {
    id: recordId(row),
    province: "天津",
    year: 2026,
    subjectType: "综合",
    batch: row.kind,
    schoolName: TITLE,
    schoolTags: ["天津官方控制线", row.ordinary ? "普通类" : "特殊路径", row.category, "本科"],
    city: "天津",
    dataType: "control-line",
    majorName: row.kind,
    majorGroup: row.category,
    minScore: row.score,
    cultureScoreLine: row.score,
    scoreDimension: "culture-score",
    scoreBasis: "gaokao-total",
    rankUnavailable: true,
    scoreOnly: true,
    sourceId: SOURCE_ID,
    sourceQuality: QUALITY,
    sourceUrl: row.sourceUrl,
    formalScoreScope: row.ordinary ? "control-line-only" : "special-path-only",
    controlLineRouteKind: row.route,
    controlLineKind: row.kind,
    controlLineSection: "本科",
    cautions: row.ordinary ? ordinaryCautions : specialCautions,
    sourceFile: `data/admissions/raw/official-tianjin-control-lines-2026/${row.sourceFile}`,
    sourcePublishedAt: "2026-06-24",
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const loaded = {};
  for (const [key, item] of Object.entries(evidence)) loaded[key] = await loadEvidence(item, args.useCache);
  const undergraduateText = loaded.undergraduatePage.toString("utf8");
  for (const phrase of ["2026年普通高考本科录取控制分数线", "普通本科录取控制分数线：458分", "特殊类型资格考生最低录取控制参考线", "547"]) {
    assert(undergraduateText.includes(phrase), `Undergraduate page is missing: ${phrase}`);
  }
  const artSportsText = loaded.artSportsPage.toString("utf8");
  for (const phrase of ["艺考类（不含舞蹈类、戏曲类）本科：343分", "艺考类（舞蹈类）本科：297分", "艺考类（戏曲类）本科：229分", "体育类本科：407分"]) {
    assert(artSportsText.includes(phrase), `Art/sports page is missing: ${phrase}`);
  }
  assert(loaded.rankPage.toString("utf8").includes("2026年高考总成绩分数段统计情况"), "Rank source page title drifted");
  assert(loaded.rankPdf.subarray(0, 4).toString("ascii") === "%PDF", "Rank evidence is not a PDF");

  const records = rows.map(makeRecord);
  assert(records.length === 6, `Expected 6 records, got ${records.length}`);
  assert(new Set(records.map((record) => record.id)).size === records.length, "Duplicate record ids detected");
  assert(records.filter((record) => record.formalScoreScope === "control-line-only").length === 1, "Expected one ordinary record");
  assert(records.filter((record) => record.formalScoreScope === "special-path-only").length === 5, "Expected five special-path records");

  const payload = {
    dataset: "official-tianjin-control-lines-2026-import",
    generatedAt: GENERATED_AT,
    sourceNotes: [{
      id: SOURCE_ID,
      province: "天津",
      title: TITLE,
      publisher: "天津教育招生考试院 / 阳光高考",
      publishedAt: "2026-06-24",
      url: UNDERGRADUATE_URL,
      relatedUrls: [ART_SPORTS_URL],
      quality: QUALITY,
      usage: "抽取天津2026普通本科线、特殊类型资格参考线及艺考类、体育类本科文化课控制线6条；仅普通本科458分参与普通资格路由。",
      parsedRecords: records.length,
      ordinaryVocationalStatus: "pending-official-release",
      ordinaryVocationalPending: true,
      ordinaryVocationalCheckedAt: "2026-07-16",
      undergraduatePageBytes: evidence.undergraduatePage.bytes,
      undergraduatePageSha256: evidence.undergraduatePage.sha256,
      artSportsPageBytes: evidence.artSportsPage.bytes,
      artSportsPageSha256: evidence.artSportsPage.sha256,
      rankPageBytes: evidence.rankPage.bytes,
      rankPageSha256: evidence.rankPage.sha256,
      rankPdfBytes: evidence.rankPdf.bytes,
      rankPdfSha256: evidence.rankPdf.sha256,
      evidenceBoundary: "control-line-only; ordinary-bachelor=1; special-path-only=5; 2026 ordinary vocational line pending official release; not filing or admission score",
    }],
    records,
    diagnostics: {
      recordCount: records.length,
      ordinaryRecords: 1,
      specialPathRecords: 5,
      routeCounts: Object.fromEntries([...new Set(records.map((record) => record.controlLineRouteKind))]
        .map((route) => [route, records.filter((record) => record.controlLineRouteKind === route).length])),
      ordinaryBoundaries: { bachelor: 458, vocational: null },
      ordinaryVocationalStatus: "pending-official-release",
      scoreBasisCounts: { "gaokao-total": records.length },
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
