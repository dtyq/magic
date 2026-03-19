import { createStyles } from "antd-style"
import type { ReactNode, CSSProperties } from "react"

interface SkeletonSafeAreaWrapperProps {
	children: ReactNode
	enableTop?: boolean
	enableBottom?: boolean
	topStyle?: CSSProperties
	bottomStyle?: CSSProperties
}

const useStyles = createStyles(({ css, token }) => {
	return {
		top: css`
			/* height: ${token.safeAreaInsetTop}; */
		`,
		bottom: css`
			height: ${token.safeAreaInsetBottom};
		`,
	}
})

/**
 * 骨架屏安全边距包裹组件
 * 为所有骨架屏统一处理顶部和底部安全边距
 * 确保在有刘海屏或 Home Indicator 的设备上内容不会被遮挡
 */
export function SkeletonSafeAreaWrapper({
	children,
	enableTop = false,
	enableBottom = true,
	topStyle,
	bottomStyle,
}: SkeletonSafeAreaWrapperProps) {
	const { styles } = useStyles()

	return (
		<div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
			{enableTop && (
				<div
					style={{
						width: "100%",
						flexShrink: 0,
						...topStyle,
					}}
					className={styles.top}
				/>
			)}
			<div style={{ flex: 1, overflow: "hidden" }}>{children}</div>
			{enableBottom && (
				<div
					className={styles.bottom}
					style={{
						width: "100%",
						flexShrink: 0,
						...bottomStyle,
					}}
				/>
			)}
		</div>
	)
}
