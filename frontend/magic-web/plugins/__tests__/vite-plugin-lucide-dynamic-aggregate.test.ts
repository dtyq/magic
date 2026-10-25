import { describe, expect, it } from "vitest"
import {
	createLucideDynamicModuleSource,
	lucideDynamicAggregatePlugin,
	parseLucideDynamicImports,
	resolveLucidePackageRoot,
} from "../vite-plugin-lucide-dynamic-aggregate"

describe("lucide dynamic aggregate plugin", () => {
	it("parses aliases and preserves duplicate aliases as shared nodes", () => {
		const imports = parseLucideDynamicImports(`
			const dynamicIconImports = {
				search: () => import('./icons/search.js'),
				searchIcon: () => import('./icons/search.js'),
			}
		`)

		expect(imports).toEqual([
			{ name: "search", iconPath: "./icons/search.js" },
			{ name: "searchIcon", iconPath: "./icons/search.js" },
		])
	})

	it("generates one static aggregate module for the installed Lucide version", () => {
		const source = createLucideDynamicModuleSource(resolveLucidePackageRoot())
		expect(source).toContain('import { forwardRef, createElement } from "react"')
		expect(source).toContain('"search": iconNode')
		expect(source).toContain("export { DynamicIcon, iconNames, iconNodes }")
		expect(source).not.toContain("dynamicIconImports")
		expect(source).not.toContain("import()")
	})

	it("redirects the package dynamic entry only during production build", () => {
		const plugin = lucideDynamicAggregatePlugin()
		if (!plugin.resolveId || !plugin.configResolved) throw new Error("Expected Vite hooks")
		plugin.configResolved({ command: "build" } as never)
		expect(plugin.resolveId("lucide-react/dynamic")).toBe("\0virtual:lucide-react/dynamic")
		expect(plugin.resolveId("lucide-react/dynamic?x")).toBeNull()
	})
})
