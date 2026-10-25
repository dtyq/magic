import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
	diffGrammar: { name: "diff-grammar" },
	githubStyle: { hljs: { color: "#333" } },
	registerLanguage: vi.fn(),
}))

vi.mock("react-syntax-highlighter/dist/esm/light", () => ({
	default: Object.assign(() => null, { registerLanguage: mocks.registerLanguage }),
}))

vi.mock("react-syntax-highlighter/dist/esm/languages/hljs/diff", () => ({
	default: mocks.diffGrammar,
}))

vi.mock("react-syntax-highlighter/dist/esm/styles/hljs/github", () => ({
	default: mocks.githubStyle,
}))

describe("TipTap diff syntax highlighter loader", () => {
	beforeEach(() => {
		vi.resetModules()
		mocks.registerLanguage.mockClear()
	})

	it("caches the runtime, registration, and explicit GitHub style", async () => {
		const { loadDiffSyntaxHighlighter } = await import("../diff")

		const [first, second] = await Promise.all([
			loadDiffSyntaxHighlighter(),
			loadDiffSyntaxHighlighter(),
		])

		expect(first).toBe(second)
		expect(first.style).toBe(mocks.githubStyle)
		expect(mocks.registerLanguage).toHaveBeenCalledTimes(1)
		expect(mocks.registerLanguage).toHaveBeenCalledWith("diff", mocks.diffGrammar)
	})
})
