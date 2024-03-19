import { createStyles } from "antd-style"

interface ChatMessageEditorSkeletonProps {
	size?: "default" | "small" | "mobile"
}

const useStyles = createStyles(({ token, css }) => {
	const shimmer = css`
		position: relative;
		overflow: hidden;

		&::after {
			content: "";
			position: absolute;
			top: 0;
			right: 0;
			bottom: 0;
			left: 0;
			transform: translateX(-100%);
			background: linear-gradient(
				90deg,
				rgba(255, 255, 255, 0) 0,
				rgba(255, 255, 255, 0.2) 20%,
				rgba(255, 255, 255, 0.5) 60%,
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
			gap: 10px;
		`,
		agentTip: css`
			min-height: 32px;
			padding: 4px 12px;
			background-color: ${token.magicColorUsages.primaryLight.default};
			border-radius: 4px;
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 6px;
		`,
		agentTipText: css`
			width: 120px;
			height: 12px;
			background-color: rgba(255, 255, 255, 0.3);
			border-radius: 2px;
			${shimmer}
		`,
		agentAvatar: css`
			width: 20px;
			height: 20px;
			border-radius: 50%;
			background-color: rgba(255, 255, 255, 0.3);
			${shimmer}
		`,
		agentName: css`
			width: 60px;
			height: 12px;
			background-color: rgba(255, 255, 255, 0.4);
			border-radius: 2px;
			${shimmer}
		`,
		editorArea: css`
			min-height: 60px;
			padding: 12px;
			border-radius: 8px;
			background-color: ${token.colorFillQuaternary};
			${shimmer}
		`,
		footer: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			height: 32px;
		`,
		footerLeft: css`
			display: flex;
			align-items: center;
			gap: 8px;
		`,
		footerRight: css`
			display: flex;
			align-items: center;
			gap: 6px;
		`,
		skeleton: css`
			background-color: ${token.colorFillQuaternary};
			border-radius: 8px;
			${shimmer}
		`,
		small: css`
			min-height: 42px;
		`,
	}
})

function ChatMessageEditorSkeleton({ size = "default" }: ChatMessageEditorSkeletonProps) {
	const { styles, cx } = useStyles()
	const isSmall = size === "small"
	const buttonSize = isSmall ? 24 : 32

	return (
		<div className={styles.container}>
			{/* Agent tip - blue area */}
			<div className={styles.agentTip}>
				<div className={styles.agentTipText} />
				<div className={styles.agentAvatar} />
				<div className={styles.agentName} />
				<div className={styles.agentTipText} style={{ width: 40 }} />
			</div>

			{/* Editor area */}
			<div className={cx(styles.editorArea, isSmall && styles.small)} />

			{/* Footer with buttons */}
			<div className={styles.footer}>
				<div className={styles.footerLeft}>
					<div
						className={styles.skeleton}
						style={{ width: buttonSize, height: buttonSize }}
					/>
					<div
						className={styles.skeleton}
						style={{ width: buttonSize, height: buttonSize }}
					/>
					<div
						className={styles.skeleton}
						style={{ width: buttonSize, height: buttonSize }}
					/>
				</div>
				<div className={styles.footerRight}>
					<div
						className={styles.skeleton}
						style={{ width: buttonSize, height: buttonSize }}
					/>
					<div
						className={styles.skeleton}
						style={{ width: buttonSize, height: buttonSize }}
					/>
					<div
						className={styles.skeleton}
						style={{ width: buttonSize, height: buttonSize }}
					/>
				</div>
			</div>
		</div>
	)
}

export default ChatMessageEditorSkeleton
