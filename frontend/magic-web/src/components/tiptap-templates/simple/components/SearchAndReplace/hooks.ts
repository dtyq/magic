import * as React from "react"
import type { Editor } from "@tiptap/react"
import type { Range } from "@tiptap/core"
import { useMemoizedFn } from "ahooks"

export interface UseSearchAndReplaceOptions {
	editor: Editor | null
}

export interface UseSearchAndReplaceReturn {
	searchTerm: string
	replaceTerm: string
	results: Range[]
	resultIndex: number
	caseSensitive: boolean
	useRegex: boolean
	setSearchTerm: (value: string) => void
	setReplaceTerm: (value: string) => void
	toggleCaseSensitive: () => void
	toggleUseRegex: () => void
	goToNext: () => void
	goToPrevious: () => void
	replace: () => void
	replaceAll: () => void
	clear: () => void
}

export function useSearchAndReplace({
	editor,
}: UseSearchAndReplaceOptions): UseSearchAndReplaceReturn {
	const [searchTerm, setSearchTermState] = React.useState("")
	const [replaceTerm, setReplaceTermState] = React.useState("")
	const [caseSensitive, setCaseSensitive] = React.useState(false)
	const [useRegex, setUseRegex] = React.useState(false)
	const [results, setResults] = React.useState<Range[]>([])
	const [resultIndex, setResultIndex] = React.useState(0)

	// Sync results from editor storage on transaction updates
	React.useEffect(() => {
		if (!editor) return

		const updateResults = () => {
			const storage = editor.storage.searchAndReplace
			if (storage) {
				setResults([...storage.results])
				setResultIndex(storage.resultIndex)
			}
		}

		editor.on("transaction", updateResults)
		return () => {
			editor.off("transaction", updateResults)
		}
	}, [editor])

	const setSearchTerm = useMemoizedFn((value: string) => {
		setSearchTermState(value)
		if (!editor) return
		editor.commands.setSearchTerm(value)
	})

	const setReplaceTerm = useMemoizedFn((value: string) => {
		setReplaceTermState(value)
		if (!editor) return
		editor.commands.setReplaceTerm(value)
	})

	const toggleCaseSensitive = useMemoizedFn(() => {
		const next = !caseSensitive
		setCaseSensitive(next)
		if (!editor) return
		editor.commands.setCaseSensitive(next)
	})

	const toggleUseRegex = useMemoizedFn(() => {
		const next = !useRegex
		setUseRegex(next)
		if (!editor) return
		// disableRegex is the inverse of useRegex
		editor.commands.setDisableRegex(!next)
	})

	const scrollToResult = useMemoizedFn(() => {
		if (!editor) return
		const storage = editor.storage.searchAndReplace
		if (storage?.results?.length > 0) {
			const idx = storage.resultIndex
			const result = storage.results[idx]
			if (result) {
				editor.commands.setTextSelection(result.from)
				editor.commands.scrollIntoView()
			}
		}
	})

	const goToNext = useMemoizedFn(() => {
		if (!editor) return
		editor.commands.nextSearchResult()
		requestAnimationFrame(scrollToResult)
	})

	const goToPrevious = useMemoizedFn(() => {
		if (!editor) return
		editor.commands.previousSearchResult()
		requestAnimationFrame(scrollToResult)
	})

	const replaceCurrent = useMemoizedFn(() => {
		if (!editor) return
		editor.commands.replace()
	})

	const replaceAllMatches = useMemoizedFn(() => {
		if (!editor) return
		editor.commands.replaceAll()
	})

	const clear = useMemoizedFn(() => {
		setSearchTermState("")
		setReplaceTermState("")
		if (!editor) return
		editor.commands.setSearchTerm("")
		editor.commands.setReplaceTerm("")
		editor.commands.resetIndex()
	})

	return {
		searchTerm,
		replaceTerm,
		results,
		resultIndex,
		caseSensitive,
		useRegex,
		setSearchTerm,
		setReplaceTerm,
		toggleCaseSensitive,
		toggleUseRegex,
		goToNext,
		goToPrevious,
		replace: replaceCurrent,
		replaceAll: replaceAllMatches,
		clear,
	}
}
