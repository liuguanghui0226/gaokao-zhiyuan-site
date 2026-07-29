#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.333-beijing-official-undergraduate-rank2025-national-bonus-municipal-local-bonus-guard-868426records";
const NEXT_VERSION = "local-deterministic-v3.334-xizang-official-category-required-no-public-rank-guard-868426records";
const SOURCE_ID = "official-xizang-control-lines-2025";
const PROVINCE = "西藏";
const RECORDS = 868426;
const RANKS = 133640;
const SOURCE_NOTES = 5136;
const PROVINCE_RECORDS = 28458;
const PROVINCE_RANKS = 0;
const CONTROL_RECORDS = 22;

function parseArgs(argv) {
  const args = {
    releaseDir: "site/data/release-v3.275",
    evidenceManifest: "data/admissions/evidence-v3334-xizang-category-safety-manifest.json",
    runtimeManifest: "data/admissions/official-xizang-category-safety-v3334-runtime-manifest.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--release") args.releaseDir = argv[++index];
    else if (argv[index] === "--evidence-manifest") args.evidenceManifest = argv[++index];
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function gzipBytes(value) {
  return zlib.gzipSync(value, { level: 9, mtime: 0 });
}

function unique(values) {
  return [...new Set(values.filter(Boolean))].sort((left, right) => String(left).localeCompare(String(right), "zh-CN"));
}

function patchReadiness(container) {
  const row = container?.rows?.find((item) => item.province === PROVINCE);
  assert(row, "Xizang readiness row is missing");
  row.rankParsedSource = false;
  row.rankQueuedSource = false;
  row.rankConversionRecords = 0;
  row.officialRankRecords = 0;
  row.missing = unique([
    ...(row.missing || []).filter((item) => item !== "缺可计算一分一段"),
    "官方公开渠道未提供可计算一分一段（仅接受考生本人官方查询位次）",
  ]);
}

function verifyEvidence(evidence) {
  assert(evidence.dataset === "evidence-v3334-xizang-category-safety", "Unexpected evidence dataset");
  assert(evidence.controlLineSourceId === SOURCE_ID, "Unexpected control-line source");
  assert(evidence.officialFacts?.candidateCategoryRequired === true, "Candidate-category requirement drifted");
  assert(evidence.officialFacts?.reviewedOfficialPagesPublishCalculableRankTable === false, "Rank publication boundary drifted");
  assert(evidence.officialFacts?.automaticScoreToRankConversionAllowed === false, "Score-to-rank guard drifted");
  assert(evidence.runtimeBoundary?.controlLineRecords === CONTROL_RECORDS, "Control-line count drifted");
  assert(evidence.files?.length === 3, "Evidence file inventory drifted");
  const lines = evidence.officialFacts.ordinaryControlLines;
  assert(lines["历史类"]["本科一批"]["A类考生"] === 338, "History A first-batch checkpoint drifted");
  assert(lines["历史类"]["本科一批"]["B类考生"] === 410, "History B first-batch checkpoint drifted");
  assert(lines["物理类"]["本科一批"]["A类考生"] === 300, "Physics A first-batch checkpoint drifted");
  assert(lines["物理类"]["本科一批"]["B类考生"] === 400, "Physics B first-batch checkpoint drifted");
}

function main() {
  if (ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const args = parseArgs(process.argv.slice(2));
  const releaseDir = path.resolve(ROOT, args.releaseDir);
  const evidence = readJson(path.resolve(ROOT, args.evidenceManifest));
  verifyEvidence(evidence);

  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const item = manifest.shards[PROVINCE];
  assert(item, "Xizang runtime shard is missing");
  const slug = path.basename(item.file, ".json");
  const shardFile = path.join(releaseDir, `${slug}.json.gz`);
  const shard = readGzipJson(shardFile);

  if (core.modelVersion === NEXT_VERSION) {
    assert(shard.records.filter((record) => record.sourceId === SOURCE_ID && record.candidateCategory).length === CONTROL_RECORDS, "Applied category normalization drifted");
    console.log(JSON.stringify({ status: "already-applied", modelVersion: NEXT_VERSION, normalized: CONTROL_RECORDS }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing unexpected core ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION, "Base runtime manifest drifted");
  assert(core.admissionScoreLayer.structuredRecords === RECORDS, "Base record count drifted");
  assert(core.admissionScoreLayer.rankConversionRecords === RANKS, "Base rank count drifted");
  assert(core.admissionScoreLayer.sourceNotes.length === SOURCE_NOTES, "Base source-note count drifted");
  assert(shard.records.length === PROVINCE_RECORDS && item.records === PROVINCE_RECORDS, "Xizang shard record count drifted");
  assert(shard.rankConversions.length === PROVINCE_RANKS && item.rankConversions === PROVINCE_RANKS, "Xizang shard rank count drifted");

  const definitions = evidence.officialFacts.candidateCategoryDefinitions;
  let normalized = 0;
  shard.records = shard.records.map((record) => {
    if (record.sourceId !== SOURCE_ID) return record;
    const candidateCategory = record.candidateClass || record.majorGroup;
    assert(["A类考生", "B类考生", "部队生源"].includes(candidateCategory), `Unexpected Xizang category ${candidateCategory}`);
    normalized += 1;
    const definition = definitions[candidateCategory] || "部队生源单独划线";
    const caution = `西藏${candidateCategory}须按官方类别单独判断：${definition}；不得跨类别套用控制线或单校分数。`;
    return {
      ...record,
      candidateCategory,
      candidateCategoryDefinition: definition,
      sourceQuality: "official-xizang-government-2025-control-line-html-and-daily-pdf-verified",
      publicRankConversionAvailable: false,
      rankPublicationStatus: "not-published-in-reviewed-official-pages",
      cautions: unique([...(record.cautions || []), caution]),
    };
  });
  assert(normalized === CONTROL_RECORDS, `Expected ${CONTROL_RECORDS} normalized records, got ${normalized}`);

  const sourceNote = core.admissionScoreLayer.sourceNotes.find((note) => note.id === SOURCE_ID);
  assert(sourceNote, "Xizang 2025 control-line source note is missing");
  const previousUrl = sourceNote.url;
  sourceNote.url = evidence.files[0].url;
  sourceNote.quality = "official-xizang-government-2025-control-line-html-and-daily-pdf-verified";
  sourceNote.usage = "西藏自治区人民政府公开HTML与《西藏日报》同日版面交叉核验22条2025控制线；A/B类别统一写入candidateCategory，只用于资格边界。";
  sourceNote.candidateCategoryRequired = true;
  sourceNote.candidateCategoryDefinitions = definitions;
  sourceNote.rankPublicationStatus = "not-published-in-reviewed-official-pages";
  sourceNote.publicRankConversionAvailable = false;
  sourceNote.reviewedOfficialChannels = evidence.reviewedOfficialChannels;
  sourceNote.relatedUrls = unique([...(sourceNote.relatedUrls || []), previousUrl, ...evidence.files.slice(1).map((file) => file.url)]);
  sourceNote.provenanceRevision = {
    evidenceManifest: args.evidenceManifest,
    files: Object.fromEntries(evidence.files.map((file) => [file.name, {
      url: file.url,
      bytes: file.bytes,
      sha256: file.sha256,
    }])),
  };
  sourceNote.cautions = unique([
    ...(sourceNote.cautions || []),
    "公开官方页面未提供可计算一分一段；不得按分数推测位次。",
    "A/B类决定控制线与同类别单校记录；未确认类别时只能降级为调研。",
  ]);

  patchReadiness(core.admissionScoreLayer.provinceReadiness);
  patchReadiness(core.admissionScoreLayer.coverage.provinceReadiness);
  core.generatedAt = evidence.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.admissionScoreLayer.currentFinding = `${core.admissionScoreLayer.currentFinding} 西藏2025控制线完成政府HTML与同日官方媒体版面交叉核验；22条记录统一写入A/B或部队生源类别，未选择A/B时只作调研；官方公开页面未提供可计算一分一段，继续禁止分数自动估位。`;
  const downgradeReason = String(core.admissionScoreLayer.downgradeReason || "").replaceAll(BASE_VERSION, NEXT_VERSION);
  core.admissionScoreLayer.downgradeReason = `${downgradeReason} 西藏仍是唯一无公开可计算一分一段的省级口径；推荐必须使用考生本人官方查询位次，并按A/B类别隔离控制线与单校记录。`;

  shard.generatedAt = evidence.generatedAt;
  const shardRaw = jsonBytes(shard);
  const coreRaw = jsonBytes(core);
  manifest.generatedAt = evidence.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.334",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };
  item.bytes = shardRaw.byteLength;
  item.sha256 = sha256(shardRaw);
  manifest.core.bytes = coreRaw.byteLength;
  manifest.core.sha256 = sha256(coreRaw);
  const manifestRaw = jsonBytes(manifest);

  const temporary = path.join(releaseDir, `.v3334-${process.pid}`);
  fs.mkdirSync(temporary, { recursive: true });
  const writes = [
    [path.join(temporary, `${slug}.json.gz`), gzipBytes(shardRaw), shardFile],
    [path.join(temporary, "knowledge-core.json.gz"), gzipBytes(coreRaw), coreFile],
    [path.join(temporary, "manifest.json.gz"), gzipBytes(manifestRaw), manifestFile],
  ];
  for (const [tempFile, bytes] of writes) fs.writeFileSync(tempFile, bytes);
  for (const [tempFile, , targetFile] of writes) fs.renameSync(tempFile, targetFile);
  fs.rmdirSync(temporary);

  const audit = {
    dataset: "official-xizang-category-safety-v3334-runtime",
    generatedAt: evidence.generatedAt,
    evidenceManifest: args.evidenceManifest,
    releaseDir: args.releaseDir,
    before: {
      modelVersion: BASE_VERSION,
      records: RECORDS,
      rankConversions: RANKS,
      sourceNotes: SOURCE_NOTES,
      provinceRecords: PROVINCE_RECORDS,
      provinceRankConversions: PROVINCE_RANKS,
    },
    after: {
      modelVersion: NEXT_VERSION,
      records: RECORDS,
      rankConversions: RANKS,
      rankConversionsAdded: 0,
      sourceNotes: SOURCE_NOTES,
      provinceRecords: shard.records.length,
      provinceRankConversions: shard.rankConversions.length,
      candidateCategoryNormalizedRecords: normalized,
      publicRankConversionAvailable: false,
      shardBytes: shardRaw.byteLength,
      shardSha256: sha256(shardRaw),
      coreBytes: coreRaw.byteLength,
      coreSha256: sha256(coreRaw),
      manifestBytesBeforeLiteRebuild: manifestRaw.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestRaw),
    },
    boundary: evidence.boundary,
  };
  writeJson(path.resolve(ROOT, args.runtimeManifest), audit);
  console.log(JSON.stringify({ status: "ok", modelVersion: NEXT_VERSION, normalized, rankConversionsAdded: 0 }, null, 2));
}

main();
