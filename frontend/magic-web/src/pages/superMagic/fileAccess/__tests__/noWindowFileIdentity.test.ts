import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const SRC_ROOT = join(__dirname, "../../../..")
const FORBIDDEN =
	/(?:\bwindow\?\.(temporary_token|project_id|topic_id)|\bwindow\.(temporary_token|project_id|topic_id)|\(window\s+as[\s\S]{0,200}?\)\.(temporary_token|project_id|topic_id))/

function collectProductionSourceFiles(dir: string, files: string[] = []): string[] {
	for (const entry of readdirSync(dir)) {
		if (entry === "node_modules" || entry === "__tests__") continue
		const fullPath = join(dir, entry)
		if (statSync(fullPath).isDirectory()) {
			collectProductionSourceFiles(fullPath, files)
			continue
		}
		if (/\.(test|spec)\.(ts|tsx)$/.test(entry)) continue
		if (/\.(ts|tsx)$/.test(entry)) files.push(fullPath)
	}
	return files
}

describe("window file identity lock", () => {
	it("keeps production src free of window file identity", () => {
		const matches: string[] = []

		for (const filePath of collectProductionSourceFiles(SRC_ROOT)) {
			const content = readFileSync(filePath, "utf8")
			if (FORBIDDEN.test(content)) {
				matches.push(filePath.slice(SRC_ROOT.length + 1))
			}
		}

		expect(matches).toEqual([])
	})
})
