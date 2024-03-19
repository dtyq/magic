import { Skeleton } from "./Skeleton"

interface MessagePanelSkeletonProps {
	showToolbar?: boolean
	height?: number
}

/**
 * MessagePanel 骨架屏组件
 * 用于 TopicPage、ProjectPage、WorkspacePage 等页面的底部消息输入区域
 */
export function MessagePanelSkeleton({
	showToolbar = true,
	height = 160,
}: MessagePanelSkeletonProps) {
	return (
		<div
			style={{
				backgroundColor: "#ffffff",
				padding: "10px 12px",
			}}
		>
			{/* 工具栏图标组（可选） */}
			{showToolbar && (
				<div
					style={{
						display: "flex",
						gap: 12,
						marginBottom: 10,
						alignItems: "center",
					}}
				>
					{Array.from({ length: 3 }).map((_, index) => (
						<Skeleton.Title
							key={index}
							animated
							style={{
								width: 24,
								height: 24,
								borderRadius: 4,
								flex: "none",
							}}
						/>
					))}
				</div>
			)}

			{/* 输入框区域 */}
			<Skeleton.Title
				animated
				style={{
					width: "100%",
					height,
					borderRadius: 8,
				}}
			/>
		</div>
	)
}
