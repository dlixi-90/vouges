import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const loadEntry = (mode) => {
  const result = spawnSync(process.execPath, ["--experimental-vm-modules", fileURLToPath(new URL("../fixtures/loadServerEntry.mjs", import.meta.url)), mode], { encoding: "utf8", timeout: 15000 });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout.trim());
};

test("Vercel entry exports a callable Express app alongside config without opening a listening socket", () => {
  const result = loadEntry("vercel");
  assert.equal(result.handlerType, "function");
  assert.equal(result.expressHandler, true);
  assert.equal(result.listenCalls, 0);
  assert.equal(result.databaseCalls, 1);
  assert.equal(result.indexCalls, 3);
  assert.equal(result.duration, 60);
  assert.equal(result.healthRoute, true);
});

test("local startup still listens on PORT and also exposes the Express handler", () => {
  const result = loadEntry("local");
  assert.equal(result.listenCalls, 1);
  assert.equal(result.port, "3489");
  assert.equal(result.expressHandler, true);
});
