import { Skeleton } from "./Skeleton"

interface UserHeaderSkeletonProps {
	showButtons?: boolean
	buttonCount?: number
}

/**
 * UserHeader 骨架屏组件
 * 用于 ChatMobile、ApprovalMobile 等页面的顶部用户头部区域
 */
export function UserHeaderSkeleton({
	showButtons = true,
	buttonCount = 2,
}: UserHeaderSkeletonProps) {
	return (
		<div
			style={{
				backgroundColor: "#ffffff",
				padding: "10px",
				height: 51,
				borderBottom: "1px solid #f0f0f0",
				display: "flex",
				alignItems: "center",
				gap: 10,
			}}
		>
			{/* 左侧头像 */}
			<Skeleton.Title
				animated
				style={{
					width: 32,
					height: 32,
					borderRadius: 4,
					flex: "none",
				}}
			/>

			{/* 中间标题区域 */}
			<div style={{ flex: 1 }}>
				<Skeleton.Title animated style={{ width: "60%", height: 16 }} />
			</div>

			{/* 右侧操作按钮组 */}
			{showButtons && (
				<div style={{ display: "flex", gap: 4 }}>
					{Array.from({ length: buttonCount }).map((_, index) => (
						<Skeleton.Title
							key={index}
							animated
							style={{
								width: 32,
								height: 32,
								borderRadius: 4,
								flex: "none",
							}}
						/>
					))}
				</div>
			)}
		</div>
	)
}
