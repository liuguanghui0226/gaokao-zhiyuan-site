#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const dataFile = path.join(projectRoot, "data/geography/knowledge.json");
const source = fs.readFileSync(appFile, "utf8");
const geographyData = JSON.parse(fs.readFileSync(dataFile, "utf8"));
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const view = { innerHTML: "" };
const emptyTemplate = { innerHTML: "<div>empty</div>" };
const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { renderSources, state };`;
const context = vm.createContext({
  console,
  document: {
    querySelector(selector) {
      if (selector === "#view-sources") return view;
      if (selector === "#emptyTemplate") return emptyTemplate;
      throw new Error(`Unexpected selector in geography source-filter test: ${selector}`);
    },
    querySelectorAll() {
      return [];
    },
  },
});
vm.runInContext(instrumented, context, { filename: appFile });

context.__gaokaoTest.state.data = {
  sourceFiles: [],
};
context.__gaokaoTest.state.geographyData = geographyData;
context.__gaokaoTest.state.query = "";
context.__gaokaoTest.state.discipline = "";
context.__gaokaoTest.state.domain = "";
context.__gaokaoTest.state.geographySourceFilter = "public";
context.__gaokaoTest.renderSources();

const publicSources = geographyData.sources.filter((source) => source?.url).length;
const localSources = geographyData.sources.filter((source) => !source?.url).length;

assert.match(view.innerHTML, /data-geography-source-filter="all"/);
assert.match(view.innerHTML, /data-geography-source-filter="public"/);
assert.match(view.innerHTML, /data-geography-source-filter="local"/);
assert.match(view.innerHTML, new RegExp(`${publicSources} 条来源 · ${publicSources} 个公开链接 · 0 个本地\\/教材`));
assert.doesNotMatch(view.innerHTML, /class="geography-directory-local"/);
assert.match(view.innerHTML, /class="geography-directory-link"/);

context.__gaokaoTest.state.geographySourceFilter = "local";
context.__gaokaoTest.renderSources();
assert.match(view.innerHTML, new RegExp(`${localSources} 条来源 · 0 个公开链接 · ${localSources} 个本地\\/教材`));
assert.doesNotMatch(view.innerHTML, /class="geography-directory-link"/);
assert.match(view.innerHTML, /class="geography-directory-local"/);

console.log(JSON.stringify({
  ok: true,
  publicSources,
  localSources,
  accessibleFilterControls: true,
}, null, 2));
