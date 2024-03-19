import {
	ListItemSkeleton,
	SkeletonSafeAreaWrapper,
	Skeleton,
} from "@/opensource/components/base/Skeleton"

/**
 * ContactsAiAssistant 移动端骨架屏组件
 * 对应页面: src/opensource/pages/contacts/aiAssistant.tsx
 */
export default function ContactsAiAssistantMobileSkeleton() {
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
				{/* NavBar - 右侧有按钮 */}
				<div
					style={{
						height: 48,
						padding: "6px 12px",
						backgroundColor: "#ffffff",
						borderBottom: "1px solid #f0f0f0",
						display: "flex",
						alignItems: "center",
						justifyContent: "space-between",
						gap: 12,
					}}
				>
					<Skeleton.Title
						animated
						style={{
							width: 24,
							height: 24,
							borderRadius: 4,
							flex: "none",
						}}
					/>
					<div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
						<Skeleton.Title animated style={{ width: "40%", height: 20 }} />
					</div>
					<Skeleton.Title animated style={{ width: 60, height: 28, borderRadius: 4 }} />
				</div>

				{/* AI助理列表 */}
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
