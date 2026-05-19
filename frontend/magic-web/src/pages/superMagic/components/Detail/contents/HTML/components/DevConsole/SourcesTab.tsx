import { useState, useRef, useMemo, useCallback, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Search, Copy, Check, WrapText } from "lucide-react"
import { cn } from "@/lib/utils"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function highlightParts(text: string, term: string): { text: string; match: boolean }[] {
	if (!term) return [{ text, match: false }]
	const parts: { text: string; match: boolean }[] = []
	const lower = text.toLowerCase()
	const lowerTerm = term.toLowerCase()
	let cursor = 0
	while (cursor < text.length) {
		const idx = lower.indexOf(lowerTerm, cursor)
		if (idx === -1) {
			parts.push({ text: text.slice(cursor), match: false })
			break
		}
		if (idx > cursor) parts.push({ text: text.slice(cursor, idx), match: false })
		parts.push({ text: text.slice(idx, idx + term.length), match: true })
		cursor = idx + term.length
	}
	return parts
}

// ─── SourcesTab ──────────────────────────────────────────────────────────────

type SourcesView = "raw" | "processed"

interface CharSegment {
	text: string
	type: "equal" | "added" | "removed"
}

type LineDiffType = "added" | "modified"

interface LineDiffInfo {
	type: LineDiffType
	charDiff?: CharSegment[]
}

interface SourcesTabProps {
	/** The intermediate processed HTML (after processHtmlContent, with TOS links replaced etc.) */
	sourceCode: string
	/** API 返回的最原始 HTML 内容（未经任何预处理） */
	rawSourceCode?: string
	/** The fully processed HTML source code (after runtime injection via getFullContent) */
	processedSourceCode?: string
}

