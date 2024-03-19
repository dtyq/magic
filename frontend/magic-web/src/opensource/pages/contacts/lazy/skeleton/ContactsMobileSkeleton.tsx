import {
	Skeleton,
	UserHeaderSkeleton,
	SkeletonSafeAreaWrapper,
} from "@/opensource/components/base/Skeleton"

/**
 * ContactsMobile 骨架屏组件
 * 对应页面: src/opensource/pages/contacts/index.tsx
 */
export default function ContactsMobileSkeleton() {
	return (
		<SkeletonSafeAreaWrapper topStyle={{ backgroundColor: "#f5f5f5" }}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					height: "100%",
					backgroundColor: "#f5f5f5",
				}}
			>
				{/* UserHeader */}
				<UserHeaderSkeleton showButtons={false} />

				{/* 内容区域 */}
				<div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
					{/* 企业内部卡片 */}
					<div
						style={{
							backgroundColor: "#ffffff",
							borderRadius: 12,
							padding: 16,
							marginBottom: 16,
						}}
					>
						{/* 标题 */}
						<Skeleton.Title
							animated
							style={{ width: "40%", height: 16, marginBottom: 16 }}
						/>

						{/* 公司信息 */}
						<div
							style={{
								display: "flex",
								alignItems: "center",
								gap: 8,
								marginBottom: 16,
							}}
						>
							<Skeleton.Title
								animated
								style={{
									width: 42,
									height: 42,
									borderRadius: 8,
									flex: "none",
								}}
							/>
							<div style={{ flex: 1 }}>
								<Skeleton.Title
									animated
									style={{ width: "60%", height: 16, marginBottom: 8 }}
								/>
								<Skeleton.Title animated style={{ width: "40%", height: 14 }} />
							</div>
						</div>

						{/* 部门列表 */}
						<div style={{ marginLeft: 50 }}>
							{Array.from({ length: 3 }).map((_, index) => (
								<div
									key={index}
									style={{
										display: "flex",
										alignItems: "center",
										gap: 8,
										padding: "8px 0",
										borderTop: "1px solid #f0f0f0",
									}}
								>
									<Skeleton.Title
										animated
										style={{
											width: 20,
											height: 12,
											flex: "none",
										}}
									/>
									<Skeleton.Title animated style={{ flex: 1, height: 14 }} />
									<Skeleton.Title
										animated
										style={{
											width: 16,
											height: 16,
											borderRadius: 4,
											flex: "none",
										}}
									/>
								</div>
							))}
						</div>
					</div>

					{/* 快捷操作区域 */}
					<div
						style={{
							backgroundColor: "#ffffff",
							borderRadius: 12,
							padding: 16,
						}}
					>
						{Array.from({ length: 2 }).map((_, index) => (
							<div
								key={index}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 12,
									padding: "12px 0",
									borderBottom: index < 1 ? "1px solid #f0f0f0" : "none",
								}}
							>
								<Skeleton.Title
									animated
									style={{
										width: 40,
										height: 40,
										borderRadius: 8,
										flex: "none",
									}}
								/>
								<Skeleton.Title animated style={{ flex: 1, height: 16 }} />
								<Skeleton.Title
									animated
									style={{
										width: 16,
										height: 16,
										borderRadius: 4,
										flex: "none",
									}}
								/>
							</div>
						))}
					</div>
				</div>
			</div>
		</SkeletonSafeAreaWrapper>
	)
}
