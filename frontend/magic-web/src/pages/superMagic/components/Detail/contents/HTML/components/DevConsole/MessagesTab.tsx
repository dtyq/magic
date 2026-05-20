import { useRef, useEffect, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Badge } from "@/components/shadcn-ui/badge"
import { ChevronRight, ArrowUpRight, ArrowDownLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import type { MessageEntry, MessageDirection } from "./types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
	const d = new Date(ts)
	return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}.${String(d.getMilliseconds()).padStart(3, "0")}`
}

const DIRECTION_CONFIG: Record<
	MessageDirection,
	{ label: string; icon: typeof ArrowUpRight; color: string; bg: string }
> = {
	outgoing: {
		label: "OUT",
		icon: ArrowUpRight,
		color: "text-blue-500",
		bg: "bg-blue-500/10 border-blue-300",
	},
	incoming: {
		label: "IN",
		icon: ArrowDownLeft,
		color: "text-green-500",
		bg: "bg-green-500/10 border-green-300",
	},
}

const DIRECTION_FILTERS: MessageDirection[] = ["outgoing", "incoming"]

// ─── MessagesTab ─────────────────────────────────────────────────────────────

interface MessagesTabProps {
	entries: MessageEntry[]
}

export function MessagesTab({ entries }: MessagesTabProps) {
	const { t } = useTranslation("super")
	const scrollRef = useRef<HTMLDivElement>(null)
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
	const [directionFilters, setDirectionFilters] = useState<Set<MessageDirection>>(
		new Set(DIRECTION_FILTERS),
	)
	const [filterText, setFilterText] = useState("")
	const userScrolledUp = useRef(false)
	const filterInputRef = useRef<HTMLInputElement>(null)

	const toggleExpand = (id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) next.delete(id)
			else next.add(id)
			return next
		})
	}

	const toggleDirection = (dir: MessageDirection) => {
		setDirectionFilters((prev) => {
			const next = new Set(prev)
			if (next.has(dir)) next.delete(dir)
			else next.add(dir)
			return next
		})
	}

	const filtered = useMemo(
		() =>
			entries.filter(
				(e) =>
					directionFilters.has(e.direction) &&
					(!filterText || e.type.toLowerCase().includes(filterText.toLowerCase())),
			),
		[entries, directionFilters, filterText],
	)

	const virtualizer = useVirtualizer({
		count: filtered.length,
		getScrollElement: () => scrollRef.current,
		estimateSize: () => 36,
		overscan: 10,
		measureElement: (el) => el.getBoundingClientRect().height,
	})

	useEffect(() => {
		if (userScrolledUp.current) return
		if (filtered.length > 0) {
			virtualizer.scrollToIndex(filtered.length - 1, { align: "end", behavior: "auto" })
		}
	}, [filtered.length]) // eslint-disable-line react-hooks/exhaustive-deps

	const handleScroll = () => {
		const el = scrollRef.current
		if (!el) return
		const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 32
		userScrolledUp.current = !atBottom
	}

	if (entries.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
				{t("stylePanel.devConsole.noMessages")}
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col">
			{/* Toolbar */}
			<div className="flex flex-shrink-0 items-center gap-1 border-b border-border/50 px-2 py-1">
				{DIRECTION_FILTERS.map((dir) => {
					const cfg = DIRECTION_CONFIG[dir]
					const active = directionFilters.has(dir)
					const count = entries.filter((e) => e.direction === dir).length
					const DirIcon = cfg.icon
					return (
						<button
							key={dir}
							onClick={() => toggleDirection(dir)}
							className={cn(
								"flex items-center gap-1 rounded px-1.5 py-0.5 text-xs transition-colors",
								active
									? "bg-accent text-accent-foreground"
									: "text-muted-foreground opacity-50",
							)}
						>
							<DirIcon size={12} className={active ? cfg.color : ""} />
							<span>{cfg.label}</span>
							{count > 0 && (
								<Badge variant="secondary" className="ml-0.5 h-4 px-1 text-[10px]">
									{count}
								</Badge>
							)}
						</button>
					)
				})}
				<div className="mx-1 h-4 w-px bg-border" />
				<input
					ref={filterInputRef}
					type="text"
					value={filterText}
					onChange={(e) => setFilterText(e.target.value)}
					placeholder={t("stylePanel.devConsole.messageFilterPlaceholder")}
					className="h-5 w-32 rounded border border-border bg-transparent px-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none"
				/>
			</div>

			{/* Virtual list */}
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
						const isExpanded = expandedIds.has(entry.id)
						const dirCfg = DIRECTION_CONFIG[entry.direction]
						const DirIcon = dirCfg.icon
						const time = formatTime(entry.timestamp)

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
								className="group border-b border-border/50"
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
											"h-4 flex-shrink-0 gap-0.5 px-1 font-mono text-[10px]",
											dirCfg.bg,
											dirCfg.color,
										)}
									>
										<DirIcon size={10} />
										{dirCfg.label}
									</Badge>
									<span className="min-w-0 flex-1 truncate font-mono">
										{entry.type}
									</span>
									<span className="flex-shrink-0 text-[10px] text-muted-foreground">
										{time}
									</span>
								</div>

								{/* Payload detail */}
								{isExpanded && (
									<div className="space-y-1 bg-muted/30 px-6 py-2">
										{entry.origin && (
											<div className="text-muted-foreground">
												<span className="font-medium">Origin:</span>{" "}
												{entry.origin}
											</div>
										)}
										<pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all rounded bg-muted/50 p-1.5 font-mono text-[10px] text-muted-foreground">
											{JSON.stringify(entry.payload, null, 2)}
										</pre>
									</div>
								)}
							</div>
						)
					})}
				</div>
			</div>
		</div>
	)
}
