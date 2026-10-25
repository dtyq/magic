import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useTranslation } from "react-i18next"
import { CalendarDays, ChevronDown, ChevronRight, FolderTree } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Spinner } from "@/components/shadcn-ui/spinner"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import SmartTooltip from "@/components/other/SmartTooltip"
import type { RecycleBinListProps } from "./RecycleBinList"
import type { RecycleBinItem } from "./recycle-bin-domain"
import { RecycleBinFileItem } from "./RecycleBinFileItem"
import {
	getRecycleBinRelativePath,
	parseRecycleBinTime,
	type RecycleBinFileGroup,
	type RecycleBinFileView,
} from "./recycle-bin-file-view"
import type { useRecycleBinSearch } from "./useRecycleBinSearch"

export interface RecycleBinFileListOptions {
	view: RecycleBinFileView
	groups: RecycleBinFileGroup[]
	expanded: ReadonlySet<string>
	onToggleGroup: (key: string) => void
	query: ReturnType<typeof useRecycleBinSearch>
	disabled: boolean
	scopeMissing: boolean
}
type Row =
	| { key: string; type: "header"; group: RecycleBinFileGroup }
	| { key: string; type: "items"; items: RecycleBinItem[] }

export function RecycleBinFileList({
	selectedIds,
	onToggleItem,
	onPreview,
	onOpenRestore,
	onOpenDelete,
	project,
}: RecycleBinListProps & { project: RecycleBinFileListOptions }) {
	const { t } = useTranslation("super")
	const { view, groups, expanded, query, disabled } = project
	const viewport = useRef<HTMLDivElement>(null)
	const [width, setWidth] = useState(0)
	const [detail, setDetail] = useState<RecycleBinItem | null>(null)
	const grid = view === "grid"
	const columns = grid ? Math.max(1, Math.floor((width - 24) / 196)) : 1
	const selected = useMemo(() => new Set(selectedIds), [selectedIds])
	const rows = useMemo(() => {
		const result: Row[] = []
		for (const group of groups) {
			result.push({ key: group.key, type: "header", group })
			if (view === "location" && !expanded.has(group.key)) continue
			for (let i = 0; i < group.items.length; i += columns)
				result.push({
					key: `${group.key}:${group.items[i].id}`,
					type: "items",
					items: group.items.slice(i, i + columns),
				})
		}
		return result
	}, [groups, columns, expanded, view])
	const virtualizer = useVirtualizer({
		count: rows.length,
		getScrollElement: () => viewport.current,
		getItemKey: (index) => rows[index].key,
		estimateSize: (index) => (rows[index].type === "header" ? 40 : grid ? 210 : 68),
		overscan: 4,
	})
	useLayoutEffect(() => {
		const element = viewport.current
		if (!element) return
		const observer = new ResizeObserver(([entry]) => {
			if (entry.contentRect.width > 0) setWidth(entry.contentRect.width)
		})
		observer.observe(element)
		return () => observer.disconnect()
	}, [])
	useLayoutEffect(() => {
		virtualizer.measure()
	}, [columns, view, virtualizer])
	useEffect(() => {
		setDetail(null)
		if (viewport.current) viewport.current.scrollTop = 0
	}, [query.scopeKey, query.resultVersion])
	let message: string | null = null
	if (project.scopeMissing) message = t("recycleBin.project.scopeMissing")
	else if (query.status === "limit")
		message = t("recycleBin.project.tooMany", { count: query.limits?.max_results })
	else if (query.status === "invalid")
		message = t("recycleBin.project.invalidRange", {
			days: (query.limits?.max_hours ?? 0) / 24,
		})
	else if (query.status === "error") message = t("recycleBin.error.loadFailed")
	else if (query.bounded && (query.status === "idle" || query.status === "cancelled"))
		message = t("recycleBin.project.readyToSearch")
	else if (query.status === "searching")
		message = t("recycleBin.project.searchProgress", { count: query.progress })
	else if (query.items.length === 0 && query.status !== "loading")
		message = query.bounded ? t("recycleBin.project.noMatches") : t("recycleBin.project.empty")
	const loading = query.status === "loading" || query.status === "searching"
	const showRows = !message && !loading
	return (
		<div
			ref={viewport}
			className="min-h-0 flex-1 overflow-auto"
			onScroll={(event) => {
				const element = event.currentTarget
				if (
					query.hasMore &&
					!query.loadingMore &&
					!query.moreError &&
					element.scrollHeight - element.scrollTop - element.clientHeight <= 80
				)
					void query.loadMore()
			}}
		>
			{!showRows && (
				<div
					className="flex min-h-48 flex-col items-center justify-center gap-3 px-5 py-8 text-center text-sm text-muted-foreground"
					role="status"
				>
					{loading && <Spinner className="size-5" />}
					<span>{message ?? t("common.loading")}</span>
					{query.status === "limit" && (
						<p className="text-xs">{t("recycleBin.project.narrowSearch")}</p>
					)}
					{query.status === "error" && (
						<Button variant="outline" size="sm" onClick={() => void query.retry()}>
							{t("recycleBin.error.retry")}
						</Button>
					)}
				</div>
			)}
			{showRows && (
				<>
					{/* 日期标题和文件行共用虚拟滚动，翻页只增加数据，不增加全部历史行的 DOM。 */}
					<div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
						{virtualizer.getVirtualItems().map((virtualRow) => {
							const row = rows[virtualRow.index]
							return (
								<div
									key={row.key}
									ref={virtualizer.measureElement}
									data-index={virtualRow.index}
									className="absolute left-0 top-0 w-full"
									style={{ transform: `translateY(${virtualRow.start}px)` }}
								>
									{row.type === "header" ? (
										<div className="flex items-center gap-2 bg-muted/50 px-3 py-2 text-xs">
											{view === "location" ? (
												<button
													type="button"
													className="flex min-w-0 flex-1 items-center gap-2 text-left"
													disabled={disabled}
													aria-expanded={expanded.has(row.group.key)}
													onClick={() =>
														project.onToggleGroup(row.group.key)
													}
												>
													{expanded.has(row.group.key) ? (
														<ChevronDown size={16} />
													) : (
														<ChevronRight size={16} />
													)}
													<FolderTree size={16} className="shrink-0" />
													<SmartTooltip
														elementType="span"
														className="min-w-0 flex-1"
														placement="top"
													>
														{row.group.location === "/"
															? t("recycleBin.project.topLevelFiles")
															: (getRecycleBinRelativePath(
																	row.group.location,
																) ??
																t(
																	"recycleBin.project.unknownLocation",
																))}
													</SmartTooltip>
												</button>
											) : (
												<span className="flex min-w-0 flex-1 items-center gap-2">
													<CalendarDays size={16} />
													{row.group.day ??
														t("recycleBin.project.unknownTime")}
												</span>
											)}
											<span className="shrink-0 text-muted-foreground">
												{view === "location"
													? t("recycleBin.project.groupCount", {
															count: row.group.items.length,
														})
													: t("recycleBin.project.loaded", {
															count: row.group.items.length,
														})}
											</span>
										</div>
									) : (
										<div
											className={grid ? "grid gap-3 p-3" : undefined}
											style={
												grid
													? {
															gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
														}
													: undefined
											}
										>
											{row.items.map((item) => (
												<RecycleBinFileItem
													key={item.id}
													item={item}
													grid={grid}
													byLocation={view === "location"}
													selected={selected.has(item.id)}
													disabled={disabled}
													onToggle={onToggleItem}
													onRestore={onOpenRestore}
													onDelete={onOpenDelete}
													onDetail={setDetail}
													onPreview={onPreview}
												/>
											))}
										</div>
									)}
								</div>
							)
						})}
					</div>
					<div className="flex flex-wrap items-center justify-center gap-3 border-t border-border px-3 py-3 text-xs text-muted-foreground">
						<span>{t("recycleBin.project.loaded", { count: query.items.length })}</span>
						<span>{t("recycleBin.project.timezone")}</span>
						{query.hasMore && (
							<Button
								type="button"
								variant="ghost"
								size="sm"
								disabled={query.loadingMore || disabled}
								onClick={() => void query.loadMore()}
							>
								{query.loadingMore ? <Spinner className="size-4" /> : null}
								{query.moreError
									? t("recycleBin.error.retry")
									: t("recycleBin.project.loadMore")}
							</Button>
						)}
					</div>
				</>
			)}
			<Dialog
				open={detail !== null}
				onOpenChange={(open) => {
					if (!open) setDetail(null)
				}}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle className="break-all">{detail?.title}</DialogTitle>
						<DialogDescription>
							{t("recycleBin.project.metadataOnly")}
						</DialogDescription>
					</DialogHeader>
					{detail && (
						<dl className="space-y-3 text-sm">
							<div>
								<dt className="text-muted-foreground">
									{t("recycleBin.project.originalLocation")}
								</dt>
								<dd className="break-all">
									{detail.originalPath === "/"
										? t("recycleBin.project.topLevelFiles")
										: (getRecycleBinRelativePath(detail.originalPath) ??
											t("recycleBin.project.unknownLocation"))}
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">
									{t("recycleBin.project.deletedTime")}
								</dt>
								<dd>
									{detail.deletedOn
										? parseRecycleBinTime(detail.deletedOn).format(
												"YYYY-MM-DD HH:mm:ss",
											)
										: t("recycleBin.project.unknownTime")}{" "}
									UTC+08:00
								</dd>
							</div>
							<div>
								<dt className="text-muted-foreground">
									{t("recycleBin.project.deletedBy")}
								</dt>
								<dd>
									{detail.deletedByName || t("recycleBin.project.unknownUser")}
								</dd>
							</div>
							<div>
								<dd>
									{t("recycleBin.project.remaining", {
										days: detail.remainingDays,
									})}
								</dd>
							</div>
							{detail.fileKind === "folder" && (
								<div>
									<dd>{t("recycleBin.project.folderOnly")}</dd>
								</div>
							)}
						</dl>
					)}
				</DialogContent>
			</Dialog>
		</div>
	)
}
