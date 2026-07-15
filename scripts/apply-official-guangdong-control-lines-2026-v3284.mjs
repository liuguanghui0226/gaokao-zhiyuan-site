#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.283-hunan-control-lines2026-and-boundary-routing-846556records";
const NEXT_VERSION = "local-deterministic-v3.284-guangdong-control-lines2026-and-rank-provenance-846605records";
const SOURCE_ID = "official-guangdong-control-lines-2026";
const RANK_SOURCE_IDS = new Set(["official-guangdong-rank-2026", "official-guangdong-special-rank-2026"]);
const RANK_SOURCE_URL = "https://eea.gd.gov.cn/ptgk/content/post_4916165.html";
const RANK_PAGE_BYTES = 21284;
const RANK_PAGE_SHA256 = "1c121b0078eff38892a9a5920d20c4390a95843724d0830d30b2d5b50f3bcb7b";
const PHYSICS_PDF_PREVIOUS_BYTES = 429301;
const PHYSICS_PDF_PREVIOUS_SHA256 = "650e82f720d9901de5568d90f19617123ba1ba203e85824f3a2fd88d182fc1f6";
const PHYSICS_PDF_CURRENT_BYTES = 550540;
const PHYSICS_PDF_CURRENT_SHA256 = "9bde2c4aaddf28cf3c294e2fdde3fa76981ae2ec4c6df39185d34d6d31044f9f";
const EXPECTED_RECORDS = 49;
const EXPECTED_RANK_PROVENANCE = 8816;

function parseArgs(argv) {
  const args = {
    importFile: "data/admissions/official-guangdong-control-lines-2026-import.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-guangdong-control-lines-2026-v3284-runtime-manifest.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--import") args.importFile = argv[++index];
    else if (item === "--release") args.releaseDir = argv[++index];
    else if (item === "--runtime-manifest") args.runtimeManifest = argv[++index];
  }
  return args;
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

