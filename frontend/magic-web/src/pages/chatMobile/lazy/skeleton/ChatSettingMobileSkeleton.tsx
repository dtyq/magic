import {
	NavBarSkeleton,
	SkeletonSafeAreaWrapper,
	Skeleton,
} from "@/components/base/Skeleton"

/**
 * ChatSetting 移动端骨架屏组件
 * 对应页面: src/pages/chatMobile/setting.tsx
 * 聊天设置页面 - 包含AI设置/用户设置/群组设置
 */
export default function ChatSettingMobileSkeleton() {
	return (
		<SkeletonSafeAreaWrapper topStyle={{ backgroundColor: "#ffffff" }}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					height: "100%",
					backgroundColor: "#f5f5f5",
				}}
			>
				{/* NavBar */}
				<NavBarSkeleton titleWidth="30%" />

				{/* 设置内容区域 */}
				<div style={{ flex: 1, overflowY: "auto", padding: "10px 10px 0 10px" }}>
					{/* 设置项分组 */}
					{Array.from({ length: 1 }).map((groupIndex) => (
						<div
							key={groupIndex}
							style={{
								backgroundColor: "#ffffff",
								borderRadius: 12,
								padding: "0 16px",
								marginBottom: 12,
							}}
						>
							{/* 分组标题 */}
							<div
								style={{
									padding: "12px 0 8px 0",
									borderBottom: "1px solid #f0f0f0",
								}}
							>
								<Skeleton.Title animated style={{ width: "40%", height: 16 }} />
							</div>

							{/* 设置项列表 */}
							{Array.from({ length: groupIndex === 0 ? 4 : 3 }).map(
								(_, itemIndex) => (
									<div
										key={itemIndex}
										style={{
											display: "flex",
											alignItems: "center",
											justifyContent: "space-between",
											padding: "16px 0",
											borderBottom:
												itemIndex < (groupIndex === 0 ? 3 : 2)
													? "1px solid #f0f0f0"
													: "none",
										}}
									>
										<div style={{ flex: 1 }}>
											<Skeleton.Title
												animated
												style={{
													width: "60%",
													height: 16,
													marginBottom: 8,
												}}
											/>
											<Skeleton.Title
												animated
												style={{ width: "80%", height: 14 }}
											/>
										</div>
										<Skeleton.Title
											animated
											style={{
												width: 16,
												height: 16,
												borderRadius: 4,
												flexShrink: 0,
												marginLeft: 12,
											}}
										/>
									</div>
								),
							)}
						</div>
					))}
				</div>
			</div>
		</SkeletonSafeAreaWrapper>
	)
}
