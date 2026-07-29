#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.334-xizang-official-category-required-no-public-rank-guard-868426records";
const NEXT_VERSION = "local-deterministic-v3.335-xizang-official-rank-source-confirmation-required-868426records";
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
  const auditFile = path.join(ROOT, "data/admissions/xizang-rank-source-confirmation-v3335-runtime-manifest.json");
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
  note.cautions = [...new Set([
    ...(note.cautions || []),
    "手填位次只有在用户确认来自考生本人官方查询后才可进入分段、院校比较和排序。",
  ])].sort((left, right) => left.localeCompare(right, "zh-CN"));

  patchReadiness(core.admissionScoreLayer.provinceReadiness);
  patchReadiness(core.admissionScoreLayer.coverage?.provinceReadiness);
  core.generatedAt = "2026-07-30T00:00:00+08:00";
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.admissionScoreLayer.currentFinding = `${core.admissionScoreLayer.currentFinding} 西藏手填位次新增来源强制确认：未选择“西藏官方个人查询”时，位次从模型输入中排除并强制降为C级。`;
  core.admissionScoreLayer.downgradeReason = `${String(core.admissionScoreLayer.downgradeReason || "").replaceAll(BASE_VERSION, NEXT_VERSION)} 西藏手填位次必须确认来自考生本人官方查询；未确认来源的数字不参与分段、院校比较或排序。`;

  manifest.generatedAt = core.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.335",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };

  const coreRaw = jsonBytes(core);
  manifest.core.bytes = coreRaw.byteLength;
  manifest.core.sha256 = sha256(coreRaw);
  const manifestRaw = jsonBytes(manifest);
  const temporary = path.join(releaseDir, `.v3335-${process.pid}`);
  fs.mkdirSync(temporary, { recursive: true });
  const writes = [
    [path.join(temporary, "knowledge-core.json.gz"), gzipBytes(coreRaw), coreFile],
    [path.join(temporary, "manifest.json.gz"), gzipBytes(manifestRaw), manifestFile],
  ];
  for (const [tempFile, bytes] of writes) fs.writeFileSync(tempFile, bytes);
  for (const [tempFile, , targetFile] of writes) fs.renameSync(tempFile, targetFile);
  fs.rmdirSync(temporary);

  const audit = {
    dataset: "xizang-rank-source-confirmation-v3335-runtime",
    generatedAt: core.generatedAt,
    before: { modelVersion: BASE_VERSION, ...COUNTS },
    after: {
      modelVersion: NEXT_VERSION,
      ...COUNTS,
      xizangRankConversions: 0,
      manualRankSourceConfirmationRequired: true,
      acceptedManualRankSources: note.acceptedManualRankSources,
      coreBytes: coreRaw.byteLength,
      coreSha256: sha256(coreRaw),
      manifestBytesBeforeLiteRebuild: manifestRaw.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestRaw),
    },
    boundary: "No admission or rank records were added. Unconfirmed Tibet manual ranks are excluded by the browser model.",
  };
  writeJson(auditFile, audit);
  console.log(JSON.stringify({ status: "ok", modelVersion: NEXT_VERSION, counts: COUNTS }, null, 2));
}

main();
