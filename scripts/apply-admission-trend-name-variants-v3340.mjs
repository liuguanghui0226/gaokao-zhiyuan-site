#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.339-route-isolated-official-first-trends-868426records";
const NEXT_VERSION = "local-deterministic-v3.340-typography-safe-trends-868426records";
const COUNTS = { records: 868426, ranks: 133640, notes: 5136 };
const GENERATED_AT = "2026-07-30T04:18:00+08:00";

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
  if (ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const releaseDir = path.join(ROOT, "site/data/release-v3.275");
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const evidenceFile = path.join(ROOT, "data/admissions/evidence-v3340-admission-trend-name-variants-manifest.json");
  const auditFile = path.join(ROOT, "data/admissions/admission-trend-name-variants-v3340-runtime-manifest.json");
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const evidence = JSON.parse(fs.readFileSync(evidenceFile, "utf8"));

  if (core.modelVersion === NEXT_VERSION) {
    assert(manifest.modelVersion === NEXT_VERSION, "Applied runtime manifest version drifted");
    console.log(JSON.stringify({ status: "already-applied", modelVersion: NEXT_VERSION }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing unexpected core ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION, "Base runtime manifest drifted");
  assert(core.admissionScoreLayer.structuredRecords === COUNTS.records, "Record count drifted");
  assert(core.admissionScoreLayer.rankConversionRecords === COUNTS.ranks, "Rank count drifted");
  assert(core.admissionScoreLayer.sourceNotes.length === COUNTS.notes, "Source-note count drifted");
  assert(evidence.provinces === 31, "Trend evidence province count drifted");
  assert(evidence.majorAdmissionRecords === 475801, "Trend evidence record count drifted");
  assert(evidence.exactMultiYearKeys === 106989, "Exact multi-year trend count drifted");
  assert(evidence.safePolicyMultiYearGroups === 110770, "Safe canonical trend count drifted");
  assert(evidence.recoveredMultiYearGroups === 3834, "Recovered trend count drifted");
  assert(evidence.extendedExistingMultiYearGroups === 1071, "Extended trend count drifted");
  assert(evidence.addedDistinctYearLinks === 4959, "Added trend year count drifted");
  assert(evidence.sameYearBoundaryConflictGroups === 140, "Boundary-conflict count drifted");

  const priorTrendPolicy = core.modelPolicy?.admissionEvidencePolicy?.trendEvidencePolicy;
  assert(priorTrendPolicy?.routeIsolated === true, "v3.339 route isolation policy missing");
  assert(priorTrendPolicy?.thirdPartyTrendWarningRequired === true, "v3.339 third-party warning policy missing");
  const typographyCanonicalization = {
    unicodeNormalization: evidence.controls.unicodeNormalization,
    removesInternalWhitespace: evidence.controls.removesInternalWhitespace,
    normalizesMiddleDots: evidence.controls.normalizesMiddleDots,
    normalizesDashVariants: evidence.controls.normalizesDashVariants,
    normalizesBracketVariants: evidence.controls.normalizesBracketVariants,
    preservesBracketContents: evidence.controls.preservesBracketContents,
    preservesWordsDigitsAndQualifiers: evidence.controls.preservesWordsDigitsAndQualifiers,
    exactKeyFallbackOnSameYearBoundaryConflict: true,
    sameYearBoundaryConflictGroups: evidence.sameYearBoundaryConflictGroups,
    recoveredMultiYearGroups: evidence.recoveredMultiYearGroups,
    extendedExistingMultiYearGroups: evidence.extendedExistingMultiYearGroups,
    addedDistinctYearLinks: evidence.addedDistinctYearLinks,
  };
  const trendEvidencePolicy = {
    ...priorTrendPolicy,
    typographyCanonicalization,
  };
  core.generatedAt = GENERATED_AT;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.modelPolicy.reliabilityDefinition = "全国通用录取分数据层优先；候选与历史趋势按省份、科类、批次、专业组、校区、合作类型、学费、选科和专业隔离；全角/半角括号、空格、中点、破折号等纯排版差异经NFKC规范后可连接，同年边界冲突则退回逐字键；同年趋势证据优先考试院和学校官网；含第三方年份必须降权并明示待复核；不输出录取概率。";
  core.modelPolicy.formula = "有可核验结构化录取分时：总分 = 40%录取分/位次安全边界 + 20%硬匹配 + 15%专业适配 + 10%城市预算 + 10%证据充分度 + 5%风险控制；历史趋势只在同招生路径内比较，纯排版差异安全规范，同年边界冲突退回逐字键；同年按考试院、学校官网、其他、第三方排序；官方趋势加5，来源待核加3，含第三方加2。";
  core.modelPolicy.admissionEvidencePolicy = {
    ...(core.modelPolicy.admissionEvidencePolicy || {}),
    trendEvidencePolicy,
  };
  core.admissionScoreLayer.currentFinding = `${core.admissionScoreLayer.currentFinding} v3.340审计发现全角/半角括号、空格和分隔符等纯排版差异拆散${evidence.recoveredMultiYearGroups}组新趋势并截短${evidence.extendedExistingMultiYearGroups}组既有趋势；现安全补回${evidence.addedDistinctYearLinks}个年份连接。`;
  core.admissionScoreLayer.downgradeReason = `${String(core.admissionScoreLayer.downgradeReason || "").replaceAll(BASE_VERSION, NEXT_VERSION)} 名称规范化保留全部文字、数字和限定语；${evidence.sameYearBoundaryConflictGroups}组同年边界冲突自动退回逐字键，不强行合并。`;

  manifest.generatedAt = GENERATED_AT;
  manifest.modelVersion = NEXT_VERSION;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.340",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };

  const coreRaw = jsonBytes(core);
  manifest.core.bytes = coreRaw.byteLength;
  manifest.core.sha256 = sha256(coreRaw);
  const manifestRaw = jsonBytes(manifest);
  const temporary = path.join(releaseDir, `.v3340-${process.pid}`);
  fs.mkdirSync(temporary, { recursive: true });
  const writes = [
    [path.join(temporary, "knowledge-core.json.gz"), gzipBytes(coreRaw), coreFile],
    [path.join(temporary, "manifest.json.gz"), gzipBytes(manifestRaw), manifestFile],
  ];
  for (const [tempFile, bytes] of writes) fs.writeFileSync(tempFile, bytes);
  for (const [tempFile, , targetFile] of writes) fs.renameSync(tempFile, targetFile);
  fs.rmdirSync(temporary);

  const audit = {
    dataset: "admission-trend-name-variants-v3340-runtime",
    generatedAt: GENERATED_AT,
    before: { modelVersion: BASE_VERSION, ...COUNTS },
    after: {
      modelVersion: NEXT_VERSION,
      ...COUNTS,
      provincesAudited: evidence.provinces,
      majorAdmissionRecordsAudited: evidence.majorAdmissionRecords,
      exactTrendKeys: evidence.exactTrendKeys,
      canonicalTrendKeys: evidence.canonicalTrendKeys,
      exactMultiYearKeys: evidence.exactMultiYearKeys,
      safePolicyMultiYearGroups: evidence.safePolicyMultiYearGroups,
      recoveredMultiYearGroups: evidence.recoveredMultiYearGroups,
      extendedExistingMultiYearGroups: evidence.extendedExistingMultiYearGroups,
      addedDistinctYearLinks: evidence.addedDistinctYearLinks,
      sameYearBoundaryConflictGroups: evidence.sameYearBoundaryConflictGroups,
      trendEvidencePolicy,
      coreBytes: coreRaw.byteLength,
      coreSha256: sha256(coreRaw),
      manifestBytesBeforeLiteRebuild: manifestRaw.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestRaw),
    },
    boundary: "No admission, rank, plan, or source-note records changed. The release normalizes only typographic Unicode/separator variants for trend identity and falls back to the exact key whenever same-year score/rank boundaries conflict.",
  };
  writeJson(auditFile, audit);
  console.log(JSON.stringify({
    status: "ok",
    modelVersion: NEXT_VERSION,
    counts: COUNTS,
    majorAdmissionRecordsAudited: evidence.majorAdmissionRecords,
    recoveredMultiYearGroups: evidence.recoveredMultiYearGroups,
    extendedExistingMultiYearGroups: evidence.extendedExistingMultiYearGroups,
    sameYearBoundaryConflictGroups: evidence.sameYearBoundaryConflictGroups,
  }, null, 2));
}

main();
