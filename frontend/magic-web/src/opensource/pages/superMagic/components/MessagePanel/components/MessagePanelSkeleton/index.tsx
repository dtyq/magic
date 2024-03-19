import { createStyles } from "antd-style"

interface MessagePanelSkeletonProps {
	className?: string
}

const useStyles = createStyles(({ token, css }) => {
	const shimmer = css`
		position: relative;
		overflow: hidden;

		&::after {
			content: "";
			position: absolute;
			inset: 0;
			transform: translateX(-100%);
			background: linear-gradient(
				90deg,
				rgba(255, 255, 255, 0) 0,
				rgba(255, 255, 255, 0.25) 25%,
				rgba(255, 255, 255, 0.45) 50%,
				rgba(255, 255, 255, 0)
			);
			animation: shimmer 2s infinite;
		}

		@keyframes shimmer {
			100% {
				transform: translateX(100%);
			}
		}
	`

	return {
		container: css`
			width: 100%;
			display: flex;
			flex-direction: column;
			gap: 6px;
			height: 220px;
		`,
		quoteBar: css`
			display: inline-flex;
			align-items: center;
			gap: 8px;
			padding: 6px 12px;
			min-height: 32px;
			background: ${token.colorFillSecondary};
			border-radius: 10px;
		`,
		quoteIcon: css`
			width: 18px;
			height: 18px;
			border-radius: 6px;
			background: ${token.colorFillQuaternary};
			${shimmer}
		`,
		quoteText: css`
			width: 160px;
			height: 12px;
			border-radius: 6px;
			background: ${token.colorFillQuaternary};
			${shimmer}
		`,
		inputArea: css`
			padding: 10px;
			border-radius: 8px;
			border: 1px solid ${token.colorBorder};
			background: ${token.colorBgContainer};
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.03);
			display: flex;
			flex-direction: column;
			gap: 12px;
			justify-content: space-between;
			flex: 1;
		`,
		inputLines: css`
			display: flex;
			flex-direction: column;
			gap: 8px;
		`,
		inputLine: css`
			height: 14px;
			border-radius: 6px;
			background: ${token.colorFillQuaternary};
			${shimmer}
		`,
		footer: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 0 4px;
			height: 40px;
		`,
		iconGroup: css`
			display: inline-flex;
			align-items: center;
			gap: 10px;
		`,
		icon: css`
			width: 28px;
			height: 28px;
			border-radius: 8px;
			background: ${token.colorFillQuaternary};
			${shimmer}
		`,
		actionButtons: css`
			display: flex;
			align-items: center;
			gap: 6px;
		`,
		actionButton: css`
			width: 100px;
			height: 20px;
			border-radius: 8px;
			background: ${token.colorFillQuaternary};
			${shimmer}
		`,
	}
})

function MessagePanelSkeleton({ className }: MessagePanelSkeletonProps) {
	const { styles, cx } = useStyles()

	return (
		<div className={cx(styles.container, className)}>
			<div className={styles.inputArea}>
				<div className={styles.inputLines}>
					<div className={styles.inputLine} style={{ width: "40px", height: "20px" }} />
					<div className={styles.inputLine} style={{ width: "90%" }} />
					<div className={styles.inputLine} style={{ width: "70%" }} />
				</div>
				<div className={styles.footer}>
					<div className={styles.iconGroup}>
						<div className={styles.icon} />
						<div className={styles.icon} />
						<div className={styles.icon} />
					</div>
					<div className={styles.iconGroup}>
						<div className={styles.icon} />
						<div className={styles.icon} />
					</div>
				</div>
			</div>
			<div className={styles.actionButtons}>
				<div className={styles.actionButton} />
				<div className={styles.actionButton} />
			</div>
		</div>
	)
}

export default MessagePanelSkeleton
