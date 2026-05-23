import { Download, FolderSymlink, Share2, Trash2 } from "lucide-react"
import { memo } from "react"
import { useTranslation } from "react-i18next"
import MobileFileSelectionCheckbox from "./MobileFileSelectionCheckbox"
import type { AttachmentNodeSelectionState } from "../utils/mobileAttachmentTreeSelection"

const SELECTION_BAR_SHADOW = "0px 8px 25px 0px rgba(0,0,0,0.10)" as const

interface MobileFilesSelectionBarProps {
	isAllSelected: boolean
	isPartiallySelected?: boolean
	onToggleAll: () => void
	onDownload?: () => void
	onShare?: () => void
	onMove?: () => void
	onDelete?: () => void
}

/**
 * 原型里的多选操作按钮组：视觉与统一底部搜索栏完全对齐，只替换内部内容。
 */
function ActionIconButton(props: {
	icon: typeof Download
	label: string
	onClick?: () => void
	isDestructive?: boolean
}) {
	const { icon: Icon, label, onClick, isDestructive = false } = props
	const isDisabled = !onClick

	return (
		<button
			type="button"
			onClick={onClick}
			disabled={isDisabled}
			className={`flex h-full flex-1 items-center justify-center active:opacity-50 ${
				isDestructive ? "text-destructive" : "text-foreground"
			} disabled:cursor-not-allowed disabled:opacity-35`}
			aria-label={label}
		>
			<Icon className="size-[20px]" strokeWidth={1.8} />
		</button>
	)
}

/** Map toolbar select-all flags to the shared tri-state checkbox model. */
function getSelectAllState(
	isAllSelected: boolean,
	isPartiallySelected: boolean,
): AttachmentNodeSelectionState {
	if (isAllSelected) return "all"
	if (isPartiallySelected) return "partial"
	return "none"
}

function MobileFilesSelectionBar({
	isAllSelected,
	isPartiallySelected = false,
	onToggleAll,
	onDownload,
	onShare,
	onMove,
	onDelete,
}: MobileFilesSelectionBarProps) {
	const { t } = useTranslation("super")
	const selectAllState = getSelectAllState(isAllSelected, isPartiallySelected)

	return (
		<div
			className="shrink-0 px-[10px] pb-3 pt-2"
			data-testid="mobile-topic-files-selection-bar"
		>
			<div className="flex h-[44px] items-center gap-2">
				<div
					className="flex h-full shrink-0 items-center gap-2 rounded-full bg-card pl-1 pr-4 active:opacity-70"
					style={{ boxShadow: SELECTION_BAR_SHADOW }}
					data-testid="mobile-topic-files-select-all"
				>
					<MobileFileSelectionCheckbox
						state={selectAllState}
						onClick={onToggleAll}
						aria-label={t("topicFiles.selectAll")}
					/>
					<button
						type="button"
						onClick={onToggleAll}
						className="text-[15px] font-medium text-foreground active:opacity-70"
					>
						{t("topicFiles.selectAll")}
					</button>
				</div>

				<div
					className="flex h-full flex-1 items-center overflow-hidden rounded-full bg-card"
					style={{ boxShadow: SELECTION_BAR_SHADOW }}
				>
					<ActionIconButton
						icon={Download}
						label={t("topicFiles.contextMenu.download")}
						onClick={onDownload}
					/>
					<div className="h-5 w-px shrink-0 bg-border" />
					<ActionIconButton
						icon={Share2}
						label={t("topicFiles.contextMenu.shareFile")}
						onClick={onShare}
					/>
					<div className="h-5 w-px shrink-0 bg-border" />
					<ActionIconButton
						icon={FolderSymlink}
						label={t("topicFiles.contextMenu.move")}
						onClick={onMove}
					/>
					<div className="h-5 w-px shrink-0 bg-border" />
					<ActionIconButton
						icon={Trash2}
						label={t("topicFiles.contextMenu.delete")}
						onClick={onDelete}
						isDestructive
					/>
				</div>
			</div>
		</div>
	)
}

export default memo(MobileFilesSelectionBar)
