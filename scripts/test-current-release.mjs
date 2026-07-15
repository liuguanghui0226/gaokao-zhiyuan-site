#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const tests = [
  "test-recommendation-boundaries-v3271.mjs",
  "test-recommendation-boundaries-v3272.mjs",
  "test-recommendation-boundaries-v3273.mjs",
  "test-szu-recommendation-boundaries-v3274.mjs",
  "test-admission-recency-v3276.mjs",
  "test-application-plan-v3277.mjs",
  "test-elective-requirement-v3278.mjs",
  "test-browser-runtime-shards-v3274.mjs",
  "test-national-score-band-coverage-v3279.mjs",
  "test-official-jiangxi-control-lines-v3280.mjs",
  "test-official-xizang-control-lines-v3281.mjs",
  "test-official-zhejiang-control-lines-v3282.mjs",
];

const results = tests.map((test) => {
  const result = spawnSync(process.execPath, [path.join(projectRoot, "scripts", test)], {
    cwd: projectRoot,
    encoding: "utf8",
  });
  return {
    test,
    status: result.status,
    stdout: result.stdout.trim(),
    stderr: result.stderr.trim(),
  };
});

for (const result of results) {
  assert.equal(
    result.status,
    0,
    `${result.test} failed\n${result.stderr || result.stdout}`,
  );
}

console.log(JSON.stringify({
  status: "ok",
  passed: results.length,
  tests: results.map(({ test }) => test),
}, null, 2));