function assert(condition, message) {
  if (!condition) throw new Error(message);
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

function refreshGuangdongReadiness(container, records, rankConversions) {
  const row = container?.rows?.find((item) => item.province === "广东");
  assert(row, "Guangdong province-readiness row is missing");
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

function rankSourceRows(shard) {
  return shard.rankConversions.filter((record) => record.year === 2026 && RANK_SOURCE_IDS.has(record.sourceId));
}

function patchRankSourceNote(core) {
  const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === "official-guangdong-rank-2026");
  assert(note, "Official Guangdong ordinary rank source note is missing");
  const physics = note.subjects?.find((item) => item.subjectType === "物理类");
  assert(physics, "Official Guangdong physics rank source metadata is missing");
  assert(
    [PHYSICS_PDF_PREVIOUS_SHA256, PHYSICS_PDF_CURRENT_SHA256].includes(physics.pdfSha256),
    `Unexpected Guangdong physics PDF SHA-256: ${physics.pdfSha256}`,
  );
  if (physics.pdfSha256 === PHYSICS_PDF_CURRENT_SHA256) {
    assert(physics.pdfBytes === PHYSICS_PDF_CURRENT_BYTES, "Current Guangdong physics PDF byte count drifted");
    assert(note.pageHtmlSha256 === RANK_PAGE_SHA256, "Current Guangdong rank source page SHA-256 drifted");
    return false;
  }
  assert(physics.pdfBytes === PHYSICS_PDF_PREVIOUS_BYTES, "Previous Guangdong physics PDF byte count drifted");
  note.pageHtmlBytes = RANK_PAGE_BYTES;
  note.pageHtmlSha256 = RANK_PAGE_SHA256;
  note.provenanceRevision = {
    verifiedAt: "2026-07-16",
    finding: "官方物理类PDF在同一URL下发生字节级替换；重新解析600个分数行、1200条本科/专科加分记录，与运行层核心字段逐条一致，内容差异为0。",
    canonicalRowsCompared: 1200,
    canonicalMismatch: 0,
  };
  physics.previousPdfBytes = PHYSICS_PDF_PREVIOUS_BYTES;
  physics.previousPdfSha256 = PHYSICS_PDF_PREVIOUS_SHA256;
  physics.pdfBytes = PHYSICS_PDF_CURRENT_BYTES;
  physics.pdfSha256 = PHYSICS_PDF_CURRENT_SHA256;
  physics.revisionVerification = "600 displayed rows; 1200 canonical records; 0 missing; 0 field mismatches";
  return true;
}

function verifyAlreadyApplied({ core, manifest, shard }) {
  const sourceRecords = shard.records.filter((record) => record.sourceId === SOURCE_ID);
  const rankRows = rankSourceRows(shard);
  assert(core.modelVersion === NEXT_VERSION, `Unexpected already-applied model version: ${core.modelVersion}`);
  assert(manifest.modelVersion === NEXT_VERSION, "Manifest model version drift after prior apply");
  assert(sourceRecords.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} prior Guangdong records, got ${sourceRecords.length}`);
  assert(rankRows.length === EXPECTED_RANK_PROVENANCE, `Expected ${EXPECTED_RANK_PROVENANCE} Guangdong rank rows, got ${rankRows.length}`);
  assert(rankRows.every((record) => record.sourceUrl === RANK_SOURCE_URL), "Guangdong rank source URL repair drifted");
  assert(manifest.recordCount === 846605, "Manifest record count drift after prior apply");
  return { sourceRecords, rankRows };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const importFile = path.resolve(PROJECT_ROOT, args.importFile);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const guangdongFile = path.join(releaseDir, "guangdong.json.gz");
  const payload = JSON.parse(fs.readFileSync(importFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const shard = readGzipJson(guangdongFile);

  assert(payload.dataset === "official-guangdong-control-lines-2026-import", `Unexpected import dataset: ${payload.dataset}`);
  assert(payload.records?.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} imported records`);
  assert(payload.sourceNotes?.length === 1 && payload.sourceNotes[0].id === SOURCE_ID, "Import source note is missing or mismatched");
  assert(payload.records.every((record) => record.province === "广东" && record.year === 2026 && record.dataType === "control-line" && record.sourceId === SOURCE_ID), "Import contains an out-of-scope record");
  assert(new Set(payload.records.map((record) => record.id)).size === EXPECTED_RECORDS, "Import contains duplicate ids");
  assert(payload.records.filter((record) => record.formalScoreScope === "control-line-only").length === 4, "Expected four ordinary control-line records");
  assert(payload.records.filter((record) => record.formalScoreScope === "special-path-only").length === 45, "Expected 45 special-path records");

  if (core.modelVersion === NEXT_VERSION) {
    const prior = verifyAlreadyApplied({ core, manifest, shard });
    const rankSourceNotePatched = patchRankSourceNote(core);
    if (rankSourceNotePatched) {
      const coreBytes = encodeJson(core);
      atomicWriteGzip(coreFile, coreBytes);
      manifest.core.bytes = coreBytes.byteLength;
      manifest.core.sha256 = sha256(coreBytes);
      const manifestBytes = encodeJson(manifest);
      atomicWriteGzip(manifestFile, manifestBytes);
      const runtimeManifest = JSON.parse(fs.readFileSync(runtimeManifestFile, "utf8"));
      Object.assign(runtimeManifest.after, {
        coreBytes: coreBytes.byteLength,
        coreSha256: sha256(coreBytes),
        manifestBytes: manifestBytes.byteLength,
        manifestSha256: sha256(manifestBytes),
        rankPhysicsPdf: {
          previousSha256: PHYSICS_PDF_PREVIOUS_SHA256,
          currentSha256: PHYSICS_PDF_CURRENT_SHA256,
          canonicalRowsCompared: 1200,
          canonicalMismatch: 0,
        },
      });
      writeJson(runtimeManifestFile, runtimeManifest);
    }
    console.log(JSON.stringify({ status: rankSourceNotePatched ? "provenance-repaired" : "already-applied", modelVersion: core.modelVersion, sourceRecords: prior.sourceRecords.length, rankSourceUrlRecords: prior.rankRows.length, rankSourceNotePatched }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to merge on unexpected base model ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION, `Refusing to merge on unexpected manifest ${manifest.modelVersion}`);
  assert(manifest.recordCount === 846556, `Refusing unexpected base record count ${manifest.recordCount}`);
  assert(manifest.rankConversionCount === 116656, `Refusing unexpected base rank-conversion count ${manifest.rankConversionCount}`);
  assert(manifest.shards?.["广东"]?.records === 17595, `Refusing unexpected Guangdong base count ${manifest.shards?.["广东"]?.records}`);
  assert(manifest.shards?.["广东"]?.rankConversions === 8816, "Refusing unexpected Guangdong rank-conversion manifest count");
  assert(shard.rankConversions?.length === 8816, `Refusing unexpected Guangdong rank-conversion count ${shard.rankConversions?.length}`);
  assert(!shard.records.some((record) => record.sourceId === SOURCE_ID), `${SOURCE_ID} is already present on the base model`);
  assert(!core.admissionScoreLayer.sourceNotes.some((note) => note.id === SOURCE_ID), `${SOURCE_ID} source note already exists on the base model`);

  const rankRows = rankSourceRows(shard);
  assert(rankRows.length === EXPECTED_RANK_PROVENANCE, `Expected ${EXPECTED_RANK_PROVENANCE} official Guangdong 2026 rank rows, got ${rankRows.length}`);
  const missingRankSourceUrl = rankRows.filter((record) => !record.sourceUrl);
  assert(missingRankSourceUrl.length === EXPECTED_RANK_PROVENANCE, `Expected all Guangdong rank rows to need URL repair, got ${missingRankSourceUrl.length}`);

  const existingSchoolNames = new Set(core.admissionScoreLayer.coverage.schools);
  patchRankSourceNote(core);
  const before = {
    modelVersion: core.modelVersion,
    recordCount: manifest.recordCount,
    guangdongRecords: shard.records.length,
    rankConversions: shard.rankConversions.length,
    rankRowsMissingSourceUrl: missingRankSourceUrl.length,
    coreSha256: sha256(zlib.gunzipSync(fs.readFileSync(coreFile))),
    guangdongSha256: sha256(zlib.gunzipSync(fs.readFileSync(guangdongFile))),
  };
  const records = payload.records.map(compact);
  shard.records.push(...records);
  for (const record of rankRows) record.sourceUrl = RANK_SOURCE_URL;
  shard.generatedAt = payload.generatedAt;

  const layer = core.admissionScoreLayer;
  const coverage = layer.coverage;
  const newCount = Number(layer.structuredRecords) + records.length;
  assert(newCount === 846605, `Unexpected merged record count ${newCount}`);
  core.generatedAt = payload.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.browserRuntime.fullMasterRecords = newCount;
  layer.structuredRecords = newCount;
  layer.statusLabel = `已接入${newCount}条结构化录取/计划数据 + ${layer.rankConversionRecords}条一分一段记录`;
  layer.currentFinding = "广东2026官方普通类历史本科440分、专科200分，物理本科425分、专科200分，已与同年8816条普通/艺体位次换算联动；其余45条特殊路径控制线保持隔离。";
  layer.sourceNotes.push(payload.sourceNotes[0]);

  coverage.files = Number(coverage.files) + 1;
  coverage.rawRecords = Number(coverage.rawRecords) + records.length;
  coverage.records = Number(coverage.records) + records.length;
  increment(coverage.dataTypes, "control-line", records.length);
  coverage.schools = sortedUnique([...coverage.schools, ...records.map((record) => record.schoolName)]);
  coverage.schoolTags = sortedUnique([...coverage.schoolTags, ...records.flatMap((record) => record.schoolTags || [])]);
  coverage.cities = sortedUnique([...coverage.cities, ...records.map((record) => record.city)]);
  addLowBands(coverage.lowBands, records);

  const provinceBreakdown = coverage.provinceBreakdown.find((row) => row.province === "广东");
  assert(provinceBreakdown, "Guangdong province coverage row is missing");
  provinceBreakdown.records += records.length;
  provinceBreakdown.years = sortedUnique([...provinceBreakdown.years, ...records.map((record) => Number(record.year))]).sort((left, right) => right - left);
  provinceBreakdown.subjects = sortedUnique([...provinceBreakdown.subjects, ...records.map((record) => record.subjectType)]);
  increment(provinceBreakdown.dataTypes, "control-line", records.length);
  addLowBands(provinceBreakdown.lowBands, records);

  const yearBreakdown = coverage.yearBreakdown.find((row) => Number(row.year) === 2026);
  assert(yearBreakdown, "2026 year coverage row is missing");
  const newSchoolNames = sortedUnique(records.map((record) => record.schoolName));
  const newGlobalSchoolNames = newSchoolNames.filter((name) => !existingSchoolNames.has(name));
  yearBreakdown.records += records.length;
  increment(yearBreakdown.dataTypes, "control-line", records.length);
  yearBreakdown.schools += newGlobalSchoolNames.length;

  refreshGuangdongReadiness(layer.provinceReadiness, shard.records, shard.rankConversions);
  refreshGuangdongReadiness(coverage.provinceReadiness, shard.records, shard.rankConversions);

  const shardBytes = encodeJson(shard);
  atomicWriteGzip(guangdongFile, shardBytes);
  const coreBytes = encodeJson(core);
  atomicWriteGzip(coreFile, coreBytes);

  manifest.generatedAt = payload.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.recordCount = newCount;
  manifest.shards["广东"].records = shard.records.length;
  manifest.shards["广东"].bytes = shardBytes.byteLength;
  manifest.shards["广东"].sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);
  atomicWriteGzip(manifestFile, manifestBytes);

  const runtimeManifest = {
    dataset: "official-guangdong-control-lines-2026-v3284-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    importFile: path.relative(PROJECT_ROOT, importFile),
    releaseDir: path.relative(PROJECT_ROOT, releaseDir),
    before,
    after: {
      modelVersion: NEXT_VERSION,
      recordCount: manifest.recordCount,
      guangdongRecords: shard.records.length,
      rankConversions: shard.rankConversions.length,
      rankSourceUrlRecords: rankRows.filter((record) => record.sourceUrl === RANK_SOURCE_URL).length,
      rankPhysicsPdf: {
        previousSha256: PHYSICS_PDF_PREVIOUS_SHA256,
        currentSha256: PHYSICS_PDF_CURRENT_SHA256,
        canonicalRowsCompared: 1200,
        canonicalMismatch: 0,
      },
      sourceRecords: shard.records.filter((record) => record.sourceId === SOURCE_ID).length,
      routeCounts: payload.diagnostics.routeCounts,
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      guangdongBytes: shardBytes.byteLength,
      guangdongSha256: sha256(shardBytes),
      manifestBytes: manifestBytes.byteLength,
      manifestSha256: sha256(manifestBytes),
    },
  };
  writeJson(runtimeManifestFile, runtimeManifest);
  console.log(JSON.stringify({ status: "applied", ...runtimeManifest.after, runtimeManifest: path.relative(PROJECT_ROOT, runtimeManifestFile) }, null, 2));
}

try {
  main();
} catch (error) {
  console.error(error.stack || error.message);
  process.exitCode = 1;
}
