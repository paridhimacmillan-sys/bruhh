import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "node:fs/promises";

// Server deps to bundle (reduce cold-start syscalls). Everything else stays external.
const allowlist = [
  "connect-pg-simple",
  "cors",
  "drizzle-orm",
  "drizzle-zod",
  "express",
  "express-session",
  "passport",
  "passport-local",
  "passport-google-oauth20",
  "pg",
  "zod",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("Building client...");
  await viteBuild();

  console.log("Building server...");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const dependencies = Object.keys(pkg.dependencies || {});
  const externals = dependencies.filter((d) => !allowlist.includes(d));

  await esbuild({
    entryPoints: ["server/index.ts"],
    outfile: "dist/index.cjs",
    bundle: true,
    platform: "node",
    format: "cjs",
    target: "node20",
    minify: true,
    sourcemap: false,
    logLevel: "info",
    external: externals,
    mainFields: ["module", "main"],
    resolveExtensions: [".ts", ".tsx", ".js", ".jsx", ".json"],
    define: { "process.env.NODE_ENV": '"production"' },
  });

  console.log("Build complete.");
}

buildAll().catch((err) => { console.error(err); process.exit(1); });
