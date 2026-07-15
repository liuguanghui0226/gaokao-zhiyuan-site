#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_URL = "https://www.zjzs.net/art/2026/6/25/art_45_12449.html";
const DEFAULT_OUT = "data/admissions/official-zhejiang-control-lines-2026-import.json";
const TMP_ROOT = path.join(PROJECT_ROOT, "tmp", "official-zhejiang-control-lines-2026");
const YEAR = 2026;
const PROVINCE = "浙江";
const SOURCE_ID = "official-zhejiang-control-lines-2026";
const SOURCE_QUALITY = "official-zhejiang-control-line-html-verified";
const TITLE = "2026年浙江省普通高校招生各类别分数线";

function parseArgs(argv) {
  const args = { url: DEFAULT_URL, out: DEFAULT_OUT, useCache: false };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--url") args.url = argv[++index];
    else if (item === "--html") args.html = argv[++index];
    else if (item === "--out") args.out = argv[++index];
    else if (item === "--use-cache") args.useCache = true;
    else if (item === "--help" || item === "-h") args.help = true;
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    `  node scripts/import-official-zhejiang-control-lines-2026.mjs --out ${DEFAULT_OUT}`,
    "  node scripts/import-official-zhejiang-control-lines-2026.mjs --html /path/to/page.html",
    "  node scripts/import-official-zhejiang-control-lines-2026.mjs --use-cache",
    "",
    "Imports 57 official Zhejiang 2026 control-line records from five HTML tables.",
    "Ordinary first/second segment lines remain segment boundaries, not bachelor/vocational level labels.",
  ].join("\n");
}

function hash(value, length = 16) {
  return crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, length);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCharCode(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, "\"")
    .replace(/&apos;|&#39;/gi, "'")
    .replace(/\u00a0/g, " ");
}

