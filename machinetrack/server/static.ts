import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  // When bundled to dist/index.cjs, __dirname === project/dist, so client is at ./public
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(`Could not find build directory: ${distPath}. Run npm run build first.`);
  }
  app.use(express.static(distPath));
  // SPA fallback
  app.use((_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
