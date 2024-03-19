import { memo } from "react"
import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, token }) => ({
	container: css`
		min-height: 60px;
		max-height: 120px;
		overflow-y: auto;
		padding: 12px 16px;
		border-radius: 8px;
		background: ${token.colorFillAlter};
		border: 1px solid ${token.colorBorderSecondary};
		transition: all 0.2s ease-in-out;
	`,

	textContent: css`
		color: ${token.colorText};
		font-size: 14px;
		line-height: 1.5;
	`,

	placeholder: css`
		color: ${token.colorTextTertiary};
		font-size: 14px;
		line-height: 1.5;
		display: flex;
		align-items: center;
	`,

	recordingDot: css`
		display: inline-block;
		width: 8px;
		height: 8px;
		background: ${token.colorError};
		border-radius: 50%;
		margin-right: 8px;
		animation: pulse 1.5s infinite;

		@keyframes pulse {
			0%,
			100% {
				opacity: 1;
			}
			50% {
				opacity: 0.5;
			}
		}
	`,
}))

interface TranscriptionDisplayProps {
	text: string
	isRecording: boolean
	className?: string
}

const TranscriptionDisplay = memo(({ text, isRecording, className }: TranscriptionDisplayProps) => {
	const { styles, cx } = useStyles()

	return (
		<div className={cx(styles.container, className)}>
			{text ? (
				<div className={styles.textContent}>{text}</div>
			) : (
				<div className={styles.placeholder}>
					{isRecording ? (
						<>
							<span className={styles.recordingDot} />
							正在聆听，请说话...
						</>
					) : (
						"按住按钮开始录音"
					)}
				</div>
			)}
		</div>
	)
})

TranscriptionDisplay.displayName = "TranscriptionDisplay"

export default TranscriptionDisplay
