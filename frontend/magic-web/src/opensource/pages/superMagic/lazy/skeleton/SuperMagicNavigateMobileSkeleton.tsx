import {
	Skeleton,
	NavBarSkeleton,
	SkeletonSafeAreaWrapper,
} from "@/opensource/components/base/Skeleton"

/**
 * SuperMagicNavigate 移动端骨架屏组件
 * 对应页面: src/opensource/pages/superMagicMobile/pages/navigate/index.tsx
 */
export default function SuperMagicNavigateMobileSkeleton() {
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
				{/* NavBar */}
				<NavBarSkeleton titleWidth="35%" />

				{/* 内容区域 */}
				<div style={{ flex: 1, padding: "20px 16px" }}>
					{/* WorkspaceSection 区域 */}
					<div
						style={{
							backgroundColor: "#ffffff",
							borderRadius: 12,
							padding: 16,
						}}
					>
						{/* 标题 */}
						<Skeleton.Title
							animated
							style={{ width: "40%", height: 18, marginBottom: 16 }}
						/>

						{/* 工作区列表 */}
						{Array.from({ length: 4 }).map((_, index) => (
							<div
								key={index}
								style={{
									display: "flex",
									alignItems: "center",
									gap: 12,
									padding: "12px 0",
									borderBottom: index < 3 ? "1px solid #f0f0f0" : "none",
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
								<div style={{ flex: 1 }}>
									<Skeleton.Title
										animated
										style={{ width: "60%", height: 16, marginBottom: 8 }}
									/>
									<Skeleton.Title animated style={{ width: "40%", height: 14 }} />
								</div>
								<Skeleton.Title
									animated
									style={{
										width: 20,
										height: 20,
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
