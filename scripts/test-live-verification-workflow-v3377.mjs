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
const unsafeAssetExtractor = String.raw`html.match(/assets\/app\.js\?v=([^"']+)/)`;
assert.equal(workflow.includes(unsafeAssetExtractor), false, "single-quoted shell scripts must not contain an unescaped apostrophe");
assert.doesNotMatch(workflow, /data-view="sources">数据来源/, "the sources navigation check must match the actual markup structure");
assert.match(workflow, /grep -q 'data-view="sources"/);
assert.match(workflow, /grep -q '数据来源'/);
assert.match(workflow, /fetch "\$\{base\}geography\//);
assert.match(workflow, /<title>高中地理知识库<\/title>/);
assert.match(workflow, /geography_asset_version=/);
assert.match(workflow, /geography\/assets\/app\.js\?v=\$\{geography_asset_version\}/);
assert.match(workflow, /\.version == "geo-2026\.08\.23\.34"/);
assert.match(workflow, /! grep -q 'state\.geographyData' "\$work\/app\.js"/);
assert.doesNotMatch(workflow, /app\.js\?v=3\.346\.4/);

console.log(JSON.stringify({
  ok: true,
  assetVersion,
  scheduledAtUtc: "02:00",
  scheduledAtChina: "10:00",
  dynamicAssetFetch: true,
}, null, 2));
