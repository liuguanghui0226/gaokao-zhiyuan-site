#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.302-qinghai-control-lines2026-language-thresholds-and-rank-provenance-847152records";
const NEXT_VERSION = "local-deterministic-v3.303-shanxi-control-lines2026-pending-vocational-and-rank-provenance-847184records";
const SOURCE_ID = "official-shanxi-control-lines-2026";
const RANK_SOURCE_ID = "official-shanxi-rank-2026";
const RANK_INDEX_URL = "https://gaokao.chsi.com.cn/gkxx/zc/ss/202606/20260626/2293847320.html";
const EOL_RANK_URL = "https://www.eol.cn/kaoshi/gaokao/fsx/202606/t20260626_2749513.shtml";
const RANK_URLS = {
  "历史类": "http://www.sxkszx.cn/news/2026625/n5905127212.html",
  "物理类": "http://www.sxkszx.cn/news/2026625/n2816127213.html",
};
const EXPECTED_RECORDS = 32;
const EXPECTED_RANK_ROWS = 555;
const EXPECTED_SHARD_RANK_ROWS = 1070;
const EXPECTED_NEW_RECORD_COUNT = 847184;
const EXPECTED_NEW_SHARD_RECORDS = 19944;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-shanxi-control-lines-2026-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-shanxi-control-lines-2026-v3303-runtime-manifest.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--import") args.importFile = argv[++index];
    else if (argv[index] === "--release") args.releaseDir = argv[++index];
    else if (argv[index] === "--runtime-manifest") args.runtimeManifest = argv[++index];
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

function compact(value) {
  if (Array.isArray(value)) return value.map(compact).filter((item) => item !== undefined && item !== "" && (!Array.isArray(item) || item.length));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .map(([key, item]) => [key, compact(item)])
      .filter(([, item]) => item !== undefined && item !== null && item !== "" && (!Array.isArray(item) || item.length)));
  }
  return value;
}

function increment(map, key, amount) {
  map[key] = Number(map[key] || 0) + amount;
}

function addLowBands(target, records) {
  for (const record of records) {
    const score = Number(record.minScore);
    if (!Number.isFinite(score)) continue;
    if (score < 200) target.below200 = Number(target.below200 || 0) + 1;
    if (score < 250) target.below250 = Number(target.below250 || 0) + 1;
    if (score < 300) target.below300 = Number(target.below300 || 0) + 1;
    if (score < 500) target.below500 = Number(target.below500 || 0) + 1;
  }
}

function sortedUnique(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))]
    .sort((left, right) => String(left).localeCompare(String(right), "zh-CN"));
}

function countBy(records, field) {
  const counts = {};
  for (const record of records) increment(counts, record[field] || "unknown", 1);
  return counts;
}

function refreshReadiness(container, records, rankConversions) {
  const row = container?.rows?.find((item) => item.province === "山西");
  assert(row, "Shanxi province-readiness row is missing");
  row.records = records.length;
  row.schools = sortedUnique(records.map((record) => record.schoolName)).length;
  row.years = sortedUnique(records.map((record) => Number(record.year))).sort((left, right) => right - left);
  row.subjects = sortedUnique(records.map((record) => record.subjectType));
  row.dataTypes = countBy(records, "dataType");
  row.officialRecords = records.filter((record) => /official/.test(String(record.sourceQuality || ""))).length;
  row.rankConversionRecords = rankConversions.length;
  row.officialEvidenceRecords = row.officialRecords + Number(row.officialRankRecords || 0);
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function atomicWriteGzip(file, uncompressedBytes) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, zlib.gzipSync(uncompressedBytes, { level: 9, mtime: 0 }));
  fs.renameSync(temporary, file);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function targetRankRows(shard) {
  return shard.rankConversions.filter((record) => record.year === 2026 && record.sourceId === RANK_SOURCE_ID);
}

function rankAt(rows, subjectType, score) {
  return rows.find((record) => record.subjectType === subjectType && record.score === score);
}

