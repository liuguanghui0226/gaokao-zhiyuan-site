#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(
  path.join(projectRoot, "data/admissions/official-jiangxi-rank-conversion-2025-v3330-import.json"),
  "utf8",
));
const source = payload.sourceNotes[0];
const history = payload.rankConversions.filter((row) => row.subjectType === "历史类");
const physics = payload.rankConversions.filter((row) => row.subjectType === "物理类");

assert.ok(!projectRoot.startsWith("/Volumes/"), "Test must run from internal APFS staging");
assert.equal(payload.dataset, "official-jiangxi-rank-conversion-2025-v3330-import");
assert.equal(payload.rankConversions.length, 1137);
assert.equal(history.length, 562);
assert.equal(physics.length, 575);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 1137);
assert.ok(payload.rankConversions.every((row) => row.province === "江西" && row.year === 2025));
assert.ok(payload.rankConversions.every((row) => row.scoreBasis === "gaokao-total-including-policy-bonus"));
assert.ok(payload.rankConversions.every((row) => row.rankPolicyBonusIncluded === true));
assert.deepEqual(payload.audit.pdfPages, { "历史类": 21, "物理类": 21 });
assert.equal(payload.audit.mirrorPdfsByteIdentical, true);
assert.equal(payload.audit.duplicateScores, 0);
assert.equal(payload.audit.cumulativeArithmeticErrors, 0);
assert.deepEqual(payload.audit.omittedZeroCandidateScores, { "历史类": [], "物理类": [117, 101] });
assert.equal(payload.audit.scoreBasisExplanationVerified, true);
assert.equal(payload.audit.filingBonusPolicyVerified, true);
assert.equal(source.publisher, "江西省教育考试院 / 阳光高考；江教在线镜像");
assert.equal(source.provenance.historyOfficialPdfSha256, "9623dedc68d3ef93f1421492ef859754085fb1b4702983a1834148c320d4da4f");
assert.equal(source.provenance.historyMirrorPdfSha256, source.provenance.historyOfficialPdfSha256);
assert.equal(source.provenance.physicsOfficialPdfSha256, "5cd0204b5bd43f751f04c3e30a6428e8a329043dfdc23f1158bc0d4885058cca");
assert.equal(source.provenance.physicsMirrorPdfSha256, source.provenance.physicsOfficialPdfSha256);
assert.equal(source.provenance.pageHtmlSha256, "66c4f8fe69ae5bd75f1feff5e248ab0440a6cde9d729f522a1fa9dca4580bd0d");
assert.equal(source.provenance.scoreBasisHtmlSha256, "f2d6cfa1269a2d0460a5a58fe85618099eb4ec09e4db3fef332883b2ef9ffee6");
assert.equal(source.provenance.policyHtmlSha256, "1dd0118d7fc90a32b1ab33b43ee3b1c9a40360873ffc320f670f6e50fc6bcc47");
assert.ok(source.cautions.some((value) => value.includes("661分及以上")));
assert.ok(source.cautions.some((value) => value.includes("117分和101分")));
assert.ok(source.cautions.some((value) => value.includes("政策加分")));

console.log("Jiangxi 2025 official rank import v3.330 tests passed");
