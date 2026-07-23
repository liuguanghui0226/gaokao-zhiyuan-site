#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.329-anhui-official-rank2025-policy-bonus-inclusive-full-table-aligned-868426records";
const sourceId = "official-tianjin-rank-2025-v3327";
const readBytes = (file) => zlib.gunzipSync(fs.readFileSync(file));
const readJson = (file) => JSON.parse(readBytes(file));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

assert.ok(!projectRoot.startsWith("/Volumes/"), "Test must run from internal APFS staging");
const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
const liteFile = path.join(releaseDir, "knowledge-core-lite.json.gz");
const manifestFile = path.join(releaseDir, "manifest.json.gz");
const core = readJson(coreFile);
const lite = readJson(liteFile);
const manifest = readJson(manifestFile);
const item = manifest.shards["天津"];
const shardFile = path.join(releaseDir, `${path.basename(item.file, ".json")}.json.gz`);
const shard = readJson(shardFile);
const applied = JSON.parse(fs.readFileSync(
  path.join(projectRoot, "data/admissions/official-tianjin-rank-conversion-2025-v3327-runtime-manifest.json"),
  "utf8",
));

assert.equal(core.modelVersion, modelVersion);
assert.equal(lite.modelVersion, modelVersion);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 130155);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5133);
assert.equal(manifest.rankConversionCount, 130155);
assert.equal(manifest.runtimeProfile.version, "v3.329");
assert.deepEqual(
  [core.admissionScoreLayer.rankSourceCoverage.sources, core.admissionScoreLayer.rankSourceCoverage.parsedSources],
  [218, 152],
);

assert.equal(shard.records.length, 10037);
assert.equal(shard.rankConversions.length, 762);
assert.equal(item.rankConversions, 762);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === sourceId).length, 381);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "综合" && row.score === 600)?.rankEnd, 12965);

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 3195);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 2910);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 285);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 2535);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 605);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 55);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 33);
assert.equal(linked.filter((row) => row.subjectType === "综合改革").length, 39);
assert.ok(linked.every((row) => row.rankDerivedFromScore === true));
assert.ok(linked.every((row) => row.rankScoreBasis === "gaokao-total-including-policy-bonus"));
assert.ok(linked.every((row) => row.rankPolicyBonusIncluded === true));
assert.ok(linked.every((row) => row.rankRangeText.endsWith("（最低分换算）")));

const special = shard.records.filter((row) => (
  row.year === 2025
  && ["综合", "综合改革"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= 300
  && Number(row.minScore) <= 750
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank)
));
assert.equal(special.length, 20);
assert.ok(special.every((row) => row.rankSourceId !== sourceId));
assert.equal(shard.records.filter((row) => row.year === 2025 && row.subjectType === "物理类" && row.rankSourceId === sourceId).length, 0);
assert.equal(shard.records.filter((row) => row.year === 2025 && row.subjectType === "历史类" && row.rankSourceId === sourceId).length, 0);

const rankSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.equal(rankSource.scoreBasis, "gaokao-total-including-policy-bonus");
assert.equal(rankSource.rankPolicyBonusIncluded, true);
const stageA = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-tianjin-undergraduate-a-2025");
assert.equal(stageA.tianjin2025ScoreDerivedRankRecords, 2077);
assert.equal(stageA.tianjin2025RankPolicyBonusIncluded, true);
assert.ok(core.admissionScoreLayer.currentFinding.includes("天津2025年381条官方含政策加分总成绩分数档已为3195条普通记录补充位次"));
assert.ok(core.admissionScoreLayer.currentFinding.includes("4234条无原生位次记录全部禁止自动套表"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("9个0人分数冲突"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("低于公开分数档"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("口径含照顾加分"));

assert.equal(applied.dataset, "official-tianjin-rank-conversion-2025-v3327-runtime");
assert.equal(applied.after.linkedAdmissionRecords, 3195);
assert.equal(applied.after.officialLinkedRecords, 2910);
assert.equal(applied.after.specialPathExcludedRecords, 20);
assert.equal(applied.after.sourceNotes, 5131);
assert.equal(sha256(readBytes(shardFile)), item.sha256);
assert.equal(sha256(readBytes(coreFile)), manifest.core.sha256);
assert.equal(sha256(readBytes(liteFile)), manifest.coreLite.sha256);

console.log("Tianjin 2025 official rank runtime v3.327 tests passed");
