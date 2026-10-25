import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

export interface TreeHash {
	sha256: string
	fileCount: number
	totalBytes: number
}

export function hashTargetTree(root: string, include: (relativePath: string) => boolean): TreeHash {
	const files = collectFiles(root)
		.map((path) => ({ path, relativePath: normalizePath(relative(root, path)) }))
		.filter(({ relativePath }) => include(relativePath))
		.sort((left, right) => left.relativePath.localeCompare(right.relativePath))
	const hash = createHash("sha256")
	let totalBytes = 0
	for (const file of files) {
		const content = readFileSync(file.path)
		totalBytes += content.byteLength
		hash.update(file.relativePath, "utf8")
		hash.update("\0")
		hash.update(content)
		hash.update("\0")
	}
	return { sha256: hash.digest("hex"), fileCount: files.length, totalBytes }
}

function collectFiles(directory: string): string[] {
	const files: string[] = []
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name)
		if (entry.isDirectory()) files.push(...collectFiles(path))
		else if (entry.isFile()) files.push(path)
	}
	return files
}

function normalizePath(path: string): string {
	return path.split("\\").join("/")
}
