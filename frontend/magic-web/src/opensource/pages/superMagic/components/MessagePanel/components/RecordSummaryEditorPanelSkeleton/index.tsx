import { createStyles } from "antd-style"

interface RecordSummaryEditorPanelSkeletonProps {
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
				rgba(255, 255, 255, 0.1) 20%,
				rgba(255, 255, 255, 0.3) 60%,
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
			min-height: 146px;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: flex-end;
			gap: 10px;
			padding: 10px;
		`,
		mainContent: css`
			width: 100%;
			flex: 1;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			gap: 10px;
		`,
		mainButton: css`
			position: relative;
			height: 42px;
			min-width: 120px;
			padding: 6px 16px 6px 8px;
			border-radius: 1000px;
			display: flex;
			align-items: center;
			gap: 4px;
			background-color: ${token.colorFillQuaternary};
			overflow: hidden;
			${shimmer}
		`,
		buttonIcon: css`
			width: 30px;
			height: 30px;
			border-radius: 50%;
			background-color: rgba(255, 255, 255, 0.1);
			flex-shrink: 0;
			${shimmer}
		`,
		buttonText: css`
			flex: 1;
			height: 16px;
			border-radius: 4px;
			background-color: rgba(255, 255, 255, 0.15);
			${shimmer}
		`,
		warningText: css`
			width: 60%;
			height: 14px;
			margin: 0 auto;
			border-radius: 4px;
			background-color: ${token.colorFillQuaternary};
			${shimmer}
		`,
		bottomControls: css`
			width: 100%;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 6px;
		`,
		leftControls: css`
			display: flex;
			align-items: center;
			gap: 6px;
		`,
		rightControls: css`
			display: flex;
			align-items: center;
			gap: 8px;
		`,
		skeleton: css`
			background-color: ${token.colorFillQuaternary};
			border-radius: 8px;
			${shimmer}
		`,
	}
})

function RecordSummaryEditorPanelSkeleton({
	size = "default",
}: RecordSummaryEditorPanelSkeletonProps) {
	const { styles } = useStyles()
	const isSmall = size === "small"
	const isMobile = size === "mobile"
	const buttonSize = isSmall ? 24 : 32

	return (
		<div className={styles.container}>
			{/* Main content area */}
			<div className={styles.mainContent}>
				{/* Start recording button */}
				<div className={styles.mainButton}></div>
				{/* Warning text */}
				<div className={styles.warningText} />
			</div>

			{/* Bottom controls */}
			{!isMobile && (
				<div className={styles.bottomControls}>
					{/* Left controls: Mode toggle + Model switch */}
					<div className={styles.leftControls}>
						<div
							className={styles.skeleton}
							style={{ width: buttonSize, height: buttonSize }}
						/>
						<div
							className={styles.skeleton}
							style={{ width: buttonSize, height: buttonSize }}
						/>
					</div>

					{/* Right controls: Audio source + Editor mode switch + Upload + Interrupt */}
					<div className={styles.rightControls}>
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
			)}
		</div>
	)
}

export default RecordSummaryEditorPanelSkeleton
