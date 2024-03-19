import {
	NavBarSkeleton,
	ListItemSkeleton,
	SkeletonSafeAreaWrapper,
} from "@/opensource/components/base/Skeleton"

/**
 * ContactsOrganization 移动端骨架屏组件
 * 对应页面: src/pages/contacts/organization.tsx
 */
export default function ContactsOrganizationMobileSkeleton() {
	return (
		<SkeletonSafeAreaWrapper topStyle={{ backgroundColor: "#ffffff" }}>
			<div
				style={{
					display: "flex",
					flexDirection: "column",
					height: "100%",
					backgroundColor: "#ffffff",
				}}
			>
				{/* NavBar */}
				<NavBarSkeleton titleWidth="40%" />

				{/* 组织架构列表 */}
				<div style={{ flex: 1, overflowY: "auto" }}>
					{Array.from({ length: 8 }).map((_, index) => (
						<ListItemSkeleton
							key={index}
							showAvatar
							avatarSize={40}
							showSubtitle
							showRightElement
							withBorder={false}
						/>
					))}
				</div>
			</div>
		</SkeletonSafeAreaWrapper>
	)
}
