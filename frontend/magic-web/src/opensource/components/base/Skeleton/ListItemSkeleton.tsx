import { Skeleton } from "./Skeleton"

interface ListItemSkeletonProps {
	showAvatar?: boolean
	avatarSize?: number
	showSubtitle?: boolean
	showRightElement?: boolean
	withBorder?: boolean
}

/**
 * 列表项骨架屏组件
 * 用于 ChatMobile、ContactsMyGroups、ContactsAiAssistant 等列表页面
 */
export function ListItemSkeleton({
	showAvatar = true,
	avatarSize = 40,
	showSubtitle = true,
	showRightElement = true,
	withBorder = false,
}: ListItemSkeletonProps) {
	return (
		<div
			style={{
				display: "flex",
				alignItems: "center",
				gap: 10,
				padding: 12,
				backgroundColor: "#ffffff",
				...(withBorder && {
					borderRadius: 8,
					border: "1px solid #f0f0f0",
				}),
			}}
		>
			{/* 左侧头像 */}
			{showAvatar && (
				<Skeleton.Title
					animated
					style={{
						width: avatarSize,
						height: avatarSize,
						borderRadius: "50%",
						flex: "none",
					}}
				/>
			)}

			{/* 中间内容区域 */}
			<div style={{ flex: 1, minWidth: 0 }}>
				{/* 标题行 */}
				<Skeleton.Title
					animated
					style={{
						width: "60%",
						height: 16,
						marginBottom: showSubtitle ? 8 : 0,
					}}
				/>

				{/* 副标题行（可选） */}
				{showSubtitle && (
					<Skeleton.Title
						animated
						style={{
							width: "80%",
							height: 14,
						}}
					/>
				)}
			</div>

			{/* 右侧时间/角标（可选） */}
			{showRightElement && (
				<Skeleton.Title
					animated
					style={{
						width: 40,
						height: 14,
						flex: "none",
					}}
				/>
			)}
		</div>
	)
}
