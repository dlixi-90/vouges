import { readFile } from "node:fs/promises";
import { createContext, SourceTextModule, SyntheticModule } from "node:vm";
import express from "express";
import cors from "cors";
import multer from "multer";

const mode = process.argv[2];
const state = { listenCalls: 0, databaseCalls: 0, indexCalls: 0 };
const context = createContext({ process: { env: { ...(mode === "vercel" ? { VERCEL: "1" } : {}), PORT: "3489" } }, console: { log() {} } });
const noop = (_req, _res, next) => next();
const dependencies = {
  express: { default: Object.assign(() => {
    const app = express();
    app.listen = (port) => { state.listenCalls++; state.port = port; };
    return app;
  }, express) },
  cors: { default: cors },
  multer: { default: multer },
  "dotenv/config": {},
  "@clerk/express": { clerkMiddleware: () => noop },
  "./config/mongodb.js": { default: async () => { state.databaseCalls++; } },
  "./config/cloudinary.js": { default: async () => {} },
  "./controllers/ClerkWebhooks.js": { default: noop },
  "./controllers/voucherController.js": { awardBirthdays: noop },
};
const source = await readFile(new URL("../../server.js", import.meta.url), "utf8");
const entry = new SourceTextModule(source, { context, identifier: "server.js" });
await entry.link((specifier) => {
  let exports = dependencies[specifier];
  if (specifier.startsWith("./routes/")) exports = { default: express.Router() };
  if (specifier.startsWith("./models/Support")) exports = { default: { init: async () => { state.indexCalls++; } } };
  if (!exports) throw new Error(`Unmocked entry dependency: ${specifier}`);
  return new SyntheticModule(Object.keys(exports), function () {
    for (const [key, value] of Object.entries(exports)) this.setExport(key, value);
  }, { context });
});
await entry.evaluate();
const handler = entry.namespace.default;
console.log(JSON.stringify({ ...state, handlerType: typeof handler, expressHandler: typeof handler?.handle === "function",
  duration: entry.namespace.config?.maxDuration,
  healthRoute: handler?.router.stack.some((layer) => layer.route?.path === "/" && layer.route.methods.get) || false }));
