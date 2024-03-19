import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Spin, Tooltip } from "antd"
import {
	IconHourglassEmpty,
	IconArrowUpDashed,
	IconChevronUp,
	IconChevronDown,
	IconEdit,
} from "@tabler/icons-react"
import { cn } from "@/opensource/lib/utils"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { QueuedMessage } from "../../hooks/useMessageQueue"
import CollapsibleText from "./components/CollapsibleText"
import { LucideLazyIcon } from "@/opensource/utils/lucideIconLoader"

export interface MessageQueueProps {
	queue: QueuedMessage[]
	queueStats: {
		total: number
		pending: number
		processing: number
		failed: number
	}
	editingQueueItem: QueuedMessage | null
	onRemoveMessage: (messageId: string) => void
	onSendMessage: (messageId: string) => void
	onStartEdit: (messageId: string) => void
	onCancelEdit: () => void
	className?: string
}

const actionButtonBase = cn(
	"inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-sm text-foreground/80 transition-colors",
	"hover:bg-fill hover:text-foreground",
	"active:scale-95",
	"focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
	"disabled:pointer-events-none disabled:opacity-50",
)

function MessageQueue({
	queue,
	queueStats,
	editingQueueItem,
	onRemoveMessage,
	onSendMessage,
	onStartEdit,
	onCancelEdit,
	className,
}: MessageQueueProps) {
	const { t } = useTranslation("super")
	const [isExpanded, setIsExpanded] = useState(true)

	if (queue.length === 0) {
		return null
	}

	const handleToggleExpanded = () => {
		setIsExpanded(!isExpanded)
	}

	return (
		<div className={cn("self-stretch overflow-hidden rounded-xl bg-card/80", className)}>
			{/* Queue header */}
			<div className="flex items-center justify-between gap-2.5 p-2.5">
				<div className="flex flex-1 items-center gap-2.5">
					<div className="text-sm font-semibold leading-5 text-foreground/80">
						{t("messageQueue.title")}
					</div>
				</div>
				<div className="flex items-center gap-2.5">
					<div className="text-[10px] font-normal leading-[1.3] text-muted-foreground">
						{t("messageQueue.taskCount", { count: queueStats.total })}
					</div>
					<button
						type="button"
						className="flex size-[18px] cursor-pointer items-center justify-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
						onClick={handleToggleExpanded}
						aria-expanded={isExpanded}
					>
						{isExpanded ? <IconChevronUp size={18} /> : <IconChevronDown size={18} />}
					</button>
				</div>
			</div>

			{/* Queue content */}
			{isExpanded && (
				<div className="scrollbar-y-thin flex max-h-[200px] flex-col gap-2.5 overflow-y-auto overflow-x-hidden px-2.5 pb-2.5">
					{queue.map((message) => {
						const isEditing = editingQueueItem?.id === message.id
						const isDisabled =
							message.isDeletingLoading ||
							message.isSendingLoading ||
							message.isEditingLoading

						return (
							<div
								key={message.id}
								className={cn(
									"flex items-start justify-between gap-3 rounded-[4px] [&_p]:m-0",
									isEditing &&
										"relative items-center pl-2 before:absolute before:bottom-0 before:left-0 before:top-0 before:w-[3px] before:rounded-[1.5px] before:bg-orange-500 before:content-[''] dark:before:bg-orange-400",
								)}
							>
								<div
									className={cn(
										"flex min-w-0 flex-1 items-start gap-1",
										isEditing && "items-center",
									)}
								>
									{isEditing && (
										<div className="flex shrink-0 self-start rounded-[4px] bg-orange-50 px-1 py-0.5 text-[10px] font-medium leading-[13px] text-orange-500 dark:bg-orange-500/20 dark:text-orange-400">
											{t("messageQueue.editing")}
										</div>
									)}
									<div className="flex min-w-0 flex-1 items-start gap-1">
										<div className="flex size-4 shrink-0 items-start justify-center text-foreground/35">
											<IconHourglassEmpty size={16} />
										</div>
										<div
											className={cn(
												"min-w-0 flex-1 break-words text-xs font-normal leading-4 text-foreground/80",
												"[&>div]:leading-[1.4] [&_p]:!text-xs [&_p]:!leading-4 [&_p]:!text-foreground/80",
												"[&_.magic-mention]:!text-[10px]",
											)}
										>
											<CollapsibleText
												content={message.content}
												maxLines={2}
											/>
										</div>
									</div>
								</div>
								<div className="flex shrink-0 items-start gap-1">
									{isEditing ? (
										<Button
											variant="secondary"
											size="sm"
											className="h-auto shrink-0 px-1 py-0.5 text-[10px] font-normal"
											onClick={onCancelEdit}
										>
											{t("messageQueue.exitEdit")}
										</Button>
									) : (
										<>
											<Tooltip title={t("messageQueue.removeFromQueue")}>
												<div
													className={cn(
														actionButtonBase,
														message.isDeletingLoading &&
															"cursor-not-allowed opacity-60",
													)}
													onClick={() => {
														if (!message.isDeletingLoading)
															onRemoveMessage(message.id)
													}}
												>
													{message.isDeletingLoading ? (
														<Spin size="small" />
													) : (
														<LucideLazyIcon icon="Trash2" size={14} />
													)}
												</div>
											</Tooltip>
											<Tooltip title={t("messageQueue.editMessage")}>
												<div
													className={cn(
														actionButtonBase,
														isDisabled &&
															"cursor-not-allowed opacity-40",
													)}
													onClick={() => {
														if (!isDisabled) onStartEdit(message.id)
													}}
												>
													<IconEdit size={14} />
												</div>
											</Tooltip>
											<Tooltip title={t("messageQueue.submitNow")}>
												<div
													className={cn(
														actionButtonBase,
														message.isSendingLoading &&
															"cursor-not-allowed opacity-60",
													)}
													onClick={() => {
														if (!message.isSendingLoading)
															onSendMessage(message.id)
													}}
												>
													{message.isSendingLoading ? (
														<IconArrowUpDashed size={14} />
													) : (
														<LucideLazyIcon
															icon="CircleArrowUp"
															size={14}
														/>
													)}
												</div>
											</Tooltip>
										</>
									)}
								</div>
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}

export default MessageQueue
