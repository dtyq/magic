import { useRef, useEffect, useState, type MouseEvent as ReactMouseEvent } from "react"
import { useTranslation } from "react-i18next"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Badge } from "@/components/shadcn-ui/badge"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/shadcn-ui/tooltip"
import { Send, ChevronRight, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { NetworkEntry } from "./types"

// ─── Shared sub-components ───────────────────────────────────────────────────

function DetailSection({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<div>
			<div className="mb-0.5 text-[10px] font-medium text-muted-foreground">{title}</div>
			{children}
		</div>
	)
}

function HeadersTable({ headers }: { headers: Record<string, string> }) {
	return (
		<div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 font-mono text-[10px]">
			{Object.entries(headers).map(([key, value]) => (
				<>
					<span key={`k-${key}`} className="text-muted-foreground">
						{key}:
					</span>
					<span key={`v-${key}`} className="break-all">
						{value}
					</span>
				</>
			))}
		</div>
	)
}

// ─── NetworkTab ───────────────────────────────────────────────────────────────

interface NetworkTabProps {
	entries: NetworkEntry[]
	onSendErrorToAgent: (entry: NetworkEntry) => void
}

export function NetworkTab({ entries, onSendErrorToAgent }: NetworkTabProps) {
	const { t } = useTranslation("super")
	const scrollRef = useRef<HTMLDivElement>(null)
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
	const userScrolledUp = useRef(false)

	const toggleExpand = (id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const virtualizer = useVirtualizer({
		count: entries.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 36,
		overscan: 10,
		measureElement: (el) => el.getBoundingClientRect().height,
	})

	// Auto-scroll to bottom on new entries
	useEffect(() => {
		if (userScrolledUp.current) return
		if (entries.length > 0) {
			virtualizer.scrollToIndex(entries.length - 1, { align: "end", behavior: "auto" })
		}
	}, [entries.length]) // eslint-disable-line react-hooks/exhaustive-deps

	const handleScroll = () => {
		const el = scrollRef.current
		if (!el) return
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32
		userScrolledUp.current = !atBottom
	}

	if (entries.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
				{t("stylePanel.devConsole.noRequests")}
			</div>
		)
	}

	return (
		<div ref={scrollRef} className="h-full overflow-y-auto text-xs" onScroll={handleScroll}>
			<div
				style={{
					height: `${virtualizer.getTotalSize()}px`,
					width: "100%",
					position: "relative",
				}}
			>
				{virtualizer.getVirtualItems().map((virtualItem) => {
					const entry = entries[virtualItem.index]
					const isExpanded = expandedIds.has(entry.id)
					const isError = !!entry.error || entry.status >= 400 || entry.status === 0
					const isIntercepted = !!(entry.originalUrl && entry.resolvedUrl)
					const statusColor = isError
						? "text-red-500"
						: entry.status >= 300
							? "text-yellow-500"
							: "text-green-500"

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
								"group border-b border-border/50",
								isError && "bg-red-500/5",
							)}
						>
							{/* Summary row */}
							<div
								className="flex cursor-pointer items-center gap-2 px-2 py-1.5 hover:bg-accent/50"
								onClick={() => toggleExpand(entry.id)}
							>
								<ChevronRight
									size={10}
									className={cn(
										"flex-shrink-0 text-muted-foreground transition-transform",
										isExpanded && "rotate-90",
									)}
								/>
								<Badge
									variant="outline"
									className={cn(
										"h-4 flex-shrink-0 px-1 font-mono text-[10px]",
										entry.method === "GET"
											? "border-blue-300 text-blue-500"
											: entry.method === "POST"
												? "border-green-300 text-green-500"
												: "border-orange-300 text-orange-500",
									)}
								>
									{entry.method}
								</Badge>
								<span className="min-w-0 flex-1 truncate font-mono">
									{entry.url}
								</span>
								{isIntercepted && (
									<Badge className="h-4 flex-shrink-0 bg-blue-500/10 px-1 text-[10px] font-normal text-blue-600 dark:text-blue-400">
										{t("stylePanel.devConsole.intercepted")}
									</Badge>
								)}
								<span className={cn("flex-shrink-0 font-mono", statusColor)}>
									{entry.status || "ERR"}
								</span>
								<span className="flex-shrink-0 text-muted-foreground">
									{entry.duration}ms
								</span>
								{isError && (
									<TooltipProvider delayDuration={200}>
										<Tooltip>
											<TooltipTrigger asChild>
												<button
													className="flex-shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-red-500 group-hover:opacity-100"
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

							{/* Detail section */}
							{isExpanded && (
								<div className="space-y-2 bg-muted/30 px-6 py-2">
									{isIntercepted && (
										<DetailSection
											title={t("stylePanel.devConsole.urlResolution")}
										>
											<div className="flex items-start gap-1.5 font-mono text-[10px]">
												<span className="text-orange-600 dark:text-orange-400">
													{entry.originalUrl}
												</span>
												<ArrowRight
													size={10}
													className="mt-0.5 flex-shrink-0 text-muted-foreground"
												/>
												<span className="break-all text-green-600 dark:text-green-400">
													{entry.resolvedUrl}
												</span>
											</div>
										</DetailSection>
									)}
									{Object.keys(entry.requestHeaders).length > 0 && (
										<DetailSection
											title={t("stylePanel.devConsole.requestHeaders")}
										>
											<HeadersTable headers={entry.requestHeaders} />
										</DetailSection>
									)}
									{entry.requestBody && (
										<DetailSection
											title={t("stylePanel.devConsole.requestBody")}
										>
											<pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px]">
												{entry.requestBody}
											</pre>
										</DetailSection>
									)}
									{Object.keys(entry.responseHeaders).length > 0 && (
										<DetailSection
											title={t("stylePanel.devConsole.responseHeaders")}
										>
											<HeadersTable headers={entry.responseHeaders} />
										</DetailSection>
									)}
									{entry.responseBody && (
										<DetailSection
											title={t("stylePanel.devConsole.responseBody")}
										>
											<pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px]">
												{entry.responseBody}
											</pre>
										</DetailSection>
									)}
									{entry.error && (
										<DetailSection title={t("stylePanel.devConsole.error")}>
											<span className="text-red-500">{entry.error}</span>
										</DetailSection>
									)}
								</div>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}
