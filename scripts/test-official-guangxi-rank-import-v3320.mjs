#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-guangxi-rank-conversion-2025-v3320-import.json"), "utf8"));
const sourceId = "official-guangxi-rank-2025-v3320";

function rankAt(scope, subjectType, score) {
  const row = payload.rankConversions.find((item) => item.rankInstitutionScope === scope
    && item.subjectType === subjectType
    && score >= Number(item.scoreRange?.min ?? item.score)
    && score <= Number(item.scoreRange?.max ?? item.score));
  return row ? { start: Number(row.rankStart), end: Number(row.rankEnd), count: Number(row.sameRankScore) } : null;
}

assert.equal(payload.dataset, "official-guangxi-rank-conversion-2025-v3320-import");
assert.equal(payload.rankConversions.length, 1896);
assert.equal(payload.rankConversions.filter((row) => row.subjectType === "历史类").length, 920);
assert.equal(payload.rankConversions.filter((row) => row.subjectType === "物理类").length, 976);
assert.equal(payload.rankConversions.filter((row) => row.rankInstitutionScope === "outside-guangxi").length, 948);
assert.equal(payload.rankConversions.filter((row) => row.rankInstitutionScope === "inside-guangxi").length, 948);
assert.equal(payload.rankConversions.filter((row) => row.topWithheldRange).length, 4);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 1896);

assert.deepEqual(rankAt("outside-guangxi", "历史类", 700), { start: 1, end: 10, count: 10 });
assert.deepEqual(rankAt("inside-guangxi", "历史类", 700), { start: 1, end: 10, count: 10 });
assert.deepEqual(rankAt("outside-guangxi", "物理类", 700), { start: 1, end: 12, count: 12 });
assert.deepEqual(rankAt("inside-guangxi", "物理类", 700), { start: 1, end: 13, count: 13 });
assert.deepEqual(rankAt("outside-guangxi", "历史类", 600), { start: 1248, end: 1291, count: 44 });
assert.deepEqual(rankAt("inside-guangxi", "历史类", 600), { start: 1257, end: 1298, count: 42 });
assert.deepEqual(rankAt("outside-guangxi", "物理类", 600), { start: 6205, end: 6442, count: 238 });
assert.deepEqual(rankAt("inside-guangxi", "物理类", 600), { start: 6236, end: 6473, count: 238 });
assert.deepEqual(rankAt("outside-guangxi", "历史类", 200), { start: 119103, end: 119153, count: 51 });
assert.deepEqual(rankAt("inside-guangxi", "物理类", 200), { start: 260361, end: 260440, count: 80 });
assert.equal(rankAt("outside-guangxi", "历史类", 199), null);
assert.equal(rankAt("inside-guangxi", "物理类", 199), null);

assert.equal(payload.audit.rowComparisons, 1892);
assert.equal(payload.audit.cellComparisons, 7568);
assert.equal(payload.audit.sourceDifferences, 0);
assert.equal(payload.audit.nationalInstitutionCount, 2919);
assert.equal(payload.audit.localInstitutionCount, 89);
assert.equal(payload.localInstitutions.filter((row) => row.educationLevel === "本科").length, 41);
assert.equal(payload.localInstitutions.filter((row) => row.educationLevel === "专科").length, 48);
assert.ok(payload.localInstitutions.some((row) => row.schoolName === "广西大学" && row.schoolCode === "10593"));
assert.ok(payload.nationalInstitutions.some((row) => row.schoolName === "北京大学" && row.schoolCode === "10001"));

const source = payload.sourceNotes.find((row) => row.id === sourceId);
assert.equal(source.publisher, "广西招生考试院");
assert.equal(source.policyUrl, "https://jyt.gxzf.gov.cn/wmhd/cjwt/t21237773.shtml");
assert.equal(source.provenance.xlsxHtmlDifferences, 0);
assert.deepEqual(source.schoolScopeEvidence, { nationalInstitutions: 2919, guangxiInstitutions: 89, undergraduate: 41, vocational: 48 });

console.log(JSON.stringify({ ok: true, sourceId, rankConversions: 1896, comparedRows: 1892, comparedCells: 7568, localInstitutions: 89 }, null, 2));
