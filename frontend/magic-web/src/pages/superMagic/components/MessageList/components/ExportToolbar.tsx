import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import { IconDownload, IconX } from "@tabler/icons-react"
import type { ExportSelectionStore } from "../hooks/useExportSelection"
import { MAX_EXPORT_COUNT } from "../hooks/useExportSelection"

export interface ExportToolbarProps {
	store: ExportSelectionStore
	selectableKeys: string[]
	onNext: () => void
	className?: string
}

function ExportToolbarInner({ store, selectableKeys, onNext, className }: ExportToolbarProps) {
	const { t } = useTranslation("super")
	const total = selectableKeys.length
	const count = store.count
	const allSelected = count > 0 && selectableKeys.every((k) => store.isSelected(k))

	const handleSelectAll = () => {
		if (allSelected) store.clear()
		else store.selectAll(selectableKeys)
	}

	return (
		<div
			className={cn(
				"sticky top-0 z-30 mx-auto flex w-full max-w-3xl items-center justify-between gap-3 rounded-2xl border border-border/70 bg-background/90 px-3 py-2 shadow-[0_14px_44px_rgba(15,23,42,0.10)] backdrop-blur-xl",
				className,
			)}
		>
			<div className="flex min-w-0 items-center gap-3 text-sm">
				<Button
					variant="ghost"
					size="icon"
					className="size-8 shrink-0 rounded-full hover:bg-muted"
					onClick={() => store.exit()}
					aria-label={t("export.cancel", { defaultValue: "取消" })}
				>
					<IconX size={16} />
				</Button>
				<div className="flex min-w-0 flex-col">
					<div className="flex items-center gap-2">
						<span className="font-medium">
							{t("export.selectedCount", {
								defaultValue: "已选 {{count}} / {{max}}",
								count,
								max: MAX_EXPORT_COUNT,
							})}
						</span>
						<span
							className={cn(
								"rounded-full px-2 py-0.5 text-xs transition-colors",
								count > 0
									? "bg-primary/10 text-primary"
									: "bg-muted text-muted-foreground",
							)}
						>
							{count}/{total}
						</span>
					</div>
					<span className="truncate text-xs text-muted-foreground">
						{t("export.totalSelectable", {
							defaultValue: "点击对话轮次选择导出内容，共 {{total}} 轮",
							total,
						})}
					</span>
				</div>
			</div>
			<div className="flex shrink-0 items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					className="rounded-full"
					onClick={handleSelectAll}
					disabled={total === 0}
				>
					{allSelected
						? t("export.clearAll", { defaultValue: "取消全选" })
						: t("export.selectAll", { defaultValue: "全选" })}
				</Button>
				<Button
					size="sm"
					className="rounded-full shadow-sm"
					onClick={onNext}
					disabled={count === 0}
				>
					<IconDownload size={15} />
					{t("export.next", { defaultValue: "下一步" })}
				</Button>
			</div>
		</div>
	)
}

export const ExportToolbar = observer(ExportToolbarInner)
