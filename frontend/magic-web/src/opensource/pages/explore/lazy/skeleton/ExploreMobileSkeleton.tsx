import {
	NavBarSkeleton,
	SkeletonSafeAreaWrapper,
	ListItemSkeleton,
} from "@/opensource/components/base/Skeleton"

/**
 * Explore 移动端骨架屏组件
 * 对应页面: src/opensource/pages/exploreMobile/index.tsx
 */
export default function ExploreMobileSkeleton() {
	return (
		<SkeletonSafeAreaWrapper
			topStyle={{ backgroundColor: "#ffffff" }}
			bottomStyle={{ backgroundColor: "#ffffff" }}
			enableBottom
			enableTop
		>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					height: "100%",
					backgroundColor: "#f5f5f5",
				}}
			>
				{/* NavBar */}
				<NavBarSkeleton titleWidth="40%" />

				{/* 分组列表 */}
				<div style={{ flex: 1, overflowY: "auto", padding: "0 10px" }}>
					{Array.from({ length: 7 }).map((_, index) => (
						<div key={index} style={{ marginTop: 10 }}>
							<ListItemSkeleton
								showAvatar
								avatarSize={30}
								showSubtitle={false}
								showRightElement={false}
								withBorder
							/>
						</div>
					))}
				</div>
			</div>
		</SkeletonSafeAreaWrapper>
	)
}
