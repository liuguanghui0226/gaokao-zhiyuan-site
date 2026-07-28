#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DATASET = "official-guangdong-rank-conversion-2025-v3331-import";
const SOURCE_ID = "official-guangdong-rank-2025-v3331";
const PROVINCE = "广东";
const YEAR = 2025;
const SOURCE_QUALITY = "official-guangdong-exam-authority-zip-pdf-jhgk-byte-identical-dxsbb-checkpoint-dual-level-bonus";
const OFFICIAL_PAGE_URL = "https://eea.gd.gov.cn/zwgk_tjxx/content/post_4734449.html";
const OFFICIAL_ZIP_URL = "https://eea.gd.gov.cn/attachment/0/583/583759/4734449.zip";
const JHGK_PAGE_URL = "https://jhgk.cn/trendDetails.htm?id=68a61ceb-7217-403b-87f9-3a2a958ebe2f";
const JHGK_ZIP_URL = "https://jhgk.cn/upload/file/20250626/1750937007438028493.zip";
const CHSI_PAGE_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250627/2293393088.html";
const DXSBB_URLS = {
  "历史类": "https://www.dxsbb.com/news/148857.html",
  "物理类": "https://www.dxsbb.com/news/148856.html",
};
const USAGES = {
  undergraduate: {
    label: "本科层次加分",
    scoreBasis: "gaokao-total-including-undergraduate-level-policy-bonus",
    scoreBonusScope: "undergraduate-level-policy-bonus",
    scoreBonusScopeLabel: "含本科层次加分",
  },
  vocational: {
    label: "专科层次加分",
    scoreBasis: "gaokao-total-including-vocational-level-policy-bonus",
    scoreBonusScope: "vocational-level-policy-bonus",
    scoreBonusScopeLabel: "含专科层次加分",
  },
};
const EXPECTED = {
  "历史类": { rows: 573, pages: 9, topScore: 672, floorScore: 100, floorRankEnd: 292200, at600: 5295 },
  "物理类": { rows: 598, pages: 12, topScore: 697, floorScore: 100, floorRankEnd: 440208, at600: 26988 },
};

function parseArgs(argv) {
  const args = {
    historyPdf: "",
    physicsPdf: "",
    officialZip: "",
    mirrorZip: "",
    officialPageHtml: "",
    mirrorPageHtml: "",
    historyMirrorHtml: "",
    physicsMirrorHtml: "",
    out: "data/admissions/official-guangdong-rank-conversion-2025-v3331-import.json",
    pdftotext: process.env.PDFTOTEXT_BIN || "pdftotext",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (key === "--history-pdf") args.historyPdf = argv[++index];
    else if (key === "--physics-pdf") args.physicsPdf = argv[++index];
    else if (key === "--official-zip") args.officialZip = argv[++index];
    else if (key === "--mirror-zip") args.mirrorZip = argv[++index];
    else if (key === "--official-page-html") args.officialPageHtml = argv[++index];
    else if (key === "--mirror-page-html") args.mirrorPageHtml = argv[++index];
    else if (key === "--history-mirror-html") args.historyMirrorHtml = argv[++index];
    else if (key === "--physics-mirror-html") args.physicsMirrorHtml = argv[++index];
    else if (key === "--out") args.out = argv[++index];
    else if (key === "--pdftotext") args.pdftotext = argv[++index];
    else throw new Error(`Unknown argument: ${key}`);
  }
  for (const key of [
    "historyPdf",
    "physicsPdf",
    "officialZip",
    "mirrorZip",
    "officialPageHtml",
    "mirrorPageHtml",
    "historyMirrorHtml",
    "physicsMirrorHtml",
  ]) {
    if (!args[key]) throw new Error(`Missing required ${key}`);
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function stripHtml(value) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim()
    .normalize("NFKC");
}

function pdfTsv(binary, file) {
  const result = spawnSync(binary, ["-tsv", file, "-"], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    maxBuffer: 30 * 1024 * 1024,
  });
  assert(result.status === 0, `pdftotext failed for ${path.basename(file)}: ${result.stderr?.trim() || "unknown error"}`);
  assert(result.stdout.length > 100000, `pdftotext TSV is too short for ${path.basename(file)}`);
  return result.stdout.normalize("NFKC");
}

