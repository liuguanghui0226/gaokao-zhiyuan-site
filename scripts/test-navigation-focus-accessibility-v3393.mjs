#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const appSource = fs.readFileSync(appFile, "utf8");
const indexSource = fs.readFileSync(path.join(projectRoot, "site/index.html"), "utf8");
const bootIndex = appSource.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const publicViews = [...indexSource.matchAll(/<section id="(view-[^"]+)" class="view(?: active-view)?" tabindex="-1"(?: aria-label="[^"]+")?><\/section>/g)]
  .map((match) => match[1]);
assert.equal(publicViews.length, 5, "every admissions view must be keyboard-focusable");
assert.deepEqual(publicViews, [
  "view-overview",
  "view-recommend",
  "view-disciplines",
  "view-rules",
  "view-sources",
]);

const updateViewStart = appSource.indexOf("function updateView(nextView)");
const updateViewEnd = appSource.indexOf("\nfunction bindEvents", updateViewStart);
assert.ok(updateViewStart >= 0 && updateViewEnd > updateViewStart, "updateView implementation must remain discoverable");
const updateViewSource = appSource.slice(updateViewStart, updateViewEnd);
assert.match(appSource, /function focusActiveView\(nextView\)/);
assert.match(updateViewSource, /focusActiveView\(nextView\)/, "navigation must focus the active view after activation");

let focusOptions = null;
const activeView = {
  focus(options) {
    focusOptions = options;
  },
};
const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__gaokaoTest = { focusActiveView };`;
const context = vm.createContext({
  console,
  document: {
    querySelector(selector) {
      return selector === "#view-sources" ? activeView : null;
    },
  },
});
vm.runInContext(instrumented, context, { filename: appFile });

assert.equal(context.__gaokaoTest.focusActiveView("sources"), true);
assert.equal(focusOptions?.preventScroll, false);
assert.equal(context.__gaokaoTest.focusActiveView("missing"), false);

console.log(JSON.stringify({
  ok: true,
  focusablePublicViews: publicViews.length,
  navigationMovesFocus: true,
  focusPreservesScrollBehavior: true,
}, null, 2));
