#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.304-yunnan-control-lines2026-art-thresholds-and-rank-image-provenance-847238records";
const NEXT_VERSION = "local-deterministic-v3.305-pending-vocational-schedule-audit-and-ui-847238records";
const EXPECTED_PROVINCES = ["上海", "天津", "江苏", "海南", "山西"];
const EXPECTED_RECORDS = 847238;
const EXPECTED_RANK_ROWS = 116656;
const EXPECTED_SOURCE_NOTES = 5110;

function parseArgs(argv) {
  const args = {
    audit: "data/admissions/official-pending-vocational-schedule-audit-2026-v3305.json",
    release: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-pending-vocational-schedule-audit-2026-v3305-runtime-manifest.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--audit") args.audit = argv[++index];
    else if (argv[index] === "--release") args.release = argv[++index];
    else if (argv[index] === "--runtime-manifest") args.runtimeManifest = argv[++index];
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value), "utf8");
}

function atomicWriteGzip(file, bytes) {
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, zlib.gzipSync(bytes, { level: 9, mtime: 0 }));
  fs.renameSync(temporary, file);
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function sorted(values) {
  return [...values].sort((left, right) => String(left).localeCompare(String(right), "zh-CN"));
}

function validateAudit(audit) {
  assert(audit.dataset === "official-pending-vocational-schedule-audit-2026-v3305", `Unexpected audit dataset: ${audit.dataset}`);
  assert(audit.checkedAt === "2026-07-17", `Unexpected checkedAt: ${audit.checkedAt}`);
  assert(audit.entries?.length === 5, `Expected five audit entries, got ${audit.entries?.length}`);
  assert(JSON.stringify(sorted(audit.entries.map((entry) => entry.province))) === JSON.stringify(sorted(EXPECTED_PROVINCES)), "Pending province inventory drifted");
  assert(new Set(audit.entries.map((entry) => entry.sourceId)).size === 5, "Audit source IDs must be unique");
  assert(audit.entries.every((entry) => entry.status === "pending-official-release"), "Every entry must remain pending");
  assert(audit.entries.every((entry) => entry.noHistoricalSubstitution === true), "Every entry must prohibit historical substitution");
  assert(audit.entries.filter((entry) => entry.expectedPublicationAt).length === 1, "Only one province has an official publication date");
  const shanghai = audit.entries.find((entry) => entry.province === "上海");
  assert(shanghai?.expectedPublicationAt === "2026-07-29" && shanghai.exactPublicationDateStatus === "official-announced", "Shanghai publication date drifted");
  assert(audit.entries.filter((entry) => entry.province !== "上海").every((entry) => entry.expectedPublicationAt === null && entry.exactPublicationDateStatus === "not-announced"), "Unannounced publication dates must remain null");
  assert(audit.entries.every((entry) => entry.primarySource?.url?.startsWith("http") && entry.sourceEvidence?.length > 0), "Every entry needs official source evidence");
}

function reviewFromEntry(entry, checkedAt) {
  return {
    checkedAt,
    status: entry.status,
    statusLabel: entry.statusLabel,
    expectedPublicationAt: entry.expectedPublicationAt,
    exactPublicationDateStatus: entry.exactPublicationDateStatus,
    reason: entry.reason,
    scoreBasisNote: entry.scoreBasisNote || "",
    noHistoricalSubstitution: entry.noHistoricalSubstitution,
    officialMilestones: entry.officialMilestones,
    primarySource: entry.primarySource,
    sourceEvidence: entry.sourceEvidence,
  };
}

