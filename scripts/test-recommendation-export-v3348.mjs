#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
assert.ok(source.includes("复制核验清单"), "recommendation export action missing");
assert.ok(source.includes("copyRecommendationStatus"), "recommendation export status missing");
assert.ok(source.includes("不等于录取概率"), "recommendation export disclaimer missing");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { recommendationExportText };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });

const text = context.__gaokaoTest.recommendationExportText({
  generatedAt: "2026-08-22T10:00:00.000Z",
  profile: {
    province: "江西",
    subject: "物理/理科",
    score: "593",
    rank: "17798",
    strategy: "稳妥优先",
  },
  band: { label: "稳妥段" },
  results: [
    {
      title: "计算机类",
      examples: ["南昌大学", "江西财经大学"],
      confidence: "A-",
      stance: "稳妥候选",
      warnings: ["2026计划待核"],
    },
  ],
});

assert.match(text, /江西/);
assert.match(text, /593/);
assert.match(text, /17798/);
assert.match(text, /计算机类/);
assert.match(text, /南昌大学/);
assert.match(text, /不等于录取概率/);
assert.doesNotMatch(text, /\[object Object\]/);

console.log(JSON.stringify({ ok: true, localOnly: true, includesProfile: true, includesDisclaimer: true }, null, 2));