function parsePdfRows(tsv, subjectType) {
  const groups = new Map();
  let pages = 0;
  for (const line of tsv.split(/\r?\n/).slice(1)) {
    const cells = line.split("\t");
    if (cells.length < 12) continue;
    const level = Number(cells[0]);
    const page = Number(cells[1]);
    pages = Math.max(pages, page);
    if (level !== 5) continue;
    const left = Number(cells[6]);
    const top = Number(cells[7]);
    const text = cells.slice(11).join("\t").trim();
    if (!/^\d{1,6}(?:（含以上）|\(含以上\))?$/.test(text)) continue;
    const key = `${page}|${top.toFixed(2)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ left, text });
  }
  const parsed = [];
  for (const words of groups.values()) {
    words.sort((left, right) => left.left - right.left);
    if (words.length !== 5) continue;
    const values = words.map((word) => Number(word.text.match(/^\d+/)?.[0]));
    if (values.some((value) => !Number.isInteger(value))) continue;
    const [score, undergraduatePeople, undergraduateCumulative, vocationalPeople, vocationalCumulative] = values;
    if (score < 100 || score > 750) continue;
    parsed.push({
      score,
      undergraduatePeople,
      undergraduateCumulative,
      vocationalPeople,
      vocationalCumulative,
      topMerged: /含以上/.test(words[0].text),
    });
  }
  const rows = [...new Map(parsed.map((row) => [row.score, row])).values()]
    .sort((left, right) => right.score - left.score);
  const expected = EXPECTED[subjectType];
  assert(pages === expected.pages, `${subjectType} expected ${expected.pages} pages, got ${pages}`);
  assert(rows.length === expected.rows, `${subjectType} expected ${expected.rows} rows, got ${rows.length}`);
  assert(rows[0].score === expected.topScore && rows[0].topMerged, `${subjectType} merged top boundary drifted`);
  assert(rows.at(-1).score === expected.floorScore, `${subjectType} floor score drifted`);
  assert(rows.at(-1).undergraduateCumulative === expected.floorRankEnd, `${subjectType} undergraduate floor rank drifted`);
  assert(rows.at(-1).vocationalCumulative === expected.floorRankEnd, `${subjectType} vocational floor rank drifted`);
  assert(rows.find((row) => row.score === 600)?.undergraduateCumulative === expected.at600, `${subjectType} 600 checkpoint drifted`);
  assert(rows.find((row) => row.score === 600)?.vocationalCumulative === expected.at600, `${subjectType} vocational 600 checkpoint drifted`);
  for (let index = 1; index < rows.length; index += 1) {
    const previous = rows[index - 1];
    const row = rows[index];
    assert(previous.score - row.score === 1, `${subjectType} score gap at ${previous.score}/${row.score}`);
    assert(
      row.undergraduateCumulative - previous.undergraduateCumulative === row.undergraduatePeople,
      `${subjectType} undergraduate cumulative arithmetic failed at ${row.score}`,
    );
    assert(
      row.vocationalCumulative - previous.vocationalCumulative === row.vocationalPeople,
      `${subjectType} vocational cumulative arithmetic failed at ${row.score}`,
    );
  }
  return { pages, rows };
}

function stableId(subjectType, usage, row) {
  const digest = sha256(Buffer.from(`${YEAR}|${PROVINCE}|${subjectType}|${usage}|${row.score}|${SOURCE_ID}`)).slice(0, 18);
  return `${YEAR}-guangdong-rank-${subjectType === "历史类" ? "history" : "physics"}-${usage}-v3331-${digest}`;
}

function createRankRows(subjectType, rows) {
  const records = [];
  for (const usage of Object.keys(USAGES)) {
    const usageInfo = USAGES[usage];
    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index];
      const people = usage === "undergraduate" ? row.undergraduatePeople : row.vocationalPeople;
      const cumulative = usage === "undergraduate" ? row.undergraduateCumulative : row.vocationalCumulative;
      const previous = index === 0
        ? 0
        : usage === "undergraduate"
          ? rows[index - 1].undergraduateCumulative
          : rows[index - 1].vocationalCumulative;
      records.push({
        id: stableId(subjectType, usage, row),
        province: PROVINCE,
        year: YEAR,
        subjectType,
        dataType: "rank-conversion",
        score: row.score,
        rankStart: previous + 1,
        rankEnd: cumulative,
        sameRankScore: people,
        ...(row.topMerged ? { scoreRange: [row.score, 750], topMerged: true } : {}),
        rankUsage: usage,
        rankUsageLabel: usageInfo.label,
        scoreBasis: usageInfo.scoreBasis,
        scoreBonusScope: usageInfo.scoreBonusScope,
        scoreBonusScopeLabel: usageInfo.scoreBonusScopeLabel,
        rankPolicyBonusIncluded: true,
        sourceId: SOURCE_ID,
        sourceQuality: SOURCE_QUALITY,
        sourceUrl: OFFICIAL_PAGE_URL,
      });
    }
  }
  return records;
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const files = Object.fromEntries(
    Object.entries(args)
      .filter(([key]) => key.endsWith("Pdf") || key.endsWith("Zip") || key.endsWith("Html"))
      .map(([key, value]) => [key, path.resolve(PROJECT_ROOT, value)]),
  );
  const bytes = Object.fromEntries(Object.entries(files).map(([key, file]) => [key, fs.readFileSync(file)]));
  assert(bytes.officialZip.equals(bytes.mirrorZip), "Official and JHGK mirror ZIP files are not byte-identical");
  const officialText = stripHtml(bytes.officialPageHtml.toString("utf8"));
  const mirrorText = stripHtml(bytes.mirrorPageHtml.toString("utf8"));
  const historyMirrorText = stripHtml(bytes.historyMirrorHtml.toString("utf8"));
  const physicsMirrorText = stripHtml(bytes.physicsMirrorHtml.toString("utf8"));
  const compactOfficialText = officialText.replace(/\s+/g, "");
  assert(compactOfficialText.includes("广东省2025年高考普通类(历史)分数段统计表"), "Official history attachment label drifted");
  assert(compactOfficialText.includes("广东省2025年高考普通类(物理)分数段统计表"), "Official physics attachment label drifted");
  assert(compactOfficialText.includes("广东省招生委员会办公室"), "Official publisher text drifted");
  assert(mirrorText.includes("广东省2025年高考分数段统计表.zip"), "Independent mirror attachment label drifted");
  assert(historyMirrorText.includes("历史类600分及以上有5295人"), "History mirror checkpoint drifted");
  assert(physicsMirrorText.includes("物理类600分及以上有26988人"), "Physics mirror checkpoint drifted");

  const parsed = {
    "历史类": parsePdfRows(pdfTsv(args.pdftotext, files.historyPdf), "历史类"),
    "物理类": parsePdfRows(pdfTsv(args.pdftotext, files.physicsPdf), "物理类"),
  };
  const rankConversions = [
    ...createRankRows("历史类", parsed["历史类"].rows),
    ...createRankRows("物理类", parsed["物理类"].rows),
  ];
  assert(rankConversions.length === 2342, `Expected 2342 rank rows, got ${rankConversions.length}`);
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate rank IDs");
  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "广东省2025年高考普通类历史/物理分数段统计表（含本、专科层次加分）",
    publisher: "广东省教育考试院 / 广东省招生委员会办公室；锦宏高考字节镜像；大学生必备网关键点复核",
    url: OFFICIAL_PAGE_URL,
    attachmentUrls: [OFFICIAL_ZIP_URL, JHGK_ZIP_URL],
    relatedUrls: [CHSI_PAGE_URL, JHGK_PAGE_URL, ...Object.values(DXSBB_URLS)],
    quality: SOURCE_QUALITY,
    usage: "广东2025普通类历史/物理整数分数换算省级位次；本科与专科按各自政策加分口径严格分开，普通本科只连接本科线及以上，明确专科批只连接专科口径。",
    province: PROVINCE,
    year: YEAR,
    parsedRecords: rankConversions.length,
    subjectRecords: { "历史类": 1146, "物理类": 1196 },
    rawScoreRows: { "历史类": 573, "物理类": 598 },
    rankUsageRecords: { undergraduate: 1171, vocational: 1171 },
    pdfPages: { "历史类": parsed["历史类"].pages, "物理类": parsed["物理类"].pages },
    scoreRange: { "历史类": { min: 100, max: 672, topMergedMax: 750 }, "物理类": { min: 100, max: 697, topMergedMax: 750 } },
    rankRange: { "历史类": { min: 1, max: 292200 }, "物理类": { min: 1, max: 440208 } },
    scoreBasis: "dual-level-policy-bonus",
    rankPolicyBonusIncluded: true,
    automaticAdmissionScoreAlignmentAllowed: true,
    rankUsageRequired: true,
    provenance: {
      officialZipBytes: bytes.officialZip.byteLength,
      officialZipSha256: sha256(bytes.officialZip),
      mirrorZipBytes: bytes.mirrorZip.byteLength,
      mirrorZipSha256: sha256(bytes.mirrorZip),
      mirrorZipByteIdentical: true,
      officialPageBytes: bytes.officialPageHtml.byteLength,
      officialPageSha256: sha256(bytes.officialPageHtml),
      mirrorPageBytes: bytes.mirrorPageHtml.byteLength,
      mirrorPageSha256: sha256(bytes.mirrorPageHtml),
      historyPdfBytes: bytes.historyPdf.byteLength,
      historyPdfSha256: sha256(bytes.historyPdf),
      physicsPdfBytes: bytes.physicsPdf.byteLength,
      physicsPdfSha256: sha256(bytes.physicsPdf),
      historyMirrorHtmlSha256: sha256(bytes.historyMirrorHtml),
      physicsMirrorHtmlSha256: sha256(bytes.physicsMirrorHtml),
    },
    cautions: [
      "同一分数的本科层次加分位次和专科层次加分位次可能不同，禁止跨层次混用。",
      "由最低分换算的位次不是院校原录取表直接公布的最低位次。",
      "艺术、体育、特殊类型、非整数分、已有原生位次和本科线下来源不明记录不自动套表。",
      "顶端合并档只保存官方区间，不生成档内伪精确位次。",
    ],
  };
  const payload = {
    dataset: DATASET,
    generatedAt,
    sourceNotes: [sourceNote],
    rankConversions,
    audit: {
      parsedRecords: rankConversions.length,
      rawScoreRows: 1171,
      parsedHistoryRows: 573,
      parsedPhysicsRows: 598,
      usageRecords: { undergraduate: 1171, vocational: 1171 },
      pdfPages: sourceNote.pdfPages,
      duplicateIds: 0,
      duplicateScores: 0,
      scoreGaps: 0,
      cumulativeArithmeticErrors: 0,
      rankUsageBucketDifferences: {
        "历史类": parsed["历史类"].rows.filter((row) => (
          row.undergraduateCumulative !== row.vocationalCumulative
          || row.undergraduatePeople !== row.vocationalPeople
        )).length,
        "物理类": parsed["物理类"].rows.filter((row) => (
          row.undergraduateCumulative !== row.vocationalCumulative
          || row.undergraduatePeople !== row.vocationalPeople
        )).length,
      },
      rankUsageCumulativeDifferences: {
        "历史类": parsed["历史类"].rows.filter((row) => row.undergraduateCumulative !== row.vocationalCumulative).length,
        "物理类": parsed["物理类"].rows.filter((row) => row.undergraduateCumulative !== row.vocationalCumulative).length,
      },
      checkpoints: {
        "历史类": { score600: 5295, floor: 292200 },
        "物理类": { score600: 26988, floor: 440208 },
      },
      mirrorZipByteIdentical: true,
      sourceQuality: SOURCE_QUALITY,
    },
  };
  const out = path.resolve(PROJECT_ROOT, args.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(JSON.stringify({ status: "ok", output: path.relative(PROJECT_ROOT, out), ...payload.audit }, null, 2));
}

main();
