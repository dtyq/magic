import {
	Skeleton,
	NavBarSkeleton,
	SkeletonSafeAreaWrapper,
} from "@/opensource/components/base/Skeleton"
import MessagePanelSkeleton from "../../components/EmptyWorkspacePanel/components/MessagePanelSkeleton"
import { createStyles } from "antd-style"

const useStyles = createStyles(({ css }) => {
	return {
		container: css`
			display: flex;
			flex-direction: column;
			height: 100%;
			padding-bottom: 10px;
		`,
	}
})

/**
 * TopicPage 移动端骨架屏组件
 * 对应页面: src/opensource/pages/superMagicMobile/pages/TopicPage/index.tsx
 */
export default function TopicPageMobileSkeleton() {
	const { styles } = useStyles()
	return (
		<SkeletonSafeAreaWrapper
			topStyle={{ backgroundColor: "#ffffff" }}
			bottomStyle={{ backgroundColor: "#ffffff" }}
		>
			<div className={styles.container}>
				{/* ChatHeader 区域 */}
				<NavBarSkeleton showRightButton titleWidth="60%" />

				{/* 消息列表区域 */}
				<div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
					{/* 消息项 */}
					{Array.from({ length: 4 }).map((_, index) => (
						<div
							key={index}
							style={{
								marginBottom: 32,
							}}
						>
							<Skeleton.Title
								animated
								style={{
									width: index % 2 === 0 ? "70%" : "85%",
									height: 20,
									marginBottom: 12,
								}}
							/>
							<Skeleton.Paragraph lineCount={2} animated />
						</div>
					))}
				</div>

				{/* 底部操作栏 + MessagePanel */}
				{/* 操作栏图标 */}
				<div
					style={{
						display: "flex",
						gap: 6,
						padding: "0 12px",
						justifyContent: "flex-start",
					}}
				>
					{Array.from({ length: 3 }).map((_, index) => (
						<Skeleton.Title
							key={index}
							animated
							style={{
								width: 80,
								height: 28,
								borderRadius: 4,
								flex: "none",
							}}
						/>
					))}
				</div>

				{/* MessagePanel */}
				<MessagePanelSkeleton isMobile showMobileModeSelector={false} />
			</div>
		</SkeletonSafeAreaWrapper>
	)
}