export function SourcesTab({ sourceCode, rawSourceCode, processedSourceCode }: SourcesTabProps) {
	const { t } = useTranslation("super")
	const scrollRef = useRef<HTMLDivElement>(null)
	const searchInputRef = useRef<HTMLInputElement>(null)
	const [sourcesView, setSourcesView] = useState<SourcesView>("raw")
	const [searchText, setSearchText] = useState("")
	const [showSearch, setShowSearch] = useState(false)
	const [wordWrap, setWordWrap] = useState(true)
	const [copied, setCopied] = useState(false)
	const [currentMatchIndex, setCurrentMatchIndex] = useState(0)

	// Determine which raw content to use (API original if available, else intermediate)
	const effectiveRawCode = rawSourceCode ?? sourceCode

	const lines = useMemo(() => {
		const activeCode =
			sourcesView === "processed" && processedSourceCode != null
				? processedSourceCode
				: effectiveRawCode
		return activeCode.split("\n")
	}, [effectiveRawCode, processedSourceCode, sourcesView])

	// Compute diff via Web Worker (off main thread)
	const [diffMap, setDiffMap] = useState<Map<number, LineDiffInfo>>(new Map())
	const workerRef = useRef<Worker | null>(null)

	useEffect(() => {
		if (sourcesView !== "processed" || processedSourceCode == null) {
			setDiffMap(new Map())
			return
		}
		// Terminate previous worker if still running
		workerRef.current?.terminate()
		const worker = new Worker(new URL("./diff-worker.ts", import.meta.url), { type: "module" })
		workerRef.current = worker
		worker.postMessage({ rawText: effectiveRawCode, processedText: processedSourceCode })
		worker.addEventListener(
			"message",
			(e: MessageEvent<{ diffMap: Array<[number, LineDiffInfo]> }>) => {
				setDiffMap(new Map(e.data.diffMap))
				worker.terminate()
				if (workerRef.current === worker) workerRef.current = null
			},
		)
		return () => {
			worker.terminate()
			if (workerRef.current === worker) workerRef.current = null
		}
	}, [effectiveRawCode, processedSourceCode, sourcesView])
	const gutterWidth = useMemo(() => String(lines.length).length * 8 + 24, [lines.length])

	// Reset search and scroll when switching views
	useEffect(() => {
		setSearchText("")
		setCurrentMatchIndex(0)
	}, [sourcesView])

	// Search matches — line indices
	const searchMatches = useMemo(() => {
		if (!searchText) return []
		const term = searchText.toLowerCase()
		const matches: number[] = []
		lines.forEach((line, idx) => {
			if (line.toLowerCase().includes(term)) matches.push(idx)
		})
		return matches
	}, [lines, searchText])

	useEffect(() => {
		if (searchMatches.length === 0) setCurrentMatchIndex(0)
		else if (currentMatchIndex >= searchMatches.length)
			setCurrentMatchIndex(searchMatches.length - 1)
	}, [searchMatches.length]) // eslint-disable-line react-hooks/exhaustive-deps

	const virtualizer = useVirtualizer({
		count: lines.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => (wordWrap ? 20 : 18),
		overscan: 20,
		measureElement: wordWrap ? (el) => el.getBoundingClientRect().height : undefined,
	})

	// Scroll to current match
	useEffect(() => {
		if (searchMatches.length > 0 && searchMatches[currentMatchIndex] !== undefined) {
			virtualizer.scrollToIndex(searchMatches[currentMatchIndex], {
				align: "center",
				behavior: "auto",
			})
		}
	}, [currentMatchIndex, searchMatches]) // eslint-disable-line react-hooks/exhaustive-deps

	const navigateMatch = useCallback(
		(dir: "next" | "prev") => {
			if (searchMatches.length === 0) return
			setCurrentMatchIndex((prev) =>
				dir === "next"
					? (prev + 1) % searchMatches.length
					: (prev - 1 + searchMatches.length) % searchMatches.length,
			)
		},
		[searchMatches.length],
	)

	// Ctrl/Cmd+F shortcut
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if ((e.metaKey || e.ctrlKey) && e.key === "f") {
				e.preventDefault()
				setShowSearch(true)
				setTimeout(() => searchInputRef.current?.focus(), 0)
			}
			if (e.key === "Escape" && showSearch) {
				setShowSearch(false)
				setSearchText("")
			}
		}
		window.addEventListener("keydown", handleKeyDown)
		return () => window.removeEventListener("keydown", handleKeyDown)
	}, [showSearch])

	const handleCopy = useCallback(async () => {
		const activeCode =
			sourcesView === "processed" && processedSourceCode != null
				? processedSourceCode
				: effectiveRawCode
		try {
			await navigator.clipboard.writeText(activeCode)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			// ignore
		}
	}, [effectiveRawCode, processedSourceCode, sourcesView])

	if (!effectiveRawCode) {
		return (
			<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
				{t("stylePanel.devConsole.noSources")}
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col">
			{/* Toolbar */}
			<div className="flex flex-shrink-0 items-center gap-1 border-b border-border/50 px-2 py-1">
				{/* View switcher — only shown when processedSourceCode is available */}
				{processedSourceCode != null && (
					<>
						<div className="flex items-center rounded bg-accent/40 p-0.5">
							<button
								onClick={() => setSourcesView("raw")}
								className={cn(
									"rounded px-2 py-0.5 text-xs transition-colors",
									sourcesView === "raw"
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{t("stylePanel.devConsole.sourcesRaw")}
							</button>
							<button
								onClick={() => setSourcesView("processed")}
								className={cn(
									"rounded px-2 py-0.5 text-xs transition-colors",
									sourcesView === "processed"
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{t("stylePanel.devConsole.sourcesProcessed")}
							</button>
						</div>
						<div className="mx-1 h-4 w-px bg-border" />
					</>
				)}
				<button
					onClick={() => setWordWrap(!wordWrap)}
					className={cn(
						"flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
						wordWrap
							? "bg-accent text-accent-foreground"
							: "text-muted-foreground hover:bg-accent/50",
					)}
					title={t("stylePanel.devConsole.wordWrap")}
				>
					<WrapText size={12} />
				</button>
				<button
					onClick={handleCopy}
					className="flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent/50"
				>
					{copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
				</button>
				<div className="mx-1 h-4 w-px bg-border" />
				<button
					onClick={() => {
						setShowSearch(!showSearch)
						if (!showSearch) setTimeout(() => searchInputRef.current?.focus(), 0)
						else setSearchText("")
					}}
					className={cn(
						"flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
						showSearch
							? "bg-accent text-accent-foreground"
							: "text-muted-foreground hover:bg-accent/50",
					)}
				>
					<Search size={12} />
				</button>
				{showSearch && (
					<>
						<input
							ref={searchInputRef}
							type="text"
							value={searchText}
							onChange={(e) => setSearchText(e.target.value)}
							onKeyDown={(e) => {
								if (e.key === "Enter") navigateMatch(e.shiftKey ? "prev" : "next")
							}}
							placeholder={t("stylePanel.devConsole.searchPlaceholder")}
							className="h-5 w-28 rounded border border-border bg-transparent px-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
						/>
						{searchText && (
							<span className="text-[10px] text-muted-foreground">
								{searchMatches.length > 0
									? t("stylePanel.devConsole.searchMatchCount", {
											current: currentMatchIndex + 1,
											total: searchMatches.length,
										})
									: t("stylePanel.devConsole.searchNoMatch")}
							</span>
						)}
					</>
				)}
				<div className="flex-1" />
				{diffMap.size > 0 && (
					<span className="text-[10px] text-green-600">
						{t("stylePanel.devConsole.sourcesDiffCount", { count: diffMap.size })}
					</span>
				)}
				<span className="text-[10px] text-muted-foreground">
					{t("stylePanel.devConsole.lineCount", { count: lines.length })}
				</span>
			</div>

			{/* Code view */}
			<div ref={scrollRef} className="min-h-0 flex-1 overflow-auto font-mono text-xs">
				<div
					style={{
						height: `${virtualizer.getTotalSize()}px`,
						width: "100%",
						position: "relative",
					}}
				>
					{virtualizer.getVirtualItems().map((virtualItem) => {
						const lineNum = virtualItem.index + 1
						const lineText = lines[virtualItem.index]
						const isMatchLine = searchText && searchMatches.includes(virtualItem.index)
						const isCurrentMatch =
							searchMatches[currentMatchIndex] === virtualItem.index
						const lineDiff = diffMap.get(virtualItem.index)
						const isDiffLine = lineDiff != null

						return (
							<div
								key={virtualItem.key}
								data-index={virtualItem.index}
								ref={wordWrap ? virtualizer.measureElement : undefined}
								style={{
									position: "absolute",
									top: 0,
									left: 0,
									width: "100%",
									transform: `translateY(${virtualItem.start}px)`,
									...(wordWrap ? {} : { height: `${virtualItem.size}px` }),
								}}
								className={cn(
									"flex hover:bg-accent/30",
									isCurrentMatch && "bg-yellow-500/10",
									isMatchLine && !isCurrentMatch && "bg-yellow-500/5",
									isDiffLine &&
										!isMatchLine &&
										!isCurrentMatch &&
										"bg-green-500/10",
								)}
							>
								{/* Line number gutter */}
								<div
									className={cn(
										"flex-shrink-0 select-none border-r border-border/30 px-2 text-right text-[10px] leading-[18px] text-muted-foreground/60",
										isDiffLine && "border-r-green-500/40 text-green-600/70",
									)}
									style={{ width: gutterWidth }}
								>
									{lineNum}
								</div>
								{/* Line content */}
								<pre
									className={cn(
										"min-w-0 flex-1 px-2 leading-[18px] text-foreground/90",
										wordWrap
											? "whitespace-pre-wrap break-all"
											: "whitespace-pre",
									)}
								>
									{isMatchLine && searchText ? (
										<>
											{highlightParts(lineText, searchText).map((p, i) =>
												p.match ? (
													<mark
														key={i}
														className={cn(
															"rounded-sm px-0",
															isCurrentMatch
																? "bg-orange-400/80 text-foreground"
																: "bg-yellow-300/60 text-foreground",
														)}
													>
														{p.text}
													</mark>
												) : (
													<span key={i}>{p.text}</span>
												),
											)}
										</>
									) : lineDiff?.type === "modified" && lineDiff.charDiff ? (
										<>
											{lineDiff.charDiff.map((seg, i) =>
												seg.type === "added" ? (
													<mark
														key={i}
														className="rounded-sm bg-green-400/40 px-0 text-foreground"
													>
														{seg.text}
													</mark>
												) : seg.type === "removed" ? null : (
													<span key={i}>{seg.text}</span>
												),
											)}
										</>
									) : (
										lineText
									)}
								</pre>
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}
