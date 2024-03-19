import { type Highlighter } from "shiki"
import useSWR from "swr"
import { loadShiki } from "@/opensource/lib/shiki"
import { loadShikiTransformers } from "@/opensource/lib/shikijs-transformers"

import { FALLBACK_LANG } from "@/opensource/utils/markdown"
import { themeConfig } from "../configs/theme"

import languageMap from "../configs/languageMap"

const FALLBACK_LANGS = [FALLBACK_LANG]

let cacheHighlighter: Highlighter

const initHighlighter = async (lang: string): Promise<Highlighter> => {
	let highlighter = cacheHighlighter
	const language = lang.toLowerCase()

	if (highlighter && FALLBACK_LANGS.includes(language)) return highlighter

	if (languageMap.includes(language as any) && !FALLBACK_LANGS.includes(language)) {
		FALLBACK_LANGS.push(language)
	}

	const { getSingletonHighlighter } = await loadShiki()
	highlighter = await getSingletonHighlighter({
		langs: FALLBACK_LANGS,
		themes: [themeConfig(true), themeConfig(false)],
	})

	cacheHighlighter = highlighter

	return highlighter
}

export const useHighlight = (text: string, lang: string = FALLBACK_LANG, isDarkMode?: boolean) =>
	useSWR(
		[lang?.toLowerCase(), isDarkMode ? "dark" : "light", text].join("-"),
		async () => {
			try {
				const language = lang?.toLowerCase()
				const highlighter = await initHighlighter(language)
				const transformersModule = await loadShikiTransformers()
				const html = highlighter?.codeToHtml(text, {
					lang: languageMap.includes(language as any) ? language : FALLBACK_LANG,
					theme: isDarkMode ? "dark" : "light",
					transformers: [
						transformersModule.transformerNotationDiff(),
						transformersModule.transformerNotationHighlight(),
						transformersModule.transformerNotationWordHighlight(),
						transformersModule.transformerNotationFocus(),
						transformersModule.transformerNotationErrorLevel(),
					],
				})
				return html
			} catch {
				return `<pre><code>${text}</code></pre>`
			}
		},
		{ revalidateOnFocus: false },
	)

export { default as languageMap } from "../configs/languageMap"
