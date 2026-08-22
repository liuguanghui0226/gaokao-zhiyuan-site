#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const workflowPath = path.join(projectRoot, ".github/workflows/deploy-pages.yml");
const workflow = fs.readFileSync(workflowPath, "utf8");

const expectedActions = [
  "uses: actions/checkout@v7.0.1",
  "uses: actions/configure-pages@v6.0.0",
  "uses: actions/upload-pages-artifact@v5.0.0",
  "uses: actions/deploy-pages@v5.0.0",
];

for (const action of expectedActions) {
  assert.equal(workflow.includes(action), true, `missing current Pages action ${action}`);
}

for (const legacyAction of [
  "actions/checkout@v4",
  "actions/configure-pages@v5",
  "actions/upload-pages-artifact@v3",
  "actions/deploy-pages@v4",
]) {
  assert.equal(workflow.includes(legacyAction), false, `legacy Node 20 action remains: ${legacyAction}`);
}

assert.match(workflow, /branches:\s*\[main\]/);
assert.match(workflow, /-\s+"site\/\*\*"/);
assert.match(workflow, /-\s+"\.github\/workflows\/deploy-pages\.yml"/);
assert.match(workflow, /run:\s+node scripts\/test-current-release\.mjs/);
assert.match(workflow, /path:\s+site/);

console.log(JSON.stringify({
  ok: true,
  currentActions: expectedActions,
  releaseGateRunsBeforeUpload: true,
  sitePathIsPublished: true,
}, null, 2));
