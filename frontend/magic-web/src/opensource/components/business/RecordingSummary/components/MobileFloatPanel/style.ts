import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	container: css`
		position: fixed;
		z-index: 1000;
		background: white;
		box-shadow:
			0px 4px 14px 0px rgba(0, 0, 0, 0.1),
			0px 0px 1px 0px rgba(0, 0, 0, 0.3);
		display: flex;
		flex-direction: column;
		overflow: hidden;

		/* Expanded state - full panel */
		&.expanded {
			width: 100vw;
			max-width: 420px;
			height: 100vh;
			max-height: 90vh;
			bottom: 0;
			left: 50%;
			transform: translateX(-50%);
			border-radius: 12px 12px 0 0;
			background: white;
			cursor: default;
		}

		/* Collapsed state - small ball */
		&.collapsed {
			width: 46px;
			height: 46px;
			bottom: 100px;
			transform: none;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			touch-action: none; /* 防止默认触摸行为 */
		}

		/* 磁吸动画 - 只在特定状态下启用 */
		&.collapsed.snapping {
			transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
		}

		/* 拖拽时禁用过渡动画 */
		&.collapsed.dragging {
			transition: none;
			border-radius: 12px !important;
		}

		/* Collapsed state - right side */
		&.collapsed.from-right {
			border-radius: 12px 0 0 12px;
			right: 0;
		}

		/* Collapsed state - left side */
		&.collapsed.from-left {
			border-radius: 0 12px 12px 0;
			left: 0;

			&:hover {
				transform: translateX(3px);
				box-shadow:
					0px 8px 24px 0px rgba(63, 143, 255, 0.25),
					0px 0px 3px 0px rgba(0, 0, 0, 0.2);
				transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
			}

			&:active {
				transform: translateX(2px) scale(0.96);
				transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
			}
		}

		/* Collapsed state - right side hover effects */
		&.collapsed.from-right {
			&:hover {
				transform: translateX(-3px);
				box-shadow:
					0px 8px 24px 0px rgba(63, 143, 255, 0.25),
					0px 0px 3px 0px rgba(0, 0, 0, 0.2);
				transition: all 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
			}

			&:active {
				transform: translateX(-2px) scale(0.96);
				transition: all 0.2s cubic-bezier(0.25, 0.1, 0.25, 1);
			}
		}

		&.enter-animation.expanded.from-right {
			animation: expandFromBallRight 0.65s cubic-bezier(0.16, 1, 0.3, 1);
		}

		&.enter-animation.expanded.from-left {
			animation: expandFromBallLeft 0.65s cubic-bezier(0.16, 1, 0.3, 1);
		}

		&.enter-animation.collapsed.from-right {
			animation: slideInFromRight 0.8s cubic-bezier(0.16, 1, 0.3, 1);
		}

		&.enter-animation.collapsed.from-left {
			animation: slideInFromLeft 0.8s cubic-bezier(0.16, 1, 0.3, 1);
		}

		@keyframes expandFromBallRight {
			0% {
				width: 46px;
				height: 46px;
				bottom: 100px;
				right: 0;
				left: auto;
				transform: translateX(0);
				border-radius: 12px 0 0 12px;
				background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
			}
			25% {
				width: 70px;
				height: 55px;
				bottom: 80px;
				right: 0;
				left: auto;
				transform: translateX(0);
				border-radius: 12px 2px 0 12px;
				background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
			}
			45% {
				width: 160px;
				height: 140px;
				bottom: 40px;
				right: 0;
				left: auto;
				transform: translateX(0);
				border-radius: 12px 12px 0 0;
				background: linear-gradient(
					to bottom,
					rgba(63, 143, 255, 0.8) 0%,
					rgba(255, 255, 255, 0.95) 60%,
					white 100%
				);
			}
			65% {
				width: 280px;
				height: 60vh;
				bottom: 0;
				right: 0;
				left: auto;
				transform: translateX(0);
				border-radius: 12px 12px 0 0;
				background: linear-gradient(
					to bottom,
					rgba(63, 143, 255, 0.4) 0%,
					rgba(255, 255, 255, 0.98) 40%,
					white 100%
				);
			}
			85% {
				width: 85vw;
				max-width: 400px;
				height: 85vh;
				bottom: 0;
				right: auto;
				left: 50%;
				transform: translateX(-50%);
				border-radius: 12px 12px 0 0;
				background: white;
			}
			100% {
				width: 100vw;
				max-width: 420px;
				height: 90vh;
				bottom: 0;
				left: 50%;
				right: auto;
				transform: translateX(-50%);
				border-radius: 12px 12px 0 0;
				background: white;
			}
		}

		@keyframes expandFromBallLeft {
			0% {
				width: 46px;
				height: 46px;
				bottom: 100px;
				left: 0;
				right: auto;
				transform: translateX(0);
				border-radius: 0 12px 12px 0;
				background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
			}
			25% {
				width: 70px;
				height: 55px;
				bottom: 80px;
				left: 0;
				right: auto;
				transform: translateX(0);
				border-radius: 2px 12px 12px 0;
				background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
			}
			45% {
				width: 160px;
				height: 140px;
				bottom: 40px;
				left: 0;
				right: auto;
				transform: translateX(0);
				border-radius: 12px 12px 0 0;
				background: linear-gradient(
					to bottom,
					rgba(63, 143, 255, 0.8) 0%,
					rgba(255, 255, 255, 0.95) 60%,
					white 100%
				);
			}
			65% {
				width: 280px;
				height: 60vh;
				bottom: 0;
				left: 0;
				right: auto;
				transform: translateX(0);
				border-radius: 12px 12px 0 0;
				background: linear-gradient(
					to bottom,
					rgba(63, 143, 255, 0.4) 0%,
					rgba(255, 255, 255, 0.98) 40%,
					white 100%
				);
			}
			85% {
				width: 85vw;
				max-width: 400px;
				height: 85vh;
				bottom: 0;
				left: 50%;
				right: auto;
				transform: translateX(-50%);
				border-radius: 12px 12px 0 0;
				background: white;
			}
			100% {
				width: 100vw;
				max-width: 420px;
				height: 90vh;
				bottom: 0;
				left: 50%;
				right: auto;
				transform: translateX(-50%);
				border-radius: 12px 12px 0 0;
				background: white;
			}
		}

		@keyframes slideInFromRight {
			0% {
				transform: translateX(120%);
				opacity: 0.8;
				border-radius: 12px 0 0 12px;
			}
			30% {
				transform: translateX(50%);
				opacity: 0.9;
				border-radius: 12px 0 0 12px;
			}
			100% {
				transform: translateX(0);
				opacity: 1;
				border-radius: 12px 0 0 12px;
			}
		}

		@keyframes slideInFromLeft {
			0% {
				transform: translateX(-120%);
				opacity: 0.8;
				border-radius: 0 12px 12px 0;
			}
			30% {
				transform: translateX(-50%);
				opacity: 0.9;
				border-radius: 0 12px 12px 0;
			}
			100% {
				transform: translateX(0);
				opacity: 1;
				border-radius: 0 12px 12px 0;
			}
		}
	`,

	expandedContainer: css`
		height: calc(90vh - ${token.safeAreaInsetTop});
	`,

	header: css`
		flex-shrink: 0;
		position: relative;
		transition: all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);

		/* Expanded state */
		.expanded & {
			height: 52px;
			padding: 10px 16px;
			border-bottom: 1px solid rgba(28, 29, 35, 0.08);
			background: white;
			display: flex;
			align-items: center;
			justify-content: space-between;
		}

		/* Collapsed state - full container becomes the ball */
		.collapsed & {
			display: none;
		}
	`,

	headerContent: css`
		transition: all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);

		/* Expanded state */
		.expanded & {
			display: flex;
			align-items: center;
			gap: 30px;
			width: 100%;
		}
	`,

	recordingInfo: css`
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 130px;
		transition: all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);

		/* Collapsed state - show as ball indicator */
		.collapsed & {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 100%;
			height: 100%;
		}
	`,

	microphoneIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 8px;
		padding: 3px;
		background: linear-gradient(
			121deg,
			#33d6c0 -11.13%,
			#5083fb 14.12%,
			#336df4 39.36%,
			#4752e6 64.61%,
			#8d55ed 89.85%
		);
		transition: all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);

		/* Expanded state */
		.expanded & {
			width: 30px;
			height: 30px;
		}

		/* Collapsed state - hide, use AudioVisualizer instead */
		.collapsed & {
			display: none;
		}
	`,

	microphoneIconCollapsed: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		background: linear-gradient(
			121deg,
			#33d6c0 -11.13%,
			#5083fb 14.12%,
			#336df4 39.36%,
			#4752e6 64.61%,
			#8d55ed 89.85%
		);
		border-radius: 8px;
	`,

	microphoneIconCollapsedAudioVisualizer: css`
		transform: scale(0.8);
		--line-color: white;
		--default-line-opacity: 1;
		--high-line-opacity: 1;
		--low-line-opacity: 1;
	`,

	recordingTextSection: css`
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		min-width: 0;
		transition: all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);

		/* Collapsed state - hide */
		.collapsed & {
			display: none;
		}
	`,

	recordingTitle: css`
		font-weight: 600;
		font-size: 14px;
		line-height: 20px;
		color: rgba(28, 29, 35, 0.8);
		margin: 0;
		white-space: nowrap;
	`,

	recordingStatus: css`
		display: flex;
		align-items: center;
		gap: 4px;
		transition: all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);

		/* Collapsed state - show as main indicator */
		.collapsed & {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 100%;
			height: 100%;
			gap: 2px;

			/* White visualizer bars in collapsed state */
			& > div > div {
				background: white !important;
				animation: audioWaveWhite 2.2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
			}

			/* Hide duration text in collapsed state */
			& span {
				display: none;
			}

			@keyframes audioWaveWhite {
				0%,
				100% {
					transform: scaleY(0.6);
					background: rgba(255, 255, 255, 0.7) !important;
				}
				50% {
					transform: scaleY(1.2);
					background: white !important;
				}
			}
		}
	`,

	durationText: css`
		font-family: "Inter", sans-serif;
		font-weight: 400;
		font-size: 12px;
		line-height: 16px;
		color: rgba(28, 29, 35, 0.8);
	`,

	cancelButton: css`
		background: #fff0eb;
		border: none;
		border-radius: 8px;
		padding: 6px 8px;
		height: 32px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 2px;

		font-size: 12px;
		line-height: 16px;
		color: #ff4d3a;
		transition: all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);
		white-space: nowrap;

		/* Collapsed state - hide content */
		.collapsed & {
			display: none;
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.5;
		}

		&:hover:not(:disabled) {
			background: rgba(255, 77, 58, 0.1);
		}

		&:active {
			transform: scale(0.98);
		}
	`,

	minimizeButton: css`
		background: transparent;
		border: none;
		border-radius: 4px;
		width: 24px;
		height: 24px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: rgba(28, 29, 35, 1);
		transition: all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);

		&:hover {
			background: rgba(28, 29, 35, 0.05);
		}

		&:active {
			transform: scale(0.98);
		}

		/* Collapsed state - hide */
		.collapsed & {
			display: none;
		}
	`,

	actionButtonWrapper: css`
		padding: 0 12px;
		height: 32px;
		border-bottom: 1px solid ${token.colorBorder};
	`,

	content: css`
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
		transition: all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);

		/* Collapsed state - hide */
		.collapsed & {
			display: none;
		}
	`,

	messagesContainer: css`
		flex: 1;
		overflow-y: auto;
		padding: 20px; /* Add bottom padding for footer */
		display: flex;
		flex-direction: column;
		gap: 20px;
		position: relative;

		/* Custom scrollbar */
		&::-webkit-scrollbar {
			width: 4px;
		}

		&::-webkit-scrollbar-track {
			background: transparent;
		}

		&::-webkit-scrollbar-thumb {
			background: rgba(46, 47, 56, 0.13);
			border-radius: 100px;
		}
	`,

	messageItem: css`
		display: flex;
		flex-direction: column;
		gap: 4px;
		width: 100%;
	`,

	messageHeader: css`
		display: flex;
		align-items: flex-start;
		gap: 14px;
	`,

	speaker: css`
		font-size: 12px;
		line-height: 16px;
		color: rgba(28, 29, 35, 0.8);
		white-space: nowrap;
	`,

	timestamp: css`
		font-size: 12px;
		line-height: 16px;
		color: ${token.magicColorUsages.text[1]};
		white-space: nowrap;
	`,

	messageText: css`
		font-size: 14px;
		line-height: 20px;
		color: #1c1d23;
		margin: 0;
		word-break: break-word;
	`,

	streamLoading: css`
		transform: translateY(-2px);
	`,

	gradientOverlay: css`
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 40px;
		background: linear-gradient(to bottom, #ffffff 0%, rgba(255, 255, 255, 0) 100%);
		pointer-events: none;
		z-index: 1;
	`,

	scrollIndicator: css`
		position: absolute;
		right: 3px;
		top: 72px;
		width: 4px;
		height: 100px;
		background: rgba(46, 47, 56, 0.13);
		border-radius: 100px;
	`,

	errorContainer: css`
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 40px 20px;
	`,

	retryButton: css`
		background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
		border: none;
		border-radius: 8px;
		padding: 10px 20px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 8px;

		font-weight: 600;
		font-size: 14px;
		line-height: 20px;
		color: white;
		transition: all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);

		&:hover {
			transform: translateY(-1px);
			box-shadow: 0 4px 12px rgba(63, 143, 255, 0.3);
		}

		&:active {
			transform: scale(0.98);
		}
	`,
	editorHeader: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		padding: 10px 16px;
		border-bottom: 1px solid ${token.colorBorder};
	`,

	aiChatTitleIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 8px;
		background: linear-gradient(
			121deg,
			#33d6c0 -11.13%,
			#5083fb 14.12%,
			#336df4 39.36%,
			#4752e6 64.61%,
			#8d55ed 89.85%
		);
	`,

	editorTitleIcon: css`
		display: flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
		border-radius: 8px;
	`,

	editorTitleText: css`
		color: ${token.magicColorUsages.text[1]};
		font-size: 14px;
		font-weight: 600;
		line-height: 20px;
	`,
	editorBody: css`
		height: calc(100% - 40px - 28px);
	`,

	aiChatContainer: css`
		height: 80vh;
		display: flex;
		flex-direction: column;
	`,

	closeButton: css`
		border: none;
		border-radius: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		transition: all 0.2s;
		background: transparent;

		&:hover {
			background: rgba(46, 47, 56, 0.05);
		}

		&:active {
			transform: scale(0.98);
		}
	`,

	editor: css`
		flex: 1;

		&& {
			height: 80vh;
		}

		width: 100%;
		overflow-y: auto;

		.ProseMirror {
			--editor-font-base: 14px;
		}
	`,

	footer: css`
		flex-shrink: 0;
		padding: 30px 10px;
		background: white;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		transition: all 0.6s cubic-bezier(0.25, 0.1, 0.25, 1);

		/* Collapsed state - hide */
		.collapsed & {
			display: none;
		}
	`,

	actionButton: css`
		flex: 1;
		height: 40px;
		background: white;
		border: 1px solid rgba(28, 29, 35, 0.08);
		border-radius: 1000px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		cursor: pointer;
		transition: all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);

		font-weight: 600;
		font-size: 14px;
		line-height: 20px;
		color: #1c1d23;

		&:hover:not(:disabled) {
			background: rgba(28, 29, 35, 0.05);
		}

		&:active {
			transform: scale(0.98);
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.8;
		}
	`,

	summarizeButton: css`
		position: absolute;
		left: 50%;
		transform: translateX(-50%);
		width: 80px;
		height: 80px;
		background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
		border: none;
		border-radius: 1000px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		color: white;
		transition: all 0.25s cubic-bezier(0.25, 0.1, 0.25, 1);

		&:hover:not(:disabled) {
			background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
		}

		&:disabled {
			cursor: not-allowed;
			opacity: 0.8;
		}
	`,

	summarizeButtonText: css`
		font-weight: 600;
		font-size: 18px;
		line-height: 24px;
		color: white;
		margin: 0;
	`,

	/* Special collapsed state audio visualizer */
	collapsedAudioVisualizer: css`
		/* Only show in collapsed state */
		.expanded & {
			display: none;
		}

		.collapsed & {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 24px;
			height: 24px;
			padding: 3px;
			border-radius: 8px;
		}
	`,
	popupContainer: css`
		height: calc(90vh - ${token.safeAreaInsetBottom} - ${token.safeAreaInsetTop});
	`,
}))
