#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const indexSource = fs.readFileSync(path.join(projectRoot, "site/index.html"), "utf8");
const publicViews = [...indexSource.matchAll(/<section id="(view-[^"]+)" class="view(?: active-view)?" tabindex="-1" aria-label="([^"]+)"><\/section>/g)]
  .map((match) => ({ id: match[1], label: match[2] }));

assert.deepEqual(publicViews, [
  { id: "view-overview", label: "填报总览" },
  { id: "view-recommend", label: "院校专业推荐" },
  { id: "view-disciplines", label: "专业门类" },
  { id: "view-geography", label: "高中地理" },
  { id: "view-rules", label: "规则与风险" },
  { id: "view-sources", label: "数据来源" },
], "every focusable public view must have a stable accessible name");

const labels = publicViews.map((view) => view.label);
assert.equal(new Set(labels).size, labels.length, "public view accessible names must be unique");

for (const view of publicViews) {
  assert.match(indexSource, new RegExp(`aria-controls="${view.id}"`), `${view.id} must remain reachable from navigation`);
}

console.log(JSON.stringify({
  ok: true,
  namedPublicViews: publicViews.length,
  uniqueAccessibleNames: true,
  navigationTargetsPreserved: true,
}, null, 2));
