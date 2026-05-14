import { useRef, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Badge } from "@/components/shadcn-ui/badge"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ApiCallEntry } from "./types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Friendly API name: "MagicFSApi" → "FS" */
function shortApiName(api: string): string {
	return api.replace(/^Magic/, "").replace(/Api$/, "")
}

/** Extract operation name from event or details.type */
function operationName(entry: ApiCallEntry): string {
	const type = entry.details?.type as string | undefined
	if (type) {
		// "MAGIC_FS_READ_REQUEST" → "fs.read"
		const match = type.match(/^MAGIC_(\w+?)_REQUEST$/)
		if (match) {
			return match[1].toLowerCase().replace(/_/g, ".")
		}
		return type
	}
	return entry.event
}

function formatTime(ts: number): string {
	const d = new Date(ts)
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`
}

const STATUS_CONFIG = {
	pending: {
		label: "Pending",
		color: "text-yellow-500",
		bg: "bg-yellow-500/10 border-yellow-300",
	},
	success: { label: "OK", color: "text-green-500", bg: "bg-green-500/10 border-green-300" },
	error: { label: "Error", color: "text-red-500", bg: "bg-red-500/10 border-red-300" },
	timeout: {
		label: "Timeout",
		color: "text-orange-500",
		bg: "bg-orange-500/10 border-orange-300",
	},
} as const

// ─── ApiTab ──────────────────────────────────────────────────────────────────

interface ApiTabProps {
	entries: ApiCallEntry[]
}

export function ApiTab({ entries }: ApiTabProps) {
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
				{t("stylePanel.devConsole.noApiCalls")}
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
					const statusCfg = STATUS_CONFIG[entry.status]
					const opName = operationName(entry)
					const apiName = shortApiName(entry.api)
					const time = formatTime(entry.startTime)

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
								entry.status === "error" && "bg-red-500/5",
								entry.status === "timeout" && "bg-orange-500/5",
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
										statusCfg.bg,
										statusCfg.color,
									)}
								>
									{statusCfg.label}
								</Badge>
								<Badge
									variant="secondary"
									className="h-4 flex-shrink-0 px-1 text-[10px] text-emerald-700"
								>
									{apiName}
								</Badge>
								<span className="min-w-0 flex-1 truncate font-mono">{opName}</span>
								{entry.duration !== undefined && (
									<span className="flex-shrink-0 text-muted-foreground">
										{entry.duration}ms
									</span>
								)}
								<span className="flex-shrink-0 text-[10px] text-muted-foreground">
									{time}
								</span>
							</div>

							{/* Detail section */}
							{isExpanded && entry.details && (
								<div className="space-y-1 bg-muted/30 px-6 py-2">
									{entry.error && (
										<div className="text-red-500">
											<span className="font-medium">
												{t("stylePanel.devConsole.error")}:
											</span>{" "}
											{entry.error}
										</div>
									)}
									<pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/50 p-1.5 font-mono text-[10px] text-muted-foreground">
										{JSON.stringify(entry.details, null, 2)}
									</pre>
								</div>
							)}
						</div>
					)
				})}
			</div>
		</div>
	)
}
