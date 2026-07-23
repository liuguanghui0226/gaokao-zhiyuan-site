#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const payload = JSON.parse(fs.readFileSync(
  path.join(projectRoot, "data/admissions/official-anhui-rank-conversion-2025-v3329-import.json"),
  "utf8",
));
const source = payload.sourceNotes[0];
const history = payload.rankConversions.filter((row) => row.subjectType === "历史类");
const physics = payload.rankConversions.filter((row) => row.subjectType === "物理类");

assert.ok(!projectRoot.startsWith("/Volumes/"), "Test must run from internal APFS staging");
assert.equal(payload.dataset, "official-anhui-rank-conversion-2025-v3329-import");
assert.equal(payload.rankConversions.length, 961);
assert.equal(history.length, 469);
assert.equal(physics.length, 492);
assert.equal(new Set(payload.rankConversions.map((row) => row.id)).size, 961);
assert.ok(payload.rankConversions.every((row) => row.province === "安徽" && row.year === 2025));
assert.ok(payload.rankConversions.every((row) => row.scoreBasis === "gaokao-total-including-policy-bonus"));
assert.ok(payload.rankConversions.every((row) => row.rankPolicyBonusIncluded === true));
assert.equal(payload.audit.pdfPages, 6);
assert.equal(payload.audit.mirrorPdfsByteIdentical, true);
assert.equal(payload.audit.duplicateScores, 0);
assert.equal(payload.audit.scoreGaps, 0);
assert.equal(payload.audit.cumulativeArithmeticErrors, 0);
assert.equal(payload.audit.populationBoundaryVerified, true);
assert.equal(source.publisher, "安徽省教育招生考试院 / 阳光高考；安庆师范大学本科招生网镜像");
assert.equal(source.provenance.aqnuPdfSha256, "bf1dbb9fe6eeb7e212379e1084394bff0e4084be512bc1e324788bc813120f71");
assert.equal(source.provenance.independentMirrorPdfSha256, source.provenance.aqnuPdfSha256);
assert.equal(source.provenance.aqnuPageHtmlSha256, "ca0513c4ffc16fdfb304f2a1fefd955536b9ae22ffe0d84e13a5d6d6856d82e9");
assert.ok(source.cautions.some((value) => value.includes("199分及以下")));
assert.ok(source.cautions.some((value) => value.includes("艺术体育录取使用综合分")));

console.log("Anhui 2025 official rank import v3.329 tests passed");
