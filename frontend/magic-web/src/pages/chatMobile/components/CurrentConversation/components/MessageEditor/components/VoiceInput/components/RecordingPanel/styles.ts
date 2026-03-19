import { createStyles } from "antd-style"

/**
 * Recording Panel Styles
 *
 * iOS优化说明：
 * 1. 使用 translate3d() 和 scale3d() 启用硬件加速
 * 2. 添加 will-change 属性预告变化的属性
 * 3. 使用 backface-visibility: hidden 避免反面闪烁
 * 4. 优化缓动函数，使用更适合iOS的 cubic-bezier
 * 5. 调整动画延迟和持续时间，避免iOS上的不同步问题
 * 6. 改进:active状态响应时间，提升触摸体验
 */
export const useStyles = createStyles(({ css, token }) => ({
	overlay: css`
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: ${token.safeAreaInsetBottom};
		z-index: 1000;
		background: rgba(255, 255, 255, 0.7);
		backdrop-filter: blur(2.5px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		padding: 0;
		height: calc(100% - ${token.safeAreaInsetBottom});
		width: 100vw;

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

		/* Panel entrance animation */
		animation: overlayFadeIn 0.15s cubic-bezier(0.2, 0, 0.2, 1) forwards;

		@keyframes overlayFadeIn {
			from {
				opacity: 0;
				backdrop-filter: blur(0px);
			}
			to {
				opacity: 1;
				backdrop-filter: blur(2.5px);
			}
		}
	`,

	content: css`
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		padding: 14px 0 28px 0;
		box-sizing: border-box;

		/* Recording mode entrance animation */
		animation: contentSlideUp 0.25s cubic-bezier(0.2, 0, 0.2, 1) forwards;

		@keyframes contentSlideUp {
			from {
				transform: translateY(100px);
				opacity: 0;
			}
			to {
				transform: translateY(0);
				opacity: 1;
			}
		}
	`,

	// Edit mode content layout
	editContent: css`
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		box-sizing: border-box;

		/* Edit mode entrance animation */
		animation: editContentFadeIn 0.2s cubic-bezier(0.2, 0, 0.2, 1) forwards;

		@keyframes editContentFadeIn {
			from {
				opacity: 0;
				transform: scale(0.95);
			}
			to {
				opacity: 1;
				transform: scale(1);
			}
		}
	`,

	// Voice message bubble
	messageBubble: css`
		background: #315cec;
		border-radius: 12px;
		padding: 10px 14px;
		margin-bottom: 10px;
		max-width: 335px;
		width: calc(100% - 40px);
		margin-left: auto;
		margin-right: 20px;
		margin-bottom: 10px;
		position: relative;

		/* Bubble entrance animation */
		animation: bubbleSlideIn 0.3s cubic-bezier(0.2, 0, 0.2, 1) forwards;
		transform-origin: bottom right;

		/* Message bubble tail */
		&::after {
			content: "";
			position: absolute;
			bottom: -6px;
			right: 16px;
			width: 0;
			height: 0;
			border-left: 8px solid transparent;
			border-right: 8px solid transparent;
			border-top: 8px solid #315cec;
		}

		@keyframes bubbleSlideIn {
			from {
				opacity: 0;
				transform: translateY(20px) scale(0.9);
			}
			to {
				opacity: 1;
				transform: translateY(0) scale(1);
			}
		}
	`,

	// Editable text input
	editableTextInput: css`
		background: transparent;
		border: none;
		outline: none;
		color: #ffffff;
		font-size: 14px;
		line-height: 20px;
		font-family: "PingFang SC", sans-serif;
		width: 100%;
		resize: none;
		min-height: 20px;
		max-height: 120px;
		height: fit-content;
		overflow-y: auto;
		transition: all 0.2s ease;

		&::placeholder {
			color: rgba(255, 255, 255, 0.7);
			transition: color 0.2s ease;
		}

		&:focus::placeholder {
			color: rgba(255, 255, 255, 0.5);
		}
	`,

	messageText: css`
		color: #ffffff;
		font-size: 14px;
		line-height: 20px;
		font-family: "PingFang SC", sans-serif;
		margin: 0;
	`,

	waveformContainer: css`
		width: 100%;
		height: 100px;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-bottom: 20px;

		/* Waveform container entrance animation */
		animation: waveformFadeIn 0.25s cubic-bezier(0.2, 0, 0.2, 1) 0.1s both;

		@keyframes waveformFadeIn {
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

	// Edit mode action buttons area
	editActionsContainer: css`
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 28px 20px;
		border-radius: 16px 16px 0 0;
		background: #ffffff;

		/* Action buttons area slide up animation */
		animation: actionsSlideUp 0.3s cubic-bezier(0.2, 0, 0.2, 1) 0.05s both;

		@keyframes actionsSlideUp {
			from {
				opacity: 0;
				transform: translateY(80px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
	`,

	// Action buttons area
	actionsContainer: css`
		display: flex;
		justify-content: space-between;
		align-items: center;
		width: 100%;
		padding: 0 30px;
		margin-bottom: 8px;
		gap: 20px;

		/* Recording mode buttons entrance animation */
		animation: recordingActionsFadeIn 0.25s cubic-bezier(0.2, 0, 0.2, 1) 0.15s both;

		@keyframes recordingActionsFadeIn {
			from {
				opacity: 0;
				transform: translateY(20px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
	`,

	actionButton: css`
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		cursor: pointer;
		transition: transform 0.2s cubic-bezier(0.2, 0, 0.2, 1);

		/* iOS渲染优化 */
		will-change: transform;
		-webkit-backface-visibility: hidden;
		backface-visibility: hidden;

		/* 防止文本选择 */
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;

		&:active {
			transform: scale3d(0.95, 0.95, 1);
			transition-duration: 0.1s;
		}
	`,

	// Action buttons in edit mode
	editActionButton: css`
		display: flex;
		flex-direction: column;
		align-items: center;
		cursor: pointer;
		transition: transform 0.2s cubic-bezier(0.2, 0, 0.2, 1);
		opacity: 0;

		/* iOS渲染优化 */
		will-change: transform, opacity;
		-webkit-backface-visibility: hidden;
		backface-visibility: hidden;
		-webkit-perspective: 1000px;
		perspective: 1000px;

		/* 防止文本选择 */
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;

		/* Staggered button entrance animation - iOS优化版本 */
		animation: buttonFadeIn 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;

		&:nth-child(1) {
			animation-delay: 0.05s;
		}

		&:nth-child(2) {
			animation-delay: 0.1s;
		}

		&:nth-child(3) {
			animation-delay: 0.15s;
		}

		/* iOS touch优化 */
		&:active {
			transform: scale3d(0.95, 0.95, 1);
			transition-duration: 0.1s;
		}

		@keyframes buttonFadeIn {
			0% {
				opacity: 0;
				transform: translate3d(0, 30px, 0) scale3d(0.8, 0.8, 1);
			}
			60% {
				opacity: 0.8;
				transform: translate3d(0, -2px, 0) scale3d(1.05, 1.05, 1);
			}
			100% {
				opacity: 1;
				transform: translate3d(0, 0, 0) scale3d(1, 1, 1);
			}
		}
	`,

	actionButtonCircle: css`
		width: 80px;
		height: 80px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		border: 1px solid rgba(28, 29, 35, 0.01);
	`,

	// Button circles in edit mode
	editActionButtonCircle: css`
		width: 90px;
		height: 90px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 2px;
		transition: all 0.2s ease;
	`,

	actionLabel: css`
		font-size: 14px;
		font-family: "PingFang SC", sans-serif;
		font-weight: 400;
		line-height: 20px;
	`,

	// Button labels in edit mode
	editActionLabel: css`
		font-size: 12px;
		font-family: "PingFang SC", sans-serif;
		font-weight: 400;
		line-height: 17px;
		color: ${token.colorText};
	`,

	// Edit mode button styles
	editCancelButton: css`
		color: ${token.colorText};
	`,

	editVoiceButton: css`
		color: ${token.colorText};
	`,

	editSendButton: css`
		background: ${token.colorPrimary};
		color: ${token.magicColorScales.white};
	`,

	editSendButtonLabel: css`
		color: ${token.magicColorScales.white};
		font-weight: 500;
	`,

	// Default state styles
	defaultButton: css`
		background: ${token.colorFillAlter};
		color: ${token.colorTextTertiary};
	`,

	defaultLabel: css`
		color: ${token.colorTextTertiary};
	`,

	// Cancel state styles
	cancelActiveButton: css`
		background: #fff0eb;
		color: ${token.colorError};
	`,

	cancelActiveLabel: css`
		color: ${token.colorError};
	`,

	// Text state styles
	textActiveButton: css`
		background: ${token.colorPrimary};
		color: ${token.magicColorScales.white};
	`,

	textActiveLabel: css`
		color: ${token.colorPrimary};
	`,

	// Microphone button
	microphoneButton: css`
		width: 80px;
		height: 80px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: transform 0.2s cubic-bezier(0.2, 0, 0.2, 1);
		position: relative;

		/* iOS渲染优化 */
		will-change: transform, opacity;
		-webkit-backface-visibility: hidden;
		backface-visibility: hidden;
		-webkit-perspective: 1000px;
		perspective: 1000px;

		/* 防止文本选择 */
		user-select: none;
		-webkit-user-select: none;
		touch-action: manipulation;
		-webkit-tap-highlight-color: transparent;

		/* Microphone button entrance animation - iOS优化 */
		animation: microphoneAppear 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94) 0.25s both;

		&:active {
			transform: scale3d(0.95, 0.95, 1);
			transition-duration: 0.1s;
		}

		&::before {
			content: "";
			position: absolute;
			top: 50%;
			left: 50%;
			width: 100%;
			height: 100%;
			border-radius: 50%;
			transform: translate3d(-50%, -50%, 0);
			opacity: 0.3;
			animation: ripple 2s infinite;
			will-change: transform, opacity;
			-webkit-backface-visibility: hidden;
			backface-visibility: hidden;
		}

		&::after {
			content: "";
			position: absolute;
			top: 50%;
			left: 50%;
			width: 100%;
			height: 100%;
			border-radius: 50%;
			transform: translate3d(-50%, -50%, 0);
			opacity: 0.2;
			animation: ripple 2s infinite 0.5s;
			will-change: transform, opacity;
			-webkit-backface-visibility: hidden;
			backface-visibility: hidden;
		}

		@keyframes ripple {
			0% {
				width: 100%;
				height: 100%;
				opacity: 0.3;
				transform: translate3d(-50%, -50%, 0) scale3d(1, 1, 1);
			}
			50% {
				width: 150%;
				height: 150%;
				opacity: 0.1;
				transform: translate3d(-50%, -50%, 0) scale3d(1.5, 1.5, 1);
			}
			100% {
				width: 200%;
				height: 200%;
				opacity: 0;
				transform: translate3d(-50%, -50%, 0) scale3d(2, 2, 1);
			}
		}

		@keyframes microphoneAppear {
			0% {
				opacity: 0;
				transform: translate3d(0, 40px, 0) scale3d(0.8, 0.8, 1);
			}
			60% {
				opacity: 0.9;
				transform: translate3d(0, -3px, 0) scale3d(1.05, 1.05, 1);
			}
			100% {
				opacity: 1;
				transform: translate3d(0, 0, 0) scale3d(1, 1, 1);
			}
		}
	`,

	microphoneDefault: css`
		background: ${token.colorPrimary};
		color: ${token.magicColorScales.white};

		&::before,
		&::after {
			background: ${token.colorPrimary};
		}
	`,

	microphoneCancel: css`
		background: ${token.colorFillAlter};
		color: ${token.colorTextTertiary};

		&::before,
		&::after {
			background: ${token.magicColorScales.grey[1]};
			color: ${token.magicColorScales.white};
			animation: none; /* No ripple animation for cancel and text states */
		}
	`,

	microphoneText: css`
		background: ${token.colorFillAlter};
		color: ${token.colorTextTertiary};

		&::before,
		&::after {
			background: ${token.magicColorScales.grey[1]};
			color: ${token.magicColorScales.white};
			animation: none; /* No ripple animation for cancel and text states */
		}
	`,

	// Status text
	statusText: css`
		font-size: 14px;
		font-family: "PingFang SC", sans-serif;
		font-weight: 400;
		line-height: 20px;
		color: rgba(28, 29, 35, 0.35);
		margin-bottom: 2px;

		/* Status text entrance animation */
		animation: statusTextFadeIn 0.25s cubic-bezier(0.2, 0, 0.2, 1) 0.2s both;

		@keyframes statusTextFadeIn {
			from {
				opacity: 0;
				transform: translateY(10px);
			}
			to {
				opacity: 1;
				transform: translateY(0);
			}
		}
	`,
}))

// Style utility functions
export const getWaveformProps = (isCancel: boolean) => {
	if (isCancel) {
		return {
			color: "#FF1809",
			backgroundColor: "rgba(255, 24, 9, 0.1)",
		}
	}
	return {
		color: "#315CEC",
		backgroundColor: "rgba(49, 92, 236, 0.1)",
	}
}

export const getMicrophoneStyleClass = (
	isCancel: boolean,
	isSendText: boolean,
	styles: ReturnType<typeof useStyles>["styles"],
) => {
	if (isCancel) return styles.microphoneCancel
	if (isSendText) return styles.microphoneText
	return styles.microphoneDefault
}
