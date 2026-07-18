#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.312-xinjiang-official-2025-undergraduate2-score-only-868426records";
const NEXT_VERSION = "local-deterministic-v3.314-ningxia-official-rank2025-aligned-868426records";
const SOURCE_ID = "official-ningxia-rank-2025-v3314";
const FILING_SOURCE_ID = "official-ningxia-undergraduate-b-2025";
const PROVINCE = "宁夏";
const YEAR = 2025;
const BASE_RANKS = 116656;
const ADDED_RANKS = 959;
const NEXT_RANKS = 117615;
const RECORDS = 868426;
const LINKED_RECORDS = 2491;
const FILING_URL = "https://www.nxjyks.cn/contents/PTGK/PTGK_PTGK/2025/07/20250720162722000.html";

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-ningxia-rank-conversion-2025-v3314-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-ningxia-rank-conversion-2025-v3314-runtime-manifest.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--import") args.importFile = argv[++index];
    else if (argv[index] === "--release") args.releaseDir = argv[++index];
    else if (argv[index] === "--runtime-manifest") args.runtimeManifest = argv[++index];
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

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function gzipBytes(value) {
  return zlib.gzipSync(value, { level: 9, mtime: 0 });
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))]
    .sort((left, right) => String(left).localeCompare(String(right), "zh-CN"));
}

function refreshReadiness(container, shard) {
  const row = container?.rows?.find((item) => item.province === PROVINCE);
  if (!row) return;
  row.records = shard.records.length;
  row.rankConversionRecords = shard.rankConversions.length;
  row.officialRankRecords = shard.rankConversions.filter((record) => String(record.sourceQuality || "").startsWith("official")).length;
  row.officialRecords = shard.records.filter((record) => String(record.sourceQuality || "").startsWith("official")).length;
  row.officialEvidenceRecords = row.officialRecords + row.officialRankRecords;
  row.rankParsedSource = row.rankConversionRecords > 0;
  row.majorWithRank = shard.records.filter((record) => record.dataType === "major-admission" && Number(record.minRankEnd || record.minRank) > 0).length;
  row.majorWithScoreDerivedRank = shard.records.filter((record) => record.dataType === "major-admission" && record.rankDerivedFromScore === true).length;
  row.institutionWithRank = shard.records.filter((record) => record.dataType === "institution-admission" && Number(record.minRankEnd || record.minRank) > 0).length;
  row.institutionWithScoreDerivedRank = shard.records.filter((record) => record.dataType === "institution-admission" && record.rankDerivedFromScore === true).length;
}

function addSorted(container, key, value, { numeric = false } = {}) {
  container[key] = sortedUnique([...(container[key] || []), value]);
  if (numeric) container[key] = container[key].map(Number).sort((left, right) => left - right);
}

function updateRankSourceCoverage(coverage) {
  coverage.sources = Number(coverage.sources || 0) + 1;
  coverage.parsedSources = Number(coverage.parsedSources || 0) + 1;
  coverage.parsedRecords = Number(coverage.parsedRecords || 0) + ADDED_RANKS;
  addSorted(coverage, "provinces", PROVINCE);
  addSorted(coverage, "parsedProvinces", PROVINCE);
  addSorted(coverage, "years", YEAR, { numeric: true });
  addSorted(coverage, "parsedYears", YEAR, { numeric: true });
  addSorted(coverage, "subjects", "历史类");
  addSorted(coverage, "subjects", "物理类");
  const yearRow = coverage.byYear?.find((row) => Number(row.year) === YEAR);
  assert(yearRow, "2025 rank source coverage row is missing");
  yearRow.sources = Number(yearRow.sources || 0) + 1;
  yearRow.parsedSources = Number(yearRow.parsedSources || 0) + 1;
  yearRow.parsedRecords = Number(yearRow.parsedRecords || 0) + ADDED_RANKS;
  addSorted(yearRow, "provinces", PROVINCE);
  addSorted(yearRow, "parsedProvinces", PROVINCE);
}

