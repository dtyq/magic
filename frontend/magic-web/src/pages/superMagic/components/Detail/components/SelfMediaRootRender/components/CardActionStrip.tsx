import { useTranslation } from "react-i18next"
import { Edit, MessageSquarePlus, Newspaper, RefreshCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { CardVersionHistoryButton } from "./CardVersionHistoryButton"
import type { SelfMediaAttachmentNode } from "../types"

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
	onBeforeOpenVersionHistory?: () => Promise<boolean>
}

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
}: CardActionStripProps) {
	const { t } = useTranslation("super")
	const readOnly = allowEdit === false

	return (
		<div className={cn("flex flex-col gap-1", className)} style={style}>
			{!readOnly && onAddToCurrentChat && (
				<Tooltip>
					<TooltipTrigger asChild>
						<button
							type="button"
							onClick={onAddToCurrentChat}
							data-testid={`${testIdPrefix}-add-current`}
							className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground"
						>
							<MessageSquarePlus className="h-4 w-4" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="right">
						{t("detail.selfMedia.edit.addCurrentPageToChat")}
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
							className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground"
						>
							<Newspaper className="h-4 w-4" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="right">
						{t("detail.selfMedia.edit.addPostFolderToCurrentChat")}
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
							className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground"
						>
							<Edit className="h-4 w-4" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="right">
						{t("detail.selfMedia.edit.goToEdit")}
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
							className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground"
						>
							<RefreshCcw className="h-4 w-4" />
						</button>
					</TooltipTrigger>
					<TooltipContent side="right">
						{t("detail.selfMedia.edit.refreshCard")}
					</TooltipContent>
				</Tooltip>
			)}
			{!readOnly && fileId && (
				<CardVersionHistoryButton
					fileId={fileId}
					attachmentList={attachmentList}
					testIdPrefix={`${testIdPrefix}-version-history`}
					onBeforeOpen={onBeforeOpenVersionHistory}
				/>
			)}
		</div>
	)
}
