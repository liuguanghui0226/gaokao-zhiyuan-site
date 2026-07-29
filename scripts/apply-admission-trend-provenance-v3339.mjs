#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.338-route-safe-dedup-official-preference-868426records";
const NEXT_VERSION = "local-deterministic-v3.339-route-isolated-official-first-trends-868426records";
const COUNTS = { records: 868426, ranks: 133640, notes: 5136 };
const GENERATED_AT = "2026-07-30T03:35:00+08:00";

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
  const evidenceFile = path.join(ROOT, "data/admissions/evidence-v3339-admission-trend-provenance-manifest.json");
  const auditFile = path.join(ROOT, "data/admissions/admission-trend-provenance-v3339-runtime-manifest.json");
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
  assert(evidence.before.officialReplacements === 4523, "Trend source-order evidence drifted");
  assert(evidence.before.routeConflicts.semanticRouteConflictGroups === 4384, "Trend route-conflict evidence drifted");

  const trendEvidencePolicy = {
    routeIsolated: true,
    routeKeyFields: evidence.controls.routeKeyFields,
    sameYearPreference: evidence.controls.sameYearPreference,
    samePriorityRankPreference: true,
    trendBonus: {
      officialOrSchoolOfficial: 5,
      other: 3,
      thirdParty: 2,
    },
    thirdPartyTrendWarningRequired: true,
    majorCodeExcludedFromCrossYearIdentity: true,
    majorCodeReason: evidence.controls.majorCodeExcludedFromCrossYearIdentity,
  };
  core.generatedAt = GENERATED_AT;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.modelPolicy.reliabilityDefinition = "全国通用录取分数据层优先；候选与历史趋势均按省份、科类、批次、专业组、校区、合作类型、学费、选科和专业隔离；同年趋势证据优先考试院和学校官网；含第三方年份的趋势必须降权并明示待复核；不输出录取概率。";
  core.modelPolicy.formula = "有可核验结构化录取分时：总分 = 40%录取分/位次安全边界 + 20%硬匹配 + 15%专业适配 + 10%城市预算 + 10%证据充分度 + 5%风险控制；历史趋势只在同招生路径内比较，同年按考试院、学校官网、其他、第三方排序；官方趋势加5，来源待核加3，含第三方加2。";
  core.modelPolicy.admissionEvidencePolicy = {
    ...(core.modelPolicy.admissionEvidencePolicy || {}),
    trendEvidencePolicy,
  };
  core.admissionScoreLayer.currentFinding = `${core.admissionScoreLayer.currentFinding} v3.339审计发现旧趋势键有${evidence.before.routeConflicts.semanticRouteConflictGroups}组混入校区、类型或选科变化，且${evidence.before.officialReplacements}组同年趋势会先取较低质量来源；现改为同路径趋势隔离、同年官方优先。`;
  core.admissionScoreLayer.downgradeReason = `${String(core.admissionScoreLayer.downgradeReason || "").replaceAll(BASE_VERSION, NEXT_VERSION)} 含第三方年份的历史趋势只加2分并显示待复核警告；不同校区、合作类型、学费或选科路径不生成跨路径涨跌结论。`;

  manifest.generatedAt = GENERATED_AT;
  manifest.modelVersion = NEXT_VERSION;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.339",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };

  const coreRaw = jsonBytes(core);
  manifest.core.bytes = coreRaw.byteLength;
  manifest.core.sha256 = sha256(coreRaw);
  const manifestRaw = jsonBytes(manifest);
  const temporary = path.join(releaseDir, `.v3339-${process.pid}`);
  fs.mkdirSync(temporary, { recursive: true });
  const writes = [
    [path.join(temporary, "knowledge-core.json.gz"), gzipBytes(coreRaw), coreFile],
    [path.join(temporary, "manifest.json.gz"), gzipBytes(manifestRaw), manifestFile],
  ];
  for (const [tempFile, bytes] of writes) fs.writeFileSync(tempFile, bytes);
  for (const [tempFile, , targetFile] of writes) fs.renameSync(tempFile, targetFile);
  fs.rmdirSync(temporary);

  const audit = {
    dataset: "admission-trend-provenance-v3339-runtime",
    generatedAt: GENERATED_AT,
    before: { modelVersion: BASE_VERSION, ...COUNTS },
    after: {
      modelVersion: NEXT_VERSION,
      ...COUNTS,
      provincesAudited: evidence.provinces,
      majorAdmissionRecordsAudited: evidence.majorAdmissionRecords,
      trendAuditBefore: evidence.before,
      trendAuditAfter: evidence.afterPolicySimulation,
      trendEvidencePolicy,
      timestampCorrection: evidence.timestampCorrection,
      coreBytes: coreRaw.byteLength,
      coreSha256: sha256(coreRaw),
      manifestBytesBeforeLiteRebuild: manifestRaw.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestRaw),
    },
    boundary: "No admission, rank, plan, or source-note records changed. The release changes trend grouping, same-year provenance selection, trend weighting, warning text, and the runtime timestamp.",
  };
  writeJson(auditFile, audit);
  console.log(JSON.stringify({
    status: "ok",
    modelVersion: NEXT_VERSION,
    counts: COUNTS,
    majorAdmissionRecordsAudited: evidence.majorAdmissionRecords,
    routeConflictGroupsBlocked: evidence.before.routeConflicts.semanticRouteConflictGroups,
    lowerPriorityFirstGroupsCorrected: evidence.before.officialReplacements,
  }, null, 2));
}

main();