function verifyImport(payload) {
  assert(payload.dataset === "official-ningxia-rank-conversion-2025-v3314-import", `Unexpected dataset ${payload.dataset}`);
  assert(payload.sourceNotes?.length === 1 && payload.sourceNotes[0].id === SOURCE_ID, "Ningxia source note mismatch");
  assert(payload.rankConversions?.length === ADDED_RANKS, `Expected ${ADDED_RANKS} rank rows`);
  assert(payload.audit?.parsedRecords === ADDED_RANKS && payload.audit?.duplicateIds === 0, "Ningxia import audit drifted");
  assert(payload.rankConversions.filter((row) => row.subjectType === "历史类").length === 467, "History row count drifted");
  assert(payload.rankConversions.filter((row) => row.subjectType === "物理类").length === 492, "Physics row count drifted");
  assert(payload.rankConversions.every((row) => row.province === PROVINCE && row.year === YEAR && row.sourceId === SOURCE_ID), "Import contains out-of-scope rows");
}

function mapFilingRecord(record, rankIndex, topBySubject, sourceNote) {
  const score = Number(record.minScore);
  const exact = rankIndex.get(`${record.subjectType}|${score}`);
  const top = topBySubject.get(record.subjectType);
  const rank = exact || (top && score > top.score ? top : null);
  assert(rank, `No ${record.subjectType} rank mapping for ${record.schoolName} ${record.minScore}`);
  const isTopBucket = rank.scoreRange && score >= rank.score;
  const rankRangeText = rank.rankStart === rank.rankEnd
    ? `${rank.rankEnd}`
    : `${rank.rankStart}-${rank.rankEnd}`;
  const replacementCaution = `原投档表不含最低位次；本条位次由同年宁夏官方一分一段表按最低分换算为${rankRangeText}名，属于全省分数段区间，不是院校原表直接公布的录取最低位次。`;
  const cautions = (record.cautions || []).map((caution) => (
    caution.includes("原表只公开已投考生最低分和同分排序项") ? replacementCaution : caution
  ));
  if (!cautions.includes(replacementCaution)) cautions.splice(1, 0, replacementCaution);
  if (isTopBucket) cautions.push(`该分数落在官方最高分合并档，仅可确定为${rankRangeText}名，不生成合并档内的伪精确位次。`);
  return {
    ...record,
    sourceUrl: FILING_URL,
    sourceQuality: "official-ningxia-undergraduate-b-2025-pdf-with-score-derived-provincial-rank",
    scoreOnly: false,
    rankUnavailable: false,
    nativeAdmissionRankUnavailable: true,
    rankDerivedFromScore: true,
    rankEvidenceScope: "score-derived-provincial-segment",
    minRank: rank.rankEnd,
    minRankStart: rank.rankStart,
    minRankEnd: rank.rankEnd,
    scoreDerivedRank: rank.rankEnd,
    rankRangeText: `${rankRangeText}（最低分换算）`,
    scoreMetric: "宁夏教育考试院本科批B段院校专业组投档最低分",
    rankMetric: "最低分对应同年同科类全省累计位次区间（非院校原表直接公布位次）",
    rankDisclaimer: "该位次由院校专业组投档最低分对应宁夏2025一分一段表换算，不是院校原表直接公布的录取最低位次。",
    rankSourceId: SOURCE_ID,
    rankSourceUrl: sourceNote.url,
    rankSourceAttachmentUrl: rank.attachmentUrl,
    cautions,
  };
}

