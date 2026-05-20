import {
	useRef,
	useEffect,
	useState,
	useCallback,
	useMemo,
	type MouseEvent as ReactMouseEvent,
	type KeyboardEvent as ReactKeyboardEvent,
} from "react"
import { useTranslation } from "react-i18next"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Badge } from "@/components/shadcn-ui/badge"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/shadcn-ui/tooltip"
import {
	Info,
	AlertTriangle,
	XCircle,
	MessageCircle,
	Send,
	ChevronRight,
	ChevronUp,
	ChevronDown,
	CheckSquare,
	Square,
	MessageSquarePlus,
	Download,
	Search,
	X,
	Play,
} from "lucide-react"
import { cn } from "@/lib/utils"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import type { ConsoleEntry, DevConsoleMode } from "./types"
import { ObjectInspector } from "./ObjectInspector"

// ─── Level Config ────────────────────────────────────────────────────────────

const LEVEL_CONFIG = {
	log: { icon: MessageCircle, color: "text-muted-foreground", bg: "" },
	info: { icon: Info, color: "text-blue-500", bg: "bg-blue-500/5" },
	warn: { icon: AlertTriangle, color: "text-yellow-500", bg: "bg-yellow-500/5" },
	error: { icon: XCircle, color: "text-red-500", bg: "bg-red-500/5" },
} as const

const LEVEL_FILTERS = ["log", "info", "warn", "error"] as const