function patchRankSourceNote(core, sourceEvidence, rows) {
  const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === RANK_SOURCE_ID);
  assert(note, "Official Shanxi rank source note is missing");
  assert(note.parsedRecords === EXPECTED_RANK_ROWS, `Unexpected Shanxi parsed rank rows: ${note.parsedRecords}`);
  assert(note.quality === "official-shanxi-rank-conversion-html-table", `Shanxi rank quality drifted: ${note.quality}`);
  assert(note.pageUrls?.includes(RANK_URLS["历史类"]) && note.pageUrls?.includes(RANK_URLS["物理类"]), "Shanxi official page URLs drifted");
  assert(note.subjects?.find((row) => row.subjectType === "历史类")?.records === 260, "Shanxi history rank inventory drifted");
  assert(note.subjects?.find((row) => row.subjectType === "物理类")?.records === 295, "Shanxi physics rank inventory drifted");
  assert(note.omittedZeroCountScoreGaps === 0, "Shanxi rank gap inventory drifted");

  const crossCheck = sourceEvidence.rankEvidence.controlBoundaryCrossCheck;
  for (const [key, checkpoints] of Object.entries(crossCheck)) {
    const subjectType = key === "history" ? "历史类" : "物理类";
    for (const label of ["bachelor", "special"]) {
      const score = checkpoints[`${label}Score`];
      assert(rankAt(rows, subjectType, score)?.rankEnd === checkpoints[`${label}RankEnd`], `Shanxi ${subjectType}/${score} rank cross-check drifted`);
    }
    assert(rankAt(rows, subjectType, 600)?.rankEnd === checkpoints.score600RankEnd, `Shanxi ${subjectType}/600 checkpoint drifted`);
  }

  note.relatedUrls = sortedUnique([...(note.relatedUrls || []), RANK_INDEX_URL, EOL_RANK_URL, sourceEvidence.url, ...(sourceEvidence.relatedUrls || [])]);
  note.chsiIndexUrl = RANK_INDEX_URL;
  note.controlBoundaryCrossCheck = {
    url: sourceEvidence.url,
    evidenceQuality: sourceEvidence.quality,
    verifiedAt: "2026-07-17",
    ...crossCheck,
  };
  note.provenanceRevision = {
    verifiedAt: "2026-07-17",
    finding: "阳光高考索引确认山西招生考试网历史/物理科类页；运行层保留的555条位次与教育在线转载的两张完整表逐行零差异并通过名次连续性检查。本轮只补科类官方页URL，位次数值和既有顶端区间不变。当前官方站HTTPS直连超时、HTTP返回403，保留此前库存官方页字节数与SHA-256，不冒充本轮重新下载成功。",
    rankRowsLinked: EXPECTED_RANK_ROWS,
    rowsFullCorroborationCrossChecked: EXPECTED_RANK_ROWS,
    rowsContinuityChecked: EXPECTED_RANK_ROWS,
    checkpointCount: 8,
    omittedZeroCountScoreGaps: 0,
    topBucketRangeRepairs: 0,
    valueChanges: 0,
    directOfficialPageRedownloadStatus: "blocked-current-session-tls-and-http-403",
    chsiOfficialLinkIndexRetrievalStatus: "success",
    corroborationMirrorRetrievalStatus: "success",
    verificationScope: "CHSI official-link index plus retained official-page hashes plus EOL full 555-row table corroboration; rank values unchanged",
    officialFiles: Object.fromEntries(note.subjects.map((subject) => [subject.subjectType, {
      url: subject.url,
      rows: subject.records,
      bytes: subject.bytes,
      sha256: subject.sha256,
    }])),
    corroborationFile: {
      url: EOL_RANK_URL,
      rows: EXPECTED_RANK_ROWS,
      bytes: sourceEvidence.evidence.eolRankCorroboration.bytes,
      sha256: sourceEvidence.evidence.eolRankCorroboration.sha256,
    },
  };
}

