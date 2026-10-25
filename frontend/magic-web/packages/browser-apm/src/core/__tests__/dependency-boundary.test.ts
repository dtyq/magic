import { readFileSync, readdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { expect, it } from "vitest"

const source = resolve(__dirname, "../..")
function files(directory: string): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
		const path = resolve(directory, entry.name)
		if (entry.name === "__tests__") return []
		return entry.isDirectory() ? files(path) : path.endsWith(".ts") ? [path] : []
	})
}
it("keeps APM source independent of application imports and business logging contracts", () => {
	for (const file of files(source)) {
		const content = readFileSync(file, "utf8")
		expect(content, file).not.toMatch(
			/ProviderErrorInput|createProviderErrorInput|code=1000|businessUrls|routesMatch/,
		)
		for (const match of content.matchAll(/(?:from\s*|import\s*\()\s*["']([^"']+)["']/g)) {
			const specifier = match[1]
			expect(specifier, file).not.toMatch(/^@\//)
			if (specifier.startsWith("."))
				expect(resolve(dirname(file), specifier).startsWith(source), file).toBe(true)
		}
	}
})
