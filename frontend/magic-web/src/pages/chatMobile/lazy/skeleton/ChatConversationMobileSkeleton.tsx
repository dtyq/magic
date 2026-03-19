import {
	NavBarSkeleton,
	MessagePanelSkeleton,
	SkeletonSafeAreaWrapper,
	Skeleton,
} from "@/components/base/Skeleton"

/**
 * ChatConversation 移动端骨架屏组件
 * 对应页面: src/pages/chatMobile/current.tsx
 * 聊天对话页面 - 包含消息列表和输入框
 */
export default function ChatConversationMobileSkeleton() {
	return (
		<SkeletonSafeAreaWrapper
			topStyle={{ backgroundColor: "#ffffff" }}
			bottomStyle={{ backgroundColor: "#ffffff" }}
			enableTop
			enableBottom
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					height: "100%",
					backgroundColor: "#ffffff",
				}}
			>
				{/* NavBar */}
				<NavBarSkeleton showRightButton titleWidth="40%" />

				{/* 消息列表区域 */}
				<div
					style={{ flex: 1, overflowY: "auto", padding: 16, backgroundColor: "#f5f5f5" }}
				>
					{/* 消息气泡 */}
					{Array.from({ length: 5 }).map((_, index) => (
						<div
							key={index}
							style={{
								marginBottom: 24,
								display: "flex",
								flexDirection: index % 2 === 0 ? "row" : "row-reverse",
								gap: 8,
							}}
						>
							{/* 头像 */}
							<Skeleton.Title
								animated
								style={{
									width: 32,
									height: 32,
									borderRadius: "50%",
									flexShrink: 0,
								}}
							/>

							{/* 消息内容 */}
							<div
								style={{
									width: "70%",
									padding: 12,
									backgroundColor: "#ffffff",
									borderRadius: 8,
								}}
							>
								<Skeleton.Paragraph lineCount={index % 3 === 0 ? 3 : 1} animated />
							</div>
						</div>
					))}
				</div>

				{/* 底部操作栏 + MessagePanel */}
				<div style={{ backgroundColor: "#ffffff" }}>
					{/* 操作栏图标 */}
					<div
						style={{
							display: "flex",
							gap: 16,
							padding: "8px 16px",
							justifyContent: "flex-start",
						}}
					>
						{Array.from({ length: 3 }).map((_, index) => (
							<Skeleton.Title
								key={index}
								animated
								style={{
									width: 60,
									height: 28,
									borderRadius: 4,
									flex: "none",
								}}
							/>
						))}
					</div>

					{/* MessagePanel */}
					<MessagePanelSkeleton showToolbar={false} height={48} />
				</div>
			</div>
		</SkeletonSafeAreaWrapper>
	)
}
