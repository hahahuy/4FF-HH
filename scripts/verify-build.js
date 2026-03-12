#!/usr/bin/env node
/**
 * scripts/verify-build.js
 * Run AFTER `npm run build`.  Exits 1 if anything is wrong.
 *
 *   node scripts/verify-build.js
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const DIST = join(ROOT, "dist");

let failures = 0;

function ok(label) {
  console.log(`  ✅ ${label}`);
}
function fail(label, detail = "") {
  console.error(`  ❌ ${label}${detail ? " — " + detail : ""}`);
  failures++;
}
function section(title) {
  console.log(`\n── ${title} ──`);
}

// ─── 1. dist/ exists ──────────────────────────────────────────────────────────
section("dist/ exists");
if (!existsSync(DIST)) {
  fail("dist/ directory missing", "run `npm run build` first");
  process.exit(1);
}
ok("dist/ exists");

// ─── 2. index.html ────────────────────────────────────────────────────────────
section("dist/index.html");
const htmlPath = join(DIST, "index.html");
if (!existsSync(htmlPath)) { fail("index.html missing"); }
else {
  const html = readFileSync(htmlPath, "utf8");
  ok("index.html present");

  // CSS bundle injected by Vite somewhere before </head>
  const cssMatch = html.match(/<link[^>]+\.css[^>]*>/);
  if (cssMatch) ok(`CSS link present: ${cssMatch[0].slice(0, 80)}`);
  else fail("No CSS <link> found in index.html");

  // CSS link must appear BEFORE the first <script src="js/
  const cssPos   = html.indexOf('<link rel="stylesheet"');
  const scriptPos = html.indexOf('<script src="js/');
  if (cssPos !== -1 && scriptPos !== -1 && cssPos < scriptPos)
    ok("CSS link appears before first JS script tag");
  else if (cssPos === -1)
    fail("CSS <link rel=stylesheet> not found (Vite may have changed format)");
  else
    fail("CSS link is AFTER the JS scripts — CSS races with JS init", `css@${cssPos} > js@${scriptPos}`);

  // All JS scripts must be present
  const requiredScripts = [
    "js/utils/config.js",
    "js/utils/dom.js",
    "js/app.js",
    "js/filesystem.js",
    "js/draggable.js",
    "js/contextmenu.js",
    "js/terminal.js",
  ];
  for (const s of requiredScripts) {
    if (html.includes(`src="${s}"`)) ok(`Script tag present: ${s}`);
    else fail(`Missing script tag: src="${s}"`);
  }
}

// ─── 3. JS files in dist/js/ ──────────────────────────────────────────────────
section("dist/js/ files");
const requiredJsFiles = [
  "js/utils/config.js",
  "js/utils/html.js",
  "js/utils/fetch.js",
  "js/utils/dom.js",
  "js/app.js",
  "js/event-bus.js",
  "js/filesystem.js",
  "js/autocomplete.js",
  "js/draggable.js",
  "js/contextmenu.js",
  "js/terminal.js",
  "js/commands/fs-commands.js",
  "js/commands/system-commands.js",
  "js/commands/ui-commands.js",
  "js/commands/owner-commands.js",
  "js/commands/index.js",
];
for (const f of requiredJsFiles) {
  const p = join(DIST, f);
  if (existsSync(p)) ok(f);
  else fail(f, "NOT FOUND in dist/");
}

// ─── 4. CSS bundle content ────────────────────────────────────────────────────
section("CSS bundle content");
const assetsDir = join(DIST, "assets");
const cssFiles  = existsSync(assetsDir)
  ? (await import("node:fs")).readdirSync(assetsDir).filter((f) => f.endsWith(".css"))
  : [];

if (cssFiles.length === 0) {
  fail("No .css file found in dist/assets/");
} else {
  const cssBundle = readFileSync(join(assetsDir, cssFiles[0]), "utf8");
  ok(`CSS bundle: ${cssFiles[0]} (${(cssBundle.length / 1024).toFixed(1)} KB)`);

  const checks = [
    { rule: ".resize-handle",           label: "resize handle base style" },
    { rule: ".resize-se",               label: "resize corner style (.resize-se)" },
    { rule: "@keyframes terminal-bounce", label: "terminal-bounce animation" },
    { rule: "@keyframes window-open",   label: "window-open animation" },
    { rule: "#bg-context-menu",         label: "context menu style (#bg-context-menu)" },
    { rule: ".ctx-item",                label: "context menu item style (.ctx-item)" },
    { rule: ".titlebar",                label: "titlebar style" },
    { rule: ".terminal-window",         label: "terminal window style" },
  ];
  for (const { rule, label } of checks) {
    if (cssBundle.includes(rule)) ok(label);
    else fail(label, `"${rule}" not found in CSS bundle`);
  }
}

// ─── 5. CNAME ─────────────────────────────────────────────────────────────────
section("CNAME");
const cname = join(DIST, "CNAME");
if (existsSync(cname)) ok(`CNAME: ${readFileSync(cname, "utf8").trim()}`);
else fail("CNAME missing from dist/");

// ─── 6. content/ ──────────────────────────────────────────────────────────────
section("content/");
const contentDir = join(DIST, "content");
if (existsSync(contentDir)) ok("content/ copied to dist/");
else fail("content/ directory missing from dist/");

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${"─".repeat(40)}`);
if (failures === 0) {
  console.log(`✅  Build verification PASSED — dist/ is production-ready.\n`);
} else {
  console.error(`❌  Build verification FAILED — ${failures} issue(s) found.\n`);
  process.exit(1);
}
