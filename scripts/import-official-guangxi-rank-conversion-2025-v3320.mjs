#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const DEFAULT_RAW = "data/admissions/raw/official-guangxi-rank-conversion-2025-v3320";
const DEFAULT_OUT = "data/admissions/official-guangxi-rank-conversion-2025-v3320-import.json";
const SOURCE_ID = "official-guangxi-rank-2025-v3320";
const PROVINCE = "广西";
const YEAR = 2025;
const CHSI_HISTORY_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250626/2293390995.html";
const CHSI_PHYSICS_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202506/20250626/2293390989.html";
const DXSBB_HISTORY_URL = "https://www.dxsbb.com/news/148824.html";
const DXSBB_PHYSICS_URL = "https://www.dxsbb.com/news/148823.html";
const JHGK_INDEX_URL = "https://www.jhgk.cn/trendDetails.htm?id=68a61ceb-7217-403b-87f9-3a2a958ebe2f";
const POLICY_URL = "https://jyt.gxzf.gov.cn/wmhd/cjwt/t21237773.shtml";
const MOE_LIST_URL = "https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/A03/202506/t20250627_1195683.html";
const MOE_XLS_URL = "https://www.moe.gov.cn/jyb_xxgk/s5743/s5744/A03/202506/W020250729615142156867.xls";
const QUALITY = "official-source-attributed-guangxi-admissions-rank-images-xlsx-html-cross-verified-moe-school-scope";

const EVIDENCE = {
  "2293390990.png": "39dc7fde833616484d075656d24efac9c98205d26fe59afa32c48800ac9b6c98",
  "2293390991.png": "b10c5ad59095b3015ff90d6192fe7521825314d4fa1beff698fd823147783eee",
  "2293390992.png": "4c8c140e76cb4dce87b8bff23fb7f63b59a8d9dab7d9f5222ef45c2403b14d59",
  "2293390993.png": "a57b6c1b4c2de100ca5bcb8ef1f4804aee8b1ffa72375b7b8c8ecf9da639009f",
  "2293390994.png": "75874ac0e358676de01d590e2f3ebb7d8c0116a08f65dce5df979b0c2309e145",
  "2293390996.png": "c18062c15dd0f9b3ffd5db98ecc5d6a8eff304c2427ead87d228886bd5a9a404",
  "2293390997.png": "be20d39d7f588f7d9711e54b8e87326a256cfa269dce133ebe642ef6378c45f1",
  "2293390998.png": "b4b8752c0be8b1de9d9faf9f9ca6abdb01ff3ba88d9ebc58a53bac419c4907bb",
  "2293390999.png": "2b6737b23099f2db96fd446b4cdb5fe02c3047b15423b45b4f683c33a6779698",
  "chsi-history.html": "904ac94f3a70d1e1142a6a70049f96a781d9085c8e2e60bea6644309ade56aa8",
  "chsi-physics.html": "c067669f33301ddbce291929eaaac92d4c272150334c148b3a7593dc5ce315ba",
  "dxsbb-history.html": "5d4fea87291f704b06896aa8fe9786c4797141243ceaf70b01101078b6d26194",
  "dxsbb-physics.html": "86a4e2e69612e0042d15a970b319f0245eaefb1524caa792aa7e78e1251f58e6",
  "history-max.json": "80bdf7500bffd156db502cb874a26d75a6c1094f0309e2f11447c677277725f7",
  "history-max.xlsx": "3690a7604c749d5310c60c1c904cfde551b2a320bf2d09052de5da31ddc7d791",
  "history-national.json": "b0ce5c57e73551be551bbe489c93fe8b922c1338604ae8fd0cd4b4b56a57f350",
  "history-national.xlsx": "f0cfa43f4c1f8b62f0f9824405ee99c48d8407e2713d158d8efff9ed72ee1713",
  "jhgk-index.html": "3052a7c776fd7be07959f21c8a63f797871ad993195ee549da604a19d49230e1",
  "moe-colleges-2025.html": "6b7eb67d44b2a7f440327832e8df89daea8872d20f8f80b14d0b93041d329a11",
  "moe-regular-colleges-2025.json": "06f03561a16c2b94c176493481d8310c830986a20618e42e10360e1da119a20d",
  "moe-regular-colleges-2025.xls": "af6f0192c29fb412b441fb55a13311479d08f861d68257960c5edb2e4dfb55af",
  "physics-max.json": "d40b7d3193afbb38c9d20c73627281b5b9c727409ee3db877024b3eeedf85001",
  "physics-max.xlsx": "17be136993f393d84a0941a83fd6313d2768cf3f8fbc756cd69d694081ace21c",
  "physics-national.json": "3dc361b305257ca15a78ec7f58de4bcb32ce4af41d863ed7c43b738a12dd2db7",
  "physics-national.xlsx": "b03ae89f3f6264059a99766457899c9592080500cc2c7a65c2eb4b511de952c1",
};

