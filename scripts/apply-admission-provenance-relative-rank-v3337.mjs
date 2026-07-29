#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.336-xizang-rank-attestation-input-binding-required-868426records";
const NEXT_VERSION = "local-deterministic-v3.337-admission-provenance-relative-rank-dedup-868426records";
const COUNTS = { records: 868426, ranks: 133640, notes: 5136 };
const ELITE_TAGS = new Set(["985", "211", "双一流", "C9"]);
const TARGET_SCHOOL = "南昌大学共青学院";
const GENERATED_AT = "2026-07-30T18:00:00+08:00";

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

function isFalseEliteRecord(record) {
  return record.schoolName === TARGET_SCHOOL &&
    (record.schoolTags || []).includes("民办/独立学院") &&
    (record.schoolTags || []).some((tag) => ELITE_TAGS.has(tag));
}

function main() {
  if (ROOT.startsWith("/Volumes/")) throw new Error("Refusing external-volume processing; run from internal APFS staging.");
  const releaseDir = path.join(ROOT, "site/data/release-v3.275");
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const jiangxiFile = path.join(releaseDir, "jiangxi.json.gz");
  const auditFile = path.join(ROOT, "data/admissions/admission-provenance-relative-rank-v3337-runtime-manifest.json");
  const evidenceFile = path.join(ROOT, "data/admissions/evidence-v3337-admission-provenance-and-rank-fit-manifest.json");
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const jiangxi = readGzipJson(jiangxiFile);

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
  assert(jiangxi.province === "江西", "Jiangxi shard province drifted");
  assert(jiangxi.records.length === manifest.shards["江西"].records, "Jiangxi shard record count drifted");

  const falseEliteBefore = jiangxi.records.filter(isFalseEliteRecord);
  assert(falseEliteBefore.length === 22, `Expected 22 false elite records, found ${falseEliteBefore.length}`);
  for (const record of falseEliteBefore) {
    record.schoolTags = (record.schoolTags || []).filter((tag) => !ELITE_TAGS.has(tag));
  }
  const falseEliteAfter = jiangxi.records.filter(isFalseEliteRecord);
  assert(falseEliteAfter.length === 0, "False elite tags remain after correction");
  assert(
    falseEliteBefore.every((record) => record.schoolTags.includes("民办/独立学院")),
    "Independent-college boundary tag was removed",
  );

  core.generatedAt = GENERATED_AT;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.modelPolicy.reliabilityDefinition = "全国通用录取分数据层优先；按省份、年份、科类/选科、批次、专业组和专业分隔离计算；第三方摘要最高B且单列待复核；位次边界按相对比例分层；未导入目标省份数据或本省数据薄弱时自动降级，不输出录取概率。";
  core.modelPolicy.formula = "有可核验结构化录取分时：总分 = 40%录取分/位次安全边界 + 20%硬匹配 + 15%专业适配 + 10%城市预算 + 10%证据充分度 + 5%风险控制；位次边界采用考生位次/录取最低位次比例；第三方摘要最高B并隔离为待复核线索。";
  core.modelPolicy.admissionEvidencePolicy = {
    thirdPartyMaximumConfidence: "B",
    thirdPartyExecutable: false,
    thirdPartyTier: "待复核数据候选",
    logicalDedupeFields: ["province", "subjectType", "school", "major", "majorGroup", "dataType"],
    relativeRankThresholds: {
      safe: 0.82,
      steady: 0.94,
      borderline: 1.03,
      reach: 1.18,
    },
  };
  core.modelPolicy.confidenceRules = [
    "A：输入完整，且命中同省同科类近年考试院或院校官网原表中的专业录取分、最低位次和招生计划；仍必须官方核验。",
    "A-：输入完整且有考试院或院校官网原表中的院校/专业组投档分，但缺少目标专业录取分；只能强推院校，不能强推专业。",
    "B：第三方录取摘要最高为B，或本地证据充足但缺少可核验结构化录取分；结果只作为候选核验清单。",
    "C：只适合作为探索方向；通常因为输入不足、证据弱或触发预算/红线风险。",
  ];
  core.admissionScoreLayer.currentFinding = `${core.admissionScoreLayer.currentFinding} 录取证据现按来源分级：第三方最低分摘要最高B且单列待复核；同一院校专业按逻辑字段去重，位次分层改用相对比例。`;
  core.admissionScoreLayer.downgradeReason = `${String(core.admissionScoreLayer.downgradeReason || "").replaceAll(BASE_VERSION, NEXT_VERSION)} 第三方摘要不能直接进入正式志愿单；独立学院不得继承母体高校的985、211、双一流或C9标签。`;

  jiangxi.generatedAt = GENERATED_AT;
  manifest.generatedAt = GENERATED_AT;
  manifest.modelVersion = NEXT_VERSION;
  manifest.runtimeProfile = {
    ...(manifest.runtimeProfile || {}),
    version: "v3.337",
    initialCore: "knowledge-core-lite.json.gz",
    fullEvidenceCore: "knowledge-core.json.gz",
  };

  const coreRaw = jsonBytes(core);
  const jiangxiRaw = jsonBytes(jiangxi);
  manifest.core.bytes = coreRaw.byteLength;
  manifest.core.sha256 = sha256(coreRaw);
  manifest.shards["江西"].bytes = jiangxiRaw.byteLength;
  manifest.shards["江西"].sha256 = sha256(jiangxiRaw);
  const manifestRaw = jsonBytes(manifest);
  const temporary = path.join(releaseDir, `.v3337-${process.pid}`);
  fs.mkdirSync(temporary, { recursive: true });
  const writes = [
    [path.join(temporary, "knowledge-core.json.gz"), gzipBytes(coreRaw), coreFile],
    [path.join(temporary, "jiangxi.json.gz"), gzipBytes(jiangxiRaw), jiangxiFile],
    [path.join(temporary, "manifest.json.gz"), gzipBytes(manifestRaw), manifestFile],
  ];
  for (const [tempFile, bytes] of writes) fs.writeFileSync(tempFile, bytes);
  for (const [tempFile, , targetFile] of writes) fs.renameSync(tempFile, targetFile);
  fs.rmdirSync(temporary);

  const policy = core.modelPolicy.admissionEvidencePolicy;
  const audit = {
    dataset: "admission-provenance-relative-rank-v3337-runtime",
    generatedAt: GENERATED_AT,
    before: { modelVersion: BASE_VERSION, ...COUNTS, falseEliteRecords: falseEliteBefore.length },
    after: {
      modelVersion: NEXT_VERSION,
      ...COUNTS,
      falseEliteRecords: falseEliteAfter.length,
      correctedRecords: falseEliteBefore.length,
      correctedSchool: TARGET_SCHOOL,
      admissionEvidencePolicy: policy,
      coreBytes: coreRaw.byteLength,
      coreSha256: sha256(coreRaw),
      jiangxiBytes: jiangxiRaw.byteLength,
      jiangxiSha256: sha256(jiangxiRaw),
      manifestBytesBeforeLiteRebuild: manifestRaw.byteLength,
      manifestSha256BeforeLiteRebuild: sha256(manifestRaw),
    },
    boundary: "No admission or rank records were added or deleted. Third-party score summaries are non-executable evidence, rank fit uses relative ratios, and independent colleges do not inherit parent-university elite tags.",
  };
  const evidence = {
    dataset: "evidence-v3337-admission-provenance-and-rank-fit",
    generatedAt: GENERATED_AT,
    triggerProfile: {
      province: "江西",
      score: 593,
      rank: 17798,
      subject: "物理/理科",
      disciplineFocus: "08",
      interests: ["计算机", "软件", "数据", "数字媒体", "虚拟现实"],
    },
    observedRisks: [
      "第三方院校分数摘要曾显示为A并被标作官方来源",
      "同一院校专业因记录ID不同重复进入清单",
      "独立学院继承母体高校的211和双一流标签",
      "固定绝对位次差无法适配全国不同位次规模",
    ],
    controls: policy,
    dataCorrection: {
      school: TARGET_SCHOOL,
      records: falseEliteBefore.length,
      removedTags: [...ELITE_TAGS],
      retainedTag: "民办/独立学院",
      sampleIds: falseEliteBefore.slice(0, 5).map((record) => record.id),
    },
    limitation: "本清单记录模型控制与数据纠错，不把第三方摘要升级为官方数据，也不声称输出录取概率。",
  };
  writeJson(auditFile, audit);
  writeJson(evidenceFile, evidence);
  console.log(JSON.stringify({
    status: "ok",
    modelVersion: NEXT_VERSION,
    counts: COUNTS,
    correctedRecords: falseEliteBefore.length,
  }, null, 2));
}

main();
