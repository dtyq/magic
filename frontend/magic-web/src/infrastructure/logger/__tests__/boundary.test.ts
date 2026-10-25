import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { expect, it } from "vitest"

function files(directory: string, includeTests = false): string[] {
	return readdirSync(directory, { withFileTypes: true }).flatMap((entry) =>
		entry.name === "__tests__" && !includeTests
			? []
			: entry.isDirectory()
				? files(join(directory, entry.name), includeTests)
				: [join(directory, entry.name)],
	)
}
it("keeps infrastructure free of application/store/env/API/router dependencies", () => {
	const directory = fileURLToPath(new URL("..", import.meta.url))
	for (const path of files(directory)) {
		const source = readFileSync(path, "utf8")
		expect(source, path).not.toMatch(/(?:from|import\s*\()\s*["']@\//)
	}
	const entry = readFileSync(join(directory, "index.ts"), "utf8")
	expect(entry).not.toMatch(
		/plugins|collectors|window|document|sessionStorage|startLogger|installCollectors/,
	)
	// Plugins receive their instance through setup; importing the singleton would cross owners.
	for (const path of files(join(directory, "plugins"))) {
		expect(readFileSync(path, "utf8"), path).not.toMatch(
			/from\s*["']\.\.\/(?:index|runtime|logger)["']/,
		)
	}
})

it("retires the legacy directory and rejects old imports or test mocks in all editions", () => {
	const project = fileURLToPath(new URL("../../../..", import.meta.url))
	const retired = ["utils", "log"].join("/")
	expect(existsSync(join(project, "src", retired))).toBe(false)
	const violations: string[] = []
	for (const edition of ["src", "enterprise/src", "customer/src"]) {
		const root = join(project, edition)
		if (!existsSync(root)) continue
		for (const path of files(root, true)) {
			if (!/\.[cm]?[jt]sx?$/.test(path)) continue
			const source = readFileSync(path, "utf8")
			// Include side-effect/dynamic imports and mocks without confusing utils/logger helpers.
			const specifiers = source.matchAll(
				/(?:\bfrom\s*|\bimport\s*(?:\(\s*)?|\brequire\s*\(\s*|\b(?:vi|jest)\.(?:mock|doMock|unmock|doUnmock)\s*\(\s*)["'`]([^"'`]+)["'`]/g,
			)
			for (const [, specifier] of specifiers) {
				const index = specifier.indexOf(retired)
				if (
					index >= 0 &&
					(index === 0 || specifier[index - 1] === "/") &&
					[undefined, "/"].includes(specifier[index + retired.length])
				)
					violations.push(`${path}: ${specifier}`)
			}
		}
	}
	expect(violations).toEqual([])
})

it("preserves explicit entry ordering and the Enterprise native document guard", () => {
	const oss = readFileSync(new URL("../../../main.tsx", import.meta.url), "utf8")
	const enterprise = readFileSync(
		new URL("../../../../enterprise/src/main.tsx", import.meta.url),
		"utf8",
	)
	expect(oss).toMatch(/loggerService\.start\(\)\s+appService\.init\(\)/)
	expect(enterprise).toMatch(
		/if \(!isNativeEntryDocument\) \{\s+loggerService\.start\(\)\s+appService\.init\(\)/,
	)
})