const TABLES = [
  {
    key: "history-national",
    subjectType: "历史类",
    scoreBonusScope: "national-bonus-only",
    scoreBonusScopeLabel: "总成绩加全国性加分",
    rankInstitutionScope: "outside-guangxi",
    rankInstitutionScopeLabel: "广西区外院校",
    title: "2025年历史类一分一档表（总分=总成绩+全国性加分）",
    note: "说明：总分=总成绩+全国性加分；人数、累计人数、名次统计均不包含已确定录取的考生。",
    expectedRows: 459,
    first: [658, 1, 11, 11],
    last: [200, 51, 119153, 119103],
    checkpoints: { 600: [44, 1291, 1248], 500: [302, 16708, 16407], 300: [318, 102458, 102141] },
    chsiUrl: CHSI_HISTORY_URL,
    chsiImages: ["https://t2.chei.com.cn/news/img/2293390996.png"],
    mirrorUrl: DXSBB_HISTORY_URL,
    xlsxUrl: "https://www.jhgk.cn/upload/file/20250626/1750921532989052826.xlsx",
  },
  {
    key: "history-max",
    subjectType: "历史类",
    scoreBonusScope: "national-or-local-max",
    scoreBonusScopeLabel: "总成绩加全国性或地方性加分最高分",
    rankInstitutionScope: "inside-guangxi",
    rankInstitutionScopeLabel: "广西区内院校",
    title: "2025年历史类一分一档表（总分=总成绩+全国性加分和地方性加分的最高分）",
    note: "说明：总分=总成绩+全国性加分和地方性加分的最高分；人数、累计人数、名次统计均不包含已确定录取的考生。",
    expectedRows: 459,
    first: [658, 1, 11, 11],
    last: [200, 52, 119161, 119110],
    checkpoints: { 600: [42, 1298, 1257], 500: [298, 16739, 16442], 300: [315, 102510, 102196] },
    chsiUrl: CHSI_HISTORY_URL,
    chsiImages: ["https://t2.chei.com.cn/news/img/2293390997.png", "https://t1.chei.com.cn/news/img/2293390998.png", "https://t1.chei.com.cn/news/img/2293390999.png"],
    mirrorUrl: DXSBB_HISTORY_URL,
    xlsxUrl: "https://www.jhgk.cn/upload/file/20250626/1750921547658070500.xlsx",
  },
  {
    key: "physics-national",
    subjectType: "物理类",
    scoreBonusScope: "national-bonus-only",
    scoreBonusScopeLabel: "总成绩加全国性加分",
    rankInstitutionScope: "outside-guangxi",
    rankInstitutionScopeLabel: "广西区外院校",
    title: "2025年物理类一分一档表（总分=总成绩+全国性加分）",
    note: "说明：总分=总成绩+全国性加分；人数、累计人数、名次统计均不包含已确定录取的考生。",
    expectedRows: 487,
    first: [687, 2, 14, 13],
    last: [200, 80, 260429, 260350],
    checkpoints: { 600: [238, 6442, 6205], 500: [704, 55964, 55261], 300: [634, 231652, 231019] },
    chsiUrl: CHSI_PHYSICS_URL,
    chsiImages: ["https://t3.chei.com.cn/news/img/2293390990.png", "https://t1.chei.com.cn/news/img/2293390991.png"],
    mirrorUrl: DXSBB_PHYSICS_URL,
    xlsxUrl: "https://www.jhgk.cn/upload/file/20250626/1750921596636065073.xlsx",
  },
  {
    key: "physics-max",
    subjectType: "物理类",
    scoreBonusScope: "national-or-local-max",
    scoreBonusScopeLabel: "总成绩加全国性或地方性加分最高分",
    rankInstitutionScope: "inside-guangxi",
    rankInstitutionScopeLabel: "广西区内院校",
    title: "2025年物理类一分一档表（总分=总成绩+全国性加分和地方性加分的最高分）",
    note: "说明：总分=总成绩+全国性加分和地方性加分的最高分；人数、累计人数、名次统计均不包含已确定录取的考生。",
    expectedRows: 487,
    first: [687, 2, 15, 14],
    last: [200, 80, 260440, 260361],
    checkpoints: { 600: [238, 6473, 6236], 500: [709, 56053, 55345], 300: [634, 231722, 231089] },
    chsiUrl: CHSI_PHYSICS_URL,
    chsiImages: ["https://t2.chei.com.cn/news/img/2293390992.png", "https://t2.chei.com.cn/news/img/2293390993.png", "https://t3.chei.com.cn/news/img/2293390994.png"],
    mirrorUrl: DXSBB_PHYSICS_URL,
    xlsxUrl: "https://www.jhgk.cn/upload/file/20250626/1750921565043091497.xlsx",
  },
];

