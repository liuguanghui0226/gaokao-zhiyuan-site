#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const assetFile = path.join(projectRoot, "site/data/release-v3.275/admission-score-supplement-v357.json.gz");
const app = fs.readFileSync(path.join(projectRoot, "site/assets/app.js"), "utf8");
const payload = JSON.parse(zlib.gunzipSync(fs.readFileSync(assetFile), { to: "string" }));

assert.equal(payload.version, "v3.357");
assert.equal(payload.type, "runtime-admission-score-supplement");
assert.equal(payload.summary.records, 3174);
assert.equal(payload.summary.filingScoreRecords, 2951);
assert.equal(payload.summary.noFilingPlanRecords, 223);
assert.deepEqual(payload.summary.provinces, ["新疆"]);
assert.equal(payload.sources.length, 1);
assert.equal(payload.sources[0].id, "official-xinjiang-2026-filing-v357");
assert.equal(payload.sources[0].parsedRecords, 3174);
assert.equal(payload.sources[0].rankUnavailableRecords, 3174);
assert.equal(payload.sources[0].scoreDerivedRankRecords, 0);
assert.equal(payload.records.length, 3174);
assert.equal(new Set(payload.records.map((record) => record.id)).size, 3174);
assert.ok(payload.records.every((record) => record.province === "新疆" && record.year === 2026));
assert.ok(payload.records.every((record) => record.rankUnavailable === true && record.rankDerivedFromScore === false));
assert.equal(payload.records.filter((record) => record.scoreOnly).length, 2951);
assert.equal(payload.records.filter((record) => record.noFiling).length, 223);
assert.ok(payload.records.filter((record) => record.noFiling).every((record) => record.dataType === "admission-plan" && record.scoreOnly === false));
assert.ok(payload.records.filter((record) => record.scoreOnly).every((record) => record.dataType === "institution-admission" && Number.isFinite(record.minScore)));
assert.match(app, /fetchRuntimeJson\("admission-score-supplement-v357\.json", "官方投档补充"\)/);
assert.match(app, /state\.scoreSupplementRecords/);
assert.match(app, /provinceRecordsWithPlanSupplement\(\s*province,\s*payload\.records \|\| \[\],\s*state\.planSupplementRecords,\s*state\.scoreSupplementRecords,?\s*\)/);
assert.match(app, /sourceNotes\s*=\s*\[/);
assert.match(app, /\.\.\.\(state\.data\.admissionScoreLayer\.sourceNotes \|\| \[\]\)/);
assert.match(app, /\.\.\.\(scoreSupplement\.sources \|\| \[\]\)/);

console.log(JSON.stringify({
  status: "ok",
  version: payload.version,
  records: payload.records.length,
  filingScoreRecords: payload.summary.filingScoreRecords,
  noFilingPlanRecords: payload.summary.noFilingPlanRecords,
}, null, 2));