function formatTime(ts: number): string {
	const d = new Date(ts)
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`
}

function formatEntryAsText(entry: ConsoleEntry): string {
	const time = formatTime(entry.timestamp)
	const message = entry.args.join(" ")
	let text = `[${time}] [${entry.level.toUpperCase()}] ${message}`
	if (entry.stack) text += `\n${entry.stack}`
	return text
}

interface ConsoleTabProps {
	entries: ConsoleEntry[]
	onSendErrorToAgent: (entry: ConsoleEntry) => void
	onExecuteCode: (code: string) => void
	onRequestCompletions: (expression: string) => Promise<string[]>
	mode: DevConsoleMode
}

// ─── Highlight helper ────────────────────────────────────────────────────────

function HighlightedText({
	text,
	highlight,
	isCurrentMatch,
}: {
	text: string
	highlight: string
	isCurrentMatch?: boolean
}) {
	if (!highlight) return <>{text}</>
	const parts: { text: string; match: boolean }[] = []
	const lower = text.toLowerCase()
	const term = highlight.toLowerCase()
	let cursor = 0
	let matchIndex = 0
	while (cursor < text.length) {
		const idx = lower.indexOf(term, cursor)
		if (idx === -1) {
			parts.push({ text: text.slice(cursor), match: false })
			break
		}
		if (idx > cursor) {
			parts.push({ text: text.slice(cursor, idx), match: false })
		}
		parts.push({ text: text.slice(idx, idx + term.length), match: true })
		cursor = idx + term.length
		matchIndex++
	}
	void matchIndex
	return (
		<>
			{parts.map((p, i) =>
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
	)
}

export function ConsoleTab({
	entries,
	onSendErrorToAgent,
	onExecuteCode,
	onRequestCompletions,
	mode,
}: ConsoleTabProps) {
	const { t } = useTranslation("super")
	const isBasicMode = mode === "basic"
	const scrollRef = useRef<HTMLDivElement>(null)
	const [filters, setFilters] = useState<Set<string>>(new Set(LEVEL_FILTERS))
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
	const [filterText, setFilterText] = useState("")
	const [searchText, setSearchText] = useState("")
	const [showSearch, setShowSearch] = useState(false)
	const [currentMatchIndex, setCurrentMatchIndex] = useState(0)
	const [evalInput, setEvalInput] = useState("")
	const [commandHistory, setCommandHistory] = useState<string[]>([])
	const [historyIndex, setHistoryIndex] = useState(-1)
	const [completions, setCompletions] = useState<string[]>([])
	const [completionIndex, setCompletionIndex] = useState(0)
	const [showCompletions, setShowCompletions] = useState(false)
	const completionTimerRef = useRef<ReturnType<typeof setTimeout>>()
	const searchInputRef = useRef<HTMLInputElement>(null)
	const filterInputRef = useRef<HTMLInputElement>(null)
	const evalInputRef = useRef<HTMLInputElement>(null)
	const completionRef = useRef<HTMLDivElement>(null)
	// Track whether user has scrolled up (pause auto-scroll)
	const userScrolledUp = useRef(false)

	const toggleFilter = (level: string) => {
		setFilters((prev) => {
			const next = new Set(prev)
			if (next.has(level)) next.delete(level)
			else next.add(level)
			return next
		})
	}

	const toggleExpand = (id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const filtered = entries.filter((e) => {
		// In basic mode, only show errors and warnings
		if (isBasicMode) {
			return e.level === "error" || e.level === "warn"
		}
		return (
			filters.has(e.level) &&
			(!filterText || e.args.join(" ").toLowerCase().includes(filterText.toLowerCase()))
		)
	})

	// Search matches — indices into `filtered` array
	const searchMatches = useMemo(() => {
		if (!searchText) return []
		const term = searchText.toLowerCase()
		const matches: number[] = []
		filtered.forEach((entry, index) => {
			if (entry.args.join(" ").toLowerCase().includes(term)) {
				matches.push(index)
			}
		})
		return matches
	}, [filtered, searchText])

	// Clamp currentMatchIndex when matches change
	useEffect(() => {
		if (searchMatches.length === 0) {
			setCurrentMatchIndex(0)
		} else if (currentMatchIndex >= searchMatches.length) {
			setCurrentMatchIndex(searchMatches.length - 1)
		}
	}, [searchMatches.length]) // eslint-disable-line react-hooks/exhaustive-deps

	// Scroll to current search match
	useEffect(() => {
		if (searchMatches.length > 0 && searchMatches[currentMatchIndex] !== undefined) {
			virtualizer.scrollToIndex(searchMatches[currentMatchIndex], {
				align: "center",
				behavior: "auto",
			})
		}
	}, [currentMatchIndex, searchMatches]) // eslint-disable-line react-hooks/exhaustive-deps

	const navigateSearch = useCallback(
		(direction: "next" | "prev") => {
			if (searchMatches.length === 0) return
			setCurrentMatchIndex((prev) => {
				if (direction === "next") return (prev + 1) % searchMatches.length
				return (prev - 1 + searchMatches.length) % searchMatches.length
			})
		},
		[searchMatches.length],
	)

	// Ctrl/Cmd+F to toggle search bar
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

	const allFilteredSelected = filtered.length > 0 && filtered.every((e) => selectedIds.has(e.id))

	const toggleSelect = useCallback((id: string) => {
		setSelectedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}, [])

	const toggleSelectAll = useCallback(() => {
		if (allFilteredSelected) {
			setSelectedIds(new Set())
		} else {
			setSelectedIds(new Set(filtered.map((e) => e.id)))
		}
	}, [allFilteredSelected, filtered])

	const getSelectedEntries = useCallback((): ConsoleEntry[] => {
		return filtered.filter((e) => selectedIds.has(e.id))
	}, [filtered, selectedIds])

	const handleInsertToInput = useCallback(() => {
		const selected = getSelectedEntries()
		if (selected.length === 0) return
		const lines = selected.map(formatEntryAsText)
		pubsub.publish(PubSubEvents.Set_Input_Message, lines)
		setSelectedIds(new Set())
	}, [getSelectedEntries])

	const handleExportAsText = useCallback(() => {
		const selected = getSelectedEntries()
		if (selected.length === 0) return
		const text = selected.map(formatEntryAsText).join("\n\n")
		const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = `console-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`
		a.click()
		URL.revokeObjectURL(url)
		setSelectedIds(new Set())
	}, [getSelectedEntries])

	const handleEvalSubmit = useCallback(() => {
		const code = evalInput.trim()
		if (!code) return
		setShowCompletions(false)
		onExecuteCode(code)
		setCommandHistory((prev) => [...prev, code])
		setHistoryIndex(-1)
		setEvalInput("")
	}, [evalInput, onExecuteCode])

	// Debounced completions request
	const fetchCompletions = useCallback(
		(value: string) => {
			if (completionTimerRef.current) clearTimeout(completionTimerRef.current)
			if (!value.trim()) {
				setShowCompletions(false)
				setCompletions([])
				return
			}
			completionTimerRef.current = setTimeout(async () => {
				const results = await onRequestCompletions(value)
				if (results.length > 0) {
					setCompletions(results)
					setCompletionIndex(0)
					setShowCompletions(true)
				} else {
					setShowCompletions(false)
					setCompletions([])
				}
			}, 150)
		},
		[onRequestCompletions],
	)

	const handleEvalInputChange = useCallback(
		(value: string) => {
			setEvalInput(value)
			setHistoryIndex(-1)
			fetchCompletions(value)
		},
		[fetchCompletions],
	)

	const applyCompletion = useCallback(
		(completion: string) => {
			const lastDot = evalInput.lastIndexOf(".")
			const newValue =
				lastDot === -1 ? completion : `${evalInput.slice(0, lastDot + 1)}${completion}`
			setEvalInput(newValue)
			setShowCompletions(false)
			evalInputRef.current?.focus()
		},
		[evalInput],
	)

	const handleEvalKeyDown = useCallback(
		(e: ReactKeyboardEvent<HTMLInputElement>) => {
			// When completions dropdown is visible, handle navigation
			if (showCompletions && completions.length > 0) {
				if (e.key === "ArrowDown") {
					e.preventDefault()
					setCompletionIndex((prev) => (prev + 1) % completions.length)
					return
				}
				if (e.key === "ArrowUp") {
					e.preventDefault()
					setCompletionIndex(
						(prev) => (prev - 1 + completions.length) % completions.length,
					)
					return
				}
				if (e.key === "Tab" || e.key === "Enter") {
					// If Tab, always apply completion; if Enter, only apply when dropdown is shown
					if (e.key === "Tab" || completions.length > 0) {
						e.preventDefault()
						applyCompletion(completions[completionIndex])
						return
					}
				}
				if (e.key === "Escape") {
					e.preventDefault()
					setShowCompletions(false)
					return
				}
			}

			if (e.key === "Enter") {
				e.preventDefault()
				handleEvalSubmit()
			} else if (e.key === "ArrowUp") {
				e.preventDefault()
				if (commandHistory.length === 0) return
				const newIndex =
					historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
				setHistoryIndex(newIndex)
				setEvalInput(commandHistory[newIndex])
				setShowCompletions(false)
			} else if (e.key === "ArrowDown") {
				e.preventDefault()
				if (historyIndex === -1) return
				if (historyIndex >= commandHistory.length - 1) {
					setHistoryIndex(-1)
					setEvalInput("")
				} else {
					const newIndex = historyIndex + 1
					setHistoryIndex(newIndex)
					setEvalInput(commandHistory[newIndex])
				}
				setShowCompletions(false)
			}
		},
		[
			handleEvalSubmit,
			historyIndex,
			commandHistory,
			showCompletions,
			completions,
			completionIndex,
			applyCompletion,
		],
	)

	const virtualizer = useVirtualizer({
		count: filtered.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 28,
		overscan: 10,
		measureElement: (el) => el.getBoundingClientRect().height,
	})

	// Auto-scroll to bottom on new entries (unless user scrolled up)
	useEffect(() => {
		if (userScrolledUp.current) return
		if (filtered.length > 0) {
			virtualizer.scrollToIndex(filtered.length - 1, { align: "end", behavior: "auto" })
		}
	}, [filtered.length]) // eslint-disable-line react-hooks/exhaustive-deps

	// Detect manual scroll to pause auto-scroll
	const handleScroll = () => {
		const el = scrollRef.current
		if (!el) return
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32
		userScrolledUp.current = !atBottom
	}

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Filter bar — advanced mode only */}
			{!isBasicMode && (
				<>
					<div className="flex flex-wrap items-center gap-1 border-b px-2 py-1">
						{/* Select all toggle */}
						<TooltipProvider delayDuration={200}>
							<Tooltip>
								<TooltipTrigger asChild>
									<button
										onClick={toggleSelectAll}
										className={cn(
											"flex items-center gap-1 rounded px-1 py-0.5 text-xs transition-colors",
											allFilteredSelected
												? "text-primary"
												: "text-muted-foreground hover:text-foreground",
										)}
									>
										{allFilteredSelected ? (
											<CheckSquare size={14} />
										) : (
											<Square size={14} />
										)}
									</button>
								</TooltipTrigger>
								<TooltipContent className="text-xs">
									{allFilteredSelected
										? t("stylePanel.devConsole.deselectAll")
										: t("stylePanel.devConsole.selectAll")}
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
						<div className="mx-0.5 h-4 w-px bg-border" />
						{LEVEL_FILTERS.map((level) => {
							const config = LEVEL_CONFIG[level]
							const count = entries.filter((e) => e.level === level).length
							const active = filters.has(level)
							return (
								<button
									key={level}
									onClick={() => toggleFilter(level)}
									className={cn(
										"flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
										active
											? "bg-accent text-accent-foreground"
											: "text-muted-foreground opacity-50",
									)}
								>
									<config.icon size={12} className={active ? config.color : ""} />
									<span className="capitalize">{level}</span>
									{count > 0 && (
										<Badge
											variant="secondary"
											className="ml-0.5 h-4 px-1 text-[10px]"
										>
											{count}
										</Badge>
									)}
								</button>
							)
						})}
						<div className="mx-1 h-4 w-px bg-border" />
						{/* Filter text input */}
						<input
							ref={filterInputRef}
							type="text"
							value={filterText}
							onChange={(e) => setFilterText(e.target.value)}
							placeholder={t("stylePanel.devConsole.filterPlaceholder")}
							className="h-5 w-24 rounded border border-border bg-transparent px-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
						/>
						{/* Search toggle button */}
						<button
							onClick={() => {
								setShowSearch(!showSearch)
								if (!showSearch) {
									setTimeout(() => searchInputRef.current?.focus(), 0)
								} else {
									setSearchText("")
								}
							}}
							className={cn(
								"flex items-center rounded p-0.5 text-xs transition-colors",
								showSearch
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground hover:text-foreground",
							)}
						>
							<Search size={14} />
						</button>
					</div>

					{/* Search bar */}
					{showSearch && (
						<div className="flex items-center gap-1 border-b bg-muted/30 px-2 py-1">
							<Search size={12} className="flex-shrink-0 text-muted-foreground" />
							<input
								ref={searchInputRef}
								type="text"
								value={searchText}
								onChange={(e) => {
									setSearchText(e.target.value)
									setCurrentMatchIndex(0)
								}}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault()
										navigateSearch(e.shiftKey ? "prev" : "next")
									}
									if (e.key === "Escape") {
										setShowSearch(false)
										setSearchText("")
									}
								}}
								placeholder={t("stylePanel.devConsole.searchPlaceholder")}
								className="h-5 min-w-0 flex-1 rounded border-none bg-transparent px-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
							/>
							<span className="flex-shrink-0 text-[10px] text-muted-foreground">
								{searchText
									? searchMatches.length > 0
										? t("stylePanel.devConsole.searchMatchCount", {
												current: currentMatchIndex + 1,
												total: searchMatches.length,
											})
										: t("stylePanel.devConsole.searchNoMatch")
									: ""}
							</span>
							<button
								onClick={() => navigateSearch("prev")}
								disabled={searchMatches.length === 0}
								className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
							>
								<ChevronUp size={14} />
							</button>
							<button
								onClick={() => navigateSearch("next")}
								disabled={searchMatches.length === 0}
								className="rounded p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30"
							>
								<ChevronDown size={14} />
							</button>
							<button
								onClick={() => {
									setShowSearch(false)
									setSearchText("")
								}}
								className="rounded p-0.5 text-muted-foreground hover:text-foreground"
							>
								<X size={14} />
							</button>
						</div>
					)}
				</>
			)}

			{/* Virtual list */}
			{filtered.length === 0 ? (
				<div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
					{isBasicMode
						? t("stylePanel.devConsole.noErrors")
						: t("stylePanel.devConsole.noLogs")}
				</div>
			) : (
				<div
					ref={scrollRef}
					className="min-h-0 flex-1 overflow-y-auto text-xs"
					onScroll={handleScroll}
				>
					<div
						style={{
							height: `${virtualizer.getTotalSize()}px`,
							width: "100%",
							position: "relative",
						}}
					>
						{virtualizer.getVirtualItems().map((virtualItem) => {
							const entry = filtered[virtualItem.index]
							const config = LEVEL_CONFIG[entry.level]
							const Icon = config.icon
							const isExpanded = expandedIds.has(entry.id)
							const isError = entry.level === "error"
							const isEvalInput = entry.source === "eval-input"
							const isEvalResult = entry.source === "eval-result"
							const isCurrentSearchMatch =
								searchMatches.length > 0 &&
								searchMatches[currentMatchIndex] === virtualItem.index
							const time = formatTime(entry.timestamp)
							const message = entry.args.join(" ")

							return (
								<div
									key={virtualItem.key}
									data-index={virtualItem.index}
									ref={virtualizer.measureElement}
									style={{
										position: "absolute",
										top: 0,
										left: 0,
										width: "100%",
										transform: `translateY(${virtualItem.start}px)`,
									}}
									className={cn(
										"group flex border-b border-border/50 px-2 py-1",
										config.bg,
										isCurrentSearchMatch &&
											"ring-1 ring-inset ring-orange-400/50",
										isEvalInput && "bg-muted/30",
										isEvalResult &&
											(entry.level === "error"
												? "bg-red-500/5"
												: "bg-blue-500/5"),
									)}
								>
									{/* Row checkbox — advanced mode only */}
									{!isBasicMode && (
										<button
											className="mr-1 flex-shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
											onClick={(e: ReactMouseEvent) => {
												e.stopPropagation()
												toggleSelect(entry.id)
											}}
										>
											{selectedIds.has(entry.id) ? (
												<CheckSquare size={12} className="text-primary" />
											) : (
												<Square
													size={12}
													className="opacity-0 group-hover:opacity-100"
												/>
											)}
										</button>
									)}
									<button
										className="mr-1 flex-shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
										onClick={() => toggleExpand(entry.id)}
									>
										<ChevronRight
											size={10}
											className={cn(
												"transition-transform",
												isExpanded && "rotate-90",
											)}
										/>
									</button>
									<Icon
										size={14}
										className={cn("mr-1.5 mt-0.5 flex-shrink-0", config.color)}
									/>
									<div className="min-w-0 flex-1">
										<div className="flex items-start justify-between gap-2">
											<div className="min-w-0 flex-1">
												{/* Eval results with structured data → ObjectInspector */}
												{isEvalResult && entry.structuredResult ? (
													<div className="font-mono">
														<span className="mr-1 text-muted-foreground">
															{"< "}
														</span>
														<ObjectInspector
															value={entry.structuredResult}
														/>
													</div>
												) : (
													<span
														className={cn(
															"break-all font-mono",
															isExpanded
																? "whitespace-pre-wrap"
																: "truncate",
															!isExpanded && "line-clamp-1",
															isEvalInput && "text-blue-500",
															isEvalResult &&
																entry.level !== "error" &&
																"text-emerald-600",
														)}
													>
														{searchText ? (
															<HighlightedText
																text={message}
																highlight={searchText}
																isCurrentMatch={
																	isCurrentSearchMatch
																}
															/>
														) : (
															message
														)}
													</span>
												)}
											</div>
											<span className="flex-shrink-0 text-[10px] text-muted-foreground">
												{time}
											</span>
										</div>
										{isExpanded && entry.stack && (
											<pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/50 p-1.5 text-[10px] text-muted-foreground">
												{entry.stack}
											</pre>
										)}
									</div>
									{isError && (
										<TooltipProvider delayDuration={200}>
											<Tooltip>
												<TooltipTrigger asChild>
													<button
														className={cn(
															"ml-1 flex-shrink-0 rounded p-0.5 text-muted-foreground transition-opacity hover:bg-accent hover:text-red-500",
															isBasicMode
																? "opacity-100"
																: "opacity-0 group-hover:opacity-100",
														)}
														onClick={(e: ReactMouseEvent) => {
															e.stopPropagation()
															onSendErrorToAgent(entry)
														}}
													>
														<Send size={12} />
													</button>
												</TooltipTrigger>
												<TooltipContent side="left" className="text-xs">
													{t("stylePanel.devConsole.sendToAgent")}
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									)}
								</div>
							)
						})}
					</div>
				</div>
			)}

			{/* Selection action bar — advanced mode only */}
			{!isBasicMode && selectedIds.size > 0 && (
				<div className="flex flex-shrink-0 items-center gap-2 border-t bg-muted/50 px-3 py-1.5">
					<span className="text-xs text-muted-foreground">
						{t("stylePanel.devConsole.selectedCount", { count: selectedIds.size })}
					</span>
					<div className="flex-1" />
					<TooltipProvider delayDuration={200}>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									onClick={handleInsertToInput}
									className="flex items-center gap-1 rounded px-2 py-1 text-xs text-foreground transition-colors hover:bg-accent"
								>
									<MessageSquarePlus size={14} />
									{t("stylePanel.devConsole.insertToInput")}
								</button>
							</TooltipTrigger>
							<TooltipContent className="text-xs">
								{t("stylePanel.devConsole.insertToInput")}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
					<TooltipProvider delayDuration={200}>
						<Tooltip>
							<TooltipTrigger asChild>
								<button
									onClick={handleExportAsText}
									className="flex items-center gap-1 rounded px-2 py-1 text-xs text-foreground transition-colors hover:bg-accent"
								>
									<Download size={14} />
									{t("stylePanel.devConsole.exportAsText")}
								</button>
							</TooltipTrigger>
							<TooltipContent className="text-xs">
								{t("stylePanel.devConsole.exportAsText")}
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>
				</div>
			)}

			{/* Code execution input — advanced mode only */}
			{!isBasicMode && (
				<div className="relative flex flex-shrink-0 items-center border-t bg-muted/20 px-2 py-1">
					<span className="mr-1 flex-shrink-0 font-mono text-xs text-blue-500">&gt;</span>
					<input
						ref={evalInputRef}
						type="text"
						value={evalInput}
						onChange={(e) => handleEvalInputChange(e.target.value)}
						onKeyDown={handleEvalKeyDown}
						onBlur={() => {
							// Delay to allow click on completion item
							setTimeout(() => setShowCompletions(false), 150)
						}}
						placeholder={t("stylePanel.devConsole.consolePlaceholder")}
						className="h-5 min-w-0 flex-1 bg-transparent font-mono text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
						autoComplete="off"
						spellCheck={false}
					/>
					<button
						onClick={handleEvalSubmit}
						disabled={!evalInput.trim()}
						className="ml-1 flex-shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
					>
						<Play size={12} />
					</button>

					{/* Completions dropdown */}
					{showCompletions && completions.length > 0 && (
						<div
							ref={completionRef}
							className="absolute bottom-full left-0 z-50 mb-0.5 max-h-40 w-full overflow-y-auto rounded border bg-popover shadow-md"
						>
							{completions.map((item, i) => (
								<button
									key={item}
									className={cn(
										"flex w-full items-center px-3 py-1 text-left font-mono text-xs transition-colors",
										i === completionIndex
											? "bg-accent text-accent-foreground"
											: "text-foreground hover:bg-accent/50",
									)}
									onMouseDown={(e) => {
										e.preventDefault()
										applyCompletion(item)
									}}
									onMouseEnter={() => setCompletionIndex(i)}
								>
									{item}
								</button>
							))}
						</div>
					)}
				</div>
			)}
		</div>
	)
}