function parseArgs(argv) {
  const args = { raw: DEFAULT_RAW, out: DEFAULT_OUT };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--raw") args.raw = argv[++index];
    else if (argv[index] === "--out") args.out = argv[++index];
    else throw new Error(`Unknown argument: ${argv[index]}`);
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;|\u00a0/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function pngDimensions(bytes) {
  assert(bytes.length >= 24 && bytes.subarray(1, 4).toString("ascii") === "PNG", "Invalid PNG evidence");
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function parseStructuredTable(bytes, config) {
  const source = JSON.parse(bytes.toString("utf8"));
  assert(Array.isArray(source) && source.length === config.expectedRows + 2, `${config.key} structured row count drifted`);
  const titleKey = Object.keys(source[0])[0];
  assert(titleKey === config.title && Object.values(source[0])[0] === config.note, `${config.key} title or note drifted`);
  const header = source[1];
  const keyByLabel = Object.fromEntries(Object.entries(header).map(([key, value]) => [String(value), key]));
  assert(["总分", "人数", "累计人数", "名次"].every((label) => keyByLabel[label]), `${config.key} headers drifted`);
  const rows = source.slice(2).map((row) => ({
    score: Number(row[keyByLabel["总分"]]),
    sameRankScore: Number(row[keyByLabel["人数"]]),
    rankEnd: Number(row[keyByLabel["累计人数"]]),
    rankStart: Number(row[keyByLabel["名次"]]),
  }));
  validateRows(rows, config, "structured XLSX conversion");
  return rows;
}

function parseHtmlTables(html, label) {
  const tables = [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)]
    .map((match) => match[0])
    .filter((table) => cleanText(table).includes("累计人数") && cleanText(table).includes("名次"));
  assert(tables.length === 2, `${label} expected two score tables, got ${tables.length}`);
  return tables.map((table) => {
    const rows = [];
    const firstRow = table.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1] || "";
    const firstCell = firstRow.match(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/i)?.[1] || "";
    for (const match of table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
      const cells = [...match[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)]
        .map((cell) => cleanText(cell[1]).replaceAll(",", ""));
      if (cells.length !== 4 || !cells.every((cell) => /^\d+$/.test(cell))) continue;
      rows.push({ score: Number(cells[0]), sameRankScore: Number(cells[1]), rankEnd: Number(cells[2]), rankStart: Number(cells[3]) });
    }
    return { note: cleanText(firstCell), rows };
  });
}

