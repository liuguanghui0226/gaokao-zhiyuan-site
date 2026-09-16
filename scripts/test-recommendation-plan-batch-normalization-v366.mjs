#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(root, "site/assets/app.js");
const app = fs.readFileSync(appFile, "utf8");
const bootIndex = app.lastIndexOf("\nboot().catch");
const instrumented = `${app.slice(0, bootIndex)}
globalThis.__gaokaoTest = { state, currentPlanEvidenceForAdmissionRecord, normalizeOfficialOrdinaryPlanRoute };`;
const context = vm.createContext({ console, Intl, Date, Set, Map });
vm.runInContext(instrumented, context, { filename: appFile });
const { state, currentPlanEvidenceForAdmissionRecord, normalizeOfficialOrdinaryPlanRoute } = context.__gaokaoTest;

const plan = {
  id: "ecnu-missing-batch",
  province: "北京",
  year: 2026,
  dataType: "admission-plan",
  schoolName: "华东师范大学",
  schoolCode: "10269",
  majorName: "汉语言文学",
  subjectType: "物理类",
  admissionType: "普通录取",
  formalScoreScope: "school-official-only",
  planCount: 2,
};
assert.equal(normalizeOfficialOrdinaryPlanRoute(plan).batch, "普通本科批");
assert.equal(plan.batch, undefined, "Source record must remain unchanged");

const admission = {
  id: "historic-ecnu",
  province: "北京",
  year: 2025,
  dataType: "major-admission",
  schoolName: "华东师范大学",
  schoolCode: "10269",
  majorName: "汉语言文学",
  subjectType: "物理类",
  batch: "本科批",
  admissionType: "普通录取",
  minRank: 1000,
  minScore: 650,
};
state.data = { admissionScoreLayer: { records: [plan, admission] } };
const evidence = currentPlanEvidenceForAdmissionRecord(admission, { province: "北京", subject: "物理类" });
assert.ok(evidence, "A missing-batch ordinary plan should corroborate the matching historical option");
assert.equal(evidence.record.id, plan.id);
assert.equal(evidence.record.batch, "普通本科批");
assert.equal(evidence.matchKind, "exact-route");

console.log(JSON.stringify({ status: "ok", derivedBatch: evidence.record.batch, route: evidence.matchKind, sourceUntouched: plan.batch === undefined }, null, 2));