function main() {
  if (PROJECT_ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const importFile = path.resolve(PROJECT_ROOT, args.importFile);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  verifyImport(payload);

  if (core.modelVersion === NEXT_VERSION) {
    const item = manifest.shards[PROVINCE];
    const shard = readGzipJson(path.join(releaseDir, `${path.basename(item.file, ".json")}.json.gz`));
    assert(shard.rankConversions.filter((row) => row.sourceId === SOURCE_ID).length === ADDED_RANKS, "Already-applied rank rows drifted");
    assert(shard.records.filter((row) => row.sourceId === FILING_SOURCE_ID && row.rankSourceId === SOURCE_ID).length === LINKED_RECORDS, "Already-applied filing links drifted");
    console.log(JSON.stringify({ status: "already-applied", modelVersion: NEXT_VERSION, rankConversionCount: manifest.rankConversionCount }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected core ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION && manifest.recordCount === RECORDS && manifest.rankConversionCount === BASE_RANKS, "Base manifest drifted");
  assert(core.admissionScoreLayer.structuredRecords === RECORDS && core.admissionScoreLayer.rankConversionRecords === BASE_RANKS, "Base core counts drifted");
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} already exists`);

  const item = manifest.shards[PROVINCE];
  assert(item, "Ningxia runtime shard is missing");
  const slug = path.basename(item.file, ".json");
  const shardFile = path.join(releaseDir, `${slug}.json.gz`);
  const shard = readGzipJson(shardFile);
  assert(shard.records.length === item.records && shard.rankConversions.length === item.rankConversions, "Ningxia shard counts drifted before merge");
  assert(!shard.rankConversions.some((row) => row.sourceId === SOURCE_ID), "Ningxia v3.314 ranks already exist");

  const sourceNote = { ...payload.sourceNotes[0], file: args.importFile };
  const rankIndex = new Map(payload.rankConversions.map((row) => [`${row.subjectType}|${row.score}`, row]));
  const topBySubject = new Map(payload.rankConversions.filter((row) => row.scoreRange).map((row) => [row.subjectType, row]));
  let linkedRecords = 0;
  let ordinaryLinked = 0;
  let specialLinked = 0;
  let topBucketLinked = 0;
  shard.records = shard.records.map((record) => {
    if (record.sourceId !== FILING_SOURCE_ID) return record;
    const mapped = mapFilingRecord(record, rankIndex, topBySubject, sourceNote);
    linkedRecords += 1;
    if (mapped.formalScoreScope === "ordinary") ordinaryLinked += 1;
    else specialLinked += 1;
    if (mapped.minRankStart === 1) topBucketLinked += 1;
    return mapped;
  });
  assert(linkedRecords === LINKED_RECORDS, `Expected ${LINKED_RECORDS} linked filing records, got ${linkedRecords}`);
  assert(ordinaryLinked === 2153 && specialLinked === 338, "Ordinary/special filing split drifted");
  assert(topBucketLinked === 18, `Expected 18 top-bucket filing rows, got ${topBucketLinked}`);

  shard.rankConversions.push(...payload.rankConversions);
  shard.rankConversions.sort((left, right) => (
    Number(right.year) - Number(left.year)
    || String(left.subjectType).localeCompare(String(right.subjectType), "zh-CN")
    || Number(right.score) - Number(left.score)
  ));
  shard.generatedAt = payload.generatedAt;
  assert(shard.rankConversions.length === 1919, "Ningxia rank count drifted after merge");

  const layer = core.admissionScoreLayer;
  const filingNote = layer.sourceNotes.find((note) => note.id === FILING_SOURCE_ID);
  assert(filingNote, "Ningxia undergraduate B source note is missing");
  core.generatedAt = payload.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  layer.rankConversionRecords = NEXT_RANKS;
  layer.statusLabel = `已接入${RECORDS}条结构化录取/计划数据 + ${NEXT_RANKS}条一分一段记录`;
  layer.currentFinding = "新增宁夏教育考试院2025年历史类467条、物理类492条官方一分一段记录，并把2491条本科批B段院校专业组投档最低分对齐到同年同科类省级位次区间。2153条普通类可按位次跨年比较，338条专项、预科和民族班继续隔离；原投档表未直接公布最低位次，全部明确标注为分数换算位次，最高分合并档只保留区间。";
  layer.downgradeReason = `当前数据层 ${NEXT_VERSION} 严格区分院校原生最低位次与最低分换算的省级分数段位次；宁夏2025本科批B段只使用同年同科类官方表换算，特殊路径不与普通类混排，最高分合并档不生成伪精确名次。`;
  layer.sourceNotes.push(sourceNote);
  layer.availableEvidenceIds = sortedUnique([...(layer.availableEvidenceIds || []), SOURCE_ID]);
  layer.rankCoverage.records = NEXT_RANKS;
  addSorted(layer.rankCoverage, "provinces", PROVINCE);
  addSorted(layer.rankCoverage, "years", YEAR, { numeric: true });
  addSorted(layer.rankCoverage, "subjects", "历史类");
  addSorted(layer.rankCoverage, "subjects", "物理类");
  updateRankSourceCoverage(layer.rankSourceCoverage);
  layer.coverage.rankConversionRecords = NEXT_RANKS;

  filingNote.quality = "official-ningxia-undergraduate-b-2025-pdf-with-score-derived-provincial-rank";
  filingNote.usage = "宁夏2025本科批B段官方PDF院校专业组投档线2491条；原表不含最低位次，现按同年同科类官方一分一段表换算省级位次区间，普通类与特殊路径继续隔离。";
  filingNote.scoreDerivedRankRecords = LINKED_RECORDS;
  filingNote.nativeRankPublishedRecords = 0;
  filingNote.rankSourceId = SOURCE_ID;
  filingNote.rankSourceUrl = sourceNote.url;
  filingNote.rankEvidenceScope = "score-derived-provincial-segment";
  filingNote.evidenceBoundary = "The filing PDF publishes minimum scores but no native minimum ranks. All linked ranks are score-derived provincial segment ranges from the separate 2025 official rank tables.";

  refreshReadiness(layer.provinceReadiness, shard);
  refreshReadiness(layer.coverage.provinceReadiness, shard);

  const shardBytes = encodeJson(shard);
  const coreBytes = encodeJson(core);
  manifest.generatedAt = payload.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.rankConversionCount = NEXT_RANKS;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.314",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };
  item.rankConversions = shard.rankConversions.length;
  item.bytes = shardBytes.byteLength;
  item.sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);

  const tempDir = path.join(releaseDir, `.v3314-${process.pid}`);
  fs.mkdirSync(tempDir, { recursive: true });
  const shardTemp = path.join(tempDir, `${slug}.json.gz`);
  const coreTemp = path.join(tempDir, "knowledge-core.json.gz");
  const manifestTemp = path.join(tempDir, "manifest.json.gz");
  fs.writeFileSync(shardTemp, gzipBytes(shardBytes));
  fs.writeFileSync(coreTemp, gzipBytes(coreBytes));
  fs.writeFileSync(manifestTemp, gzipBytes(manifestBytes));
  fs.renameSync(shardTemp, shardFile);
  fs.renameSync(coreTemp, coreFile);
  fs.renameSync(manifestTemp, manifestFile);
  fs.rmdirSync(tempDir);

  const runtimeManifest = {
    dataset: "official-ningxia-rank-conversion-2025-v3314-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    filingSourceId: FILING_SOURCE_ID,
    importFile: args.importFile,
    releaseDir: args.releaseDir,
    before: { modelVersion: BASE_VERSION, records: RECORDS, rankConversions: BASE_RANKS, provinceRankConversions: 960 },
    after: {
      modelVersion: NEXT_VERSION,
      records: RECORDS,
      rankConversions: NEXT_RANKS,
      rankConversionsAdded: ADDED_RANKS,
      provinceRecords: shard.records.length,
      provinceRankConversions: shard.rankConversions.length,
      linkedFilingRecords: linkedRecords,
      ordinaryLinkedRecords: ordinaryLinked,
      specialPathLinkedRecords: specialLinked,
      topBucketLinkedRecords: topBucketLinked,
      sourceNotes: layer.sourceNotes.length,
      shardBytes: shardBytes.byteLength,
      shardSha256: sha256(shardBytes),
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      manifestBytesBeforeLiteRebuild: manifestBytes.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestBytes),
    },
    cautions: payload.notes,
  };
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({
    status: "applied",
    modelVersion: NEXT_VERSION,
    records: RECORDS,
    rankConversions: NEXT_RANKS,
    linkedFilingRecords: linkedRecords,
    ordinaryLinkedRecords: ordinaryLinked,
    specialPathLinkedRecords: specialLinked,
    topBucketLinkedRecords: topBucketLinked,
    sourceNotes: layer.sourceNotes.length,
    shardSha256: runtimeManifest.after.shardSha256,
    coreSha256: runtimeManifest.after.coreSha256,
  }, null, 2));
}

main();
