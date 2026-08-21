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
globalThis.__gaokaoTest = { formatGeographyVersionDate, renderFreshnessLabel };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });

assert.equal(
  context.__gaokaoTest.formatGeographyVersionDate("geo-2026.08.22.2"),
  "2026/8/22",
);
assert.equal(context.__gaokaoTest.formatGeographyVersionDate("not-a-version"), "");

const validLabel = context.__gaokaoTest.renderFreshnessLabel(
  "2026-07-30T10:45:00+08:00",
  "geo-2026.08.22.2",
);
assert.match(validLabel, /更新于 /);
assert.match(validLabel, / · 高中地理 2026\/8\/22$/);

const coreOnlyLabel = context.__gaokaoTest.renderFreshnessLabel(
  "2026-07-30T10:45:00+08:00",
  "malformed",
);
assert.doesNotMatch(coreOnlyLabel, /高中地理/);

console.log(JSON.stringify({
  ok: true,
  geographyDate: "2026/8/22",
  malformedVersionFallsBackToCoreOnly: true,
}, null, 2));
