#!/usr/bin/env node

import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const releaseDir = path.join(projectRoot, "site/data/release-v3.275");
const modelVersion = "local-deterministic-v3.327-tianjin-official-rank2025-policy-bonus-inclusive-full-table-aligned-868426records";
const sourceId = "sohu-xinjiang-rank-2025-cb85600e32";
const evidenceId = "verified-xinjiang-rank-score-basis-2025-v3326";
const readGzipBytes = (file) => zlib.gunzipSync(fs.readFileSync(file));
const readGzip = (file) => JSON.parse(readGzipBytes(file));
const sha256 = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

assert.ok(!projectRoot.startsWith("/Volumes/"), "Test must run from internal APFS staging");
const audit = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/xinjiang-rank-score-basis-audit-2025-v3326.json"), "utf8"));
const applied = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/xinjiang-rank-score-basis-safety-v3326-runtime-manifest.json"), "utf8"));
const liteAudit = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/runtime-core-lite-v3326-manifest.json"), "utf8"));
const app = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");
const coreFile = path.join(releaseDir, "knowledge-core.json.gz");
const liteFile = path.join(releaseDir, "knowledge-core-lite.json.gz");
const manifestFile = path.join(releaseDir, "manifest.json.gz");
const core = readGzip(coreFile);
const lite = readGzip(liteFile);
const manifest = readGzip(manifestFile);
const item = manifest.shards["新疆"];
const shardFile = path.join(releaseDir, `${path.basename(item.file, ".json")}.json.gz`);
const shard = readGzip(shardFile);

assert.equal(audit.dataset, "xinjiang-rank-score-basis-audit-2025-v3326");
assert.equal(audit.mirrorComparison.gk100Rows, 1033);
assert.equal(audit.mirrorComparison.positiveRows, 996);
assert.equal(audit.mirrorComparison.zeroRows, 37);
assert.equal(audit.mirrorComparison.exactPositiveMatches, 996);
assert.equal(audit.mirrorComparison.valueDiffs, 0);
assert.equal(audit.scoreBasisAudit.officialZeroCandidateConflicts, 9);
assert.equal(audit.scoreBasisAudit.allSourceZeroCandidateConflicts, 19);
assert.equal(audit.scoreBasisAudit.unrankedOrdinarySubjectRecords, 4234);
assert.equal(audit.scoreBasisAudit.officialFilingRecords, 2302);
assert.equal(audit.scoreBasisAudit.automaticAdmissionScoreAlignmentAllowed, false);
assert.equal(audit.scoreBasisAudit.conflictRecords.length, 9);

assert.equal(core.modelVersion, modelVersion);
assert.equal(lite.modelVersion, modelVersion);
assert.equal(manifest.modelVersion, modelVersion);
assert.equal(core.modelPolicy.version, modelVersion);
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 128972);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5131);
assert.equal(lite.admissionScoreLayer.sourceNotes.length, 5131);
assert.equal(manifest.recordCount, 868426);
assert.equal(manifest.rankConversionCount, 128972);
assert.equal(manifest.runtimeProfile.version, "v3.327");
assert.equal(liteAudit.dataset, "runtime-core-lite-v3326");

assert.equal(shard.records.length, 11518);
assert.equal(shard.rankConversions.length, 2823);
assert.equal(item.records, 11518);
assert.equal(item.rankConversions, 2823);
const auditedRanks = shard.rankConversions.filter((row) => row.year === 2025 && row.sourceId === sourceId);
assert.equal(auditedRanks.length, 996);
assert.ok(auditedRanks.every((row) => row.automaticAdmissionScoreAlignmentAllowed === false));
assert.ok(auditedRanks.every((row) => row.rankPolicyBonusIncluded === null));
assert.ok(auditedRanks.every((row) => row.scoreBasis === "gaokao-cultural-total-policy-bonus-unspecified"));
assert.ok(auditedRanks.every((row) => row.scoreBasisAuditEvidenceId === evidenceId));

const blocked = shard.records.filter((row) => row.rankAlignmentEvidenceId === evidenceId);
assert.equal(blocked.length, 4234);
assert.ok(blocked.every((row) => row.rankAlignmentStatus === "blocked-score-basis-unresolved"));
assert.ok(blocked.every((row) => row.rankAlignmentReasonCode === "xinjiang-2025-policy-bonus-scope-unresolved"));
const officialFiling = blocked.filter((row) => row.admissionScorePolicyBonusIncluded === true);
assert.equal(officialFiling.length, 2302);
assert.ok(officialFiling.every((row) => row.admissionScoreBasis === "gaokao-filing-total-including-policy-bonus"));
assert.equal(shard.records.filter((row) => row.rankSourceId === sourceId).length, 0);

const rankSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === sourceId);
assert.equal(rankSource.automaticAdmissionScoreAlignmentAllowed, false);
assert.equal(rankSource.rankPolicyBonusIncluded, null);
assert.equal(rankSource.independentMirrorExactMatches, 996);
assert.equal(rankSource.scoreBasisAuditEvidenceId, evidenceId);
const evidenceSource = core.admissionScoreLayer.sourceNotes.find((note) => note.id === evidenceId);
assert.equal(evidenceSource.scoreBasisAudit.officialZeroCandidateConflicts, 9);
assert.equal(evidenceSource.scoreBasisAudit.unrankedOrdinarySubjectRecords, 4234);
assert.ok(core.admissionScoreLayer.currentFinding.includes("4234条无原生位次记录全部禁止自动套表"));
assert.ok(core.admissionScoreLayer.downgradeReason.includes("9个0人分数冲突"));
assert.ok(app.includes('record.rankAlignmentStatus === "blocked-score-basis-unresolved"'));
assert.ok(app.includes("政策加分口径未闭合"));

assert.equal(applied.dataset, "xinjiang-rank-score-basis-safety-v3326-runtime");
assert.equal(applied.after.rankRowsAudited, 996);
assert.equal(applied.after.blockedAdmissionRecords, 4234);
assert.equal(applied.after.officialFilingRecords, 2302);
assert.equal(applied.after.unsafeDerivedRanks, 0);
assert.equal(applied.after.sourceNotes, 5130);

const shardRaw = readGzipBytes(shardFile);
const coreRaw = readGzipBytes(coreFile);
const liteRaw = readGzipBytes(liteFile);
assert.equal(sha256(shardRaw), item.sha256);
assert.equal(sha256(coreRaw), manifest.core.sha256);
assert.equal(sha256(liteRaw), manifest.coreLite.sha256);

console.log("Xinjiang 2025 rank score-basis safety v3.326 tests passed");
