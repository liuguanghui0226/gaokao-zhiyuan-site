#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const appFile = path.join(projectRoot, "site/assets/app.js");
const appSource = fs.readFileSync(appFile, "utf8");
const bootIndex = appSource.lastIndexOf("\nboot().catch");
if (bootIndex < 0) throw new Error("Could not isolate app.js boot call");

const instrumented = `${appSource.slice(0, bootIndex)}\nglobalThis.__gaokaoTest = { renderGeographySource, renderGeographySourceDirectory, state };`;
const context = vm.createContext({ console });
vm.runInContext(instrumented, context, { filename: appFile });

const api = context.__gaokaoTest;
const externalSource = {
  id: "external-source",
  title: "开放 & 地图",
  url: "https://example.com/geography",
  commitSha: "abc123",
  accessedAt: "2026-08-23",
};

const cardLink = api.renderGeographySource(externalSource);
assert.match(cardLink, /target="_blank"/);
assert.match(cardLink, /rel="noreferrer"/);
assert.match(cardLink, /aria-label="开放 &amp; 地图（在新窗口打开）"/);

const localSource = api.renderGeographySource({
  id: "local-source",
  title: "本地教材",
});
assert.doesNotMatch(localSource, /target="_blank"/);
assert.doesNotMatch(localSource, /aria-label=/);

api.state.query = "";
api.state.geographySourceFilter = "all";
const directory = api.renderGeographySourceDirectory({ sources: [externalSource] });
assert.match(directory, /class="geography-directory-link"/);
assert.match(directory, /aria-label="开放 &amp; 地图（在新窗口打开）"/);

console.log(JSON.stringify({
  ok: true,
  cardLinksAnnounceNewWindow: true,
  directoryLinksAnnounceNewWindow: true,
  localSourcesRemainNonInteractive: true,
}, null, 2));
