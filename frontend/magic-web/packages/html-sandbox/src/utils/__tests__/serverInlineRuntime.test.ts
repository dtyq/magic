import { createRequire } from "node:module"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const { buildIndexHtmlWithRuntime } = require("../../../server.cjs") as {
	buildIndexHtmlWithRuntime: (indexHtml: string, runtimeSource: string) => string
}

describe("html-sandbox dev server inline runtime", () => {
	it("enables CORS for host runtime script loading", () => {
		const indexHtml = readFileSync(resolve(__dirname, "../../../index.html"), "utf8")

		expect(indexHtml).toContain('script.crossOrigin = "anonymous"')
	})

	it("encodes inline runtime content as base64 for the shell decoder", () => {
		const runtimeSource =
			"/* dev runtime */\nconsole.log('中文 runtime');\nwindow.__runtime = '</script>';"
		const html = buildIndexHtmlWithRuntime(
			`<!doctype html><html><head>
				<script id="magic-iframe-runtime-inline" type="application/magic-runtime" data-runtime="true" data-encoding="base64">
					__MAGIC_IFRAME_RUNTIME_INLINE_PLACEHOLDER__
				</script>
			</head><body></body></html>`,
			runtimeSource,
		)

		const match = html.match(
			/<script\b(?=[^>]*\bid\s*=\s*["']magic-iframe-runtime-inline["'])[^>]*>([\s\S]*?)<\/script\s*>/i,
		)
		const inlineRuntime = match?.[1]?.replace(/\s+/g, "") || ""

		expect(inlineRuntime).toMatch(/^[A-Za-z0-9+/]*={0,2}$/)
		expect(inlineRuntime).not.toContain("console.log")
		expect(Buffer.from(inlineRuntime, "base64").toString("utf8")).toBe(runtimeSource)
	})
})
