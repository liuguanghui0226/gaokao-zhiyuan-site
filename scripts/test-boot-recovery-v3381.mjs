#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const indexFile = path.join(projectRoot, "site/index.html");
const appSource = fs.readFileSync(appFile, "utf8");
const indexSource = fs.readFileSync(indexFile, "utf8");
const bootIndex = appSource.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

assert.match(indexSource, /id="view-overview"/);
assert.match(appSource, /function renderBootFailure\(error\)/);
assert.match(appSource, /id="retryBoot"/);
assert.match(appSource, /重新加载资料/);
assert.match(appSource, /boot\(\)\.catch\(renderBootFailure\)/);

const overview = { innerHTML: "" };
const retryButton = {
  disabled: false,
  attributes: new Map(),
  listener: null,
  addEventListener(type, listener) {
    assert.equal(type, "click");
    this.listener = listener;
  },
  setAttribute(name, value) {
    this.attributes.set(name, value);
  },
};
let reloadCount = 0;
const context = vm.createContext({
  console,
  location: {
    reload() {
      reloadCount += 1;
    },
  },
  document: {
    querySelector(selector) {
      if (selector === "#view-overview") return overview;
      if (selector === "#retryBoot") return retryButton;
      return null;
    },
  },
});
const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__gaokaoTest = { renderBootFailure };`;
vm.runInContext(instrumented, context, { filename: appFile });

context.__gaokaoTest.renderBootFailure(new Error("核心知识载入失败（HTTP 503）"));
assert.match(overview.innerHTML, /数据载入失败/);
assert.match(overview.innerHTML, /核心知识载入失败（HTTP 503）/);
assert.match(overview.innerHTML, /重新加载资料/);
assert.equal(typeof retryButton.listener, "function");

retryButton.listener();
assert.equal(retryButton.disabled, true);
assert.equal(retryButton.attributes.get("aria-busy"), "true");
assert.equal(reloadCount, 1);

console.log(JSON.stringify({
  ok: true,
  errorRenderedInOverview: true,
  originalMessagePreserved: true,
  accessibleRetryAction: true,
  reloadTriggered: true,
}, null, 2));
