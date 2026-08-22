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
globalThis.__gaokaoTest = { recommendationValidationIssues };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });
const { recommendationValidationIssues } = context.__gaokaoTest;

const validProfile = {
  province: "江西",
  score: "593",
  rank: "",
  guangxiLocalScore: "",
  guangxiLocalRank: "",
  vocationalScore: "",
};

assert.equal(JSON.stringify(recommendationValidationIssues(validProfile)), "[]", "blank rank remains estimable from a valid score");

const missingIssues = recommendationValidationIssues({
  ...validProfile,
  province: "",
  score: "",
  rank: "abc",
});
assert.equal(
  JSON.stringify(missingIssues.map((issue) => issue.fieldId)),
  JSON.stringify(["provinceInput", "scoreInput", "rankInput"]),
  "missing required fields and malformed rank must be reported inline",
);

const rangeIssues = recommendationValidationIssues({
  ...validProfile,
  province: "火星",
  score: "1001",
  rank: "0",
});
assert.equal(
  JSON.stringify(rangeIssues.map((issue) => issue.fieldId)),
  JSON.stringify(["provinceInput", "scoreInput", "rankInput"]),
  "invalid province, score, and rank ranges must fail fast",
);

const guangxiIssues = recommendationValidationIssues({
  ...validProfile,
  province: "广西",
  guangxiLocalScore: "751",
  guangxiLocalRank: "1.5",
});
assert.equal(
  JSON.stringify(guangxiIssues.map((issue) => issue.fieldId)),
  JSON.stringify(["guangxiLocalScoreInput", "guangxiLocalRankInput"]),
  "province-specific Guangxi fields must use their own scales",
);

const beijingIssues = recommendationValidationIssues({
  ...validProfile,
  province: "北京",
  vocationalScore: "451",
});
assert.equal(
  JSON.stringify(beijingIssues.map((issue) => issue.fieldId)),
  JSON.stringify(["vocationalScoreInput"]),
  "Beijing vocational score must stay within the three-subject scale",
);

assert.ok(source.includes('id="recommendStatus"'), "recommendation status region missing");
assert.ok(source.includes("recommendationValidationIssues"), "recommendation validation is not wired");
assert.ok(!source.includes("window.alert("), "recommendation errors must remain in the accessible status region");

console.log(JSON.stringify({
  ok: true,
  validProfileAccepted: true,
  requiredFieldsValidated: true,
  provinceSpecificScalesValidated: true,
  inlineErrors: true,
}, null, 2));
