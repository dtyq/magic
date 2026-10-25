import { memo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Eye, Info, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react"
import MagicFileIcon from "@/components/base/MagicFileIcon"
import MagicTooltip from "@/components/base/MagicTooltip"
import SmartTooltip from "@/components/other/SmartTooltip"
import { Button } from "@/components/shadcn-ui/button"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { cn } from "@/utils/cn"
import type { RecycleBinItem, RestoreTarget } from "./recycle-bin-domain"
import { getRecycleBinRelativePath, parseRecycleBinTime } from "./recycle-bin-file-view"

interface Props {
	onPreview?: (item: RecycleBinItem) => void
	item: RecycleBinItem
	grid: boolean
	byLocation: boolean
	selected: boolean
	disabled: boolean
	onToggle: (payload: { id: string; checked: boolean }) => void
	onRestore: (target: RestoreTarget) => void
	onDelete: (item: RecycleBinItem) => void
	onDetail: (item: RecycleBinItem) => void
}

export const RecycleBinFileItem = memo(function RecycleBinFileItem({
	item,
	grid,
	byLocation,
	selected,
	disabled,
	onToggle,
	onRestore,
	onDelete,
	onDetail,
	onPreview,
}: Props) {
	const { t } = useTranslation("super")
	const [menuOpen, setMenuOpen] = useState(false)
	const folder = item.fileKind === "folder"
	const fileType = folder ? "folder" : item.title.split(".").slice(1).pop()
	const parentPath =
		getRecycleBinRelativePath(item.originalPath) ?? t("recycleBin.project.unknownLocation")
	const checkbox = (
		<Checkbox
			checked={selected}
			disabled={disabled}
			aria-label={t("recycleBin.project.selectItem", { name: item.title })}
			onCheckedChange={(checked) => onToggle({ id: item.id, checked: checked === true })}
		/>
	)
	const remaining = (
		<span
			className={cn(
				"text-xs text-muted-foreground",
				item.remainingDays <= 3 && "text-amber-700 dark:text-amber-400",
			)}
		>
			{t("recycleBin.project.remaining", { days: item.remainingDays })}
		</span>
	)
	const menu = (
		<DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
			<MagicTooltip title={t("recycleBin.item.more")} disabled={menuOpen}>
				<DropdownMenuTrigger asChild>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						className="size-7"
						aria-label={t("recycleBin.item.more")}
						disabled={disabled}
					>
						<MoreHorizontal size={16} />
					</Button>
				</DropdownMenuTrigger>
			</MagicTooltip>
			<DropdownMenuContent align="end">
				{!folder && onPreview && (
					<DropdownMenuItem onSelect={() => onPreview(item)}>
						<Eye size={16} />
						{t("recycleBin.preview.open")}
					</DropdownMenuItem>
				)}
				<DropdownMenuItem onSelect={() => onDetail(item)}>
					<Info size={16} />
					{t("recycleBin.project.details")}
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => onRestore({ kind: "item", item })}>
					<RotateCcw size={16} />
					{t("recycleBin.bulkActions.restore")}
				</DropdownMenuItem>
				<DropdownMenuItem variant="destructive" onSelect={() => onDelete(item)}>
					<Trash2 size={16} />
					{t("recycleBin.bulkActions.permanentDelete")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	)
	const title = (
		<SmartTooltip
			elementType="span"
			fileName
			className="min-w-0 text-sm font-medium"
			placement="top"
		>
			{item.title}
		</SmartTooltip>
	)
	const select = () => onToggle({ id: item.id, checked: !selected })
	const time = item.deletedOn ? parseRecycleBinTime(item.deletedOn) : null
	const timeText = time?.isValid()
		? time.format(byLocation ? "MM-DD HH:mm:ss" : "HH:mm:ss")
		: t("recycleBin.project.unknownTime")
	if (grid)
		return (
			<div
				className={cn(
					"flex min-w-0 flex-col gap-2 rounded-lg border border-border bg-card p-3",
					selected && "border-primary/40 bg-accent",
				)}
			>
				<div className="flex items-center justify-between gap-2">
					{checkbox}
					<span className="text-xs text-muted-foreground">{timeText}</span>
					{menu}
				</div>
				{/* 一期只使用随应用打包的类型图标，不请求已删除文件的内容或缩略图。 */}
				<button
					type="button"
					className="flex h-16 items-center justify-center rounded-md bg-muted/40"
					aria-label={t("recycleBin.project.selectItem", { name: item.title })}
					aria-pressed={selected}
					disabled={disabled}
					onClick={select}
				>
					<MagicFileIcon type={fileType} size={36} />
				</button>
				<button
					type="button"
					className="flex min-w-0 text-left"
					disabled={disabled}
					onClick={!folder && onPreview ? () => onPreview(item) : select}
				>
					{title}
				</button>
				<SmartTooltip
					elementType="span"
					className="min-w-0 text-xs text-muted-foreground"
					placement="top"
				>
					{parentPath}
				</SmartTooltip>
				<div className="flex items-center justify-between gap-2">
					{remaining}
					{folder && (
						<span className="text-xs text-muted-foreground">
							{t("recycleBin.project.folderOnlyShort")}
						</span>
					)}
				</div>
			</div>
		)
	return (
		<div
			className={cn(
				"grid grid-cols-[16px_minmax(0,1fr)_28px] items-center gap-3 border-t border-border px-4 py-3 sm:grid-cols-[16px_minmax(0,1fr)_90px_76px_28px]",
				selected && "bg-accent",
			)}
		>
			{checkbox}
			<div className="min-w-0">
				<button
					type="button"
					className="flex w-full min-w-0 items-center gap-2 text-left"
					disabled={disabled}
					onClick={!folder && onPreview ? () => onPreview(item) : select}
				>
					<MagicFileIcon type={fileType} size={20} className="shrink-0" />
					{title}
				</button>
				<SmartTooltip
					elementType="span"
					className="mt-1 block min-w-0 text-xs text-muted-foreground"
					placement="top"
				>
					{byLocation
						? folder
							? t("recycleBin.project.folderOnlyShort")
							: t("recycleBin.item.type.file")
						: parentPath}
				</SmartTooltip>
			</div>
			<span className="hidden text-xs text-muted-foreground sm:block">{timeText}</span>
			<div className="hidden sm:block">{remaining}</div>
			{menu}
		</div>
	)
})
