import { observer } from "mobx-react-lite"
import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Card } from "@/opensource/components/shadcn-ui/card"
import { Badge } from "@/opensource/components/shadcn-ui/badge"
import { ScrollArea } from "@/opensource/components/shadcn-ui/scroll-area"
import { Separator } from "@/opensource/components/shadcn-ui/separator"
import {
	Download,
	Trash2,
	Filter,
	Minimize2,
	Maximize2,
	Bug,
	Info,
	AlertTriangle,
	XCircle,
} from "lucide-react"
import { cn } from "@/opensource/lib/utils"

interface LogEntry {
	id: string
	level: "debug" | "info" | "warn" | "error"
	message: string
	data?: unknown
	timestamp: number
	formattedTime: string
}

interface LogPanelProps {
	iframeRef: React.RefObject<HTMLIFrameElement>
	className?: string
}

const LOG_LEVEL_CONFIG = {
	debug: {
		icon: Bug,
		label: "Debug",
		color: "text-gray-500",
		bgColor: "bg-gray-100 dark:bg-gray-800",
		badgeVariant: "secondary" as const,
	},
	info: {
		icon: Info,
		label: "Info",
		color: "text-blue-600",
		bgColor: "bg-blue-50 dark:bg-blue-950",
		badgeVariant: "default" as const,
	},
	warn: {
		icon: AlertTriangle,
		label: "Warning",
		color: "text-yellow-600",
		bgColor: "bg-yellow-50 dark:bg-yellow-950",
		badgeVariant: "outline" as const,
	},
	error: {
		icon: XCircle,
		label: "Error",
		color: "text-red-600",
		bgColor: "bg-red-50 dark:bg-red-950",
		badgeVariant: "destructive" as const,
	},
}

/**
 * Log Panel Component
 * Display and manage runtime logs from iframe editor
 */