function verifyAlreadyApplied({ core, manifest, shard }) {
  const sourceRecords = shard.records.filter((record) => record.sourceId === SOURCE_ID);
  const rows = targetRankRows(shard);
  const rankNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === RANK_SOURCE_ID);
  assert(core.modelVersion === NEXT_VERSION, `Unexpected model version: ${core.modelVersion}`);
  assert(manifest.modelVersion === NEXT_VERSION, "Manifest model version drift");
  assert(manifest.recordCount === EXPECTED_NEW_RECORD_COUNT, "Manifest record count drift");
  assert(sourceRecords.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} Shanxi control records`);
  assert(rows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} Shanxi rank rows`);
  assert(rows.every((record) => record.sourceUrl === RANK_URLS[record.subjectType]), "Shanxi rank source URL repair drifted");
  assert(rankNote?.provenanceRevision?.rowsFullCorroborationCrossChecked === EXPECTED_RANK_ROWS, "Shanxi rank provenance drifted");
  return { sourceRecords, rows };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const importFile = path.resolve(PROJECT_ROOT, args.importFile);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const shardFile = path.join(releaseDir, "shanxi.json.gz");
  const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const shard = readGzipJson(shardFile);
  const sourceEvidence = payload.sourceNotes?.[0];

  assert(payload.dataset === "official-shanxi-control-lines-2026-import", `Unexpected import dataset: ${payload.dataset}`);
  assert(payload.records?.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} imported records`);
  assert(payload.sourceNotes?.length === 1 && sourceEvidence.id === SOURCE_ID, "Import source note mismatch");
  assert(payload.records.every((record) => record.province === "山西" && record.year === 2026 && record.dataType === "control-line" && record.sourceId === SOURCE_ID), "Import contains an out-of-scope record");
  assert(new Set(payload.records.map((record) => record.id)).size === EXPECTED_RECORDS, "Import contains duplicate ids");
  assert(payload.records.filter((record) => record.formalScoreScope === "control-line-only").length === 2, "Expected two ordinary Shanxi records");
  assert(payload.records.filter((record) => record.formalScoreScope === "special-path-only").length === 30, "Expected 30 Shanxi special-path records");
  assert(payload.records.filter((record) => Number.isFinite(record.professionalMinScore)).length === 26, "Expected 26 Shanxi numeric professional thresholds");
  assert(payload.records.filter((record) => record.professionalQualification).length === 2, "Expected two Shanxi school-exam qualification rows");
  assert(payload.records.every((record) => record.scoreMaximum === 750), "Shanxi control records must retain the 750-point score scale");
  assert(sourceEvidence.ordinaryVocationalStatus === "pending-official-release", "Shanxi vocational status must remain pending");

  if (core.modelVersion === NEXT_VERSION) {
    const prior = verifyAlreadyApplied({ core, manifest, shard });
    console.log(JSON.stringify({ status: "already-applied", modelVersion: core.modelVersion, sourceRecords: prior.sourceRecords.length, rankSourceUrlRecords: prior.rows.length }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected base model ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION, `Refusing to merge on unexpected manifest ${manifest.modelVersion}`);
  assert(manifest.recordCount === 847152, `Unexpected base record count ${manifest.recordCount}`);
  assert(manifest.rankConversionCount === 116656, `Unexpected rank-conversion count ${manifest.rankConversionCount}`);
  assert(manifest.shards?.["山西"]?.records === 19912, `Unexpected Shanxi base count ${manifest.shards?.["山西"]?.records}`);
  assert(manifest.shards?.["山西"]?.rankConversions === EXPECTED_SHARD_RANK_ROWS, "Unexpected Shanxi rank-conversion manifest count");
  assert(shard.rankConversions?.length === EXPECTED_SHARD_RANK_ROWS, `Unexpected Shanxi rank-conversion count ${shard.rankConversions?.length}`);
  assert(!shard.records.some((record) => record.sourceId === SOURCE_ID), `${SOURCE_ID} already exists`);
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} source note already exists`);

  const rows = targetRankRows(shard);
  assert(rows.length === EXPECTED_RANK_ROWS, `Expected ${EXPECTED_RANK_ROWS} official Shanxi rank rows`);
  assert(rows.every((record) => !record.sourceUrl), "Expected all Shanxi rank rows to need URL repair");
  assert(rows.filter((record) => record.scoreRange?.max === 750).length === 2, "Expected two existing Shanxi top-bucket ranges");
  const existingSchoolNames = new Set(core.admissionScoreLayer.coverage.schools);
  const beforeRankValues = rows.map((record) => [record.id, record.score, record.scoreRange, record.rankStart, record.rankEnd, record.sameRankScore, record.sourceQuality]);
  const before = {
    modelVersion: core.modelVersion,
    recordCount: manifest.recordCount,
    shanxiRecords: shard.records.length,
    rankConversions: shard.rankConversions.length,
    rankRowsMissingSourceUrl: rows.filter((record) => !record.sourceUrl).length,
    topBucketRangesPresent: rows.filter((record) => record.scoreRange?.max === 750).length,
    coreSha256: sha256(zlib.gunzipSync(fs.readFileSync(coreFile))),
    shanxiSha256: sha256(zlib.gunzipSync(fs.readFileSync(shardFile))),
  };

  const records = payload.records.map(compact);
  shard.records.push(...records);
  for (const record of rows) record.sourceUrl = RANK_URLS[record.subjectType];
  assert(JSON.stringify(beforeRankValues) === JSON.stringify(rows.map((record) => [record.id, record.score, record.scoreRange, record.rankStart, record.rankEnd, record.sameRankScore, record.sourceQuality])), "Shanxi rank values changed during provenance repair");
  shard.generatedAt = payload.generatedAt;
  patchRankSourceNote(core, sourceEvidence, rows);

  const layer = core.admissionScoreLayer;
  const coverage = layer.coverage;
  const newCount = Number(layer.structuredRecords) + records.length;
  assert(newCount === EXPECTED_NEW_RECORD_COUNT, `Unexpected merged record count ${newCount}`);
  core.generatedAt = payload.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.browserRuntime.fullMasterRecords = newCount;
  layer.structuredRecords = newCount;
  layer.statusLabel = `已接入${newCount}条结构化录取/计划数据 + ${layer.rankConversionRecords}条一分一段记录`;
  layer.currentFinding = "山西2026普通历史/物理本科409/401分进入普通本科资格路由；普通专科线尚未发布，线下只作置信C路径调研。特殊类型、艺术和体育30条保持特殊路径；艺体26条数值专业线与文化线分列，校考2条只保存合格要求。555条普通类位次经官方链接索引、库存官方页哈希和完整双表逐行交叉复核，数值零改动并补科类官方页URL。";
  layer.sourceNotes.push(sourceEvidence);

  coverage.files = Number(coverage.files) + 1;
  coverage.rawRecords = Number(coverage.rawRecords) + records.length;
  coverage.records = Number(coverage.records) + records.length;
  increment(coverage.dataTypes, "control-line", records.length);
  coverage.schools = sortedUnique([...coverage.schools, ...records.map((record) => record.schoolName)]);
  coverage.schoolTags = sortedUnique([...coverage.schoolTags, ...records.flatMap((record) => record.schoolTags || [])]);
  coverage.cities = sortedUnique([...coverage.cities, ...records.map((record) => record.city)]);
  addLowBands(coverage.lowBands, records);

  const provinceBreakdown = coverage.provinceBreakdown.find((row) => row.province === "山西");
  assert(provinceBreakdown, "Shanxi province coverage row is missing");
  provinceBreakdown.records += records.length;
  provinceBreakdown.years = sortedUnique([...provinceBreakdown.years, ...records.map((record) => Number(record.year))]).sort((left, right) => right - left);
  provinceBreakdown.subjects = sortedUnique([...provinceBreakdown.subjects, ...records.map((record) => record.subjectType)]);
  increment(provinceBreakdown.dataTypes, "control-line", records.length);
  addLowBands(provinceBreakdown.lowBands, records);

  const yearBreakdown = coverage.yearBreakdown.find((row) => Number(row.year) === 2026);
  assert(yearBreakdown, "2026 year coverage row is missing");
  const newSchoolNames = sortedUnique(records.map((record) => record.schoolName));
  yearBreakdown.records += records.length;
  increment(yearBreakdown.dataTypes, "control-line", records.length);
  yearBreakdown.schools += newSchoolNames.filter((name) => !existingSchoolNames.has(name)).length;

  refreshReadiness(layer.provinceReadiness, shard.records, shard.rankConversions);
  refreshReadiness(coverage.provinceReadiness, shard.records, shard.rankConversions);

  const shardBytes = encodeJson(shard);
  atomicWriteGzip(shardFile, shardBytes);
  const coreBytes = encodeJson(core);
  atomicWriteGzip(coreFile, coreBytes);
  manifest.generatedAt = payload.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.recordCount = newCount;
  manifest.shards["山西"].records = shard.records.length;
  manifest.shards["山西"].bytes = shardBytes.byteLength;
  manifest.shards["山西"].sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);
  atomicWriteGzip(manifestFile, manifestBytes);

  const runtimeManifest = {
    dataset: "official-shanxi-control-lines-2026-v3303-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: path.relative(PROJECT_ROOT, importFile),
    releaseDir: path.relative(PROJECT_ROOT, releaseDir),
    before,
    after: {
      modelVersion: NEXT_VERSION,
      recordCount: manifest.recordCount,
      shanxiRecords: shard.records.length,
      rankConversions: shard.rankConversions.length,
      rankRowsLinked: rows.length,
      rankRowsFullCorroborationCrossChecked: rows.length,
      rankRowsContinuityChecked: rows.length,
      topBucketRangeRepairs: 0,
      rankValueChanges: 0,
      sourceRecords: shard.records.filter((record) => record.sourceId === SOURCE_ID).length,
      routeCounts: payload.diagnostics.routeCounts,
      professionalNumericRecords: payload.diagnostics.professionalNumericRecords,
      professionalQualificationRecords: payload.diagnostics.professionalQualificationRecords,
      ordinaryVocationalStatus: sourceEvidence.ordinaryVocationalStatus,
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      shanxiBytes: shardBytes.byteLength,
      shanxiSha256: sha256(shardBytes),
      manifestBytes: manifestBytes.byteLength,
      manifestSha256: sha256(manifestBytes),
    },
  };
  assert(runtimeManifest.after.shanxiRecords === EXPECTED_NEW_SHARD_RECORDS, `Unexpected Shanxi merged count ${runtimeManifest.after.shanxiRecords}`);
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({ status: "applied", ...runtimeManifest.after, runtimeManifest: path.relative(PROJECT_ROOT, runtimeManifestFile) }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
