#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const baseVersion = "local-deterministic-v3.340-typography-safe-trends-868426records";
const nextVersion = "local-deterministic-v3.341-batch-isolated-admission-options-868426records";
const counts = { records: 868426, ranks: 133640, notes: 5136 };
const generatedAt = "2026-07-30T04:45:00+08:00";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function jsonBytes(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function gzipBytes(value) {
  return zlib.gzipSync(value, { level: 9, mtime: 0 });
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  if (root.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const releaseDir = path.join(root, "site/data/release-v3.275");
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const evidenceFile = path.join(root, "data/admissions/evidence-v3341-admission-batch-route-collisions-manifest.json");
  const auditFile = path.join(root, "data/admissions/admission-batch-route-safety-v3341-runtime-manifest.json");
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const evidence = JSON.parse(fs.readFileSync(evidenceFile, "utf8"));

  if (core.modelVersion === nextVersion) {
    assert(manifest.modelVersion === nextVersion, "Applied runtime manifest version drifted");
    console.log(JSON.stringify({ status: "already-applied", modelVersion: nextVersion }, null, 2));
    return;
  }

  assert(core.modelVersion === baseVersion, `Refusing unexpected core ${core.modelVersion}`);
  assert(manifest.modelVersion === baseVersion, "Base runtime manifest drifted");
  assert(core.admissionScoreLayer.structuredRecords === counts.records, "Record count drifted");
  assert(core.admissionScoreLayer.rankConversionRecords === counts.ranks, "Rank count drifted");
  assert(core.admissionScoreLayer.sourceNotes.length === counts.notes, "Source-note count drifted");
  assert(evidence.provinces === 31, "Batch-route evidence province count drifted");
  assert(evidence.admissionRecords === 794934, "Batch-route evidence record count drifted");
  assert(evidence.crossBatchSharedRouteGroups === 7607, "Current cross-batch group count drifted");
  assert(evidence.crossBatchSharedRoutePairs === 13137, "Current cross-batch pair count drifted");
  assert(evidence.preventedCrossBatchGroups === 4740, "Prevented cross-batch group count drifted");
  assert(evidence.preventedCrossBatchPairs === 9085, "Prevented cross-batch pair count drifted");
  assert(evidence.retainedAliasPairs === 4052, "Retained batch alias count drifted");
  assert(evidence.preventedBoundaryConflictPairs === 8348, "Prevented boundary-conflict count drifted");
  assert(evidence.preventedOfficialInvolvedPairs === 3479, "Official-involved batch-route count drifted");

  const admissionPolicy = core.modelPolicy?.admissionEvidencePolicy || {};
  assert(admissionPolicy.routeSafeDedupe === true, "v3.338 route-safe dedupe policy missing");
  assert(admissionPolicy.trendEvidencePolicy?.typographyCanonicalization?.unicodeNormalization === "NFKC", "v3.340 trend policy missing");
  const preservedRouteFields = [...new Set(["batch", ...(admissionPolicy.preservedRouteFields || [])])];
  const batchRoutePolicy = {
    semanticBatchRouteIsolation: true,
    semanticAliasesRetained: evidence.retainedAliasPairs,
    distinctRoutePairsPreserved: evidence.preventedCrossBatchPairs,
    distinctRouteGroupsPreserved: evidence.preventedCrossBatchGroups,
    boundaryConflictPairsPreserved: evidence.preventedBoundaryConflictPairs,
    officialInvolvedPairsPreserved: evidence.preventedOfficialInvolvedPairs,
    ordinaryInitialAliases: evidence.controls.retainedOrdinaryInitialAliases,
    preservedDistinctRoutes: evidence.controls.preservedDistinctRoutes,
    sameSemanticRouteEvidencePreferencePreserved: true,
    batchShownInCandidateTags: true,
  };

  core.generatedAt = generatedAt;
  core.modelVersion = nextVersion;
  core.modelPolicy.version = nextVersion;
  core.modelPolicy.reliabilityDefinition = "全国通用录取分数据层优先；候选清单按批次语义、专业组、校区、合作类型、学费、选科、专业代码和位次口径隔离；普通初次录取的同义批次标签仍合并并优先考试院或学校官网，提前批、专项、征集轮次、一二三批/段、A/B/C段和文理预科保持分开；跨年趋势继续执行v3.340排版安全规范；不输出录取概率。";
  core.modelPolicy.formula = "有可核验结构化录取分时：总分 = 40%录取分/位次安全边界 + 20%硬匹配 + 15%专业适配 + 10%城市预算 + 10%证据充分度 + 5%风险控制；候选去重先按批次语义隔离招生路径，同一路径再按考试院、学校官网、其他、第三方择优；趋势仅在同路径内比较。";
  core.modelPolicy.admissionEvidencePolicy = {
    ...admissionPolicy,
    preservedRouteFields,
    batchRoutePolicy,
  };
  core.admissionScoreLayer.currentFinding = `${core.admissionScoreLayer.currentFinding} v3.341审计发现当前候选去重会比较${evidence.crossBatchSharedRouteGroups}组跨批次记录；现保留${evidence.preventedCrossBatchPairs}对提前批、专项、征集轮次、批段或预科等不同招生路径，同时继续合并${evidence.retainedAliasPairs}对普通初次录取批次别名。`;
  core.admissionScoreLayer.downgradeReason = `${String(core.admissionScoreLayer.downgradeReason || "").replaceAll(baseVersion, nextVersion)} 批次路径会直接显示在候选标签中；${evidence.preventedBoundaryConflictPairs}对同年边界不同的跨批次记录不再互相覆盖。`;

  manifest.generatedAt = generatedAt;
  manifest.modelVersion = nextVersion;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.341",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };

  const coreRaw = jsonBytes(core);
  manifest.core.bytes = coreRaw.byteLength;
  manifest.core.sha256 = sha256(coreRaw);
  const manifestRaw = jsonBytes(manifest);
  const temporary = path.join(releaseDir, `.v3341-${process.pid}`);
  fs.mkdirSync(temporary, { recursive: true });
  const writes = [
    [path.join(temporary, "knowledge-core.json.gz"), gzipBytes(coreRaw), coreFile],
    [path.join(temporary, "manifest.json.gz"), gzipBytes(manifestRaw), manifestFile],
  ];
  for (const [tempFile, bytes] of writes) fs.writeFileSync(tempFile, bytes);
  for (const [tempFile, , targetFile] of writes) fs.renameSync(tempFile, targetFile);
  fs.rmdirSync(temporary);

  const audit = {
    dataset: "admission-batch-route-safety-v3341-runtime",
    generatedAt,
    before: { modelVersion: baseVersion, ...counts },
    after: {
      modelVersion: nextVersion,
      ...counts,
      provincesAudited: evidence.provinces,
      admissionRecordsAudited: evidence.admissionRecords,
      crossBatchSharedRouteGroups: evidence.crossBatchSharedRouteGroups,
      crossBatchSharedRoutePairs: evidence.crossBatchSharedRoutePairs,
      preventedCrossBatchGroups: evidence.preventedCrossBatchGroups,
      preventedCrossBatchPairs: evidence.preventedCrossBatchPairs,
      retainedAliasPairs: evidence.retainedAliasPairs,
      preventedBoundaryConflictPairs: evidence.preventedBoundaryConflictPairs,
      preventedOfficialInvolvedPairs: evidence.preventedOfficialInvolvedPairs,
      batchRoutePolicy,
      coreBytes: coreRaw.byteLength,
      coreSha256: sha256(coreRaw),
      manifestBytesBeforeLiteRebuild: manifestRaw.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestRaw),
    },
    boundary: "No admission, rank, plan, or source-note record changed. This release changes only candidate-route identity, dedupe, evidence selection boundaries, and visible batch labels.",
  };
  writeJson(auditFile, audit);
  console.log(JSON.stringify({
    status: "ok",
    modelVersion: nextVersion,
    counts,
    admissionRecordsAudited: evidence.admissionRecords,
    preventedCrossBatchPairs: evidence.preventedCrossBatchPairs,
    retainedAliasPairs: evidence.retainedAliasPairs,
    preventedBoundaryConflictPairs: evidence.preventedBoundaryConflictPairs,
  }, null, 2));
}

main();
