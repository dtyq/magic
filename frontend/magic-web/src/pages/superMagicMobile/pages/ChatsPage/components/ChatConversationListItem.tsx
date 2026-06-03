import { ChevronRight, Ellipsis, Pin, PinOff, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { SwipeActionRow, type SwipeAction } from "@/components/base-mobile/SwipeActionRow"
import { MobilePinBadge } from "@/pages/superMagicMobile/components/icons/MobilePinBadge"
import { MobileResourceTypeIcon } from "@/pages/superMagicMobile/components/icons/mobile-resource-type-icon"
import type { ChatConversationListItem as ChatConversationListItemData } from "../hooks/useChatConversationList"
import { MOBILE_CHAT_PIN_ENABLED } from "@/pages/superMagicMobile/utils/mobileProjectActionOrder"

interface ChatConversationListItemProps {
	item: ChatConversationListItemData
	/** 行是否处于左滑展开状态，由父层维护以保证同时只展开一行 */
	isOpen: boolean
	onOpen: () => void
	onClose: () => void
	onClick: (item: ChatConversationListItemData) => void
	onMore: (item: ChatConversationListItemData) => void
	/** When omitted, swipe pin and pinned badge are hidden. */
	onPin?: (item: ChatConversationListItemData) => void
	onDelete: (item: ChatConversationListItemData) => void
}

/**
 * 对话列表项：展示标题、时间和入口箭头，支持左滑显示操作按钮。
 * 触摸手势完全由 SwipeActionRow 处理，本组件只需组装 actions 并转发回调。
 */
export function ChatConversationListItem({
	item,
	isOpen,
	onOpen,
	onClose,
	onClick,
	onMore,
	onPin,
	onDelete,
}: ChatConversationListItemProps) {
	const { t } = useTranslation(["super", "interface"])
	const runningAriaLabel = t("accountPanel.timedTasks.running", { ns: "interface" })

	const actions: SwipeAction[] = [
		{
			id: "more",
			label: t("chatList.swipeMore"),
			icon: <Ellipsis className="size-4 text-secondary-foreground" />,
			className: "bg-secondary",
			labelClassName: "text-secondary-foreground",
			onClick: () => onMore(item),
		},
		...(MOBILE_CHAT_PIN_ENABLED && onPin
			? [
					{
						id: "pin",
						label: item.isPinned ? t("chatList.swipeUnpin") : t("chatList.swipePin"),
						icon: item.isPinned ? (
							<PinOff className="size-4 text-primary-foreground" />
						) : (
							<Pin className="size-4 text-primary-foreground" />
						),
						className: "bg-primary",
						labelClassName: "text-primary-foreground",
						onClick: () => onPin(item),
					},
				]
			: []),
		{
			id: "delete",
			label: t("chatList.swipeDelete"),
			icon: <Trash2 className="size-4 text-white" />,
			className: "bg-destructive",
			labelClassName: "text-white",
			onClick: () => onDelete(item),
		},
	]

	return (
		<SwipeActionRow
			actions={actions}
			isOpen={isOpen}
			onOpen={onOpen}
			onClose={onClose}
			onRowClick={() => onClick(item)}
			data-testid={`mobile-chats-page-item-${item.id}`}
		>
			{/* 行内容：与 SwipeActionRow children 配合，整体作为可左移的内容层 */}
			<div className="flex h-16 w-full items-center gap-2 rounded-[14px] px-3 py-[10px]">
				<MobileResourceTypeIcon
					type="conversation"
					isRunning={item.isRunning}
					loaderSizeClass="size-6"
					data-testid="mobile-chats-page-item-status-icon"
					loadingDataTestId="mobile-chats-page-item-loading"
					iconDataTestId="mobile-chats-page-item-default-icon"
					aria-label={item.isRunning ? runningAriaLabel : undefined}
					aria-busy={item.isRunning}
				/>

				<div className="min-w-0 flex-1">
					<div className="flex h-6 items-center gap-1">
						<p className="min-w-0 truncate text-[16px] font-medium leading-6 text-foreground">
							{item.title}
						</p>
						{MOBILE_CHAT_PIN_ENABLED && item.isPinned ? (
							<MobilePinBadge data-testid="mobile-chats-page-item-pinned-badge" />
						) : null}
					</div>
					<p className="truncate text-[12px] font-light leading-4 text-muted-foreground">
						{item.timeLabel}
					</p>
				</div>

				<ChevronRight className="size-4 shrink-0 text-foreground" strokeWidth={2.25} />
			</div>
		</SwipeActionRow>
	)
}
