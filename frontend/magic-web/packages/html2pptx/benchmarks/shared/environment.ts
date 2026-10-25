import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { existsSync, readFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { createRequire } from "node:module"
import { cpus, totalmem } from "node:os"
import type { BenchmarkEnvironment } from "./types"
import { hashTargetTree } from "./tree-hash"

const require = createRequire(import.meta.url)

export function readEnvironment(packageRoot: string): BenchmarkEnvironment {
	const benchmarkTree = hashTargetTree(resolve(packageRoot, "benchmarks"), () => true)
	const pptxGenJs = readPackageInfo("pptxgenjs")
	const puppeteer = readPackageInfo("puppeteer")
	const cpuList = cpus()
	return {
		gitCommit: readGitCommit(packageRoot),
		gitDirty: readGitDirty(packageRoot),
		gitWorkingTreeSha256: readGitWorkingTreeSha256(packageRoot),
		benchmarkTreeSha256: benchmarkTree.sha256,
		benchmarkTreeFileCount: benchmarkTree.fileCount,
		benchmarkTreeBytes: benchmarkTree.totalBytes,
		lockfileSha256: hashFile(resolve(packageRoot, "../../pnpm-lock.yaml")),
		pptxGenJsVersion: pptxGenJs.version,
		pptxGenJsEntrySha256: hashFile(pptxGenJs.entryPath),
		pptxGenJsTreeSha256: pptxGenJs.tree.sha256,
		pptxGenJsTreeFileCount: pptxGenJs.tree.fileCount,
		pptxGenJsTreeBytes: pptxGenJs.tree.totalBytes,
		puppeteerVersion: puppeteer.version,
		nodeVersion: process.version,
		platform: process.platform,
		arch: process.arch,
		cpuModel: cpuList[0]?.model ?? "unknown",
		logicalCpuCount: cpuList.length,
		totalMemoryBytes: totalmem(),
	}
}

function readGitCommit(packageRoot: string): string {
	try {
		return execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: packageRoot,
			encoding: "utf8",
			stdio: ["ignore", "pipe", "ignore"],
		}).trim()
	} catch {
		return "unknown"
	}
}

function readGitDirty(packageRoot: string): boolean {
	try {
		return readGitOutput(packageRoot, ["status", "--porcelain", "--untracked-files=all"]).length > 0
	} catch {
		return false
	}
}

function readGitWorkingTreeSha256(packageRoot: string): string {
	try {
		const repositoryRoot = readGitOutput(packageRoot, ["rev-parse", "--show-toplevel"])
		const hash = createHash("sha256")
		hash.update(readGitOutput(packageRoot, ["diff", "--binary", "HEAD", "--"]))
		const untracked = readGitOutput(packageRoot, [
			"-c",
			"core.quotePath=false",
			"ls-files",
			"--full-name",
			"--others",
			"--exclude-standard",
		])
			.split("\n")
			.filter(Boolean)
			.sort()
		for (const relativePath of untracked) {
			hash.update(relativePath)
			hash.update("\0")
			hash.update(readFileSync(resolve(repositoryRoot, relativePath)))
			hash.update("\0")
		}
		return hash.digest("hex")
	} catch {
		return "unknown"
	}
}

function readGitOutput(packageRoot: string, args: string[]): string {
	return execFileSync("git", args, {
		cwd: packageRoot,
		encoding: "utf8",
		stdio: ["ignore", "pipe", "ignore"],
	}).trim()
}

function readPackageInfo(packageName: string): {
	version: string
	entryPath: string
	tree: ReturnType<typeof hashTargetTree>
} {
	try {
		const entryPath = require.resolve(packageName)
		let current = dirname(entryPath)
		while (true) {
			const packageJsonPath = join(current, "package.json")
			if (existsSync(packageJsonPath)) {
				const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
					name?: string
					version?: string
				}
				if (packageJson.name === packageName) {
					return {
						version: packageJson.version ?? "unknown",
						entryPath,
						tree: hashTargetTree(current, (relativePath) => {
							return !relativePath.startsWith("node_modules/")
						}),
					}
				}
			}
			const parent = resolve(current, "..")
			if (parent === current) break
			current = parent
		}
	} catch {
		// Fall through to the stable unknown marker.
	}
	return {
		version: "unknown",
		entryPath: "",
		tree: { sha256: "unknown", fileCount: 0, totalBytes: 0 },
	}
}

function hashFile(path: string): string {
	if (!path || !existsSync(path)) return "unknown"
	return createHash("sha256").update(readFileSync(path)).digest("hex")
}
