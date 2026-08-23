#!/usr/bin/env node

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const port = 4300 + Math.floor(Math.random() * 200);
const child = spawn(process.execPath, [path.join(projectRoot, "scripts", "serve.mjs")], {
  cwd: projectRoot,
  env: { ...process.env, GAOKAO_PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

function request(pathname) {
  return new Promise((resolve, reject) => {
    const requestHandle = http.get({ hostname: "127.0.0.1", port, path: pathname }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => resolve({ statusCode: response.statusCode, body }));
    });
    requestHandle.on("error", reject);
  });
}

try {
  let index = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      index = await request("/geography/");
      break;
    } catch (error) {
      if (attempt === 39) throw error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  assert.equal(index.statusCode, 200);
  assert.match(index.body, /<title>高中地理知识库<\/title>/);

  const app = await request("/geography/assets/app.js");
  assert.equal(app.statusCode, 200);
  assert.match(app.body, /data-geography-course/);

  console.log(JSON.stringify({
    ok: true,
    localRoute: "/geography/",
    indexServed: true,
    appServed: true,
  }, null, 2));
} finally {
  child.kill("SIGTERM");
}
