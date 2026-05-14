import { useState, useRef, useMemo, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/shadcn-ui/tooltip"
import {
	FileCode,
	Paintbrush,
	Image,
	Type,
	Film,
	SquareCode,
	Package,
	Search,
	Copy,
	Check,
	ChevronRight,
	ChevronDown,
	ExternalLink,
} from "lucide-react"
import type { DependencyEntry, DependencyType } from "./types"

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<DependencyType, typeof FileCode> = {
	script: FileCode,
	stylesheet: Paintbrush,
	image: Image,
	font: Type,
	media: Film,
	iframe: SquareCode,
	other: Package,
}

function getUrlFilename(url: string): string {
	try {
		const pathname = new URL(url, "https://placeholder").pathname
		const parts = pathname.split("/")
		return parts[parts.length - 1] || url
	} catch {
		const parts = url.split("/")
		return parts[parts.length - 1] || url
	}
}

// ─── DependenciesTab ─────────────────────────────────────────────────────────

interface DependenciesTabProps {
	entries: DependencyEntry[]
}

type FilterType = "all" | DependencyType

export function DependenciesTab({ entries }: DependenciesTabProps) {
	const { t } = useTranslation("super")
	const scrollRef = useRef<HTMLDivElement>(null)
	const [filter, setFilter] = useState<FilterType>("all")
	const [searchText, setSearchText] = useState("")
	const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
	const [copiedId, setCopiedId] = useState<string | null>(null)

	const typeCounts = useMemo(() => {
		const counts: Record<string, number> = {}
		for (const entry of entries) {
			counts[entry.type] = (counts[entry.type] || 0) + 1
		}
		return counts
	}, [entries])

	const filteredEntries = useMemo(() => {
		let result = entries
		if (filter !== "all") {
			result = result.filter((e) => e.type === filter)
		}
		if (searchText.trim()) {
			const term = searchText.toLowerCase()
			result = result.filter(
				(e) =>
					e.originalUrl.toLowerCase().includes(term) ||
					e.resolvedUrl.toLowerCase().includes(term) ||
					e.tagName.toLowerCase().includes(term),
			)
		}
		return result
	}, [entries, filter, searchText])

	const toggleExpand = useCallback((id: string) => {
		setExpandedIds((prev) => {
			const next = new Set(prev)
			if (next.has(id)) {
				next.delete(id)
			} else {
				next.add(id)
			}
			return next
		})
	}, [])

	const copyUrl = useCallback((url: string, id: string) => {
		navigator.clipboard.writeText(url).then(() => {
			setCopiedId(id)
			setTimeout(() => setCopiedId(null), 1500)
		})
	}, [])

	const filterTypes: { key: FilterType; label: string }[] = useMemo(
		() => [
			{ key: "all", label: t("stylePanel.devConsole.deps.filterAll") },
			{ key: "script", label: "Script" },
			{ key: "stylesheet", label: "CSS" },
			{ key: "image", label: "Image" },
			{ key: "font", label: "Font" },
			{ key: "media", label: "Media" },
			{ key: "iframe", label: "IFrame" },
			{ key: "other", label: t("stylePanel.devConsole.deps.filterOther") },
		],
		[t],
	)

	if (entries.length === 0) {
		return (
			<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
				{t("stylePanel.devConsole.deps.empty")}
			</div>
		)
	}

	return (
		<div className="flex h-full flex-col" data-testid="dev-console-dependencies-tab">
			{/* Toolbar */}
			<div className="flex flex-shrink-0 items-center gap-1 border-b px-2 py-1">
				{/* Search */}
				<div className="relative flex-1">
					<Search
						size={12}
						className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
					/>
					<input
						className="h-6 w-full rounded border bg-transparent pl-6 pr-2 text-xs outline-none focus:border-primary"
						placeholder={t("stylePanel.devConsole.deps.searchPlaceholder")}
						value={searchText}
						onChange={(e) => setSearchText(e.target.value)}
						data-testid="dev-console-deps-search"
					/>
				</div>
				{/* Filter badges */}
				<div className="flex items-center gap-0.5">
					{filterTypes.map((ft) => {
						const count = ft.key === "all" ? entries.length : typeCounts[ft.key] || 0
						if (ft.key !== "all" && count === 0) return null
						return (
							<button
								key={ft.key}
								type="button"
								className={cn(
									"rounded px-1.5 py-0.5 text-[10px] transition-colors",
									filter === ft.key
										? "bg-primary text-primary-foreground"
										: "bg-muted text-muted-foreground hover:bg-accent",
								)}
								onClick={() => setFilter(ft.key)}
							>
								{ft.label}
								{count > 0 && <span className="ml-0.5 opacity-70">({count})</span>}
							</button>
						)
					})}
				</div>
			</div>

			{/* Entry list */}
			<div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
				{filteredEntries.length === 0 ? (
					<div className="flex h-full items-center justify-center text-xs text-muted-foreground">
						{t("stylePanel.devConsole.deps.noMatch")}
					</div>
				) : (
					<div className="divide-y">
						{filteredEntries.map((entry) => {
							const expanded = expandedIds.has(entry.id)
							const Icon = TYPE_ICONS[entry.type] || Package
							const urlChanged = entry.originalUrl !== entry.resolvedUrl

							return (
								<div
									key={entry.id}
									className="group px-2 py-1.5 hover:bg-accent/50"
									data-testid="dev-console-deps-entry"
								>
									{/* Summary row */}
									<div
										className="flex cursor-pointer items-center gap-1.5"
										onClick={() => toggleExpand(entry.id)}
									>
										{expanded ? (
											<ChevronDown
												size={12}
												className="flex-shrink-0 text-muted-foreground"
											/>
										) : (
											<ChevronRight
												size={12}
												className="flex-shrink-0 text-muted-foreground"
											/>
										)}
										<Icon
											size={12}
											className="flex-shrink-0 text-muted-foreground"
										/>
										<span className="flex-1 truncate font-mono text-xs">
											{getUrlFilename(entry.originalUrl)}
										</span>
										<Badge
											variant="outline"
											className="h-4 px-1 text-[10px] font-normal"
										>
											{`<${entry.tagName.toLowerCase()}>`}
										</Badge>
										{entry.source === "dynamic" && (
											<Badge
												variant="secondary"
												className="h-4 px-1 text-[10px] font-normal"
											>
												{t("stylePanel.devConsole.deps.dynamic")}
											</Badge>
										)}
										{urlChanged && (
											<Badge className="h-4 bg-blue-500/10 px-1 text-[10px] font-normal text-blue-600 dark:text-blue-400">
												{t("stylePanel.devConsole.deps.replaced")}
											</Badge>
										)}
									</div>

									{/* Expanded detail */}
									{expanded && (
										<div className="ml-5 mt-1.5 space-y-1.5">
											{/* Original URL */}
											<div className="flex items-start gap-1">
												<span className="flex-shrink-0 text-[10px] font-medium text-muted-foreground">
													{t("stylePanel.devConsole.deps.original")}:
												</span>
												<div className="group/url flex min-w-0 flex-1 items-center gap-1">
													<code className="min-w-0 flex-1 break-all font-mono text-[11px] text-orange-600 dark:text-orange-400">
														{entry.originalUrl}
													</code>
													<TooltipProvider delayDuration={200}>
														<Tooltip>
															<TooltipTrigger asChild>
																<Button
																	variant="ghost"
																	size="icon"
																	className="invisible h-5 w-5 group-hover/url:visible"
																	onClick={(e) => {
																		e.stopPropagation()
																		copyUrl(
																			entry.originalUrl,
																			`${entry.id}-orig`,
																		)
																	}}
																	data-testid="dev-console-deps-copy-original"
																>
																	{copiedId ===
																	`${entry.id}-orig` ? (
																		<Check size={10} />
																	) : (
																		<Copy size={10} />
																	)}
																</Button>
															</TooltipTrigger>
															<TooltipContent className="text-xs">
																{t(
																	"stylePanel.devConsole.deps.copyUrl",
																)}
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												</div>
											</div>

											{/* Resolved URL */}
											<div className="flex items-start gap-1">
												<span className="flex-shrink-0 text-[10px] font-medium text-muted-foreground">
													{t("stylePanel.devConsole.deps.resolved")}:
												</span>
												<div className="group/url flex min-w-0 flex-1 items-center gap-1">
													<code
														className={cn(
															"min-w-0 flex-1 break-all font-mono text-[11px]",
															urlChanged
																? "text-green-600 dark:text-green-400"
																: "text-muted-foreground",
														)}
													>
														{entry.resolvedUrl}
													</code>
													<div className="invisible flex items-center gap-0.5 group-hover/url:visible">
														<TooltipProvider delayDuration={200}>
															<Tooltip>
																<TooltipTrigger asChild>
																	<Button
																		variant="ghost"
																		size="icon"
																		className="h-5 w-5"
																		onClick={(e) => {
																			e.stopPropagation()
																			copyUrl(
																				entry.resolvedUrl,
																				`${entry.id}-resolved`,
																			)
																		}}
																		data-testid="dev-console-deps-copy-resolved"
																	>
																		{copiedId ===
																		`${entry.id}-resolved` ? (
																			<Check size={10} />
																		) : (
																			<Copy size={10} />
																		)}
																	</Button>
																</TooltipTrigger>
																<TooltipContent className="text-xs">
																	{t(
																		"stylePanel.devConsole.deps.copyUrl",
																	)}
																</TooltipContent>
															</Tooltip>
														</TooltipProvider>
														{entry.resolvedUrl.startsWith("http") && (
															<TooltipProvider delayDuration={200}>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button
																			variant="ghost"
																			size="icon"
																			className="h-5 w-5"
																			onClick={(e) => {
																				e.stopPropagation()
																				window.open(
																					entry.resolvedUrl,
																					"_blank",
																					"noopener",
																				)
																			}}
																			data-testid="dev-console-deps-open-url"
																		>
																			<ExternalLink
																				size={10}
																			/>
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent className="text-xs">
																		{t(
																			"stylePanel.devConsole.deps.openInNewTab",
																		)}
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														)}
													</div>
												</div>
											</div>

											{/* Meta info */}
											<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
												<span>{entry.attrName}</span>
												<span>·</span>
												<span>
													{entry.source === "static"
														? t(
																"stylePanel.devConsole.deps.staticSource",
															)
														: t(
																"stylePanel.devConsole.deps.dynamicSource",
															)}
												</span>
											</div>
										</div>
									)}
								</div>
							)
						})}
					</div>
				)}
			</div>

			{/* Footer summary */}
			<div className="flex flex-shrink-0 items-center justify-between border-t px-2 py-0.5 text-[10px] text-muted-foreground">
				<span>
					{t("stylePanel.devConsole.deps.total", { count: filteredEntries.length })}
				</span>
				<span>
					{t("stylePanel.devConsole.deps.replacedCount", {
						count: filteredEntries.filter((e) => e.originalUrl !== e.resolvedUrl)
							.length,
					})}
				</span>
			</div>
		</div>
	)
}
