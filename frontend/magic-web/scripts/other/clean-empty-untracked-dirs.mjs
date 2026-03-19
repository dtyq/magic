#!/usr/bin/env node
import fs from "node:fs"
import path from "node:path"
import { execSync } from "node:child_process"

function parseArgs(argv) {
  const args = new Map()
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token.startsWith("--")) {
      const key = token.slice(2)
      const next = argv[i + 1]
      const hasValue = next !== undefined && !next.startsWith("--")
      if (hasValue) {
        args.set(key, next)
        i += 1
      } else {
        args.set(key, true)
      }
    }
  }
  return args
}

function toPosixPath(p) {
  return p.split(path.sep).join(path.posix.sep)
}

function getGitTrackedFiles(gitRootAbs) {
  try {
    const out = execSync("git ls-files", {
      cwd: gitRootAbs,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    })
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    throw new Error(`Failed to run git ls-files: ${msg}`)
  }
}

function buildTrackedAncestorDirs(gitRootAbs, trackedFiles) {
  const ancestorAbsSet = new Set()
  for (const relFile of trackedFiles) {
    const parts = relFile.split("/")
    for (let i = 0; i < parts.length - 1; i += 1) {
      const relDir = parts.slice(0, i + 1).join("/")
      ancestorAbsSet.add(path.join(gitRootAbs, relDir))
    }
  }
  return ancestorAbsSet
}

function isExcludedAbsDir(absDir, rootAbs, excludedSegments) {
  const rel = path.relative(rootAbs, absDir)
  if (rel.startsWith("..") || path.isAbsolute(rel)) return true
  const segs = rel.split(path.sep)
  for (const seg of segs) {
    if (excludedSegments.has(seg)) return true
  }
  return false
}

function usageAndExit() {
  // eslint-disable-next-line no-console
  console.log(`Usage:
  node scripts/clean-empty-untracked-dirs.mjs [--apply]
    [--root <path>]
    [--exclude <a,b>]
    [--no-default-excludes]

Default is dry-run (no deletion). Use --apply to delete.`)
  process.exit(1)
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes("--help") || argv.includes("-h")) usageAndExit()

  const args = parseArgs(argv)
  const apply = Boolean(args.get("apply"))
  const rootRel = typeof args.get("root") === "string" ? args.get("root") : "."
  const gitRootAbs = path.resolve(process.cwd(), rootRel)

  const defaultOtherExcludes = [
    "node_modules",
    ".cursor",
    "dist",
    "build",
    "coverage",
    ".next",
    ".turbo",
  ]

  const excludedSegments = new Set([".git"])
  if (!Boolean(args.get("no-default-excludes"))) {
    for (const seg of defaultOtherExcludes) excludedSegments.add(seg)
  }
  if (typeof args.get("exclude") === "string") {
    const extra = args
      .get("exclude")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    for (const seg of extra) excludedSegments.add(seg)
  }

  const trackedFiles = getGitTrackedFiles(gitRootAbs)
  const trackedAncestorDirs = buildTrackedAncestorDirs(
    gitRootAbs,
    trackedFiles,
  )

  const deletableDirs = []

  function visitDir(absDir) {
    const isRoot = absDir === gitRootAbs
    if (!isRoot && isExcludedAbsDir(absDir, gitRootAbs, excludedSegments)) return false

    let dirents
    try {
      dirents = fs.readdirSync(absDir, { withFileTypes: true })
    } catch {
      // Ignore permission errors so the script can complete.
      return false
    }

    let hasNonRemovableEntry = false
    for (const entry of dirents) {
      if (entry.isDirectory()) {
        if (entry.isSymbolicLink()) {
          hasNonRemovableEntry = true
          continue
        }
        const childAbs = path.join(absDir, entry.name)
        const childCanRemove = visitDir(childAbs)
        if (!childCanRemove) hasNonRemovableEntry = true
      } else {
        // Any file (including hidden ones) means not empty.
        hasNonRemovableEntry = true
      }
    }

    if (hasNonRemovableEntry) return false
    if (!isRoot && trackedAncestorDirs.has(absDir)) return false

    if (!isRoot) {
      deletableDirs.push(absDir)
      return true
    }
    return false
  }

  visitDir(gitRootAbs)

  const displayLimit = 200
  // eslint-disable-next-line no-console
  console.log(
    `Deletable empty dirs (dry-run: ${!apply}): ${deletableDirs.length}`,
  )
  if (deletableDirs.length > 0) {
    const head = deletableDirs.slice(0, displayLimit)
    for (const absDir of head) {
      const relDir = toPosixPath(path.relative(gitRootAbs, absDir))
      // eslint-disable-next-line no-console
      console.log(`  - ${relDir}`)
    }
    if (deletableDirs.length > displayLimit) {
      // eslint-disable-next-line no-console
      console.log(`  ... and ${deletableDirs.length - displayLimit} more`)
    }
  }

  if (!apply) return

  let deletedCount = 0
  let failedCount = 0

  for (const absDir of deletableDirs) {
    try {
      fs.rmdirSync(absDir)
      deletedCount += 1
    } catch (e) {
      failedCount += 1
      const msg = e instanceof Error ? e.message : String(e)
      // eslint-disable-next-line no-console
      console.error(`Failed to delete ${absDir}: ${msg}`)
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Deleted ${deletedCount} directories.`)
  if (failedCount > 0) {
    // eslint-disable-next-line no-console
    console.log(`Failed to delete ${failedCount} directories.`)
    process.exitCode = 1
  }
}

main()