function validateRows(rows, config, label) {
  assert(rows.length === config.expectedRows, `${config.key} ${label} expected ${config.expectedRows} rows, got ${rows.length}`);
  assert(JSON.stringify(Object.values(rows[0])) === JSON.stringify(config.first), `${config.key} ${label} first row drifted`);
  assert(JSON.stringify(Object.values(rows.at(-1))) === JSON.stringify(config.last), `${config.key} ${label} last row drifted`);
  assert(rows.every((row) => [row.score, row.sameRankScore, row.rankEnd, row.rankStart].every(Number.isInteger)), `${config.key} ${label} has non-integer values`);
  assert(rows.every((row, index) => index === 0 || row.score < rows[index - 1].score), `${config.key} ${label} scores are not strictly descending`);
  assert(rows.every((row) => row.rankStart === row.rankEnd - row.sameRankScore + 1), `${config.key} ${label} rank ranges do not close`);
  assert(rows.every((row, index) => index === 0 || row.rankStart === rows[index - 1].rankEnd + 1), `${config.key} ${label} cumulative ranks are discontinuous`);
  for (const [score, expected] of Object.entries(config.checkpoints)) {
    const row = rows.find((item) => item.score === Number(score));
    assert(row && JSON.stringify([row.sameRankScore, row.rankEnd, row.rankStart]) === JSON.stringify(expected), `${config.key} ${label} checkpoint ${score} drifted`);
  }
}

function compareRows(authority, mirror, config) {
  assert(mirror.note === config.note, `${config.key} mirror note drifted`);
  validateRows(mirror.rows, config, "HTML mirror");
  let cellComparisons = 0;
  for (let index = 0; index < authority.length; index += 1) {
    for (const field of ["score", "sameRankScore", "rankEnd", "rankStart"]) {
      assert(authority[index][field] === mirror.rows[index][field], `${config.key} sources differ at row ${index + 1} field ${field}`);
      cellComparisons += 1;
    }
  }
  return cellComparisons;
}

function makeId(config, score, topBucket = false) {
  const digest = sha256(`${YEAR}|${PROVINCE}|${config.subjectType}|${config.scoreBonusScope}|${score}|${topBucket}|${SOURCE_ID}`).slice(0, 16);
  return `${YEAR}-guangxi-rank-${config.key}-${digest}`;
}

function buildRankConversions(rows, config) {
  const precedingCandidates = rows[0].rankStart - 1;
  assert(precedingCandidates >= 10, `${config.key} withheld top cohort drifted`);
  const shared = {
    province: PROVINCE,
    year: YEAR,
    subjectType: config.subjectType,
    dataType: "rank-conversion",
    sourceId: SOURCE_ID,
    sourceQuality: QUALITY,
    sourceUrl: config.chsiUrl,
    mirrorUrl: config.mirrorUrl,
    mirrorXlsxUrl: config.xlsxUrl,
    policyUrl: POLICY_URL,
    rankInstitutionScope: config.rankInstitutionScope,
    rankInstitutionScopeLabel: config.rankInstitutionScopeLabel,
    scoreBonusScope: config.scoreBonusScope,
    scoreBonusScopeLabel: config.scoreBonusScopeLabel,
    evidenceStage: "ordinary-cohort-excluding-already-admitted-candidates",
  };
  const topScore = rows[0].score + 1;
  const topBucket = {
    ...shared,
    id: makeId(config, topScore, true),
    score: topScore,
    scoreRange: { min: topScore, max: 750 },
    rankStart: 1,
    rankEnd: precedingCandidates,
    sameRankScore: precedingCandidates,
    topWithheldRange: true,
  };
  return [topBucket, ...rows.map((row) => ({
    ...shared,
    id: makeId(config, row.score),
    score: row.score,
    rankStart: row.rankStart,
    rankEnd: row.rankEnd,
    sameRankScore: row.sameRankScore,
  }))];
}

function parseNationalInstitutions(bytes) {
  const rows = JSON.parse(bytes.toString("utf8"));
  const institutions = rows
    .filter((row) => /^\d{10}$/.test(String(row.__EMPTY_1 || "")) && row.__EMPTY && row.__EMPTY_4)
    .map((row) => ({
      schoolName: String(row.__EMPTY),
      schoolCode: String(row.__EMPTY_1).slice(-5),
      schoolIdentifierCode: String(row.__EMPTY_1),
      supervisor: String(row.__EMPTY_2 || ""),
      city: String(row.__EMPTY_3 || ""),
      educationLevel: String(row.__EMPTY_4),
      ownership: row.__EMPTY_5 ? String(row.__EMPTY_5) : "公办",
    }));
  assert(institutions.length === 2919, `Expected 2919 national institutions, got ${institutions.length}`);
  assert(new Set(institutions.map((row) => row.schoolCode)).size === institutions.length, "Duplicate national school codes detected");
  assert(new Set(institutions.map((row) => row.schoolName)).size === institutions.length, "Duplicate national school names detected");
  return institutions;
}

