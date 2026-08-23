#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const source = fs.readFileSync(appFile, "utf8");
const indexSource = fs.readFileSync(path.join(projectRoot, "site/index.html"), "utf8");
const bootIndex = source.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

assert.ok(source.includes('id="downloadRecommendation"'), "recommendation download action missing");
assert.ok(source.includes("recommendationExportFilename"), "recommendation download filename helper missing");
assert.ok(source.includes("downloadRecommendationText"), "recommendation download helper missing");
assert.match(indexSource, /styles\.css\?v=3\.346\.27/);
assert.match(indexSource, /app\.js\?v=3\.346\.27/);

const blobCalls = [];
const revokedUrls = [];
let clicked = false;
let appended = false;
const anchor = {
  href: "",
  download: "",
  rel: "",
  style: {},
  click() {
    clicked = true;
  },
  remove() {},
};
class TestBlob {
  constructor(parts, options) {
    blobCalls.push({ parts, options });
  }
}

const instrumented = `${source.slice(0, bootIndex)}
globalThis.__gaokaoTest = { recommendationExportFilename, downloadRecommendationText };`;
const context = vm.createContext({
  console,
  Blob: TestBlob,
  URL: {
    createObjectURL() {
      return "blob:test-checklist";
    },
    revokeObjectURL(url) {
      revokedUrls.push(url);
    },
  },
  document: {
    createElement(tagName) {
      assert.equal(tagName, "a");
      return anchor;
    },
    body: {
      appendChild(element) {
        appended = element === anchor;
      },
    },
  },
});
vm.runInContext(instrumented, context, { filename: appFile });

const api = context.__gaokaoTest;
assert.equal(
  api.recommendationExportFilename({ province: "江西/测试" }, "2026-08-23T01:00:00.000Z"),
  "gaokao-志愿核验清单-江西-测试-2026-08-23.txt",
  "download filenames must be safe and use China calendar dates",
);

assert.equal(api.downloadRecommendationText("候选核验清单", "checklist.txt"), true);
assert.equal(blobCalls.length, 1);
assert.equal(blobCalls[0].parts.length, 1);
assert.equal(blobCalls[0].parts[0], "候选核验清单");
assert.equal(blobCalls[0].options.type, "text/plain;charset=utf-8");
assert.equal(anchor.href, "blob:test-checklist");
assert.equal(anchor.download, "checklist.txt");
assert.equal(anchor.rel, "noopener");
assert.equal(appended, true);
assert.equal(clicked, true);
assert.deepEqual(revokedUrls, ["blob:test-checklist"]);

console.log(JSON.stringify({
  ok: true,
  safeChinaDateFilename: true,
  utf8TextBlob: true,
  browserDownloadTriggered: true,
  objectUrlRevoked: true,
}, null, 2));
