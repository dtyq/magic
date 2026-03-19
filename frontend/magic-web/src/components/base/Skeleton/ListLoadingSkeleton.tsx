import { ListItemSkeleton } from "./ListItemSkeleton"

interface ListLoadingSkeletonProps {
	count?: number // 显示多少个列表项骨架
	showAvatar?: boolean
	avatarSize?: number
	showSubtitle?: boolean
	showRightElement?: boolean
}

/**
 * 列表加载骨架屏组件
 * 用于 MagicInfiniteList 的 initialLoadingComponent
 * 适用于 contactsMobile/aiAssistant、contactsMobile/myGroups 等列表页面
 */
export function ListLoadingSkeleton({
	count = 5,
	showAvatar = true,
	avatarSize = 30,
	showSubtitle = false,
	showRightElement = false,
}: ListLoadingSkeletonProps) {
	return (
		<div style={{ padding: "0 10px" }}>
			{Array.from({ length: count }).map((_, index) => (
				<div key={index} style={{ marginTop: 10 }}>
					<ListItemSkeleton
						showAvatar={showAvatar}
						avatarSize={avatarSize}
						showSubtitle={showSubtitle}
						showRightElement={showRightElement}
						withBorder
					/>
				</div>
			))}
		</div>
	)
}
