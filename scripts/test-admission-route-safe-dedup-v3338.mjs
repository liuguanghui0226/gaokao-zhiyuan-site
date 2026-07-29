#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(root, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = {
  admissionRecordsShareRoute,
  admissionRouteIdentityKey,
  admissionRouteTags,
  applicationPlanDetail,
  buildApplicationPlan,
  dedupeAdmissionOptions,
  dedupeAdmissionRecords,
};`;
const context = vm.createContext({ console, Intl, Date });
vm.runInContext(instrumented, context, { filename: appFile });
const api = context.__gaokaoTest;

const base = {
  id: "third-party",
  province: "江西",
  subjectType: "物理类",
  year: 2025,
  batch: "本科批",
  schoolName: "示例大学",
  dataType: "major-admission",
  majorName: "计算机科学与技术",
  majorGroup: "物理+化学组",
  minScore: 590,
  minRankEnd: 18000,
  sourceQuality: "third-party-school-score-summary-imported-score-only",
};

const blankGroupDuplicate = { ...base, id: "blank-group", majorGroup: "" };
assert.equal(api.admissionRecordsShareRoute(base, blankGroupDuplicate), true);
assert.equal(api.dedupeAdmissionRecords([base, blankGroupDuplicate]).length, 1);

const anotherGroup = { ...base, id: "another-group", majorGroup: "物理+化学组02" };
assert.equal(api.admissionRecordsShareRoute(base, anotherGroup), false);
assert.equal(api.dedupeAdmissionRecords([base, anotherGroup]).length, 2);
assert.notEqual(api.admissionRouteIdentityKey(base), api.admissionRouteIdentityKey(anotherGroup));

const cooperation = {
  ...base,
  id: "cooperation",
  majorGroup: "",
  admissionSubtype: "中外合作办学",
};
assert.equal(api.admissionRecordsShareRoute(base, cooperation), false);

const anotherCampus = { ...base, id: "campus", campus: "新校区" };
assert.equal(api.admissionRecordsShareRoute(base, anotherCampus), false);

const anotherTuition = { ...base, id: "tuition", tuition: 68000 };
assert.equal(api.admissionRecordsShareRoute(base, anotherTuition), false);
assert.ok(api.admissionRouteTags(anotherTuition).includes("学费68,000元/年"));

const genericGroupOne = {
  ...base,
  id: "generic-01",
  dataType: "major-group-admission",
  majorName: "院校专业组投档线",
  majorGroup: "01 不限",
  majorCode: "01",
};
const genericGroupTwo = { ...genericGroupOne, id: "generic-02", majorGroup: "02 物理", majorCode: "02" };
assert.equal(api.dedupeAdmissionRecords([genericGroupOne, genericGroupTwo]).length, 2);

const schoolOfficial = {
  ...base,
  id: "school-official",
  sourceQuality: "school-official-admission-score",
  formalScoreScope: "school-official-only",
};
const official = {
  ...base,
  id: "exam-authority",
  sourceQuality: "official-exam-authority-major-admission",
};
assert.equal(api.dedupeAdmissionRecords([base, schoolOfficial])[0].id, "school-official");
assert.equal(api.dedupeAdmissionRecords([schoolOfficial, official])[0].id, "exam-authority");

const fit = { score: 76, text: "边界匹配。", recency: { fresh: true, label: "近年" } };
const plan = api.buildApplicationPlan([{
  title: "08 工学",
  total: 80,
  schoolOptions: [
    { name: base.schoolName, optionScore: 82, admissionFit: fit, record: base },
    { name: base.schoolName, optionScore: 81, admissionFit: fit, record: anotherGroup },
  ],
}]);
const review = plan.find((tier) => tier.id === "review");
assert.equal(review.options.length, 2, "distinct professional groups must remain separately visible");
assert.ok(api.applicationPlanDetail(review.options[0]).tags.some((tag) => tag.includes("组")));

console.log(JSON.stringify({
  status: "ok",
  blankGroupDuplicates: 1,
  distinctNamedMajorGroups: 2,
  genericMajorGroups: 2,
  evidenceWinner: api.dedupeAdmissionRecords([base, schoolOfficial, official])[0].id,
  applicationPlanRoutes: review.options.length,
}, null, 2));
