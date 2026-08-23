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

assert.match(source, /function recommendationValidationIssues\(profile = \{\}\)/);

const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { recommendationValidationIssues };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });

const { recommendationValidationIssues } = context.__gaokaoTest;
assert.deepEqual(
  JSON.parse(JSON.stringify(recommendationValidationIssues({ province: "江西", score: 0, rank: 1 }))),
  [],
  "numeric score zero is within the declared 0-to-1000 range",
);
assert.deepEqual(
  JSON.parse(JSON.stringify(recommendationValidationIssues({ province: "江西", score: 0, rank: 0 }))),
  [{ fieldId: "rankInput", message: "位次应为不小于1的整数" }],
  "numeric rank zero must be rejected instead of being treated as empty",
);

console.log(JSON.stringify({
  ok: true,
  numericScoreZeroAccepted: true,
  numericRankZeroRejected: true,
}, null, 2));
