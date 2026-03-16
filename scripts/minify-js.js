#!/usr/bin/env node
/**
 * scripts/minify-js.js
 * Post-build: minify all JS in dist/js/ using esbuild.
 * Run automatically as part of `npm run build`.
 *
 * Safety: esbuild minifies local variable names only.
 * Globals (App.*, FS, Config, globalThis.*) are property accesses — never mangled.
 */
import { transform } from "esbuild";
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, resolve } from "node:path";

const ROOT   = resolve(import.meta.dirname, "..");
const JS_DIR = join(ROOT, "dist", "js");

function collectJs(dir) {
  const out = [];
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    statSync(full).isDirectory() ? out.push(...collectJs(full)) : f.endsWith(".js") && out.push(full);
  }
  return out;
}

const files = collectJs(JS_DIR);
let totalBefore = 0, totalAfter = 0, errors = 0;
console.log(`\n── JS Minification (${files.length} files) ──`);

await Promise.all(files.map(async (fp) => {
  try {
    const src = readFileSync(fp, "utf8");
    const { code } = await transform(src, { minify: true, target: "es2020" });
    totalBefore += src.length;
    totalAfter  += code.length;
    writeFileSync(fp, code);
    const pct = (((src.length - code.length) / src.length) * 100).toFixed(0);
    console.log(`  ✅ ${relative(ROOT, fp)}  ${(src.length/1024).toFixed(1)}KB → ${(code.length/1024).toFixed(1)}KB  (-${pct}%)`);
  } catch (e) {
    errors++;
    console.error(`  ❌ ${relative(ROOT, fp)}  ${e.message}`);
  }
}));

const saved = ((totalBefore - totalAfter) / 1024).toFixed(1);
console.log(`\n  Total: ${(totalBefore/1024).toFixed(1)} KB → ${(totalAfter/1024).toFixed(1)} KB  (-${saved} KB)\n`);
if (errors) { console.error(`❌ ${errors} error(s).`); process.exit(1); }
console.log(`✅ Done.\n`);
