import { readFileSync } from "node:fs"
import { resolve } from "node:path"

interface PackageJson {
	exports?: Record<string, unknown>
}

describe("package exports", () => {
	it("exposes parentOrigin for external runtime plugins", () => {
		const packageJson = JSON.parse(
			readFileSync(resolve(__dirname, "../../../package.json"), "utf8"),
		) as PackageJson

		expect(packageJson.exports?.["./utils/parentOrigin"]).toEqual({
			"magic-web-source": "./src/utils/parentOrigin.ts",
			types: "./src/utils/parentOrigin.ts",
			import: "./dist/utils/parentOrigin.js",
		})
	})

	it("exposes textContent helpers for host editor commands", () => {
		const packageJson = JSON.parse(
			readFileSync(resolve(__dirname, "../../../package.json"), "utf8"),
		) as PackageJson

		expect(packageJson.exports?.["./utils/textContent"]).toEqual({
			"magic-web-source": "./src/utils/textContent.ts",
			types: "./src/utils/textContent.ts",
			import: "./dist/utils/textContent.js",
		})
	})
})
