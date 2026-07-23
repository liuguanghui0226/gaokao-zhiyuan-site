#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.328-shanghai-official-rank2025-policy-bonus-inclusive-undergraduate-floor-aligned-868426records";
const sourceId = "official-shanghai-rank-2025-v3328";
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
const item = manifest.shards["上海"];
const shardFile = path.join(releaseDir, `${path.basename(item.file, ".json")}.json.gz`);
const shard = readJson(shardFile);
const applied = JSON.parse(fs.readFileSync(
  path.join(projectRoot, "data/admissions/official-shanghai-rank-conversion-2025-v3328-runtime-manifest.json"),
  "utf8",
));

assert.equal(core.modelVersion, modelVersion);
assert.equal(lite.modelVersion, modelVersion);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 129194);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5132);
assert.equal(manifest.rankConversionCount, 129194);
assert.equal(manifest.runtimeProfile.version, "v3.328");
assert.deepEqual(
  [core.admissionScoreLayer.rankSourceCoverage.sources, core.admissionScoreLayer.rankSourceCoverage.parsedSources],
  [217, 151],
);

assert.equal(shard.records.length, 6247);
assert.equal(shard.rankConversions.length, 436);
assert.equal(item.rankConversions, 436);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === sourceId).length, 222);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "综合" && row.score === 600)?.rankEnd, 1250);

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 1964);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 1708);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 256);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 1480);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 437);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 47);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 1);
assert.equal(linked.filter((row) => row.subjectType === "综合改革").length, 29);
assert.ok(linked.every((row) => row.rankDerivedFromScore === true));
assert.ok(linked.every((row) => row.rankScoreBasis === "gaokao-total-including-policy-bonus"));
assert.ok(linked.every((row) => row.rankPolicyBonusIncluded === true));
assert.ok(linked.every((row) => row.rankRangeText.endsWith("（最低分换算）")));

const special = shard.records.filter((row) => (
  row.year === 2025
  && ["综合", "综合改革"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= 402
  && Number(row.minScore) <= 660
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank)
));
assert.equal(special.length, 14);
assert.ok(special.every((row) => row.rankSourceId !== sourceId));
assert.equal(shard.records.filter((row) => row.year === 2025 && row.subjectType === "物理类" && row.rankSourceId === sourceId).length, 0);
assert.equal(shard.records.filter((row) => row.year === 2025 && row.subjectType === "历史类" && row.rankSourceId === sourceId).length, 0);

const rankSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.equal(rankSource.scoreBasis, "gaokao-total-including-policy-bonus");
assert.equal(rankSource.rankPolicyBonusIncluded, true);
const undergraduate = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-shanghai-undergraduate-2025");
assert.equal(undergraduate.shanghai2025ScoreDerivedRankRecords, 1331);
assert.equal(undergraduate.shanghai2025RankPolicyBonusIncluded, true);
assert.ok(core.admissionScoreLayer.currentFinding.includes("1964条上海2025综合普通类整数最低分"));
assert.ok(core.admissionScoreLayer.currentFinding.includes("4234条无原生位次记录全部禁止自动套表"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("9个0人分数冲突"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("低于公开分数档"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("口径含照顾加分"));

assert.equal(applied.dataset, "official-shanghai-rank-conversion-2025-v3328-runtime");
assert.equal(applied.after.linkedAdmissionRecords, 1964);
assert.equal(applied.after.officialLinkedRecords, 1708);
assert.equal(applied.after.specialPathExcludedRecords, 14);
assert.equal(applied.after.sourceNotes, 5132);
assert.equal(sha256(readBytes(shardFile)), item.sha256);
assert.equal(sha256(readBytes(coreFile)), manifest.core.sha256);
assert.equal(sha256(readBytes(liteFile)), manifest.coreLite.sha256);

console.log("Shanghai 2025 official rank runtime v3.328 tests passed");
