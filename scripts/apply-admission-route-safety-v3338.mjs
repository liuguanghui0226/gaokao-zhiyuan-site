#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.337-admission-provenance-relative-rank-dedup-868426records";
const NEXT_VERSION = "local-deterministic-v3.338-route-safe-dedup-official-preference-868426records";
const COUNTS = { records: 868426, ranks: 133640, notes: 5136 };
const GENERATED_AT = "2026-07-30T20:30:00+08:00";

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
  const evidenceFile = path.join(ROOT, "data/admissions/evidence-v3338-admission-route-collision-manifest.json");
  const auditFile = path.join(ROOT, "data/admissions/admission-route-safety-v3338-runtime-manifest.json");
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
  assert(evidence.admissionRecords === 794934, "Route collision evidence record count drifted");
  assert(evidence.provinces === 31, "Route collision evidence province count drifted");

  const previousPolicy = core.modelPolicy.admissionEvidencePolicy || {};
  const routePolicy = {
    ...previousPolicy,
    routeSafeDedupe: true,
    candidateBestEvidenceDedupeBeforeScoring: true,
    clearDuplicateDefinition: "同省、同科类、同校、同数据类型、同专业且同招生路径；一条缺专业组时，仅同年分数或位次边界完全一致且无校区、合作、专项、学费、选科等冲突才合并。",
    preservedRouteFields: [
      "majorGroup",
      "admissionSubtype",
      "campus",
      "tuition",
      "electiveRequirement",
      "majorCode",
      "rankInstitutionScope",
    ],
    sameYearEvidencePreference: [
      "official-exam-authority",
      "school-official",
      "other",
      "third-party",
    ],
  };

  core.generatedAt = GENERATED_AT;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.modelPolicy.reliabilityDefinition = "全国通用录取分数据层优先；按省份、年份、科类/选科、批次、专业组、校区、合作类型和专业隔离；只合并同招生路径的明确重复证据，同年优先考试院和学校官网；第三方摘要最高B且单列待复核；不输出录取概率。";
  core.modelPolicy.formula = "有可核验结构化录取分时：总分 = 40%录取分/位次安全边界 + 20%硬匹配 + 15%专业适配 + 10%城市预算 + 10%证据充分度 + 5%风险控制；候选评分前先按招生路径安全去重，同路径同年证据按考试院、学校官网、其他、第三方排序。";
  core.modelPolicy.admissionEvidencePolicy = routePolicy;
  core.admissionScoreLayer.currentFinding = `${core.admissionScoreLayer.currentFinding} v3.338审计发现旧宽键在最新年份有${evidence.collisions.latestYearCollisionGroups}组碰撞；现保留不同专业组、校区、合作类型和招生路径，只合并边界一致的明确重复证据。`;
  core.admissionScoreLayer.downgradeReason = `${String(core.admissionScoreLayer.downgradeReason || "").replaceAll(BASE_VERSION, NEXT_VERSION)} 不同专业组、校区、合作办学、专项或选科路径不可互相替代；缺少路径字段时必须回官方招生计划核验。`;

  manifest.generatedAt = GENERATED_AT;
  manifest.modelVersion = NEXT_VERSION;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.338",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };

  const coreRaw = jsonBytes(core);
  manifest.core.bytes = coreRaw.byteLength;
  manifest.core.sha256 = sha256(coreRaw);
  const manifestRaw = jsonBytes(manifest);
  const temporary = path.join(releaseDir, `.v3338-${process.pid}`);
  fs.mkdirSync(temporary, { recursive: true });
  const writes = [
    [path.join(temporary, "knowledge-core.json.gz"), gzipBytes(coreRaw), coreFile],
    [path.join(temporary, "manifest.json.gz"), gzipBytes(manifestRaw), manifestFile],
  ];
  for (const [tempFile, bytes] of writes) fs.writeFileSync(tempFile, bytes);
  for (const [tempFile, , targetFile] of writes) fs.renameSync(tempFile, targetFile);
  fs.rmdirSync(temporary);

  const audit = {
    dataset: "admission-route-safety-v3338-runtime",
    generatedAt: GENERATED_AT,
    before: { modelVersion: BASE_VERSION, ...COUNTS },
    after: {
      modelVersion: NEXT_VERSION,
      ...COUNTS,
      admissionRecordsAudited: evidence.admissionRecords,
      provincesAudited: evidence.provinces,
      collisionSummary: evidence.collisions,
      admissionEvidencePolicy: routePolicy,
      coreBytes: coreRaw.byteLength,
      coreSha256: sha256(coreRaw),
      manifestBytesBeforeLiteRebuild: manifestRaw.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestRaw),
    },
    boundary: "No admission, rank, plan, or source-note records changed. The release changes browser selection semantics and records a nationwide read-only collision audit.",
  };
  writeJson(auditFile, audit);
  console.log(JSON.stringify({
    status: "ok",
    modelVersion: NEXT_VERSION,
    counts: COUNTS,
    admissionRecordsAudited: evidence.admissionRecords,
    routeSafeDistinctGroups: evidence.collisions.routeSafeDistinctGroups,
  }, null, 2));
}

main();
