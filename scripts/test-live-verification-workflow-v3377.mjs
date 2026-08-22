#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const workflowPath = path.join(projectRoot, ".github/workflows/verify-live.yml");
const indexPath = path.join(projectRoot, "site/index.html");
const workflow = fs.readFileSync(workflowPath, "utf8");
const index = fs.readFileSync(indexPath, "utf8");
const assetVersion = index.match(/assets\/app\.js\?v=([^"']+)/)?.[1] || "";

assert.ok(assetVersion, "site index must publish an app.js cache version");
assert.match(workflow, /workflow_dispatch:/);
assert.match(workflow, /schedule:\s*\n\s*-\s*cron:\s*"0 2 \* \* \*"/);
assert.match(workflow, /app_asset_version=/);
assert.match(workflow, /assets\/app\.js\?v=\$\{app_asset_version\}/);
assert.match(workflow, /fetch "\$\{base\}assets\/app\.js\?v=\$\{app_asset_version\}"/);
assert.doesNotMatch(workflow, /app\.js\?v=3\.346\.4/);

console.log(JSON.stringify({
  ok: true,
  assetVersion,
  scheduledAtUtc: "02:00",
  scheduledAtChina: "10:00",
  dynamicAssetFetch: true,
}, null, 2));
