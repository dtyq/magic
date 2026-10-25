import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { css } from "@emotion/css"
import { useThemeMode } from "antd-style"
import { useTranslation } from "react-i18next"
import { MonacoEditor, type editor } from "@/infrastructure/editors/monaco"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { useTerminalOutput } from "./useTerminalOutput"
import { useStyles, useTerminalTheme } from "./style"
import { TerminalOutputToolbar, type TerminalOutputToolbarVariant } from "./TerminalOutputToolbar"

interface TerminalOutputProps {
	content: string
	recordKey: string
	showControls: boolean
	toolbarVariant?: TerminalOutputToolbarVariant
}

export function TerminalOutput({
	content,
	recordKey,
	showControls,
	toolbarVariant,
}: TerminalOutputProps) {
	const { t } = useTranslation("super")
	const { appearance } = useThemeMode()
	const theme = useTerminalTheme()
	const { styles } = useStyles()
	const { document, failed } = useTerminalOutput({ content, recordKey, theme })
	const [instance, setInstance] = useState<editor.IStandaloneCodeEditor | null>(null)
	const [query, setQuery] = useState("")
	const [wrap, setWrap] = useState(true)
	const [searchResult, setSearchResult] = useState({ count: 0, index: -1 })
	const matchesRef = useRef<editor.FindMatch[]>([])
	const activeMatchRef = useRef(-1)
	const ansiDecorations = useRef<editor.IEditorDecorationsCollection | null>(null)
	const searchDecorations = useRef<editor.IEditorDecorationsCollection | null>(null)
	const activeDecoration = useRef<editor.IEditorDecorationsCollection | null>(null)
	const queryRef = useRef(query)
	queryRef.current = query
	const previousText = useRef<string | null>(null)
	const applyingContent = useRef(false)
	const followEnd = useRef(false)

	const showMatch = useCallback(
		(index: number, reveal: boolean) => {
			if (!instance?.getModel()) return
			const match = matchesRef.current[index]
			activeMatchRef.current = match ? index : -1
			activeDecoration.current?.set(
				match
					? [{ range: match.range, options: { inlineClassName: styles.activeMatch } }]
					: [],
			)
			setSearchResult({ count: matchesRef.current.length, index: activeMatchRef.current })
			if (match && reveal) {
				followEnd.current = false
				instance.setSelection(match.range)
				instance.revealRangeInCenterIfOutsideViewport(match.range)
			}
		},
		[instance, styles.activeMatch],
	)

	const refreshSearch = useCallback(
		(reset: boolean) => {
			const model = instance?.getModel()
			if (!model) return
			const value = queryRef.current
			// 使用编辑器的字面量搜索和 Range，不自行判断异常或计算中文、软换行的位置。
			matchesRef.current = value
				? model.findMatches(value, false, false, false, null, false, model.getValueLength())
				: []
			searchDecorations.current?.set(
				matchesRef.current.map((match) => ({
					range: match.range,
					options: { inlineClassName: styles.searchMatch },
				})),
			)
			showMatch(
				reset
					? 0
					: Math.min(Math.max(0, activeMatchRef.current), matchesRef.current.length - 1),
				reset && Boolean(value),
			)
		},
		[instance, showMatch, styles.searchMatch],
	)

	useEffect(() => {
		if (!instance) return
		ansiDecorations.current = instance.createDecorationsCollection()
		searchDecorations.current = instance.createDecorationsCollection()
		activeDecoration.current = instance.createDecorationsCollection()
		const scroll = instance.onDidScrollChange((event) => {
			if (!applyingContent.current && event.scrollTopChanged && !event.scrollHeightChanged) {
				followEnd.current =
					Math.ceil(event.scrollTop + instance.getLayoutInfo().height) >=
					event.scrollHeight
			}
		})
		const size = instance.onDidContentSizeChange(() => {
			if (followEnd.current) instance.setScrollTop(instance.getScrollHeight())
		})
		return () => {
			scroll.dispose()
			size.dispose()
			ansiDecorations.current = null
			searchDecorations.current = null
			activeDecoration.current = null
		}
	}, [instance])

	useEffect(() => {
		const model = instance?.getModel()
		if (!instance || !model) return
		const view = instance.saveViewState()
		const hasPreviousContent = Boolean(previousText.current)
		const keepEnd = hasPreviousContent && followEnd.current
		applyingContent.current = true
		if (model.getValue() !== document.text) model.setValue(document.text)
		ansiDecorations.current?.set(
			document.styles.map((span) => {
				const start = model.getPositionAt(span.start)
				const end = model.getPositionAt(span.end)
				return {
					range: {
						startLineNumber: start.lineNumber,
						startColumn: start.column,
						endLineNumber: end.lineNumber,
						endColumn: end.column,
					},
					options: { inlineClassName: css(span.css) },
				}
			}),
		)
		// 首次打开从顶部阅读；输出更新保留选择与位置，仅用户已经在末尾时继续跟随。
		if (hasPreviousContent && view) instance.restoreViewState(view)
		else instance.setScrollTop(0)
		followEnd.current = keepEnd
		if (keepEnd) instance.setScrollTop(instance.getScrollHeight())
		previousText.current = document.text
		applyingContent.current = false
		refreshSearch(false)
	}, [document, instance, refreshSearch])

	useEffect(() => refreshSearch(true), [query, refreshSearch])

	const find = useCallback(
		(direction: 1 | -1) => {
			const count = matchesRef.current.length
			if (count) showMatch((activeMatchRef.current + direction + count) % count, true)
		},
		[showMatch],
	)
	const scrollToEnd = useCallback(() => {
		followEnd.current = true
		instance?.setScrollTop(instance.getScrollHeight())
	}, [instance])
	const editorOptions = useMemo<editor.IStandaloneEditorConstructionOptions>(
		() => ({
			readOnly: true,
			domReadOnly: true,
			automaticLayout: true,
			minimap: { enabled: false },
			lineNumbers: showControls ? "on" : "off",
			lineNumbersMinChars: 3,
			lineDecorationsWidth: 8,
			folding: false,
			glyphMargin: false,
			wordWrap: wrap ? "on" : "off",
			fontSize: 14,
			lineHeight: 22,
			fontFamily: '"SF Mono", Menlo, Monaco, Consolas, monospace',
			padding: { top: 8, bottom: 8 },
			scrollBeyondLastLine: false,
			scrollbar: { vertical: "auto", horizontal: "auto", alwaysConsumeMouseWheel: false },
			contextmenu: false,
			renderLineHighlight: "none",
			overviewRulerLanes: 0,
			renderWhitespace: "none",
			selectionHighlight: false,
			occurrencesHighlight: "off",
			// 这是已交付输出的阅读视图，不能让编辑器默认长行裁剪静默隐藏结果。
			// 仍使用编辑器的可见行渲染和 largeFileOptimizations，不渲染全部 DOM 行。
			stopRenderingLineAfter: -1,
			largeFileOptimizations: true,
		}),
		[showControls, wrap],
	)

	return (
		<>
			{showControls && (
				<TerminalOutputToolbar
					variant={toolbarVariant}
					query={query}
					onQueryChange={setQuery}
					count={searchResult.count}
					index={searchResult.index}
					onFind={find}
					wrap={wrap}
					onWrapChange={() => setWrap((value) => !value)}
					onScrollToEnd={scrollToEnd}
				/>
			)}
			{failed && <p role="alert">{t("terminal.renderFailed")}</p>}
			<div className={styles.terminalBody} aria-label={t("terminal.output")}>
				<MonacoEditor
					height="100%"
					language="plaintext"
					defaultValue=""
					theme={appearance === "dark" ? "vs-dark" : "light"}
					options={editorOptions}
					onMount={setInstance}
					className={styles.outputEditor}
					loading={
						<div className="flex h-full items-center justify-center">
							<Spinner size={20} />
						</div>
					}
				/>
			</div>
		</>
	)
}
