#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(
  path.join(projectRoot, "data/admissions/official-shanghai-rank-conversion-2025-v3328-import.json"),
  "utf8",
));
const source = payload.sourceNotes[0];

assert.ok(!projectRoot.startsWith("/Volumes/"), "Test must run from internal APFS staging");
assert.equal(payload.dataset, "official-shanghai-rank-conversion-2025-v3328-import");
assert.equal(payload.rankConversions.length, 222);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 222);
assert.ok(payload.rankConversions.every((row) => row.province === "上海" && row.year === 2025 && row.subjectType === "综合"));
assert.ok(payload.rankConversions.every((row) => row.scoreBasis === "gaokao-total-including-policy-bonus"));
assert.ok(payload.rankConversions.every((row) => row.rankPolicyBonusIncluded === true));
assert.equal(payload.audit.officialPdfPages, 4);
assert.equal(payload.audit.officialPdfOcrRows, 221);
assert.equal(payload.audit.crossCheckHtmlRows, 222);
assert.equal(payload.audit.comparedOcrCells, 663);
assert.equal(payload.audit.ocrDifferences.length, 1);
assert.equal(payload.audit.missingOcrRows.length, 1);
assert.equal(payload.audit.retainedOcrCorrections, 2);
assert.equal(payload.audit.policyBonusRuleVerified, true);
assert.equal(payload.audit.ordinaryFilingTotalScoreOrderVerified, true);
assert.equal(payload.audit.topMergedCandidates, 52);
assert.equal(payload.audit.publishedFloorRankEnd, 49276);
assert.equal(source.publisher, "上海市教育考试院");
assert.equal(source.provenance.officialPdfSha256, "388eeae20146ff6f59df73dfdb60e5afdcd3e16aefad7a9c91e6e940ff153917");
assert.equal(source.provenance.officialPageHtmlSha256, "9a7d477cad32ab21bbc1c666f131e2f15c43e44b318d3d7eed322d64d6f5b249");
assert.equal(source.provenance.policyHtmlSha256, "8842a53c0c1ed7b68051ce09e26d57b5fdd7a414ee26d3eca7af171b8713869a");
assert.equal(source.provenance.filingHtmlSha256, "a97354144429203edf99b1660695e3f2ff47925b588b2453cfecbbd8c8820cf1");
assert.equal(source.provenance.crossCheckHtmlSha256, "f985f814697197c6665be4fec54b461afef2c5057fc1021e99bef91ea157484c");
assert.ok(source.cautions.some((value) => value.includes("623分及以上")));
assert.ok(source.cautions.some((value) => value.includes("401分及以下")));

console.log("Shanghai 2025 official rank import v3.328 tests passed");
