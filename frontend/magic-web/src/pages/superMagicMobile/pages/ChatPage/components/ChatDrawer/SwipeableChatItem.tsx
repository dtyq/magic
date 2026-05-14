import { MessageCircle, Ellipsis, Pin, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { SwipeableChatItemProps } from "./types"
import { useTranslation } from "react-i18next"
import { useSwipeActions } from "./hooks/useSwipeActions"
import { SwipeActionButtons } from "./SwipeActionButtons"
import type { SwipeActionButtonConfig } from "./SwipeActionButtons"
import { useMemoizedFn } from "ahooks"
import PinnedTag from "@/pages/superMagic/components/EmptyWorkspacePanel/components/ProjectItem/components/PinnedTag"

export default function SwipeableChatItem({
	item,
	isSwiped = false,
	onSwipeChange,
	onSwipeStart,
	onClick,
	onMore,
	onPin,
	onDelete,
}: SwipeableChatItemProps) {
	const { t } = useTranslation("super")

	const { offsetX, isDragging, touchHandlers, close } = useSwipeActions({
		syncOpen: isSwiped,
		onSwipeChange,
		onDragStart: () => onSwipeStart(item.id),
	})

	const handleOpenChat = useMemoizedFn(() => {
		if (offsetX < 0) {
			close()
			onSwipeChange?.(false)
			return
		}

		onClick(item.id)
	})

	const handleMore = useMemoizedFn((e: React.MouseEvent) => {
		e.stopPropagation()
		onSwipeChange?.(false)
		onMore(item.id)
	})

	const handlePin = useMemoizedFn((e: React.MouseEvent) => {
		e.stopPropagation()
		onSwipeChange?.(false)
		onPin(item.id)
	})

	const handleDelete = useMemoizedFn((e: React.MouseEvent) => {
		e.stopPropagation()
		onSwipeChange?.(false)
		onDelete(item.id)
	})

	const actionButtons: [
		SwipeActionButtonConfig,
		SwipeActionButtonConfig,
		SwipeActionButtonConfig,
	] = [
		{
			label: t("common.moreActions"),
			icon: <Ellipsis size={16} className="text-white" />,
			bgClassName: "bg-[#9ca3af]",
			labelClassName: "text-white",
			onClick: handleMore,
		},
		{
			label: item.isPinned
				? t("hierarchicalWorkspacePopup.unpinProject")
				: t("hierarchicalWorkspacePopup.pinProject"),
			icon: <Pin size={16} className="text-primary-foreground" />,
			bgClassName: "bg-primary",
			labelClassName: "text-primary-foreground",
			onClick: handlePin,
		},
		{
			label: t("common.delete"),
			icon: <Trash2 size={16} className="text-destructive-foreground" />,
			bgClassName: "bg-destructive",
			labelClassName: "text-destructive-foreground",
			onClick: handleDelete,
		},
	]

	const snapTransition = isDragging ? "none" : "transform 0.32s cubic-bezier(0.34, 1.2, 0.64, 1)"

	return (
		<div
			className="relative flex w-full shrink-0 items-center overflow-hidden"
			data-testid="chat-drawer-chat-item-row"
		>
			<SwipeActionButtons offsetX={offsetX} isDragging={isDragging} buttons={actionButtons} />

			{/* 主内容层 */}
			<div
				className={cn(
					"relative z-10 flex w-full items-center gap-2 bg-background px-3 py-2.5",
				)}
				style={{
					transform: `translateX(${offsetX}px)`,
					transition: snapTransition,
					willChange: "transform",
				}}
				onTouchStart={touchHandlers.onTouchStart}
				onTouchMove={touchHandlers.onTouchMove}
				onTouchEnd={touchHandlers.onTouchEnd}
				onClick={handleOpenChat}
				data-testid="chat-drawer-chat-item-trigger"
			>
				{/* 图标容器 */}
				<div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-foreground">
					<MessageCircle size={24} className="text-white" />
				</div>

				{/* 信息容器 */}
				<div className="flex min-w-0 flex-1 flex-col">
					<div className="flex h-6 items-center gap-1">
						{item.isPinned && <PinnedTag className="shrink-0" showText={false} />}
						<div className="min-w-0 flex-1 truncate text-sm font-medium leading-5 text-foreground">
							{item.title}
						</div>
					</div>
					<div className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-light leading-4 text-muted-foreground">
						{item.subtitle}
					</div>
				</div>
			</div>

			{/* 左侧渐变遮罩（仅在滑动时显示） */}
			{offsetX < 0 && (
				<div className="pointer-events-none absolute bottom-0 left-0 top-0 z-20 w-12 bg-gradient-to-r from-background from-50% to-transparent" />
			)}
		</div>
	)
}
