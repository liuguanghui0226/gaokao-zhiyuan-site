#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.335-xizang-official-rank-source-confirmation-required-868426records";
const NEXT_VERSION = "local-deterministic-v3.336-xizang-rank-attestation-input-binding-required-868426records";
const SOURCE_ID = "official-xizang-control-lines-2025";
const COUNTS = { records: 868426, ranks: 133640, notes: 5136 };

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

function patchReadiness(container) {
  const row = container?.rows?.find((item) => item.province === "西藏");
  assert(row, "Xizang readiness row is missing");
  row.missing = [...new Set([
    ...(row.missing || []).filter((item) => !/官方公开渠道未提供可计算一分一段/.test(item)),
    "官方公开渠道未提供可计算一分一段（手填位次须确认来自考生本人官方查询）",
  ])].sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function main() {
  if (ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const releaseDir = path.join(ROOT, "site/data/release-v3.275");
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const auditFile = path.join(ROOT, "data/admissions/xizang-rank-attestation-binding-v3336-runtime-manifest.json");
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);

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
  assert(manifest.shards["西藏"]?.rankConversions === 0, "Xizang rank conversions must remain empty");

  const note = core.admissionScoreLayer.sourceNotes.find((item) => item.id === SOURCE_ID);
  assert(note, "Xizang official source note is missing");
  assert(note.publicRankConversionAvailable === false, "Xizang public rank boundary drifted");
  note.manualRankSourceConfirmationRequired = true;
  note.acceptedManualRankSources = ["official-personal-query"];
  note.manualRankSourceLabel = "西藏官方个人查询";
  note.manualRankAttestationBoundFields = [
    "score",
    "rank",
    "province",
    "subject",
    "candidateCategory",
    "rankUsage",
  ];
  note.staleRecommendationInvalidationRequired = true;
  note.officialPublicDisclosureAudit = {
    checkedAt: "2026-07-30",
    listUrl: "http://zsks.edu.xizang.gov.cn/71/74/index.html",
    reviewedListPages: 12,
    reviewedDateRange: ["2021-06-30", "2026-07-19"],
    notices2025: 42,
    provinceWideFormalAdmissionTablesFound: 0,
    publicRankConversionTablesFound: 0,
    finding: "已核查考试院公告目录和2025招生规定；未在所核官方公开页面发现普通本科或专科省级投档表、录取最低位次表或一分一段表。",
    limitation: "仅说明所核官方公开页面未发现，不证明其他渠道绝对不存在；不得据此生成缺失数据。",
  };
  note.cautions = [...new Set([
    ...(note.cautions || []),
    "手填位次只有在用户确认来自考生本人官方查询后才可进入分段、院校比较和排序。",
    "确认后若分数、位次、省份、科类、A/B类或成绩口径变化，确认立即失效且旧推荐必须清空。",
  ])].sort((left, right) => left.localeCompare(right, "zh-CN"));

  patchReadiness(core.admissionScoreLayer.provinceReadiness);
  patchReadiness(core.admissionScoreLayer.coverage?.provinceReadiness);
  core.generatedAt = "2026-07-30T12:00:00+08:00";
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.admissionScoreLayer.currentFinding = `${core.admissionScoreLayer.currentFinding} 西藏位次确认现已绑定当前分数、位次、省份、科类、A/B类和成绩口径；任一字段变化都会使确认及旧推荐失效。`;
  core.admissionScoreLayer.downgradeReason = `${String(core.admissionScoreLayer.downgradeReason || "").replaceAll(BASE_VERSION, NEXT_VERSION)} 西藏位次确认只对生成推荐时的当前输入有效；关键输入变化后必须重新确认。`;

  manifest.generatedAt = core.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.336",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };

  const coreRaw = jsonBytes(core);
  manifest.core.bytes = coreRaw.byteLength;
  manifest.core.sha256 = sha256(coreRaw);
  const manifestRaw = jsonBytes(manifest);
  const temporary = path.join(releaseDir, `.v3336-${process.pid}`);
  fs.mkdirSync(temporary, { recursive: true });
  const writes = [
    [path.join(temporary, "knowledge-core.json.gz"), gzipBytes(coreRaw), coreFile],
    [path.join(temporary, "manifest.json.gz"), gzipBytes(manifestRaw), manifestFile],
  ];
  for (const [tempFile, bytes] of writes) fs.writeFileSync(tempFile, bytes);
  for (const [tempFile, , targetFile] of writes) fs.renameSync(tempFile, targetFile);
  fs.rmdirSync(temporary);

  const audit = {
    dataset: "xizang-rank-attestation-binding-v3336-runtime",
    generatedAt: core.generatedAt,
    before: { modelVersion: BASE_VERSION, ...COUNTS },
    after: {
      modelVersion: NEXT_VERSION,
      ...COUNTS,
      xizangRankConversions: 0,
      manualRankSourceConfirmationRequired: true,
      acceptedManualRankSources: note.acceptedManualRankSources,
      manualRankAttestationBoundFields: note.manualRankAttestationBoundFields,
      staleRecommendationInvalidationRequired: true,
      officialPublicDisclosureAudit: note.officialPublicDisclosureAudit,
      coreBytes: coreRaw.byteLength,
      coreSha256: sha256(coreRaw),
      manifestBytesBeforeLiteRebuild: manifestRaw.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestRaw),
    },
    boundary: "No admission or rank records were added. Official-rank confirmation is bound to the current Tibet form inputs, and reviewed public pages are not treated as missing data.",
  };
  writeJson(auditFile, audit);
  console.log(JSON.stringify({ status: "ok", modelVersion: NEXT_VERSION, counts: COUNTS }, null, 2));
}

main();
