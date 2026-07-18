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
globalThis.__gaokaoTest = {
  state, admissionFit, admissionRecordLimitWarning, admissionPreferenceScore,
  buildAdmissionOptions, profileAdmissionRecords,
};`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;
const payload = JSON.parse(fs.readFileSync(path.join(projectRoot, "data/admissions/official-national-school-admission-2014-2025-v3310-hdu-import.json"), "utf8"));
api.state.data = { admissionScoreLayer: { records: payload.records, rankConversions: [], sourceNotes: payload.sourceNotes } };

const computer = payload.records.find((record) => record.id === "hdu-2025-09dd552ef21fc9fc31");
assert.ok(computer);
const fit = api.admissionFit(computer, { score: "605", rank: "17798" }, "2026-07-18");
assert.equal(fit.zone, "分数临界");
assert.match(fit.text, /分数高出近年最低分0分/);
assert.match(fit.text, /缺位次需复核/);
assert.doesNotMatch(fit.text, /近年最低位次|最低分换算位次/);

const warning = api.admissionRecordLimitWarning(computer);
assert.match(warning, /学校官网单校录取边界/);
assert.match(warning, /不能单独推断录取概率/);
assert.doesNotMatch(warning, /一分一段表换算/);

const profile = {
  province: "江西",
  subject: "物理类",
  score: "605",
  rank: "17798",
  disciplineFocus: "08",
  cities: "杭州",
  interest: "计算机科学与技术",
  redLines: "",
  electives: "物理 化学",
};
const ordinaryCandidates = api.profileAdmissionRecords(profile);
assert.ok(ordinaryCandidates.some((record) => record.id === computer.id));
assert.ok(ordinaryCandidates.every((record) => record.formalScoreScope !== "special-path-only"));
assert.equal(api.admissionPreferenceScore(computer, profile), 24);

const candidate = {
  id: "computer-tech",
  disciplines: ["08"],
  keywords: ["计算机科学与技术"],
  cities: [],
};
const options = api.buildAdmissionOptions(candidate, profile);
const hdu = options.find((option) => option.name === "杭州电子科技大学");
assert.ok(hdu, `HDU must enter visible recommendations: ${JSON.stringify(options.map((option) => ({ name: option.name, major: option.record.majorName, score: option.optionScore })))}`);
assert.equal(hdu.record.id, computer.id);
assert.ok(hdu.tags.includes("最低分605"));
assert.ok(hdu.tags.includes("招生数3"));
assert.ok(!hdu.tags.some((tag) => /^位次/.test(tag)));
assert.equal(hdu.scoreStatus, "学校官网单校最低分：位次待补，仅作候选复核");
assert.match(hdu.focus, /缺位次需复核/);
assert.match(hdu.focus, /不能单独推断录取概率/);
assert.match(hdu.focus, /选科要求/);

const early = payload.records.find((record) => record.id === "hdu-2025-99f7483d108727b198");
assert.ok(early);
assert.equal(early.formalScoreScope, "special-path-only");
assert.ok(!ordinaryCandidates.some((record) => record.id === early.id));

const historical = payload.records.find((record) => record.province === "江西" && record.year === 2014 && record.formalScoreScope === "school-official-only");
assert.ok(historical);
const historicalFit = api.admissionFit(historical, { score: String(historical.minScore), rank: "17798" }, "2026-07-18");
assert.equal(historicalFit.recency.fresh, false);
assert.equal(historicalFit.recency.age, 12);
assert.match(historicalFit.text, /历史录取边界/);

console.log(JSON.stringify({
  ok: true,
  fitText: fit.text,
  warning,
  ordinaryCandidateCount: ordinaryCandidates.length,
  visibleRecommendation: { school: hdu.name, major: hdu.record.majorName, tags: hdu.tags, scoreStatus: hdu.scoreStatus },
  specialPathExcluded: early.id,
  historicalAge: historicalFit.recency.age,
}, null, 2));
