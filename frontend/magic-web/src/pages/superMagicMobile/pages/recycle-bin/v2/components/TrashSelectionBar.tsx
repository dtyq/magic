import { memo } from "react"
import { useTranslation } from "react-i18next"
import { Check, Trash2, RotateCcw, type LucideIcon } from "lucide-react"

const SELECTION_BAR_SHADOW = "0px 8px 25px 0px rgba(0,0,0,0.10)" as const

interface TrashSelectionBarProps {
	/** 当前 Tab + 搜索过滤后的条数（预留与文案扩展一致） */
	visibleTotal: number
	isAllSelected: boolean
	onToggleAll: () => void
	onRestore: () => void
	onPurge: () => void
}

/** 对齐原型 `TrashSelectionBar` 内 `ActionIconBtn` */
function ActionIconBtn(props: {
	icon: LucideIcon
	label: string
	onClick: () => void
	isDestructive?: boolean
	"data-testid"?: string
}) {
	const { icon: Icon, label, onClick, isDestructive = false, "data-testid": dataTestId } = props
	return (
		<button
			type="button"
			onClick={onClick}
			data-testid={dataTestId}
			className={`flex h-full flex-1 items-center justify-center active:opacity-50 ${
				isDestructive ? "text-destructive" : "text-foreground"
			}`}
			aria-label={label}
		>
			<Icon className="size-[20px]" strokeWidth={1.8} />
		</button>
	)
}

/**
 * 回收站多选底栏：全选 + 还原 + 彻底删除。
 * 布局严格对齐原型 `prototype/components/common/TrashSelectionBar.tsx`（与 BottomSearchBar 外留白一致）。
 */
function TrashSelectionBar(props: TrashSelectionBarProps) {
	const { visibleTotal, isAllSelected, onToggleAll, onRestore, onPurge } = props
	void visibleTotal
	const { t } = useTranslation("super")

	return (
		<div
			className="shrink-0 px-[10px] pb-3 pt-2"
			data-testid="mobile-recycle-bin-trash-selection-bar"
		>
			<div className="flex h-[44px] items-center gap-2">
				<button
					type="button"
					onClick={onToggleAll}
					className="flex h-full shrink-0 items-center gap-2 rounded-full bg-card px-4 active:opacity-70"
					style={{ boxShadow: SELECTION_BAR_SHADOW }}
					data-testid="mobile-recycle-bin-select-all-toggle"
				>
					<div
						className={`flex size-[22px] items-center justify-center rounded-full transition-colors ${
							isAllSelected ? "bg-primary" : "border-2 border-muted-foreground/35"
						}`}
					>
						{isAllSelected && (
							<Check className="size-3.5 text-primary-foreground" strokeWidth={2.5} />
						)}
					</div>
					<span className="text-[15px] font-medium text-foreground">
						{t("mobile.recycleBin.selection.selectAll")}
					</span>
				</button>

				<div
					className="flex h-full flex-1 items-center overflow-hidden rounded-full bg-card"
					style={{ boxShadow: SELECTION_BAR_SHADOW }}
				>
					<ActionIconBtn
						icon={RotateCcw}
						label={t("mobile.recycleBin.selection.restore")}
						onClick={onRestore}
						data-testid="mobile-recycle-bin-bulk-restore"
					/>
					<div className="h-5 w-px shrink-0 bg-border" />
					<ActionIconBtn
						icon={Trash2}
						label={t("mobile.recycleBin.selection.purge")}
						onClick={onPurge}
						isDestructive
						data-testid="mobile-recycle-bin-bulk-purge"
					/>
				</div>
			</div>
		</div>
	)
}

export default memo(TrashSelectionBar)
