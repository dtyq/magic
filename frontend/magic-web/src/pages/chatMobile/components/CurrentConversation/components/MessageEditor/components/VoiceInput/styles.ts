import { createStyles } from "antd-style"

export const useVoiceInputMobileStyles = createStyles(({ css, token, cx }) => ({
	container: css`
		position: relative;
		display: inline-block;
		text-align: center;
		display: flex;
		align-items: center;
		justify-content: center;
		background-color: ${token.magicColorUsages.fill[0]};
		border-radius: 8px;
		padding: 8px 12px;
		flex: 1;
		overflow: hidden;
		color: ${token.colorText};
		text-align: center;
		text-overflow: ellipsis;
		font-size: 14px;
		font-weight: 600;
		line-height: 20px;

		/* 防止文本选择和触摸冲突 */
		user-select: none;
		-webkit-user-select: none;
		-moz-user-select: none;
		-ms-user-select: none;

		/* 优化移动端触摸体验 */
		touch-action: manipulation;
		-webkit-touch-callout: none;
		-webkit-tap-highlight-color: transparent;

		/* 防止长按菜单 */
		-webkit-user-drag: none;
		-khtml-user-drag: none;
		-moz-user-drag: none;
		-o-user-drag: none;
		user-drag: none;

		/* 防止拖拽 */
		-webkit-user-modify: read-only;

		/* 提升交互性能 */
		transform: translateZ(0);
		will-change: transform;
	`,

	voiceButton: css`
		overflow: hidden;
		color: ${token.colorText};
		text-align: center;
		text-overflow: ellipsis;

		font-size: 14px;
		font-weight: 600;
		line-height: 20px;
	`,

	pressed: css`
		background-color: ${token.magicColorUsages.fill[1]};
		border-radius: 8px;
	`,

	buttonText: css`
		margin-left: 8px;
		font-size: 14px;
		font-weight: 500;
		color: ${token.colorText};
	`,

	// 录音面板样式
	recordingOverlay: css`
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 1000;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	`,

	recordingPanel: css`
		background: white;
		border-radius: 16px;
		padding: 24px;
		width: 100%;
		max-width: 360px;
		box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
		animation: slideUp 0.3s ease-out;
		user-select: none;

		@keyframes slideUp {
			from {
				opacity: 0;
				transform: translateY(30px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
	`,

	recordingHeader: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 20px;
	`,

	recordingStatus: css`
		display: flex;
		align-items: center;
		gap: 8px;
		color: ${token.colorTextSecondary};
		font-size: 14px;
		font-weight: 500;
	`,

	recordingDot: css`
		width: 8px;
		height: 8px;
		background: ${token.colorError};
		border-radius: 50%;
		animation: blink 1s infinite;

		@keyframes blink {
			0%,
			50% {
				opacity: 1;
			}
			51%,
			100% {
				opacity: 0.3;
			}
		}
	`,

	duration: css`
		font-family: ${token.fontFamilyCode};
		color: ${token.colorTextTertiary};
		font-size: 12px;
	`,

	waveformContainer: css`
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		margin: 20px 0;
	`,

	audioLevel: css`
		font-size: 12px;
		color: ${token.colorTextTertiary};
	`,

	transcriptionContainer: css`
		background: ${token.colorFillAlter};
		border-radius: 8px;
		padding: 16px;
		margin: 20px 0;
		min-height: 60px;
		max-height: 120px;
		overflow-y: auto;
	`,

	transcriptionText: css`
		color: ${token.colorText};
		font-size: 14px;
		line-height: 1.5;
		margin: 0;
	`,

	transcriptionPlaceholder: css`
		color: ${token.colorTextTertiary};
		font-size: 14px;
		display: flex;
		align-items: center;
		gap: 8px;
	`,

	gestureIndicator: css`
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 12px;
		margin: 20px 0;
	`,

	gestureText: css`
		font-size: 14px;
		font-weight: 500;
		transition: color 0.2s ease;
	`,

	gestureProgress: css`
		width: 80px;
		height: 4px;
		background: ${token.colorFillSecondary};
		border-radius: 2px;
		overflow: hidden;
	`,

	gestureProgressBar: css`
		height: 100%;
		transition: width 0.1s ease-out;
		border-radius: 2px;
	`,

	gestureHints: css`
		display: flex;
		align-items: center;
		gap: 24px;
		color: ${token.colorTextTertiary};
	`,

	gestureHint: css`
		display: flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
		transition: color 0.2s ease;

		&.active {
			color: ${token.colorPrimary};
		}
	`,

	instructions: css`
		text-align: center;
		font-size: 12px;
		color: ${token.colorTextTertiary};
		line-height: 1.4;
		margin-top: 16px;
	`,

	// 手势相关样式
	cancelGesture: css`
		color: ${token.colorError} !important;

		.${cx("gestureProgressBar")} {
			background: ${token.colorError};
		}
	`,

	sendTextGesture: css`
		color: ${token.colorPrimary} !important;

		.${cx("gestureProgressBar")} {
			background: ${token.colorPrimary};
		}
	`,

	sendVoiceGesture: css`
		color: ${token.colorSuccess} !important;

		.${cx("gestureProgressBar")} {
			background: ${token.colorSuccess};
		}
	`,
}))
