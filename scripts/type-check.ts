#!/usr/bin/env bun
/**
 * Type-check all TypeScript projects in the workspace
 *
 * This script automatically discovers all directories with tsconfig.json files
 * and runs tsc --noEmit on each one to catch type errors across the monorepo.
 */

import { readdirSync, statSync } from "fs";
import { join } from "path";
import { spawnSync } from "bun";

const WORKSPACE_ROOT = join(import.meta.dir, "..");

// Directories to skip when searching for tsconfig.json
const SKIP_DIRS = new Set([
  "node_modules",
  "dist",
  ".git",
  ".bun",
  "coverage",
]);

/**
 * Recursively find all directories containing tsconfig.json
 */
function findTsConfigDirs(dir: string, depth = 0): string[] {
  // Don't recurse too deep (safety limit)
  if (depth > 3) return [];

  const results: string[] = [];

  try {
    const entries = readdirSync(dir);

    // Check if this directory has a tsconfig.json
    if (entries.includes("tsconfig.json")) {
      results.push(dir);
    }

    // Recurse into subdirectories
    for (const entry of entries) {
      if (SKIP_DIRS.has(entry)) continue;

      const fullPath = join(dir, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) {
          results.push(...findTsConfigDirs(fullPath, depth + 1));
        }
      } catch {
        // Skip if we can't stat (permissions, etc.)
      }
    }
  } catch {
    // Skip if we can't read directory
  }

  return results;
}

/**
 * Run tsc --noEmit on a directory
 */
function typeCheck(dir: string): { success: boolean; output: string } {
  const relativePath = dir.replace(WORKSPACE_ROOT, "").replace(/^\//, "") || ".";

  console.log(`\n📝 Type-checking: ${relativePath || "root"}`);

  const result = spawnSync({
    cmd: ["bunx", "tsc", "--noEmit", "-p", dir],
    stdout: "pipe",
    stderr: "pipe",
  });

  const output = result.stderr.toString() + result.stdout.toString();
  const success = result.exitCode === 0;

  if (success) {
    console.log("✅ No type errors");
  } else {
    console.log("❌ Type errors found:");
    console.log(output);
  }

  return { success, output };
}

/**
 * Main execution
 */
function main() {
  console.log("🔍 Discovering TypeScript projects...\n");

  const tsconfigDirs = findTsConfigDirs(WORKSPACE_ROOT).sort();

  console.log(`Found ${tsconfigDirs.length} project(s):`);
  for (const dir of tsconfigDirs) {
    const relativePath = dir.replace(WORKSPACE_ROOT, "").replace(/^\//, "") || "root";
    console.log(`  - ${relativePath}`);
  }

  let failures = 0;
  const failedProjects: string[] = [];

  for (const dir of tsconfigDirs) {
    const { success } = typeCheck(dir);
    if (!success) {
      failures++;
      const relativePath = dir.replace(WORKSPACE_ROOT, "").replace(/^\//, "") || "root";
      failedProjects.push(relativePath);
    }
  }

  console.log("\n" + "=".repeat(60));
  if (failures === 0) {
    console.log("✅ All type checks passed!");
    process.exit(0);
  } else {
    console.log(`❌ ${failures} project(s) failed type checking:`);
    for (const project of failedProjects) {
      console.log(`  - ${project}`);
    }
    process.exit(1);
  }
}

main();
