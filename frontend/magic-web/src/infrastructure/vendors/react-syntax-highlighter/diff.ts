import { lazy } from "react"
import type { CSSProperties } from "react"
import type Light from "react-syntax-highlighter/dist/esm/light"

type DiffSyntaxHighlighter = typeof Light
type DiffSyntaxModule = {
	SyntaxHighlighter: DiffSyntaxHighlighter
	style: Record<string, CSSProperties>
}

let diffSyntaxHighlighterPromise: Promise<DiffSyntaxModule> | undefined

/**
 * TipTap diff blocks use the small highlight.js Light runtime. The language,
 * style, and registration stay behind one cached boundary so normal code
 * blocks never pull this feature into their Shiki path.
 */
export const loadDiffSyntaxHighlighter = (): Promise<DiffSyntaxModule> => {
	if (!diffSyntaxHighlighterPromise) {
		diffSyntaxHighlighterPromise = Promise.all([
			import("react-syntax-highlighter/dist/esm/light"),
			import("react-syntax-highlighter/dist/esm/languages/hljs/diff"),
			import("react-syntax-highlighter/dist/esm/styles/hljs/github"),
		]).then(([highlighterModule, diffModule, styleModule]) => {
			const SyntaxHighlighter = highlighterModule.default
			SyntaxHighlighter.registerLanguage("diff", diffModule.default)
			return { SyntaxHighlighter, style: styleModule.default }
		})
	}

	const promise = diffSyntaxHighlighterPromise
	return promise
}

export const preloadDiffSyntaxHighlighter = () => {
	void loadDiffSyntaxHighlighter()
}

export const DiffSyntaxHighlighter = lazy(async () => {
	const { SyntaxHighlighter } = await loadDiffSyntaxHighlighter()
	return { default: SyntaxHighlighter }
})
