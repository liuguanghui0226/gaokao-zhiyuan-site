#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { state, admissionFit, admissionRecordLimitWarning, isScoreDerivedRankRecord, profileAdmissionRecords };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-national-school-admission-2021-2025-v3309-qlu-import.json"), "utf8"));
api.state.data = { admissionScoreLayer: { records: payload.records, rankConversions: [], sourceNotes: payload.sourceNotes } };

const computer = payload.records.find((record) => record.id === "qlu-2025-9170e490195e37b6ae");
assert.ok(computer);
assert.equal(api.isScoreDerivedRankRecord(computer), false);
const fit = api.admissionFit(computer, { score: "593", rank: "17798" }, "2026-07-18");
assert.match(fit.text, /近年最低位次/);
assert.doesNotMatch(fit.text, /最低分换算位次/);
const warning = api.admissionRecordLimitWarning(computer);
assert.match(warning, /学校官网单校录取边界/);
assert.doesNotMatch(warning, /一分一段表换算/);
assert.match(warning, /不能单独推断录取概率/);

const profile = {
  province: "江西",
  subject: "物理类",
  score: "593",
  rank: "17798",
  disciplineFocus: "08",
  redLines: "",
  electives: "化学 生物",
};
const ordinaryCandidates = api.profileAdmissionRecords(profile);
assert.ok(ordinaryCandidates.some((record) => record.id === computer.id));
assert.ok(ordinaryCandidates.every((record) => record.formalScoreScope !== "special-path-only"));

const differentElectives = api.profileAdmissionRecords({ ...profile, electives: "生物 地理" });
assert.ok(differentElectives.some((record) => record.id === computer.id));
assert.ok(computer.cautions.some((text) => /未列选科要求/.test(text)));

const art = payload.records.find((record) => record.id === "qlu-2025-ba75e83d650809e8b9");
assert.ok(art);
assert.ok(!ordinaryCandidates.some((record) => record.id === art.id));
const xinjiangSpecial = payload.records.find((record) => record.id === "qlu-2025-79a4845bf29f528932");
assert.ok(xinjiangSpecial);
assert.equal(xinjiangSpecial.formalScoreScope, "special-path-only");

console.log(JSON.stringify({
  ok: true,
  fitText: fit.text,
  warning,
  ordinaryCandidateCount: ordinaryCandidates.length,
  missingElectiveRequirementPreserved: computer.id,
  artExcluded: art.id,
  xinjiangSpecialExcluded: xinjiangSpecial.id,
}, null, 2));
