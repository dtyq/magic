import type { UIEvent } from "react"
import type { TFunction } from "i18next"
import { CheckLine, Eye, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react"
import { Badge } from "@/components/shadcn-ui/badge"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { Separator } from "@/components/shadcn-ui/separator"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { RecycleBinFileList, type RecycleBinFileListOptions } from "./RecycleBinFileList"
import {
	getCategoryLabel,
	getDisplayTitle,
	type RecycleBinItem,
	type RestoreTarget,
} from "./recycle-bin-domain"

export interface RecycleBinListProps {
	onPreview?: (item: RecycleBinItem) => void
	project?: RecycleBinFileListOptions
	items: RecycleBinItem[]
	selectedIds: string[]
	loading: boolean
	loadingMore: boolean
	hasMore: boolean
	hasError: boolean
	shouldShowEmpty: boolean
	onLoadMore: () => void
	onToggleItem: (payload: { id: string; checked: boolean }) => void
	onRetry: () => void
	onOpenRestore: (target: RestoreTarget) => void
	onOpenDelete: (item: RecycleBinItem) => void
	t: TFunction
}

export function RecycleBinList(props: RecycleBinListProps) {
	const {
		items,
		selectedIds,
		loading,
		loadingMore,
		hasMore,
		hasError,
		shouldShowEmpty,
		onLoadMore,
		onToggleItem,
		onRetry,
		onOpenRestore,
		onOpenDelete,
		t,
	} = props
	if (props.project) return <RecycleBinFileList {...props} project={props.project} />
	if (loading && items.length === 0) {
		return (
			<div
				className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground"
				data-testid="recycle-bin-loading"
			>
				<Spinner className="text-muted-foreground" />
				<span>{t("common.loading")}</span>
			</div>
		)
	}

	if (hasError) {
		return (
			<div
				className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-sm text-muted-foreground"
				data-testid="recycle-bin-error"
			>
				<div>{t("recycleBin.error.loadFailed")}</div>
				<Button
					variant="outline"
					size="default"
					className="h-9 rounded-lg px-4"
					onClick={onRetry}
					type="button"
					data-testid="recycle-bin-retry"
				>
					{t("recycleBin.error.retry")}
				</Button>
			</div>
		)
	}

	if (shouldShowEmpty) {
		return (
			<div
				className="flex flex-1 flex-col items-center justify-center gap-6 p-6"
				data-testid="recycle-bin-empty"
			>
				<div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-card p-2 shadow-sm">
					<Trash2 className="h-6 w-6 text-foreground" strokeWidth={1.25} />
				</div>
				<div className="flex w-96 flex-col items-center gap-2">
					<p className="text-center text-lg font-medium leading-normal text-foreground">
						{t("recycleBin.empty.title")}
					</p>
					<p className="text-center text-sm font-normal leading-normal text-muted-foreground">
						{t("recycleBin.empty.description")}
					</p>
				</div>
			</div>
		)
	}

	function handleScroll(event: UIEvent<HTMLDivElement>) {
		if (!hasMore || loadingMore) return
		const target = event.currentTarget
		const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight
		if (distanceToBottom <= 80) onLoadMore()
	}

	return (
		<div
			className="flex min-h-0 flex-1 flex-col overflow-y-auto"
			data-testid="recycle-bin-list"
			onScroll={handleScroll}
		>
			{items.map((item, index) => (
				<div key={item.id} data-testid={`recycle-bin-row-${item.id}`}>
					<div className="flex items-center justify-between px-7 py-5">
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<Checkbox
									id={`row-${item.id}`}
									checked={selectedIds.includes(item.id)}
									onCheckedChange={(checked) =>
										onToggleItem({
											id: item.id,
											checked: checked === true,
										})
									}
									data-testid={`recycle-bin-row-select-${item.id}`}
								/>
								<Badge variant="outline" className="rounded-lg px-2 py-0.5">
									{getCategoryLabel(item.category, t, item.fileKind)}
								</Badge>
								<div className="truncate text-sm font-medium leading-normal text-foreground">
									{props.onPreview &&
									item.category === "files" &&
									item.fileKind !== "folder" ? (
										<button
											type="button"
											onClick={() => props.onPreview?.(item)}
										>
											{getDisplayTitle(item, t)}
										</button>
									) : (
										getDisplayTitle(item, t)
									)}
								</div>
							</div>

							<div className="mt-1 flex flex-wrap items-center gap-2 text-xs font-normal leading-normal text-muted-foreground">
								<span>
									{t("recycleBin.item.pathPrefix")}
									{item.path}
								</span>
								<Separator orientation="vertical" className="h-3" />
								<span>
									{t("recycleBin.item.deletedOn", {
										date: item.deletedOn,
									})}
								</span>
								<Separator orientation="vertical" className="h-3" />
								<span>
									{t("recycleBin.item.validDays", {
										days: item.remainingDays,
									})}
								</span>
							</div>
						</div>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<div
									className="flex h-4 w-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-sidebar-accent"
									data-testid={`recycle-bin-row-actions-${item.id}`}
								>
									<MoreHorizontal className="size-4" />
								</div>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								{props.onPreview &&
									item.category === "files" &&
									item.fileKind !== "folder" && (
										<DropdownMenuItem onSelect={() => props.onPreview?.(item)}>
											<Eye size={16} />
											{t("recycleBin.preview.open")}
										</DropdownMenuItem>
									)}
								<DropdownMenuItem
									variant="default"
									onSelect={() => onOpenRestore({ kind: "item", item })}
									data-testid={`recycle-bin-row-restore-${item.id}`}
								>
									<RotateCcw className="size-4" />
									{t("recycleBin.bulkActions.restore")}
								</DropdownMenuItem>
								<DropdownMenuItem
									variant="destructive"
									onSelect={() => onOpenDelete(item)}
									data-testid={`recycle-bin-row-delete-${item.id}`}
								>
									<Trash2 className="size-4" />
									{t("recycleBin.bulkActions.permanentDelete")}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{index < items.length - 1 ? <Separator /> : null}
				</div>
			))}
			{loadingMore ? (
				<div
					className="flex items-center justify-center gap-2 px-7 py-4 text-xs text-muted-foreground"
					data-testid="recycle-bin-more"
				>
					<Spinner className="size-4" />
					<span>{t("common.loading")}</span>
				</div>
			) : null}
			{!hasMore && items.length > 0 ? (
				<>
					<Separator />
					<div
						className="flex items-center justify-center gap-1.5 py-3 text-xs font-normal leading-normal text-muted-foreground"
						data-testid="recycle-bin-end"
					>
						<CheckLine className="size-4 text-muted-foreground" />
						<span>{t("recycleBin.loader.noMoreData")}</span>
					</div>
				</>
			) : null}
		</div>
	)
}
