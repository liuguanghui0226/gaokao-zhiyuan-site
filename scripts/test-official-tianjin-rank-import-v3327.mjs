#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(
  path.join(projectRoot, "data/admissions/official-tianjin-rank-conversion-2025-v3327-import.json"),
  "utf8",
));
const source = payload.sourceNotes[0];

assert.ok(!projectRoot.startsWith("/Volumes/"), "Test must run from internal APFS staging");
assert.equal(payload.dataset, "official-tianjin-rank-conversion-2025-v3327-import");
assert.equal(payload.rankConversions.length, 381);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 381);
assert.ok(payload.rankConversions.every((row) => row.province === "天津" && row.year === 2025 && row.subjectType === "综合"));
assert.ok(payload.rankConversions.every((row) => row.scoreBasis === "gaokao-total-including-policy-bonus"));
assert.ok(payload.rankConversions.every((row) => row.rankPolicyBonusIncluded === true));
assert.equal(payload.audit.pdfRows, 381);
assert.equal(payload.audit.htmlRows, 381);
assert.equal(payload.audit.comparedCells, 1143);
assert.equal(payload.audit.valueDifferences, 0);
assert.equal(payload.audit.policyBonusTitleVerified, true);
assert.equal(payload.audit.policyBonusFilingRuleVerified, true);
assert.equal(payload.audit.topMergedCandidates, 656);
assert.equal(payload.audit.publishedFloorRankEnd, 71938);
assert.equal(source.publisher, "天津市教育招生考试院 / 阳光高考");
assert.equal(source.provenance.chsiPdfSha256, "07bbfd81704008968def886f5dcfe5515584e17b2d7de410dd352e2347d5f774");
assert.equal(source.provenance.eolHtmlSha256, "9d7e4bc0069d74e739fd8557ee42fcac3d6f26c1e586cec52d96a21ee48fe520");
assert.equal(source.provenance.policyPdfSha256, "47098003b962e5086cd6842f3315167743187dd0f2202ee90d62862eaba3f8ec");
assert.equal(source.directOfficialPdfRetrievalStatus, "blocked-current-session-tls");
assert.ok(source.cautions.some((value) => value.includes("680分及以上")));
assert.ok(source.cautions.some((value) => value.includes("299分及以下")));

console.log("Tianjin 2025 official rank import v3.327 tests passed");
