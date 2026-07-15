#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const PROJECT_ROOT = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const BASE_VERSION = "local-deterministic-v3.280-jiangxi-control-lines2026-846462records";
const NEXT_VERSION = "local-deterministic-v3.281-xizang-control-provenance-and-low-score-safety-846462records";
const SOURCE_ID = "official-xizang-control-lines-2026";
const EXPECTED_RECORDS = 22;

function parseArgs(argv) {
  const args = {
    verificationFile: "data/admissions/official-xizang-control-lines-2026-government-verification.json",
    releaseDir: "site/data/release-v3.275",
    runtimeManifest: "data/admissions/official-xizang-control-lines-2026-v3281-runtime-manifest.json",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--verification") args.verificationFile = argv[++index];
    else if (item === "--release") args.releaseDir = argv[++index];
    else if (item === "--runtime-manifest") args.runtimeManifest = argv[++index];
  }
  return args;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function readGzipJson(file) {
  return JSON.parse(zlib.gunzipSync(fs.readFileSync(file)).toString("utf8"));
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

function routeFor(record) {
  if (record.candidateClass === "部队生源" || /部队生源/.test(record.majorName || "")) return "military";
  if ((record.disciplineCodes || []).some((code) => ["04", "13"].includes(code)) || /艺体/.test(record.majorName || "")) return "art-sports";
  return "ordinary";
}

function rowKey(row) {
  return [row.route, row.subjectType, row.batch, row.candidateClass, Number(row.minScore)].join("|");
}

function patchRecord(record, sourcePatch) {
  const route = routeFor(record);
  const special = route !== "ordinary";
  record.candidateCategory = record.candidateClass;
  record.controlLineKind = route === "ordinary" ? "普通生源" : route === "art-sports" ? "艺术体育类文化线" : "部队生源";
  record.controlLineSection = record.batch;
  record.cultureScoreLine = record.minScore;
  record.formalScoreScope = special ? "special-path-only" : "control-line-only";
  record.sourceQuality = sourcePatch.quality;
  record.sourceUrl = sourcePatch.url;
  record.sourceMirrorUrl = sourcePatch.mirrorUrl;
  record.sourcePublishedAt = sourcePatch.publishedAt;
  record.sourceOfficialAuthority = "西藏自治区教育考试院";
  if (route === "art-sports") {
    record.rankUsage = "art-sports";
    record.rankUsageLabel = "西藏艺术体育类文化线";
    record.schoolTags = [...new Set((record.schoolTags || []).map((tag) => tag === "普通生源" ? "艺术体育类" : tag).concat("特殊路径"))];
  } else if (route === "military") {
    record.rankUsage = "military";
    record.rankUsageLabel = "部队生源";
    record.schoolTags = [...new Set((record.schoolTags || []).concat("特殊路径"))];
  }
  record.cautions = [
    "这是西藏自治区教育考试院公布、自治区人民政府公开页面逐行复核的录取最低控制分数线，只能作为批次资格边界。",
    "控制线不等同于院校投档线、专业录取分、一分一段或录取概率。",
    route === "ordinary"
      ? "普通本科和专科线只用于同科类、同A/B考生类别的资格路由；未选择类别时按较高边界保守判断。"
      : "本记录属于艺术体育或部队生源特殊路径，不得进入普通考生本科/专科边界判断。",
    "西藏仍缺公开可计算一分一段和省级全量普通/高职投档录取表，正式填报必须回官方系统核验。",
  ];
  return route;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const verificationFile = path.resolve(PROJECT_ROOT, args.verificationFile);
  const releaseDir = path.resolve(PROJECT_ROOT, args.releaseDir);
  const runtimeManifestFile = path.resolve(PROJECT_ROOT, args.runtimeManifest);
  const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
  const manifestFile = path.join(releaseDir, "manifest.json.gz");
  const shardFile = path.join(releaseDir, "xizang.json.gz");
  const payload = JSON.parse(fs.readFileSync(verificationFile, "utf8"));
  const core = readGzipJson(coreFile);
  const manifest = readGzipJson(manifestFile);
  const shard = readGzipJson(shardFile);

  assert(payload.dataset === "official-xizang-control-lines-2026-government-verification", `Unexpected verification dataset: ${payload.dataset}`);
  assert(payload.verificationRows?.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} verification rows`);
  assert(payload.sourcePatch?.id === SOURCE_ID, "Source patch id mismatch");
  const sourceRecords = shard.records.filter((record) => record.sourceId === SOURCE_ID);
  assert(sourceRecords.length === EXPECTED_RECORDS, `Expected ${EXPECTED_RECORDS} existing source records, got ${sourceRecords.length}`);

  const actualKeys = sourceRecords.map((record) => rowKey({ ...record, route: routeFor(record) })).sort();
  const expectedKeys = payload.verificationRows.map(rowKey).sort();
  assert(JSON.stringify(actualKeys) === JSON.stringify(expectedKeys), "Existing Xizang control-line matrix does not match the government verification page");

  if (core.modelVersion === NEXT_VERSION) {
    assert(manifest.modelVersion === NEXT_VERSION, "Already-applied manifest version drift");
    assert(sourceRecords.every((record) => record.formalScoreScope && record.controlLineSection && record.sourceMirrorUrl === payload.sourcePatch.mirrorUrl), "Already-applied record patch drift");
    console.log(JSON.stringify({ status: "already-applied", modelVersion: NEXT_VERSION, verifiedRecords: sourceRecords.length }, null, 2));
    return;
  }

  assert(core.modelVersion === BASE_VERSION, `Refusing unexpected base model ${core.modelVersion}`);
  assert(manifest.modelVersion === BASE_VERSION, `Refusing unexpected manifest model ${manifest.modelVersion}`);
  assert(manifest.recordCount === 846462, `Refusing unexpected record count ${manifest.recordCount}`);
  assert(manifest.shards?.["西藏"]?.records === 28315, `Refusing unexpected Xizang shard count ${manifest.shards?.["西藏"]?.records}`);
  const sourceNoteIndex = core.admissionScoreLayer.sourceNotes.findIndex((note) => note.id === SOURCE_ID);
  assert(sourceNoteIndex >= 0, "Existing Xizang source note is missing");

  const before = {
    modelVersion: core.modelVersion,
    recordCount: manifest.recordCount,
    xizangRecords: shard.records.length,
    coreSha256: sha256(zlib.gunzipSync(fs.readFileSync(coreFile))),
    xizangSha256: sha256(zlib.gunzipSync(fs.readFileSync(shardFile))),
  };

  const routeCounts = { ordinary: 0, "art-sports": 0, military: 0 };
  for (const record of sourceRecords) routeCounts[patchRecord(record, payload.sourcePatch)] += 1;
  assert(routeCounts.ordinary === 12 && routeCounts["art-sports"] === 8 && routeCounts.military === 2, `Unexpected route patch counts ${JSON.stringify(routeCounts)}`);

  core.generatedAt = payload.generatedAt;
  core.modelVersion = NEXT_VERSION;
  core.modelPolicy.version = NEXT_VERSION;
  core.admissionScoreLayer.currentFinding = "西藏2026普通本科/专科控制线已按A/B考生类别接入资格路由，并由自治区政府公开HTML逐行复核；低于普通专科线的结果强制降为路径探索，艺体和部队生源继续隔离。西藏一分一段及省级全量投档录取表缺口仍未关闭。";
  core.admissionScoreLayer.sourceNotes[sourceNoteIndex] = {
    ...core.admissionScoreLayer.sourceNotes[sourceNoteIndex],
    ...payload.sourcePatch,
    file: core.admissionScoreLayer.sourceNotes[sourceNoteIndex].file,
  };

  const shardBytes = encodeJson(shard);
  const coreBytes = encodeJson(core);
  atomicWriteGzip(shardFile, shardBytes);
  atomicWriteGzip(coreFile, coreBytes);

  manifest.generatedAt = payload.generatedAt;
  manifest.modelVersion = NEXT_VERSION;
  manifest.shards["西藏"].bytes = shardBytes.byteLength;
  manifest.shards["西藏"].sha256 = sha256(shardBytes);
  manifest.core.bytes = coreBytes.byteLength;
  manifest.core.sha256 = sha256(coreBytes);
  const manifestBytes = encodeJson(manifest);
  atomicWriteGzip(manifestFile, manifestBytes);

  const runtimeManifest = {
    dataset: "official-xizang-control-lines-2026-v3281-runtime",
    generatedAt: payload.generatedAt,
    sourceId: SOURCE_ID,
    verificationFile: path.relative(PROJECT_ROOT, verificationFile),
    releaseDir: path.relative(PROJECT_ROOT, releaseDir),
    before,
    after: {
      modelVersion: NEXT_VERSION,
      recordCount: manifest.recordCount,
      xizangRecords: shard.records.length,
      verifiedRecords: sourceRecords.length,
      routeCounts,
      sourceMirrorUrl: payload.sourcePatch.mirrorUrl,
      coreBytes: coreBytes.byteLength,
      coreSha256: sha256(coreBytes),
      xizangBytes: shardBytes.byteLength,
      xizangSha256: sha256(shardBytes),
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
