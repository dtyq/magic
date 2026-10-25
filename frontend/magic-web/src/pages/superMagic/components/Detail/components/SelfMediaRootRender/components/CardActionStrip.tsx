import { useTranslation } from "react-i18next"
import type { ComponentType } from "react"
import { Edit, MessageSquarePlus, Newspaper, RefreshCcw } from "lucide-react"
import { cn } from "@/utils/cn"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { CardVersionHistoryButton } from "./CardVersionHistoryButton"
import type { SelfMediaAttachmentNode } from "../types"
import type { BeforeAction } from "../../../utils/actionGuard"

type CardActionStripTooltipSide = "top" | "right" | "bottom" | "left"

interface CardActionStripLabels {
	addToCurrentChat?: string
	addPostFolderToCurrentChat?: string
	goToEdit?: string
	refresh?: string
}

export interface CardActionStripCustomAction {
	key: string
	label: string
	icon: ComponentType<{ className?: string }>
	onClick: () => void
	active?: boolean
	testId?: string
}

export interface CardActionStripProps {
	/** Add the current page/card file to the chat (article slice). */
	onAddToCurrentChat?: () => void
	/** @mention the on-disk post directory (not each card file). */
	onAddPostFolderToCurrentChat?: () => void
	onRefresh?: () => void
	onGoToEdit?: () => void
	/** Whether the user has permission to edit. When false, only refresh is shown. */
	allowEdit?: boolean
	className?: string
	style?: React.CSSProperties
	testIdPrefix?: string
	/** 当传入 fileId 时，展示版本历史按钮 */
	fileId?: string
	/** 附件列表（用于版本历史内容路径处理） */
	attachmentList?: SelfMediaAttachmentNode[]
	/** 打开版本历史前的拦截回调（有未保存内容时弹框询问用户） */
	onBeforeOpenVersionHistory?: BeforeAction
	tooltipSide?: CardActionStripTooltipSide
	testId?: string
	labels?: CardActionStripLabels
	customActions?: CardActionStripCustomAction[]
}

const cardActionStripButtonClass =
	"flex h-9 w-9 items-center justify-center rounded-[14px] text-[#52525b] transition-[background,color,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:bg-[#18181b] hover:text-[#ffd637] hover:shadow-[0_10px_20px_rgba(24,24,27,0.14)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#18181b]/15 active:translate-y-0"

/**
 * Vertical strip of icon buttons for card actions (add to chat, refresh, go to edit).
 * Intended to be placed to the right of a phone shell or card thumbnail.
 */
export function CardActionStrip({
	onAddToCurrentChat,
	onAddPostFolderToCurrentChat,
	onRefresh,
	onGoToEdit,
	allowEdit,
	className,
	style,
	testIdPrefix = "card-action",
	fileId,
	attachmentList,
	onBeforeOpenVersionHistory,
	tooltipSide = "right",
	testId,
	labels,
	customActions,
}: CardActionStripProps) {
	const { t } = useTranslation("super")
	const readOnly = allowEdit === false

	return (
		<div
			className={cn(
				"flex flex-col gap-1.5 rounded-[18px] border border-white/80 bg-white/85 p-1.5 shadow-[inset_0_1px_rgba(255,255,255,0.86),0_16px_38px_rgba(24,24,27,0.12)] backdrop-blur-xl",
				className,
			)}
			style={style}
			data-testid={testId}
		>
			{customActions?.map((action) => {
				const Icon = action.icon
				return (
					<Tooltip key={action.key}>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={action.onClick}
								aria-pressed={action.active}
								aria-label={action.label}
								data-testid={action.testId ?? `${testIdPrefix}-${action.key}`}
								className={cn(
									cardActionStripButtonClass,
									action.active &&
										"bg-[#18181b] text-[#ffd637] shadow-[0_10px_20px_rgba(24,24,27,0.14)]",
								)}
							>
								<Icon className="h-[18px] w-[18px]" />
							</button>
						</TooltipTrigger>
						<TooltipContent side={tooltipSide}>{action.label}</TooltipContent>
					</Tooltip>
				)
			})}
			{customActions?.length ? <div className="mx-2 h-px bg-[#18181b]/10" /> : null}
			{!readOnly && onAddToCurrentChat && (
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={onAddToCurrentChat}
							data-testid={`${testIdPrefix}-add-current`}
							className={cardActionStripButtonClass}
						>
							<MessageSquarePlus className="h-[18px] w-[18px]" />
						</button>
					</TooltipTrigger>
					<TooltipContent side={tooltipSide}>
						{labels?.addToCurrentChat ??
							t("detail.selfMedia.edit.addCurrentPageToChat")}
					</TooltipContent>
				</Tooltip>
			)}
			{!readOnly && onAddPostFolderToCurrentChat && (
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={onAddPostFolderToCurrentChat}
							data-testid={`${testIdPrefix}-add-post-folder`}
							className={cardActionStripButtonClass}
						>
							<Newspaper className="h-[18px] w-[18px]" />
						</button>
					</TooltipTrigger>
					<TooltipContent side={tooltipSide}>
						{labels?.addPostFolderToCurrentChat ??
							t("detail.selfMedia.edit.addPostFolderToCurrentChat")}
					</TooltipContent>
				</Tooltip>
			)}
			{!readOnly && onGoToEdit && (
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={onGoToEdit}
							data-testid={`${testIdPrefix}-go-to-edit`}
							className={cardActionStripButtonClass}
						>
							<Edit className="h-[18px] w-[18px]" />
						</button>
					</TooltipTrigger>
					<TooltipContent side={tooltipSide}>
						{labels?.goToEdit ?? t("detail.selfMedia.edit.goToEdit")}
					</TooltipContent>
				</Tooltip>
			)}
			{onRefresh && (
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={onRefresh}
							data-testid={`${testIdPrefix}-refresh`}
							className={cardActionStripButtonClass}
						>
							<RefreshCcw className="h-[18px] w-[18px]" />
						</button>
					</TooltipTrigger>
					<TooltipContent side={tooltipSide}>
						{labels?.refresh ?? t("detail.selfMedia.edit.refreshCard")}
					</TooltipContent>
				</Tooltip>
			)}
			{!readOnly && fileId && (
				<CardVersionHistoryButton
					fileId={fileId}
					attachmentList={attachmentList}
					className={cardActionStripButtonClass}
					testIdPrefix={`${testIdPrefix}-version-history`}
					onBeforeOpen={onBeforeOpenVersionHistory}
				/>
			)}
		</div>
	)
}
