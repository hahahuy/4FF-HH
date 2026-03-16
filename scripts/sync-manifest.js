#!/usr/bin/env node
/**
 * scripts/sync-manifest.js
 * Scans content/blog/*.md and rewrites content/blog/manifest.json.
 *
 * Title  — first "# Heading" line in the file.
 * Date   — "**Date:** YYYY-MM-DD" line in the file, or kept from the
 *           existing manifest entry so hand-curated dates aren't lost.
 *
 * Files are sorted newest-first by date, then alphabetically for ties.
 * index.md is skipped (it is generated at runtime by loadBlogManifest).
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, join } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const BLOG_DIR = join(ROOT, "content", "blog");
const MANIFEST_PATH = join(BLOG_DIR, "manifest.json");

// Load existing manifest so we can preserve hand-curated dates
const existing = existsSync(MANIFEST_PATH)
  ? JSON.parse(readFileSync(MANIFEST_PATH, "utf8"))
  : [];
const existingDates = Object.fromEntries(existing.map((e) => [e.file, e.date]));

const files = readdirSync(BLOG_DIR).filter(
  (f) => f.endsWith(".md") && f !== "index.md",
);

if (files.length === 0) {
  console.log("sync-manifest: no .md files found, manifest unchanged.");
  process.exit(0);
}

const entries = files.map((file) => {
  const src = readFileSync(join(BLOG_DIR, file), "utf8");
  const lines = src.split("\n");

  // Title: first "# ..." line
  const titleLine = lines.find((l) => /^#\s+/.test(l));
  const title = titleLine ? titleLine.replace(/^#+\s+/, "").trim() : file.replace(/\.md$/i, "");

  // Date: "**Date:** YYYY-MM-DD" anywhere in the file
  const dateLine = lines.find((l) => /\*\*Date:\*\*\s*\d{4}-\d{2}-\d{2}/.test(l));
  const dateMatch = dateLine && dateLine.match(/(\d{4}-\d{2}-\d{2})/);
  const date = dateMatch ? dateMatch[1] : (existingDates[file] ?? "1970-01-01");

  // Folder: "**Folder:** Name" anywhere in the file
  const folderLine = lines.find((l) => /\*\*Folder:\*\*/.test(l));
  const folderMatch = folderLine && folderLine.match(/\*\*Folder:\*\*\s*(.+)/);
  const folder = folderMatch ? folderMatch[1].trim() : "";

  return { file, title, date, folder };
});

// Sort newest-first, then alphabetically
entries.sort((a, b) => {
  const d = new Date(b.date) - new Date(a.date);
  return d !== 0 ? d : a.file.localeCompare(b.file);
});

const json = `${JSON.stringify(entries, null, 2)}\n`;
writeFileSync(MANIFEST_PATH, json, "utf8");
console.log(`sync-manifest: wrote ${entries.length} entries to content/blog/manifest.json`);
entries.forEach((e) => console.log(`  ${e.date}  ${e.file}`));