function selectLocalInstitutions(institutions) {
  const local = institutions
    .filter((row) => row.supervisor.startsWith("广西壮族自治区"))
    .map((row) => ({ ...row }));
  assert(local.length === 89, `Expected 89 Guangxi institutions, got ${local.length}`);
  assert(new Set(local.map((row) => row.schoolCode)).size === 89, "Duplicate Guangxi school codes detected");
  assert(new Set(local.map((row) => row.schoolName)).size === 89, "Duplicate Guangxi school names detected");
  assert(local.filter((row) => row.educationLevel === "本科").length === 41, "Guangxi undergraduate count drifted");
  assert(local.filter((row) => row.educationLevel === "专科").length === 48, "Guangxi vocational count drifted");
  return local;
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const rawDir = path.resolve(PROJECT_ROOT, args.raw);
  const outFile = path.resolve(PROJECT_ROOT, args.out);
  const raw = {};
  for (const [name, expectedHash] of Object.entries(EVIDENCE)) {
    const file = path.join(rawDir, name);
    assert(fs.existsSync(file), `Missing evidence file: ${file}`);
    raw[name] = fs.readFileSync(file);
    assert(sha256(raw[name]) === expectedHash, `${name} hash drifted`);
  }

  for (const name of ["history-national.xlsx", "history-max.xlsx", "physics-national.xlsx", "physics-max.xlsx"]) {
    assert(raw[name][0] === 0x50 && raw[name][1] === 0x4b, `${name} is not an OOXML ZIP workbook`);
  }
  assert(raw["moe-regular-colleges-2025.xls"].subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex")), "MOE workbook is not a BIFF compound document");

  const chsiHistory = raw["chsi-history.html"].toString("utf8");
  const chsiPhysics = raw["chsi-physics.html"].toString("utf8");
  assert(cleanText(chsiHistory).includes("来源：广西招生考试院"), "CHSI history authority attribution is missing");
  assert(cleanText(chsiPhysics).includes("来源：广西招生考试院"), "CHSI physics authority attribution is missing");
  for (const config of TABLES) {
    const html = config.subjectType === "历史类" ? chsiHistory : chsiPhysics;
    assert(config.chsiImages.every((url) => html.includes(url)), `${config.key} CHSI image references are missing`);
  }
  const expectedDimensions = {
    "2293390990.png": [420, 822], "2293390991.png": [424, 11370], "2293390992.png": [418, 108],
    "2293390993.png": [421, 12116], "2293390994.png": [436, 182], "2293390996.png": [421, 11470],
    "2293390997.png": [413, 130], "2293390998.png": [418, 11560], "2293390999.png": [423, 32],
  };
  for (const [name, [width, height]] of Object.entries(expectedDimensions)) {
    assert(JSON.stringify(pngDimensions(raw[name])) === JSON.stringify({ width, height }), `${name} dimensions drifted`);
  }

  const htmlMirrors = {
    "历史类": parseHtmlTables(raw["dxsbb-history.html"].toString("utf8"), "history mirror"),
    "物理类": parseHtmlTables(raw["dxsbb-physics.html"].toString("utf8"), "physics mirror"),
  };
  const tableBySubjectIndex = { "history-national": 0, "history-max": 1, "physics-national": 0, "physics-max": 1 };
  let publishedRows = 0;
  let cellComparisons = 0;
  const built = TABLES.map((config) => {
    const authority = parseStructuredTable(raw[`${config.key}.json`], config);
    const mirror = htmlMirrors[config.subjectType][tableBySubjectIndex[config.key]];
    cellComparisons += compareRows(authority, mirror, config);
    publishedRows += authority.length;
    return { config, authority, rankConversions: buildRankConversions(authority, config) };
  });
  assert(publishedRows === 1892 && cellComparisons === 7568, "Guangxi source comparison totals drifted");

  const jhgkHtml = raw["jhgk-index.html"].toString("utf8");
  assert(TABLES.every((config) => jhgkHtml.includes(new URL(config.xlsxUrl).pathname)), "JHGK XLSX inventory drifted");
  const moeHtml = raw["moe-colleges-2025.html"].toString("utf8");
  assert(cleanText(moeHtml).includes("截至2025年6月20日") && moeHtml.includes("W020250729615142156867.xls"), "MOE college-list page drifted");
  const nationalInstitutions = parseNationalInstitutions(raw["moe-regular-colleges-2025.json"]);
  const localInstitutions = selectLocalInstitutions(nationalInstitutions);

  const rankConversions = built.flatMap((item) => item.rankConversions);
  assert(rankConversions.length === 1896, `Expected 1896 emitted rank rows, got ${rankConversions.length}`);
  assert(new Set(rankConversions.map((row) => row.id)).size === rankConversions.length, "Duplicate Guangxi rank conversion IDs detected");
  assert(rankConversions.filter((row) => row.topWithheldRange).length === 4, "Guangxi top bucket count drifted");

  const generatedAt = new Date().toISOString();
  const sourceNote = {
    id: SOURCE_ID,
    title: "广西2025年普通高考普通类一分一档表（历史/物理，区内/区外双加分口径）",
    publisher: "广西招生考试院",
    province: PROVINCE,
    year: YEAR,
    url: CHSI_HISTORY_URL,
    physicsUrl: CHSI_PHYSICS_URL,
    policyUrl: POLICY_URL,
    schoolScopeUrl: MOE_LIST_URL,
    schoolScopeWorkbookUrl: MOE_XLS_URL,
    quality: QUALITY,
    usage: "用于把广西2025同科类整数最低分或考生分数换算为省级位次区间；区外院校使用全国性加分表，区内院校使用全国性/地方性加分取最高表，不混用两种位次口径，也不冒充院校原表直接公布的最低位次。",
    parsedRecords: rankConversions.length,
    publishedRows,
    subjectBreakdown: { 历史类: 920, 物理类: 976 },
    bonusScopeBreakdown: { "national-bonus-only": 948, "national-or-local-max": 948 },
    schoolScopeEvidence: { nationalInstitutions: 2919, guangxiInstitutions: 89, undergraduate: 41, vocational: 48 },
    provenance: {
      chsiHistoryUrl: CHSI_HISTORY_URL,
      chsiPhysicsUrl: CHSI_PHYSICS_URL,
      chsiAuthorityAttributionVerified: true,
      dxsbbHistoryUrl: DXSBB_HISTORY_URL,
      dxsbbPhysicsUrl: DXSBB_PHYSICS_URL,
      jhgkIndexUrl: JHGK_INDEX_URL,
      xlsxHtmlRowComparisons: publishedRows,
      xlsxHtmlCellComparisons: cellComparisons,
      xlsxHtmlDifferences: 0,
      policyUrl: POLICY_URL,
      moeListUrl: MOE_LIST_URL,
      moeWorkbookUrl: MOE_XLS_URL,
    },
    cautions: [
      "表中人数、累计人数和名次均不包含已确定录取的考生。",
      "首批高位考生按官方隐私规则未逐分公开，本导入仅保留官方累计人数能确定的合并位次区间。",
      "全国性加分适用于区外院校；区内院校按全国性加分和地方性加分中最高一项计入总分。",
      "最低分换算位次不是院校投档表原生公布的最低位次，正式填报前仍须核验当年考试院表、招生计划和院校章程。",
    ],
  };

  const payload = {
    dataset: "official-guangxi-rank-conversion-2025-v3320-import",
    generatedAt,
    sourceNotes: [sourceNote],
    nationalInstitutions,
    localInstitutions,
    rankConversions,
    audit: {
      parsedRecords: rankConversions.length,
      publishedRows,
      topBuckets: 4,
      duplicateIds: rankConversions.length - new Set(rankConversions.map((row) => row.id)).size,
      rowComparisons: publishedRows,
      cellComparisons,
      sourceDifferences: 0,
      nationalInstitutionCount: nationalInstitutions.length,
      localInstitutionCount: localInstitutions.length,
      evidenceSha256: Object.fromEntries(Object.entries(raw).map(([name, bytes]) => [name, sha256(bytes)])),
    },
  };
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ status: "ok", out: path.relative(PROJECT_ROOT, outFile), rankConversions: rankConversions.length, publishedRows, cellComparisons, nationalInstitutions: nationalInstitutions.length, localInstitutions: localInstitutions.length }, null, 2));
}

main();