export const LogPanel = observer(function LogPanel({ iframeRef, className }: LogPanelProps) {
	const [logs, setLogs] = useState<LogEntry[]>([])
	const [isExpanded, setIsExpanded] = useState(false)
	const [selectedLevels, setSelectedLevels] = useState<Set<string>>(
		new Set(["info", "warn", "error"]),
	)
	const [autoScroll, setAutoScroll] = useState(true)
	const scrollRef = useRef<HTMLDivElement>(null)

	/**
	 * Request logs from iframe
	 */
	const requestLogs = useCallback(() => {
		if (!iframeRef.current?.contentWindow) return

		iframeRef.current.contentWindow.postMessage(
			{
				version: "1.0.0",
				category: "request",
				type: "GET_LOGS",
				requestId: `log-req-${Date.now()}`,
				timestamp: Date.now(),
				source: "parent",
			},
			"*",
		)
	}, [iframeRef])

	/**
	 * Listen for log updates from iframe
	 */
	useEffect(() => {
		const handleMessage = (event: MessageEvent) => {
			// Only handle messages from our iframe
			if (event.source !== iframeRef.current?.contentWindow) return

			const { category, type, payload } = event.data || {}

			if (category === "response" && type === "GET_LOGS" && payload?.logs) {
				setLogs(payload.logs)
			} else if (category === "event" && type === "LOG_UPDATED" && payload?.logs) {
				setLogs(payload.logs)
			}
		}

		window.addEventListener("message", handleMessage)

		// Request initial logs
		requestLogs()

		// Poll for updates every 2 seconds when expanded
		const interval = isExpanded ? setInterval(requestLogs, 2000) : undefined

		return () => {
			window.removeEventListener("message", handleMessage)
			if (interval) clearInterval(interval)
		}
	}, [iframeRef, isExpanded, requestLogs])

	/**
	 * Auto-scroll to bottom when new logs arrive
	 */
	useEffect(() => {
		if (autoScroll && scrollRef.current) {
			const scrollContainer = scrollRef.current.querySelector(
				"[data-radix-scroll-area-viewport]",
			)
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollContainer.scrollHeight
			}
		}
	}, [logs, autoScroll])

	/**
	 * Export logs to JSON file
	 */
	const handleExport = useCallback(() => {
		const exportData = {
			exportTime: new Date().toISOString(),
			totalLogs: logs.length,
			logs,
		}

		const blob = new Blob([JSON.stringify(exportData, null, 2)], {
			type: "application/json",
		})
		const url = URL.createObjectURL(blob)
		const a = document.createElement("a")
		a.href = url
		a.download = `editor-logs-${Date.now()}.json`
		a.click()
		URL.revokeObjectURL(url)
	}, [logs])

	/**
	 * Clear logs
	 */
	const handleClear = useCallback(() => {
		if (!iframeRef.current?.contentWindow) return

		iframeRef.current.contentWindow.postMessage(
			{
				version: "1.0.0",
				category: "request",
				type: "CLEAR_LOGS",
				requestId: `log-clear-${Date.now()}`,
				timestamp: Date.now(),
				source: "parent",
			},
			"*",
		)

		setLogs([])
	}, [iframeRef])

	/**
	 * Toggle log level filter
	 */
	const toggleLevel = useCallback((level: string) => {
		setSelectedLevels((prev) => {
			const next = new Set(prev)
			if (next.has(level)) {
				next.delete(level)
			} else {
				next.add(level)
			}
			return next
		})
	}, [])

	// Filter logs by selected levels
	const filteredLogs = logs.filter((log) => selectedLevels.has(log.level))

	// Count by level
	const levelCounts = logs.reduce(
		(acc, log) => {
			acc[log.level] = (acc[log.level] || 0) + 1
			return acc
		},
		{} as Record<string, number>,
	)

	// Only show in development mode
	if (process.env.NODE_ENV !== "development") {
		return null
	}

	return (
		<Card
			className={cn(
				"fixed bottom-4 right-4 z-50 transition-all duration-300",
				isExpanded ? "h-[500px] w-[600px]" : "h-auto w-auto",
				className,
			)}
		>
			{/* Header */}
			<div className="flex items-center justify-between border-b px-4 py-2">
				<div className="flex items-center gap-2">
					<Bug className="h-4 w-4" />
					<span className="text-sm font-semibold">Editor Logs</span>
					<Badge variant="secondary">{logs.length}</Badge>
				</div>

				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setIsExpanded(!isExpanded)}
						title={isExpanded ? "Minimize" : "Maximize"}
					>
						{isExpanded ? (
							<Minimize2 className="h-4 w-4" />
						) : (
							<Maximize2 className="h-4 w-4" />
						)}
					</Button>
				</div>
			</div>

			{/* Expanded content */}
			{isExpanded && (
				<>
					{/* Toolbar */}
					<div className="flex items-center gap-2 border-b px-4 py-2">
						{/* Level filters */}
						<div className="flex items-center gap-1">
							<Filter className="h-3 w-3 text-muted-foreground" />
							{Object.entries(LOG_LEVEL_CONFIG).map(([level, config]) => (
								<Button
									key={level}
									variant={selectedLevels.has(level) ? "default" : "outline"}
									size="sm"
									onClick={() => toggleLevel(level)}
									className="h-7 gap-1 px-2 text-xs"
								>
									<config.icon className="h-3 w-3" />
									{config.label}
									{levelCounts[level] > 0 && (
										<Badge
											variant="secondary"
											className="ml-1 h-4 px-1 text-xs"
										>
											{levelCounts[level]}
										</Badge>
									)}
								</Button>
							))}
						</div>

						<Separator orientation="vertical" className="h-6" />

						{/* Actions */}
						<Button
							variant="outline"
							size="sm"
							onClick={handleExport}
							className="h-7 gap-1 px-2"
						>
							<Download className="h-3 w-3" />
							<span className="text-xs">Export</span>
						</Button>

						<Button
							variant="outline"
							size="sm"
							onClick={handleClear}
							className="h-7 gap-1 px-2"
						>
							<Trash2 className="h-3 w-3" />
							<span className="text-xs">Clear</span>
						</Button>

						<div className="ml-auto flex items-center gap-2">
							<label className="flex items-center gap-1 text-xs text-muted-foreground">
								<input
									type="checkbox"
									checked={autoScroll}
									onChange={(e) => setAutoScroll(e.target.checked)}
									className="h-3 w-3"
								/>
								Auto-scroll
							</label>
						</div>
					</div>

					{/* Log list */}
					<ScrollArea ref={scrollRef} className="h-[calc(500px-120px)]">
						<div className="space-y-1 p-2">
							{filteredLogs.length === 0 ? (
								<div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
									No logs to display
								</div>
							) : (
								filteredLogs.map((log) => {
									const config =
										LOG_LEVEL_CONFIG[log.level as keyof typeof LOG_LEVEL_CONFIG]
									const Icon = config.icon

									return (
										<div
											key={log.id}
											className={cn(
												"rounded px-2 py-1.5 font-mono text-xs",
												config.bgColor,
											)}
										>
											<div className="flex items-start gap-2">
												<Icon
													className={cn(
														"mt-0.5 h-3 w-3 flex-shrink-0",
														config.color,
													)}
												/>
												<div className="min-w-0 flex-1">
													<div className="mb-1 flex items-center gap-2">
														<span className="text-muted-foreground">
															{log.formattedTime}
														</span>
														<Badge
															variant={config.badgeVariant}
															className="h-4 px-1 text-xs"
														>
															{log.level.toUpperCase()}
														</Badge>
													</div>
													<div className="break-words font-medium">
														{log.message as string}
													</div>
													{log.data !== undefined &&
														log.data !== null && (
															<details className="mt-1">
																<summary className="cursor-pointer text-muted-foreground hover:text-foreground">
																	View data
																</summary>
																<pre className="mt-1 whitespace-pre-wrap break-all text-xs">
																	{
																		JSON.stringify(
																			log.data,
																			null,
																			2,
																		) as string
																	}
																</pre>
															</details>
														)}
												</div>
											</div>
										</div>
									)
								})
							)}
						</div>
					</ScrollArea>
				</>
			)}
		</Card>
	)
})

LogPanel.displayName = "LogPanel"