function cleanHtmlText(value) {
  return decodeEntities(String(value ?? ""))
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactText(value) {
  return cleanHtmlText(value)
    .replace(/\s+/g, "")
    .replace(/[（]/g, "(")
    .replace(/[）]/g, ")");
}

function tableRows(tableHtml) {
  return [...tableHtml.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)].map((match) =>
    [...match[0].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
      .map((cell) => cleanHtmlText(cell[1]))
  );
}

function extractPage(html, pageUrl) {
  const title = cleanHtmlText(/<h1[^>]+class=["']zjhz-main_title["'][^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1] || "");
  const publishedMatch = cleanHtmlText(/<p[^>]+class=["']zjhz-time["'][^>]*>([\s\S]*?)<\/p>/i.exec(html)?.[1] || "")
    .match(/发布时间：(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2})/);
  const articleHtml = /<!--ZJEG_RSS\.content\.begin-->([\s\S]*?)<meta name=["']ContentEnd["']/i.exec(html)?.[1] || "";
  const articleText = compactText(articleHtml);
  const tables = [...articleHtml.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map((match) => tableRows(match[0]));

  if (title !== TITLE) throw new Error(`Unexpected Zhejiang title: ${title}`);
  if (!publishedMatch || publishedMatch[1] !== "2026-06-25" || publishedMatch[2] !== "13:22") {
    throw new Error(`Unexpected Zhejiang publish time: ${publishedMatch?.slice(1).join(" ") || "missing"}`);
  }
  if (tables.length !== 5) throw new Error(`Expected five Zhejiang control-line tables, got ${tables.length}`);
  return { title, publishedAt: `${publishedMatch[1]} ${publishedMatch[2]}`, articleHtml, articleText, tables, pageUrl };
}

function assertEqual(actual, expected, label) {
  const actualText = JSON.stringify(actual);
  const expectedText = JSON.stringify(expected);
  if (actualText !== expectedText) throw new Error(`${label} drift: ${actualText} != ${expectedText}`);
}

function parseOfficialRows(parsed) {
  const [ordinaryTable, artCultureTable, artCompositeTable, sportsTable, singleExamTable] = parsed.tables;
  const ordinaryScores = ordinaryTable[1].slice(1).map(Number);
  assertEqual(ordinaryScores, [494, 266], "ordinary segment scores");
  const specialTypeScore = Number(/特殊类型招生控制线(\d+)分/.exec(parsed.articleText)?.[1]);
  if (specialTypeScore !== 594) throw new Error(`Special-type score drift: ${specialTypeScore}`);

  const artCultureScores = artCultureTable.slice(1).map((row) => Number(row.find((cell) => /^\d+$/.test(cell))));
  assertEqual(artCultureScores, [494, 247, 371, 187], "art culture scores");
  const lowerArtCultureScore = Number(/本科专业371.*?为(\d+)分/.exec(parsed.articleText)?.[1]);
  if (lowerArtCultureScore !== 322) throw new Error(`Lower art culture score drift: ${lowerArtCultureScore}`);

  const artComposite = artCompositeTable.slice(1).map((row) => ({
    category: compactText(row[0]),
    first: Number(row[1]),
    second: Number(row[2]),
  }));
  const expectedArtComposite = [
    ["美术与设计类", 517, 466],
    ["音乐类音乐表演器乐方向", 485, 421],
    ["音乐类音乐表演声乐方向", 489, 430],
    ["音乐类音乐教育器乐主项", 487, 425],
    ["音乐类音乐教育声乐主项", 488, 430],
    ["舞蹈类", 472, 426],
    ["表(导)演类戏剧影视表演方向", 494, 425],
    ["表(导)演类服装表演方向", 463, 402],
    ["表(导)演类戏剧影视导演方向", 499, 436],
    ["播音与主持类", 485, 409],
    ["书法类", 506, 450],
  ];
  assertEqual(artComposite.map((row) => [row.category, row.first, row.second]), expectedArtComposite, "art composite lines");

  const sportsScores = sportsTable[1].slice(1).map(Number);
  assertEqual(sportsScores, [525, 460], "sports composite scores");

  const singleExam = singleExamTable.slice(1).map((row) => {
    const compact = compactText(row[0]);
    const match = /^(\d+)(.+)$/.exec(compact);
    if (!match) throw new Error(`Could not parse single-exam category: ${row[0]}`);
    return { code: match[1], category: match[2], score: Number(row[1]) };
  });
  if (singleExam.length !== 25) throw new Error(`Expected 25 single-exam rows, got ${singleExam.length}`);
  assertEqual(singleExam.map((row) => row.score), [319, 246, 321, 276, 400, 180, 338, 257, 325, 314, 239, 255, 230, 351, 343, 285, 248, 302, 293, 175, 202, 245, 379, 88, 266], "single-exam scores");

  return { ordinaryScores, specialTypeScore, artCultureScores, lowerArtCultureScore, artComposite, sportsScores, singleExam };
}

function baseRecord({ subjectType, batch, majorName, majorGroup, minScore, formalScoreScope, controlLineKind, controlLineSection, controlLineRouteKind, rankUsage, rankUsageLabel, disciplineCodes = [], extra = {} }) {
  const idBase = [YEAR, PROVINCE, subjectType, batch, majorName, minScore, controlLineRouteKind].join("|");
  return {
    id: `${YEAR}-${hash(idBase)}`,
    province: PROVINCE,
    year: YEAR,
    subjectType,
    batch,
    schoolName: TITLE,
    schoolTags: ["批次控制线", majorGroup, controlLineSection].filter(Boolean),
    city: "浙江",
    dataType: "control-line",
    majorName,
    majorCode: "",
    majorGroup,
    disciplineCodes,
    minScore,
    rankUsage,
    rankUsageLabel,
    rankRangeText: "",
    sourceId: SOURCE_ID,
    sourceQuality: SOURCE_QUALITY,
    controlLineKind,
    controlLineSection,
    controlLineRouteKind,
    formalScoreScope,
    cautions: [
      "这是浙江省教育考试院发布的2026年普通高校招生各类别分数线，只用于对应类别和分段资格边界。",
      "浙江普通类第一段、第二段是考生分段，不等同于本科线、专科线；第二段仍可能包含剩余本科计划。",
      "控制线不是院校专业投档线、专业录取最低分或录取概率证据。",
      "艺体综合分和单独考试招生须使用各自成绩口径，不得与普通类总分或位次混算。",
    ],
    ...extra,
  };
}

function recordsFor(rows) {
  const records = [
    baseRecord({ subjectType: "综合", batch: "普通类一段线", majorName: "普通类第一段线", majorGroup: "普通类", minScore: rows.ordinaryScores[0], formalScoreScope: "control-line-only", controlLineKind: "普通类第一段线", controlLineSection: "第一段", controlLineRouteKind: "segment", rankUsage: "ordinary", rankUsageLabel: "普通类" }),
    baseRecord({ subjectType: "综合", batch: "普通类二段线", majorName: "普通类第二段线", majorGroup: "普通类", minScore: rows.ordinaryScores[1], formalScoreScope: "control-line-only", controlLineKind: "普通类第二段线", controlLineSection: "第二段", controlLineRouteKind: "segment", rankUsage: "ordinary", rankUsageLabel: "普通类" }),
    baseRecord({ subjectType: "综合", batch: "特殊类型招生控制线", majorName: "特殊类型招生控制线", majorGroup: "特殊类型", minScore: rows.specialTypeScore, formalScoreScope: "special-path-only", controlLineKind: "特殊类型招生控制线", controlLineSection: "特殊类型", controlLineRouteKind: "special", rankUsage: "special", rankUsageLabel: "特殊类型" }),
  ];

  const artCulture = [
    ["校考批", "校考专业", rows.artCultureScores[0]],
    ["校考批", "戏曲类本科专业", rows.artCultureScores[1]],
    ["统考批", "本科专业", rows.artCultureScores[2]],
    ["统考批", "舞蹈/表演/音乐表演本科专业", rows.lowerArtCultureScore],
    ["统考批", "高职（专科）专业", rows.artCultureScores[3]],
  ];
  for (const [batch, category, score] of artCulture) {
    records.push(baseRecord({
      subjectType: "艺术类",
      batch: `艺术类${batch}${category}`,
      majorName: `${category}文化成绩控制线`,
      majorGroup: "艺术类文化线",
      minScore: score,
      formalScoreScope: "special-path-only",
      controlLineKind: "艺术类文化成绩控制线",
      controlLineSection: batch,
      controlLineRouteKind: "art-culture",
      rankUsage: "art",
      rankUsageLabel: category,
      disciplineCodes: ["13"],
      extra: { cultureScoreLine: score, scoreMetric: "culture-score" },
    }));
  }

  for (const row of rows.artComposite) {
    for (const [section, score] of [["第一段", row.first], ["第二段", row.second]]) {
      records.push(baseRecord({
        subjectType: "艺术类",
        batch: `艺术类统考批${section}`,
        majorName: `${row.category}综合分${section}线`,
        majorGroup: row.category,
        minScore: score,
        formalScoreScope: "special-path-only",
        controlLineKind: "艺术类统考批综合分分段线",
        controlLineSection: section,
        controlLineRouteKind: "art-composite",
        rankUsage: "art-composite",
        rankUsageLabel: row.category,
        disciplineCodes: ["13"],
        extra: { scoreMetric: "art-composite", scoreOnly: true, rankUnavailable: true },
      }));
    }
  }

  for (const [section, score] of [["第一段", rows.sportsScores[0]], ["第二段", rows.sportsScores[1]]]) {
    records.push(baseRecord({
      subjectType: "体育类",
      batch: `体育类${section}`,
      majorName: `体育类综合分${section}线`,
      majorGroup: "体育类",
      minScore: score,
      formalScoreScope: "special-path-only",
      controlLineKind: "体育类综合分分段线",
      controlLineSection: section,
      controlLineRouteKind: "sports-composite",
      rankUsage: "sports-composite",
      rankUsageLabel: "体育类",
      disciplineCodes: ["04"],
      extra: { scoreMetric: "sports-composite", scoreOnly: true, rankUnavailable: true },
    }));
  }

  for (const row of rows.singleExam) {
    records.push(baseRecord({
      subjectType: "单独考试招生",
      batch: "单独考试招生",
      majorName: `${row.code} ${row.category}分数线`,
      majorGroup: row.category,
      minScore: row.score,
      formalScoreScope: "special-path-only",
      controlLineKind: "单独考试招生分数线",
      controlLineSection: row.category,
      controlLineRouteKind: "single-exam",
      rankUsage: "zhejiang-single-exam",
      rankUsageLabel: `${row.code} ${row.category}`,
      extra: { categoryCode: row.code, scoreMetric: "single-exam-score", scoreOnly: true, rankUnavailable: true },
    }));
  }
  return records;
}

async function downloadText(url) {
  const response = await fetch(url, {
    signal: AbortSignal.timeout(90_000),
    headers: { "user-agent": "Mozilla/5.0 gaokao-zhejiang-control-importer/1.0", accept: "text/html,application/xhtml+xml" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  fs.mkdirSync(TMP_ROOT, { recursive: true });
  const cachePath = path.join(TMP_ROOT, "control-lines.html");
  const html = args.html
    ? fs.readFileSync(path.resolve(args.html), "utf8")
    : args.useCache && fs.existsSync(cachePath)
      ? fs.readFileSync(cachePath, "utf8")
      : await downloadText(args.url);
  if (!args.html) fs.writeFileSync(cachePath, html, "utf8");

  const parsed = extractPage(html, args.url);
  const officialRows = parseOfficialRows(parsed);
  const records = recordsFor(officialRows);
  if (records.length !== 57) throw new Error(`Expected 57 Zhejiang records, got ${records.length}`);
  if (new Set(records.map((record) => record.id)).size !== records.length) throw new Error("Duplicate Zhejiang control-line record ids");

  const routeCounts = records.reduce((counts, record) => {
    counts[record.controlLineRouteKind] = Number(counts[record.controlLineRouteKind] || 0) + 1;
    return counts;
  }, {});
  const payload = {
    dataset: "official-zhejiang-control-lines-2026-import",
    generatedAt: new Date().toISOString(),
    scope: { province: PROVINCE, year: YEAR, sourceKind: "official-control-lines" },
    notes: [
      "由浙江省教育考试院公开HTML的五张表逐行解析，共57条。",
      "普通类第一段/第二段是考生分段，不等同于本科/专科学历层次；模型使用独立segment路由。",
      "特殊类型、艺术、体育和单独考试招生保持special-path-only，成绩口径不得混算。",
    ],
    sourceNotes: [{
      id: SOURCE_ID,
      title: parsed.title,
      publisher: "浙江省教育考试院",
      publishedAt: parsed.publishedAt,
      url: parsed.pageUrl,
      quality: SOURCE_QUALITY,
      usage: "解析浙江2026普通类分段线2条、特殊类型1条、艺术文化5条、艺术综合分22条、体育综合分2条和单独考试招生25条；普通分段使用独立segment路由。",
      parsedRecords: records.length,
      routeCounts,
      pageHtmlSha256: sha256(html),
      articleHtmlSha256: sha256(parsed.articleHtml),
      articleTextSha256: sha256(parsed.articleText),
      mac2tMirrorRelativePath: "gaokao-official-mirror/zhejiang/2026/control-lines/zhejiang-2026-all-category-control-lines.html",
    }],
    diagnostics: {
      recordCount: records.length,
      tableCount: parsed.tables.length,
      routeCounts,
      ordinaryBoundaries: { firstSegment: 494, secondSegment: 266, specialType: 594 },
      artCultureScores: [494, 247, 371, 322, 187],
      sportsCompositeScores: officialRows.sportsScores,
      singleExamRows: officialRows.singleExam.length,
    },
    records,
  };
  const out = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ out: path.relative(PROJECT_ROOT, out), records: records.length, routeCounts, pageHtmlSha256: payload.sourceNotes[0].pageHtmlSha256 }, null, 2));
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
