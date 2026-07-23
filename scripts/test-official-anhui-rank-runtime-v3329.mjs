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
const sourceId = "official-anhui-rank-2025-v3329";
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
const item = manifest.shards["安徽"];
const shardFile = path.join(releaseDir, `${path.basename(item.file, ".json")}.json.gz`);
const shard = readJson(shardFile);
const applied = JSON.parse(fs.readFileSync(
  path.join(projectRoot, "data/admissions/official-anhui-rank-conversion-2025-v3329-runtime-manifest.json"),
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
assert.equal(core.admissionScoreLayer.rankSourceCoverage.parsedRecords, 130155);

assert.equal(shard.records.length, 16250);
assert.equal(shard.rankConversions.length, 1937);
assert.equal(item.rankConversions, 1937);
assert.equal(shard.rankConversions.filter((row) => row.sourceId === sourceId).length, 961);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "历史类" && row.score === 600)?.rankEnd, 3415);
assert.equal(shard.rankConversions.find((row) => row.year === 2025 && row.subjectType === "物理类" && row.score === 600)?.rankEnd, 27089);

const linked = shard.records.filter((row) => row.rankSourceId === sourceId);
assert.equal(linked.length, 1804);
assert.equal(linked.filter((row) => row.subjectType === "历史类").length, 480);
assert.equal(linked.filter((row) => row.subjectType === "物理类").length, 1324);
assert.equal(linked.filter((row) => String(row.sourceQuality || "").startsWith("official")).length, 658);
assert.equal(linked.filter((row) => !String(row.sourceQuality || "").startsWith("official")).length, 1146);
assert.equal(linked.filter((row) => row.dataType === "major-admission").length, 1633);
assert.equal(linked.filter((row) => row.dataType === "institution-admission").length, 157);
assert.equal(linked.filter((row) => row.dataType === "major-group-admission").length, 8);
assert.equal(linked.filter((row) => row.dataType === "school-admission-summary").length, 6);
assert.equal(linked.filter((row) => row.minRankStart === 1).length, 0);
assert.ok(linked.every((row) => row.rankDerivedFromScore === true));
assert.ok(linked.every((row) => row.rankScoreBasis === "gaokao-total-including-policy-bonus"));
assert.ok(linked.every((row) => row.rankPolicyBonusIncluded === true));
assert.ok(linked.every((row) => row.rankRangeText.endsWith("（最低分换算）")));

const special = shard.records.filter((row) => (
  row.year === 2025
  && ["历史类", "物理类"].includes(row.subjectType)
  && Number.isInteger(Number(row.minScore))
  && Number(row.minScore) >= 200
  && Number(row.minScore) <= 750
  && row.formalScoreScope === "special-path-only"
  && !Number(row.minRankEnd || row.minRank)
));
assert.equal(special.length, 179);
assert.ok(special.every((row) => row.rankSourceId !== sourceId));
assert.equal(shard.records.filter((row) => row.year === 2025 && ["艺术类", "体育类"].includes(row.subjectType) && row.rankSourceId === sourceId).length, 0);
assert.equal(shard.records.filter((row) => row.year === 2025 && Number(row.minScore) < 200 && row.rankSourceId === sourceId).length, 0);

const rankSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.equal(rankSource.scoreBasis, "gaokao-total-including-policy-bonus");
assert.equal(rankSource.rankPolicyBonusIncluded, true);
const hdu = core.admissionScoreLayer.sourceNotes.find((note) => note.id === "official-hdu-national-2014-2025-school-major-admission");
assert.equal(hdu.anhui2025ScoreDerivedRankRecords, 25);
assert.equal(hdu.anhui2025RankPolicyBonusIncluded, true);
assert.ok(hdu.rankAlignmentBoundary.includes("安徽2025年25条"));
assert.ok(hdu.rankAlignmentBoundary.includes("安徽按历史/物理分别使用含加分且公开至200分的完整分档表"));
assert.ok(core.admissionScoreLayer.currentFinding.includes("1804条安徽历史类/物理类普通整数最低分"));
assert.ok(core.admissionScoreLayer.currentFinding.includes("179条特殊路径继续隔离"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("199分及以下"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("艺术体育综合分"));

assert.equal(applied.dataset, "official-anhui-rank-conversion-2025-v3329-runtime");
assert.equal(applied.after.linkedAdmissionRecords, 1804);
assert.equal(applied.after.officialLinkedRecords, 658);
assert.equal(applied.after.specialPathExcludedRecords, 179);
assert.equal(applied.after.sourceNotes, 5133);
assert.equal(sha256(readBytes(shardFile)), item.sha256);
assert.equal(sha256(readBytes(coreFile)), manifest.core.sha256);
assert.equal(sha256(readBytes(liteFile)), manifest.coreLite.sha256);

console.log("Anhui 2025 official rank runtime v3.329 tests passed");
