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

assert.match(source, /function recommendationDraftValidationSummary\(profile = \{\}\)/);
assert.match(source, /id="recommendDraftValidation"[^>]*role="alert"/);
assert.match(source, /aria-describedby="recommendDraftValidation"/);

const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { recommendationDraftValidationSummary };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });

const { recommendationDraftValidationSummary } = context.__gaokaoTest;
assert.equal(
  recommendationDraftValidationSummary({ province: "江西", score: "593", rank: "17798" }),
  "",
  "a valid saved draft should not show a validation warning",
);
assert.equal(
  recommendationDraftValidationSummary({ province: "火星", score: "1001", rank: "0" }),
  "当前草稿有 3 项需要修正：请从省份列表中选择有效省份；高考总分应在0至1000之间；位次应为不小于1的整数",
  "an invalid saved draft should expose every correction in one visible summary",
);

console.log(JSON.stringify({
  ok: true,
  validDraftIsQuiet: true,
  invalidDraftSummaryIsActionable: true,
  invalidFieldsReferenceSummary: true,
}, null, 2));
