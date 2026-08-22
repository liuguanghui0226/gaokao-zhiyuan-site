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

const navButtons = [...indexSource.matchAll(/<button class="nav-btn(?: active)?" data-view="([^"]+)" aria-controls="([^"]+)"(?: aria-current="page")?>/g)]
  .map((match) => ({ view: match[1], control: match[2], current: match[0].includes('aria-current="page"') }));
assert.equal(navButtons.length, 6, "every public view must have one navigation button");
assert.ok(navButtons.every((button) => button.control === `view-${button.view}`), "navigation targets must match view ids");
assert.equal(navButtons.filter((button) => button.current).length, 1, "exactly one navigation button must be current initially");
assert.equal(navButtons.find((button) => button.current)?.view, "overview");
assert.match(appSource, /function syncNavigationState\(nextView\)/);
assert.match(appSource, /syncNavigationState\(nextView\)/);

function makeButton(view, current = false) {
  const attributes = new Map(current ? [["aria-current", "page"]] : []);
  const classes = new Set(current ? ["active"] : []);
  return {
    dataset: { view },
    classList: {
      toggle(name, enabled) {
        if (enabled) classes.add(name);
        else classes.delete(name);
      },
    },
    setAttribute(name, value) {
      attributes.set(name, value);
    },
    removeAttribute(name) {
      attributes.delete(name);
    },
    hasClass(name) {
      return classes.has(name);
    },
    attribute(name) {
      return attributes.get(name) || "";
    },
  };
}

const buttons = [
  makeButton("overview", true),
  makeButton("recommend"),
  makeButton("disciplines"),
  makeButton("geography"),
  makeButton("rules"),
  makeButton("sources"),
];
const instrumented = `${appSource.slice(0, bootIndex)}
globalThis.__gaokaoTest = { syncNavigationState };`;
const context = vm.createContext({
  console,
  document: {
    querySelectorAll(selector) {
      return selector === ".nav-btn" ? buttons : [];
    },
  },
});
vm.runInContext(instrumented, context, { filename: appFile });

context.__gaokaoTest.syncNavigationState("sources");
assert.equal(buttons.find((button) => button.dataset.view === "sources").hasClass("active"), true);
assert.equal(buttons.find((button) => button.dataset.view === "sources").attribute("aria-current"), "page");
assert.equal(buttons.find((button) => button.dataset.view === "overview").hasClass("active"), false);
assert.equal(buttons.find((button) => button.dataset.view === "overview").attribute("aria-current"), "");

console.log(JSON.stringify({
  ok: true,
  navigationButtons: navButtons.length,
  controlsMatchViews: true,
  activePageStateSynchronized: true,
}, null, 2));
