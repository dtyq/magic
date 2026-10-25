import { lazy } from "react"
import type PrismLight from "react-syntax-highlighter/dist/esm/prism-light"

type PrismLightConstructor = typeof PrismLight

let mcpSyntaxHighlighterPromise: Promise<PrismLightConstructor> | undefined

/**
 * MCP only renders JSON and plain text. Keeping registration in one cached
 * promise prevents each message-node implementation from creating its own
 * Prism runtime and language registration side effect.
 */
export const loadMcpSyntaxHighlighter = (): Promise<PrismLightConstructor> => {
	if (!mcpSyntaxHighlighterPromise) {
		mcpSyntaxHighlighterPromise = Promise.all([
			import("react-syntax-highlighter/dist/esm/prism-light"),
			import("react-syntax-highlighter/dist/esm/languages/prism/json"),
		]).then(([highlighterModule, jsonModule]) => {
			const SyntaxHighlighter = highlighterModule.default
			SyntaxHighlighter.registerLanguage("json", jsonModule.default)
			return SyntaxHighlighter
		})
	}

	return mcpSyntaxHighlighterPromise
}

export const preloadMcpSyntaxHighlighter = () => {
	void loadMcpSyntaxHighlighter()
}

export const McpSyntaxHighlighter = lazy(async () => ({
	default: await loadMcpSyntaxHighlighter(),
}))
