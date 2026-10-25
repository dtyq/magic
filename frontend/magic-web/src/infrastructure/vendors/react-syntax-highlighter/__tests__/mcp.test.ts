import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	jsonGrammar: { name: "json-grammar" },
	registerLanguage: vi.fn(),
}))

vi.mock("react-syntax-highlighter/dist/esm/prism-light", () => ({
	default: Object.assign(() => null, { registerLanguage: mocks.registerLanguage }),
}))

vi.mock("react-syntax-highlighter/dist/esm/languages/prism/json", () => ({
	default: mocks.jsonGrammar,
}))

describe("MCP syntax highlighter loader", () => {
	beforeEach(() => {
		vi.resetModules()
		mocks.registerLanguage.mockClear()
	})

	it("caches the runtime and registers only JSON once", async () => {
		const { loadMcpSyntaxHighlighter } = await import("../mcp")

		const [first, second] = await Promise.all([
			loadMcpSyntaxHighlighter(),
			loadMcpSyntaxHighlighter(),
		])

		expect(first).toBe(second)
		expect(mocks.registerLanguage).toHaveBeenCalledTimes(1)
		expect(mocks.registerLanguage).toHaveBeenCalledWith("json", mocks.jsonGrammar)
	})
})
