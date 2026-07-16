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
  "test-official-hunan-control-lines-v3283.mjs",
  "test-official-guangdong-control-lines-v3284.mjs",
  "test-official-anhui-control-lines-v3285.mjs",
  "test-official-beijing-control-lines-v3286.mjs",
  "test-official-tianjin-control-lines-v3287.mjs",
  "test-official-neimenggu-control-lines-v3288.mjs",
  "test-official-fujian-control-lines-v3289.mjs",
  "test-official-hebei-control-lines-v3290.mjs",
  "test-official-hubei-control-lines-v3291.mjs",
  "test-official-shanghai-control-lines-v3292.mjs",
  "test-official-chongqing-control-lines-v3293.mjs",
  "test-official-gansu-control-lines-v3294.mjs",
  "test-official-guangxi-control-lines-v3295.mjs",
  "test-official-guizhou-control-lines-v3296.mjs",
  "test-official-hainan-control-lines-v3297.mjs",
  "test-official-heilongjiang-control-lines-v3298.mjs",
  "test-official-jiangsu-control-lines-v3299.mjs",
  "test-official-liaoning-control-lines-v3300.mjs",
  "test-official-ningxia-control-lines-v3301.mjs",
  "test-official-qinghai-control-lines-v3302.mjs",
  "test-official-shanxi-control-lines-v3303.mjs",
  "test-official-yunnan-control-lines-v3304.mjs",
  "audit-official-control-line-coverage-v3304.mjs",
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
