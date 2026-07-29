#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const release = path.join(root, "site/data/release-v3.275");
const shard = JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(release, "beijing.json.gz"))));
const filingId = "official-beijing-undergraduate-filing-2025";
const rankId = "official-beijing-rank-2025-v3271";
const vocationalId = "official-beijing-vocational-filing-2025";
const linked = shard.records.filter((row) => row.sourceId === filingId && row.rankSourceId === rankId);
const municipal = shard.records.filter((row) => row.rankAlignmentBlockReason === "beijing-municipal-local-bonus-not-represented-in-national-bonus-rank-table");
const vocational = shard.records.filter((row) => row.sourceId === vocationalId);

assert.equal(linked.length, 1271);
assert.ok(linked.every((row) => row.rankDerivedFromScore === true));
assert.ok(linked.every((row) => row.rankEvidenceScope === "score-derived-provincial-segment"));
assert.ok(linked.every((row) => row.rankScoreBasis === "gaokao-total-including-national-policy-bonus"));
assert.ok(linked.every((row) => row.rankPolicyBonusIncluded === true));
assert.ok(linked.every((row) => row.minRank === row.minRankEnd && row.minRankStart <= row.minRankEnd));
assert.equal(municipal.length, 126);
assert.ok(municipal.every((row) => row.rankUnavailable === true && row.rankDerivedFromScore === false && !row.rankSourceId));
assert.equal(vocational.length, 580);
assert.ok(vocational.every((row) => row.rankAlignmentBlockReason === "beijing-vocational-three-subject-total-incompatible-with-undergraduate-rank-table"));
assert.ok(vocational.every((row) => row.rankUnavailable === true && !row.rankSourceId));

const checkpoints = new Map([
  [600, { count: 10, start: 11660, end: 11883 }],
  [500, { count: 6, start: 37269, end: 37553 }],
  [430, { count: 53, start: 53798, end: 53994 }],
]);
for (const [score, expected] of checkpoints) {
  const rows = linked.filter((row) => row.minScore === score);
  assert.equal(rows.length, expected.count);
  assert.ok(rows.every((row) => row.minRankStart === expected.start && row.minRankEnd === expected.end));
}
const beijingUniversity = linked.find((row) => row.schoolName === "北京大学" && row.minScore === 697);
assert.equal(beijingUniversity.minRankStart, 114);
assert.equal(beijingUniversity.minRankEnd, 136);
assert.ok(municipal.some((row) => row.schoolName === "北京工业大学"));
assert.ok(municipal.some((row) => row.schoolName === "首都医科大学"));
console.log(JSON.stringify({ status: "ok", linked: linked.length, municipalGuarded: municipal.length, vocationalGuarded: vocational.length }, null, 2));
