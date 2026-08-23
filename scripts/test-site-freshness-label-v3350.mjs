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
globalThis.__gaokaoTest = { renderFreshnessLabel };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });

const validLabel = context.__gaokaoTest.renderFreshnessLabel(
  "2026-07-30T10:45:00+08:00",
);
assert.match(validLabel, /更新于 /);

console.log(JSON.stringify({
  ok: true,
  admissionsFreshnessIsIndependent: true,
}, null, 2));
