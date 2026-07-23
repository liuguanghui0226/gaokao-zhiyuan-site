#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-hainan-rank-conversion-2025-v3325-import.json"), "utf8"));
const sourceId = "official-hainan-rank-2025-v3325";

function rankAt(score) {
  const row = payload.rankConversions.find((item) => (
    score >= Number(item.scoreRange?.min ?? item.score)
    && score <= Number(item.scoreRange?.max ?? item.score)
  ));
  return row ? { start: Number(row.rankStart), end: Number(row.rankEnd), count: Number(row.sameRankScore) } : null;
}

assert.equal(payload.dataset, "official-hainan-rank-conversion-2025-v3325-import");
assert.equal(payload.rankConversions.length, 555);
assert.equal(payload.rankConversions.filter((row) => row.subjectType === "综合").length, 555);
assert.equal(payload.rankConversions.filter((row) => row.topWithheldRange).length, 1);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 555);
assert.ok(payload.rankConversions.every((row) => row.rankPolicyBonusIncluded === true));

assert.deepEqual(rankAt(900), { start: 1, end: 105, count: 105 });
assert.deepEqual(rankAt(800), { start: 1, end: 105, count: 105 });
assert.deepEqual(rankAt(799), { start: 106, end: 110, count: 5 });
assert.deepEqual(rankAt(785), { start: 169, end: 171, count: 3 });
assert.deepEqual(rankAt(731), { start: 792, end: 809, count: 18 });
assert.deepEqual(rankAt(727), { start: 874, end: 900, count: 27 });
assert.deepEqual(rankAt(700), { start: 1721, end: 1763, count: 43 });
assert.deepEqual(rankAt(600), { start: 12011, end: 12182, count: 172 });
assert.deepEqual(rankAt(500), { start: 37237, end: 37504, count: 268 });
assert.deepEqual(rankAt(480), { start: 42848, end: 43089, count: 242 });
assert.deepEqual(rankAt(325), { start: 65969, end: 66006, count: 38 });
assert.deepEqual(rankAt(307), { start: 66577, end: 66608, count: 32 });
assert.deepEqual(rankAt(305), { start: 66631, end: 66661, count: 31 });
assert.deepEqual(rankAt(304), { start: 66662, end: 66688, count: 27 });
assert.deepEqual(rankAt(246), { start: 67404, end: 67408, count: 5 });
assert.equal(rankAt(245), null);

assert.equal(payload.audit.officialImagePages, 21);
assert.equal(payload.audit.mirrorImagePages, 21);
assert.equal(payload.audit.numericScoreRows, 554);
assert.equal(payload.audit.directCumulativeMatches, 549);
assert.equal(payload.audit.rawDifferenceRows, 38);
assert.equal(payload.audit.rawCumulativeDifferences, 5);
assert.equal(payload.audit.cumulativeCorrections, 7);
assert.equal(payload.audit.arithmeticCorrections, 4);
assert.equal(payload.audit.mirrorCorrections, 3);
assert.equal(payload.audit.allDerivedCountsClose, true);
assert.equal(payload.audit.allCumulativeRanksContinuous, true);
assert.equal(payload.audit.topMergedCandidates, 105);
assert.equal(payload.audit.publishedFloorRankEnd, 67408);
assert.equal(payload.audit.scoreBasis, "gaokao-comprehensive-filing-score-including-policy-bonus");
assert.equal(payload.audit.rankPolicyBonusIncluded, true);
assert.equal(Object.keys(payload.audit.evidenceBundleSha256).length, 6);

const source = payload.sourceNotes.find((row) => row.id === sourceId);
assert.equal(source.publisher, "海南省考试局");
assert.equal(source.publishedScoreFloor, 246);
assert.equal(source.publishedScoreCeiling, 900);
assert.equal(source.scoreBasis, "gaokao-comprehensive-filing-score-including-policy-bonus");
assert.equal(source.rankPolicyBonusIncluded, true);
assert.equal(source.provenance.officialImagePages, 21);
assert.equal(source.provenance.mirrorImagePages, 21);
assert.equal(source.provenance.directCumulativeMatches, 549);
assert.equal(source.provenance.cumulativeCorrections.length, 7);
assert.deepEqual(source.provenance.peopleCellAudit, {
  bothMatch: 480,
  officialOnly: 20,
  mirrorOnly: 8,
  bothBlank: 43,
  oneBlankNoMatch: 1,
  bothWrong: 2,
});
assert.ok(source.cautions.some((value) => value.includes("照顾加分")));
assert.ok(source.cautions.some((value) => value.includes("800分及以上")));
assert.ok(source.cautions.some((value) => value.includes("低于246分")));

console.log(JSON.stringify({
  ok: true,
  sourceId,
  rankConversions: payload.rankConversions.length,
  directCumulativeMatches: payload.audit.directCumulativeMatches,
  cumulativeCorrections: payload.audit.cumulativeCorrections,
}, null, 2));
