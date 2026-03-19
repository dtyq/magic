import { ListItemSkeleton } from "@/components/base/Skeleton"

interface ChatListSkeletonProps {
	/**
	 * 置顶消息数量
	 * @default 2
	 */
	pinnedCount?: number
	/**
	 * 聊天列表数量
	 * @default 8
	 */
	listCount?: number
	/**
	 * 头像大小
	 * @default 40
	 */
	avatarSize?: number
}

/**
 * Chat 列表骨架屏组件
 * 包含置顶消息区域和聊天列表区域
 */
export function ChatListSkeleton({
	pinnedCount = 2,
	listCount = 8,
	avatarSize = 40,
}: ChatListSkeletonProps) {
	return (
		<>
			{/* Pinned messages area */}
			<div style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #f0f0f0" }}>
				{Array.from({ length: pinnedCount }).map((_, index) => (
					<ListItemSkeleton
						key={index}
						showAvatar
						avatarSize={avatarSize}
						showSubtitle
						showRightElement
						withBorder={false}
					/>
				))}
			</div>

			{/* Chat list */}
			<div style={{ flex: 1, overflowY: "auto", backgroundColor: "#f5f5f5" }}>
				{Array.from({ length: listCount }).map((_, index) => (
					<ListItemSkeleton
						key={index}
						showAvatar
						avatarSize={avatarSize}
						showSubtitle
						showRightElement
						withBorder={false}
					/>
				))}
			</div>
		</>
	)
}
