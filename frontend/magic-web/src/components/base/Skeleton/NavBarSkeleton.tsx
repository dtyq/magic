import { IconChevronLeft } from "@tabler/icons-react"
import { Skeleton } from "./Skeleton"
import { createStyles } from "antd-style"

interface NavBarSkeletonProps {
	showRightButton?: boolean
	titleWidth?: string | number
}

const useStyles = createStyles(({ css, token }) => {
	return {
		arrow: css`
			color: ${token.magicColorUsages.text[1]};
		`,
	}
})

/**
 * NavBar 骨架屏组件
 * 用于移动端页面的导航栏骨架
 */
export function NavBarSkeleton({
	showRightButton = false,
	titleWidth = "50%",
}: NavBarSkeletonProps) {
	const { styles } = useStyles()
	return (
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
			{/* 左侧返回图标 */}
			<IconChevronLeft size={24} className={styles.arrow} />

			{/* 中间标题文本 */}
			<div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
				<Skeleton.Title
					animated
					style={{
						width: titleWidth,
						height: 20,
					}}
				/>
			</div>

			{/* 右侧操作按钮（可选） */}
			{showRightButton ? (
				<Skeleton.Title
					animated
					style={{
						width: 24,
						height: 24,
						borderRadius: 4,
						flex: "none",
					}}
				/>
			) : (
				<div style={{ width: 24, height: 24, flex: "none" }} />
			)}
		</div>
	)
}