function verifyApplied(core, manifest, audit) {
  assert(core.modelVersion === NEXT_VERSION, `Unexpected model version: ${core.modelVersion}`);
  assert(core.modelPolicy.version === NEXT_VERSION, "Model policy version drifted");
  assert(manifest.modelVersion === NEXT_VERSION, "Manifest model version drifted");
  assert(manifest.recordCount === EXPECTED_RECORDS, "Record count drifted");
  assert(manifest.rankConversionCount === EXPECTED_RANK_ROWS, "Rank count drifted");
  assert(core.admissionScoreLayer.structuredRecords === EXPECTED_RECORDS, "Core record count drifted");
  assert(core.admissionScoreLayer.sourceNotes.length === EXPECTED_SOURCE_NOTES, "Source-note count drifted");
  for (const entry of audit.entries) {
    const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === entry.sourceId);
    assert(note?.ordinaryVocationalReview?.checkedAt === audit.checkedAt, `${entry.province} review is missing`);
    assert(note.ordinaryVocationalReview.expectedPublicationAt === entry.expectedPublicationAt, `${entry.province} publication date drifted`);
    assert(note.ordinaryVocationalReview.noHistoricalSubstitution === true, `${entry.province} substitution guard drifted`);
  }
  assert(core.admissionScoreLayer.pendingOrdinaryVocationalAudit?.pendingCount === 5, "Pending audit summary drifted");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const auditFile = path.resolve(PROJECT_ROOT, args.audit);
  const releaseDir = path.resolve(PROJECT_ROOT, args.release);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const audit = JSON.parse(fs.readFileSync(auditFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);

  validateAudit(audit);
  if (core.modelVersion === NEXT_VERSION) {
    verifyApplied(core, manifest, audit);
    console.log(JSON.stringify({ status: "already-applied", modelVersion: NEXT_VERSION, pendingProvinces: EXPECTED_PROVINCES }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing to patch unexpected base model ${core.modelVersion}`);
  assert(core.modelPolicy.version === BASE_VERSION, "Base model-policy version drifted");
  assert(manifest.modelVersion === BASE_VERSION, "Base manifest model version drifted");
  assert(manifest.recordCount === EXPECTED_RECORDS, "Base record count drifted");
  assert(manifest.rankConversionCount === EXPECTED_RANK_ROWS, "Base rank count drifted");
  assert(core.admissionScoreLayer.structuredRecords === EXPECTED_RECORDS, "Base core record count drifted");
  assert(core.admissionScoreLayer.sourceNotes.length === EXPECTED_SOURCE_NOTES, "Base source-note count drifted");

  const beforeCoreBytes = zlib.gunzipSync(fs.readFileSync(coreFile));
  const beforeManifestBytes = zlib.gunzipSync(fs.readFileSync(manifestFile));
  for (const entry of audit.entries) {
    const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === entry.sourceId);
    assert(note, `${entry.province} source note is missing`);
    assert(note.province === entry.province, `${entry.province} source-note province drifted`);
    assert(note.ordinaryVocationalStatus === "pending-official-release", `${entry.province} is no longer pending`);
    assert(!note.ordinaryVocationalReview, `${entry.province} review already exists on the base model`);
    note.ordinaryVocationalCheckedAt = audit.checkedAt;
    note.ordinaryVocationalExpectedPublicationAt = entry.expectedPublicationAt;
    note.ordinaryVocationalReview = reviewFromEntry(entry, audit.checkedAt);
    note.relatedUrls = [...new Set([...(note.relatedUrls || []), entry.primarySource.url, ...entry.officialMilestones.map((item) => item.sourceUrl)])];
  }

  const layer = core.admissionScoreLayer;
  layer.pendingOrdinaryVocationalAudit = {
    dataset: audit.dataset,
    checkedAt: audit.checkedAt,
    pendingCount: audit.entries.length,
    provinces: audit.entries.map((entry) => entry.province),
    exactPublicationDateProvinces: audit.entries.filter((entry) => entry.exactPublicationDateStatus === "official-announced").map((entry) => entry.province),
    publicationDateUnannouncedProvinces: audit.entries.filter((entry) => entry.exactPublicationDateStatus === "not-announced").map((entry) => entry.province),
    noHistoricalSubstitution: true,
  };
  layer.currentFinding = "全国2026普通类通用控制线已覆盖31省。上海、江苏、天津、山西、海南普通专科线仍保持待发布：上海官方明确7月29日晚公布；其余4省只记录官方填报、录取节点或先填志愿后划线规则，不反推发布日期，不使用往年线替代。";
  core.generatedAt = audit.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;

  const coreBytes = encodeJson(core);
  atomicWriteGzip(coreFile, coreBytes);
  manifest.generatedAt = audit.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);
  atomicWriteGzip(manifestFile, manifestBytes);

  verifyApplied(core, manifest, audit);
  const runtimeManifest = {
    dataset: "official-pending-vocational-schedule-audit-2026-v3305-runtime",
    generatedAt: audit.generatedAt,
    auditFile: path.relative(PROJECT_ROOT, auditFile),
    releaseDir: path.relative(PROJECT_ROOT, releaseDir),
    before: {
      modelVersion: BASE_VERSION,
      recordCount: EXPECTED_RECORDS,
      sourceNotes: EXPECTED_SOURCE_NOTES,
      coreBytes: beforeCoreBytes.byteLength,
      coreSha256: sha256(beforeCoreBytes),
      manifestBytes: beforeManifestBytes.byteLength,
      manifestSha256: sha256(beforeManifestBytes),
    },
    after: {
      modelVersion: NEXT_VERSION,
      recordCount: EXPECTED_RECORDS,
      rankConversionCount: EXPECTED_RANK_ROWS,
      sourceNotes: EXPECTED_SOURCE_NOTES,
      pendingProvinces: audit.entries.map((entry) => entry.province),
      exactPublicationDateProvinces: ["上海"],
      unannouncedPublicationDateProvinces: audit.entries.filter((entry) => entry.province !== "上海").map((entry) => entry.province),
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
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
