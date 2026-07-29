#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const baseVersion = "local-deterministic-v3.341-batch-isolated-admission-options-868426records";
const nextVersion = "local-deterministic-v3.342-typography-safe-admission-options-868426records";
const counts = { records: 868426, ranks: 133640, notes: 5136 };
const generatedAt = "2026-07-30T05:30:00+08:00";

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
  const evidenceFile = path.join(root, "data/admissions/evidence-v3342-admission-option-name-variants-manifest.json");
  const auditFile = path.join(root, "data/admissions/admission-option-name-safety-v3342-runtime-manifest.json");
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
  assert(evidence.provinces === 31, "Name-variant evidence province count drifted");
  assert(evidence.admissionRecords === 794934, "Name-variant evidence record count drifted");
  assert(evidence.exactBaseGroups === 428254, "Exact candidate base-group count drifted");
  assert(evidence.canonicalBaseGroups === 421393, "Canonical candidate base-group count drifted");
  assert(evidence.canonicalNameVariantGroups === 6838, "Candidate name-variant group count drifted");
  assert(evidence.routeTypographyVariantGroups === 2689, "Route typography group count drifted");
  assert(evidence.affectedCandidateGroups === 2881, "Affected candidate-group count drifted");
  assert(evidence.safelyRemovedDuplicateOptions === 3015, "Removed duplicate-option count drifted");
  assert(evidence.sameYearSafeMergePairs === 389, "Same-year safe merge count drifted");
  assert(evidence.crossYearSafeMergePairs === 3468, "Cross-year safe merge count drifted");
  assert(evidence.officialInvolvedSafeMergePairs === 3371, "Official-involved merge count drifted");
  assert(evidence.preservedSameYearBoundaryConflictPairs === 537, "Preserved conflict count drifted");

  const admissionPolicy = core.modelPolicy?.admissionEvidencePolicy || {};
  assert(admissionPolicy.routeSafeDedupe === true, "v3.338 route-safe dedupe policy missing");
  assert(admissionPolicy.batchRoutePolicy?.semanticBatchRouteIsolation === true, "v3.341 batch policy missing");
  assert(
    admissionPolicy.trendEvidencePolicy?.typographyCanonicalization?.unicodeNormalization === "NFKC",
    "v3.340 trend typography policy missing",
  );
  const optionNameCanonicalization = {
    unicodeNormalization: evidence.controls.unicodeNormalization,
    removesInternalWhitespace: evidence.controls.removesInternalWhitespace,
    normalizesMiddleDots: evidence.controls.normalizesMiddleDots,
    normalizesDashVariants: evidence.controls.normalizesDashVariants,
    normalizesBracketVariants: evidence.controls.normalizesBracketVariants,
    preservesWordsDigitsAndQualifiers: evidence.controls.preservesWordsDigitsAndQualifiers,
    exactBaseGroups: evidence.exactBaseGroups,
    canonicalBaseGroups: evidence.canonicalBaseGroups,
    canonicalNameVariantGroups: evidence.canonicalNameVariantGroups,
    routeTypographyVariantGroups: evidence.routeTypographyVariantGroups,
    affectedCandidateGroups: evidence.affectedCandidateGroups,
    safelyRemovedDuplicateOptions: evidence.safelyRemovedDuplicateOptions,
    sameYearSafeMerges: evidence.sameYearSafeMergePairs,
    crossYearSafeMerges: evidence.crossYearSafeMergePairs,
    officialInvolvedSafeMerges: evidence.officialInvolvedSafeMergePairs,
    boundaryConflictPairsPreserved: evidence.preservedSameYearBoundaryConflictPairs,
    sameYearBoundaryRequired: true,
    semanticRouteIsolationPreserved: true,
    evidencePreferencePreserved: true,
    originalDisplayNamesPreserved: true,
  };

  core.generatedAt = generatedAt;
  core.modelVersion = nextVersion;
  core.modelPolicy.version = nextVersion;
  core.modelPolicy.reliabilityDefinition = "全国通用录取分数据层优先；候选清单先按批次、专业组、校区、合作类型、学费、选科、专业代码和位次口径隔离，再对院校、专业及路径字段中的全半角括号、空格、中点、破折号等纯排版变体安全去重；同年只有分数/位次边界一致才合并，边界冲突保持分开；同一路径继续优先考试院或学校官网，不输出录取概率。";
  core.modelPolicy.formula = "有可核验结构化录取分时：总分 = 40%录取分/位次安全边界 + 20%硬匹配 + 15%专业适配 + 10%城市预算 + 10%证据充分度 + 5%风险控制；候选去重先隔离招生路径，再规范纯排版名称并校验同年边界，同一路径按考试院、学校官网、其他、第三方择优；趋势只在同路径内比较。";
  core.modelPolicy.admissionEvidencePolicy = {
    ...admissionPolicy,
    optionNameCanonicalization,
  };
  core.admissionScoreLayer.currentFinding = `${core.admissionScoreLayer.currentFinding} v3.342全国模拟识别${evidence.canonicalNameVariantGroups}组院校/专业名称排版变体和${evidence.routeTypographyVariantGroups}组路径字段排版变体；安全去除${evidence.safelyRemovedDuplicateOptions}个重复候选，释放${evidence.affectedCandidateGroups}组候选名额。`;
  core.admissionScoreLayer.downgradeReason = `${String(core.admissionScoreLayer.downgradeReason || "").replaceAll(baseVersion, nextVersion)} 同年排版变体只有在最低分/位次边界一致时才合并；${evidence.preservedSameYearBoundaryConflictPairs}对边界冲突继续分开显示，原始院校专业名称不改写。`;

  manifest.generatedAt = generatedAt;
  manifest.modelVersion = nextVersion;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.342",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };

  const coreRaw = jsonBytes(core);
  manifest.core.bytes = coreRaw.byteLength;
  manifest.core.sha256 = sha256(coreRaw);
  const manifestRaw = jsonBytes(manifest);
  const temporary = path.join(releaseDir, `.v3342-${process.pid}`);
  fs.mkdirSync(temporary, { recursive: true });
  const writes = [
    [path.join(temporary, "knowledge-core.json.gz"), gzipBytes(coreRaw), coreFile],
    [path.join(temporary, "manifest.json.gz"), gzipBytes(manifestRaw), manifestFile],
  ];
  for (const [tempFile, bytes] of writes) fs.writeFileSync(tempFile, bytes);
  for (const [tempFile, , targetFile] of writes) fs.renameSync(tempFile, targetFile);
  fs.rmdirSync(temporary);

  const audit = {
    dataset: "admission-option-name-safety-v3342-runtime",
    generatedAt,
    before: { modelVersion: baseVersion, ...counts },
    after: {
      modelVersion: nextVersion,
      ...counts,
      provincesAudited: evidence.provinces,
      admissionRecordsAudited: evidence.admissionRecords,
      canonicalNameVariantGroups: evidence.canonicalNameVariantGroups,
      routeTypographyVariantGroups: evidence.routeTypographyVariantGroups,
      affectedCandidateGroups: evidence.affectedCandidateGroups,
      safelyRemovedDuplicateOptions: evidence.safelyRemovedDuplicateOptions,
      sameYearSafeMerges: evidence.sameYearSafeMergePairs,
      crossYearSafeMerges: evidence.crossYearSafeMergePairs,
      officialInvolvedSafeMerges: evidence.officialInvolvedSafeMergePairs,
      boundaryConflictPairsPreserved: evidence.preservedSameYearBoundaryConflictPairs,
      optionNameCanonicalization,
      coreBytes: coreRaw.byteLength,
      coreSha256: sha256(coreRaw),
      manifestBytesBeforeLiteRebuild: manifestRaw.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestRaw),
    },
    boundary: "No admission, rank, plan, or source-note record changed. This release changes only candidate identity normalization, route comparison of pure typography variants, and same-year conflict preservation. Original display names remain unchanged.",
  };
  writeJson(auditFile, audit);
  console.log(JSON.stringify({
    status: "ok",
    modelVersion: nextVersion,
    counts,
    admissionRecordsAudited: evidence.admissionRecords,
    safelyRemovedDuplicateOptions: evidence.safelyRemovedDuplicateOptions,
    affectedCandidateGroups: evidence.affectedCandidateGroups,
    officialInvolvedSafeMerges: evidence.officialInvolvedSafeMergePairs,
    boundaryConflictPairsPreserved: evidence.preservedSameYearBoundaryConflictPairs,
  }, null, 2));
}

main();
