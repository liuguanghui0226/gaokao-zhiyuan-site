#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const release = path.join(root, "site/data/release-v3.275");
const read = (name) => JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(release, name))));
const core = read("knowledge-core.json.gz");
const lite = read("knowledge-core-lite.json.gz");
const manifest = read("manifest.json.gz");
const shard = read("xizang.json.gz");
const evidence = JSON.parse(fs.readFileSync(path.join(root, "data/admissions/evidence-v3334-xizang-category-safety-manifest.json")));
const runtime = JSON.parse(fs.readFileSync(path.join(root, "data/admissions/official-xizang-category-safety-v3334-runtime-manifest.json")));
const version = "local-deterministic-v3.339-route-isolated-official-first-trends-868426records";

assert.equal(core.modelVersion, version);
assert.equal(lite.modelVersion, version);
assert.equal(manifest.modelVersion, version);
assert.equal(manifest.runtimeProfile.version, "v3.339");
assert.equal(core.admissionScoreLayer.structuredRecords, 868426);
assert.equal(core.admissionScoreLayer.rankConversionRecords, 133640);
assert.equal(core.admissionScoreLayer.sourceNotes.length, 5136);
assert.match(core.admissionScoreLayer.downgradeReason, new RegExp(version));
assert.doesNotMatch(core.admissionScoreLayer.downgradeReason, /local-deterministic-v3\.333/);
assert.equal(lite.admissionScoreLayer.downgradeReason, core.admissionScoreLayer.downgradeReason);
assert.equal(manifest.shards["西藏"].records, 28458);
assert.equal(manifest.shards["西藏"].rankConversions, 0);
assert.equal(shard.records.length, 28458);
assert.equal(shard.rankConversions.length, 0);

const lines = shard.records.filter((record) => record.sourceId === "official-xizang-control-lines-2025");
assert.equal(lines.length, 22);
assert.ok(lines.every((record) => record.candidateCategory === record.candidateClass));
assert.ok(lines.every((record) => record.publicRankConversionAvailable === false));
assert.ok(lines.every((record) => record.rankPublicationStatus === "not-published-in-reviewed-official-pages"));
assert.equal(lines.filter((record) => record.candidateCategory === "A类考生").length, 10);
assert.equal(lines.filter((record) => record.candidateCategory === "B类考生").length, 10);
assert.equal(lines.filter((record) => record.candidateCategory === "部队生源").length, 2);

const checkpoint = (subjectType, batch, category) =>
  lines.find((record) => record.subjectType === subjectType && record.batch === batch && record.candidateCategory === category);
assert.equal(checkpoint("历史类", "本科一批", "A类考生").minScore, 338);
assert.equal(checkpoint("历史类", "本科一批", "B类考生").minScore, 410);
assert.equal(checkpoint("物理类", "本科一批", "A类考生").minScore, 300);
assert.equal(checkpoint("物理类", "本科一批", "B类考生").minScore, 400);

const note = core.admissionScoreLayer.sourceNotes.find((row) => row.id === "official-xizang-control-lines-2025");
assert.equal(note.url, "https://www.xizang.gov.cn/xwzx_406/bmkx/202506/t20250626_486252.html");
assert.equal(note.quality, "official-xizang-government-2025-control-line-html-and-daily-pdf-verified");
assert.equal(note.candidateCategoryRequired, true);
assert.equal(note.publicRankConversionAvailable, false);
assert.equal(note.provenanceRevision.files["xizang-government-2025-control-lines.html"].sha256, "663762a459a4c5e99bdf415e4b6bd273352ab27b4975b9fa22ee8124f0556da8");
assert.equal(note.provenanceRevision.files["xizang-daily-2025-control-lines.pdf"].sha256, "570f0b3759241a6d5ef2ede4d3392b87e53e1e47a9abc4619b1a05c6503f96fa");

const readiness = core.admissionScoreLayer.provinceReadiness.rows.find((row) => row.province === "西藏");
assert.equal(readiness.readinessScore, 66);
assert.equal(readiness.rankConversionRecords, 0);
assert.equal(readiness.rankParsedSource, false);
assert.ok(readiness.missing.some((item) => /官方公开渠道未提供可计算一分一段/.test(item)));
assert.equal(runtime.after.candidateCategoryNormalizedRecords, 22);
assert.equal(runtime.after.rankConversionsAdded, 0);
assert.equal(evidence.officialFacts.reviewedOfficialPagesPublishCalculableRankTable, false);
assert.equal(evidence.officialFacts.automaticScoreToRankConversionAllowed, false);

console.log(JSON.stringify({
  status: "ok",
  modelVersion: version,
  normalizedControlLines: lines.length,
  rankConversionsAdded: 0,
  readinessScore: readiness.readinessScore,
}, null, 2));
