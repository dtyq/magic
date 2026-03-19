import FlexBox from "@/components/base/FlexBox"
import { createStyles } from "antd-style"
import { memo } from "react"
import { useTranslation } from "react-i18next"

const useStyles = createStyles(({ css }) => {
	return {
		audioVisualizer: css`
			display: flex;
			align-items: center;
			gap: 4px;
			--line-color: rgba(28, 29, 35);
			--default-line-opacity: 0.35;
			--high-line-opacity: 0.7;
			--low-line-opacity: 0.2;
		`,

		visualizerBar: css`
			width: 2px;
			border-radius: 1px;
			background: var(--line-color);
			opacity: var(--default-opacity);
			transition: all 0.3s ease;
			animation: audioWave 1.2s ease-in-out infinite;
			transform-origin: center;

			&:nth-child(1) {
				animation-delay: 0ms;
			}
			&:nth-child(2) {
				animation-delay: 200ms;
			}
			&:nth-child(3) {
				animation-delay: 400ms;
			}
			&:nth-child(4) {
				animation-delay: 600ms;
			}
			&:nth-child(5) {
				animation-delay: 800ms;
			}

			@keyframes audioWave {
				0%,
				100% {
					transform: scaleY(0.6);
					opacity: var(--low-line-opacity);
				}
				50% {
					transform: scaleY(1.2);
					opacity: var(--high-line-opacity);
				}
			}
		`,

		duration: css`
			font-family: "Inter", sans-serif;
			font-size: 12px;
			line-height: 16px;
			color: rgba(28, 29, 35, 0.8);
			margin-left: 4px;
		`,

		durationText: css`
			width: 60px;
		`,
	}
})

const AudioVisualizer = memo(
	({
		duration,
		showDuration = true,
		className,
		isPaused,
	}: {
		duration?: string
		showDuration?: boolean
		lineColor?: string
		className?: string
		isPaused?: boolean
	}) => {
		const { styles, cx } = useStyles()
		const { t } = useTranslation("super")

		return (
			<div className={cx(styles.audioVisualizer, className)}>
				{!isPaused && (
					<>
						<div
							className={cx(styles.visualizerBar)}
							style={!isPaused ? { height: "5px" } : { height: "1px" }}
						/>
						<div
							className={cx(styles.visualizerBar)}
							style={!isPaused ? { height: "10px" } : { height: "1px" }}
						/>
						<div
							className={cx(styles.visualizerBar)}
							style={!isPaused ? { height: "5px" } : { height: "1px" }}
						/>
						<div
							className={cx(styles.visualizerBar)}
							style={!isPaused ? { height: "10px" } : { height: "1px" }}
						/>
						<div
							className={cx(styles.visualizerBar)}
							style={!isPaused ? { height: "6px" } : { height: "1px" }}
						/>
					</>
				)}
				{showDuration && (
					<FlexBox className={styles.duration} align="center" gap={4}>
						<span className={cx(styles.durationText)}>{duration}</span>
						{isPaused && <span>{t("recordingSummary.status.paused")}</span>}
					</FlexBox>
				)}
			</div>
		)
	},
)

AudioVisualizer.displayName = "AudioVisualizer"

export default AudioVisualizer
