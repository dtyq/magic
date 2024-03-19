import { createStyles } from "antd-style"
import { COLLAPSED, EXPANDED, SIZES } from "../../constants"

export const useStyles = createStyles(({ token, css, prefixCls }) => {
	// 样式片段函数
	const expandedChildrenStyles = `
		.recording-messages {
			opacity: 1;
			transform: translateY(0);
			visibility: visible;
		}

		.recording-footer {
			opacity: 1;
			height: ${SIZES.FOOTER_HEIGHT}px;
			padding: 10px;
			transform: translateY(0);
			visibility: visible;
		}

		.recording-scrollbar {
			opacity: 1;
			visibility: visible;
		}

		.recording-header {
			border-radius: 12px;
		}
	`

	const collapsedChildrenStyles = `
		.recording-messages {
			opacity: 0;
			max-height: 0;
			padding-top: 0;
			padding-bottom: 0;
			transform: translateY(-10px);
			visibility: hidden;
		}

		.recording-footer {
			opacity: 0;
			height: 0;
			padding: 0;
			transform: translateY(10px);
			visibility: hidden;
		}

		.recording-scrollbar {
			opacity: 0;
			visibility: hidden;
		}

		.recording-header {
			border-radius: 12px;
		}
	`

	const expandAnimationStyles = `
		.recording-messages {
			transition: all 0.3s ease-out 0.1s;
		}

		.recording-footer {
			transition: all 0.3s ease-out 0.15s;
		}

		.recording-scrollbar {
			transition: opacity 0.3s ease-out 0.2s;
		}

		.recording-header {
			transition: border-radius 0.3s ease-out;
		}
	`

	const collapseAnimationStyles = `
		.recording-messages {
			transition: all 0.25s ease-in;
		}

		.recording-footer {
			transition: all 0.01s ease-in;
		}

		.recording-scrollbar {
			transition: opacity 0.2s ease-in;
		}

		.recording-header {
			transition: border-radius 0.25s ease-in 0.1s;
		}
	`

	const totalHeight = `${EXPANDED.height} - 20px`
	const expandedWidth =
		typeof EXPANDED.width === "string"
			? `${EXPANDED.width} - 20px`
			: `${EXPANDED.width}px - 20px`
	const expandedMaxWidth =
		typeof EXPANDED.maxWidth === "string"
			? `${EXPANDED.maxWidth} - 20px`
			: `${EXPANDED.maxWidth}px - 20px`

	return {
		shadow: css`
			position: fixed;
			bottom: 0;
			z-index: 219;
			width: 100%;
			height: 100%;
			background: linear-gradient(
				0deg,
				rgba(255, 255, 255, 0.6) 0%,
				rgba(255, 255, 255, 0.6) 70%,
				transparent 100%
			);

			animation: shadowAnimation 0.3s ease-out;

			@keyframes shadowAnimation {
				0% {
					opacity: 0;
				}
				100% {
					opacity: 1;
				}
			}
		`,
		container: css`
			position: fixed;
			z-index: 220;
			transition: all 0.3s ease-out;
			transform-origin: top left;
			/* overflow: hidden; */
			height: ${COLLAPSED.height}px;
			box-sizing: border-box;

			&.enter-animation {
				animation: enterAnimation 0.3s ease-out;
			}

			&.expanded {
				border-radius: 12px;
				height: calc(${totalHeight});
				left: 10px;
				top: 10px;
			}

			@keyframes enterAnimation {
				0% {
					transform: translateY(100vh);
				}
				100% {
					transform: translateY(0);
				}
			}
		`,

		dragging: css`
			cursor: grabbing;
			transition: box-shadow 0.2s ease;
		`,

		panelLeft: css`
			flex: 1;
			overflow-y: hidden !important;
			padding: 10px 20px;
			display: flex;
			flex-direction: column;
			gap: 20px;
			position: relative;
		`,

		divider: css`
			width: 1px;
			height: 100%;
			background: ${token.colorBorder};
			margin: 0 10px;
		`,

		editorContainer: css`
			height: 100%;
			width: 100%;
		`,

		editorTitle: css`
			height: 40px;
			padding: 10px;
			box-sizing: border-box;
			width: 100%;
		`,

		editorTitleIcon: css`
			display: flex;
			align-items: center;
			justify-content: center;
			width: 20px;
			height: 20px;
			background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
			border-radius: 4px;
		`,

		editorTitleText: css`
			color: ${token.magicColorUsages.text[0]};
			font-size: 14px;
			font-weight: 600;
			line-height: 20px;
		`,

		editorTitleTip: css`
			color: ${token.magicColorUsages.text[3]};
			text-align: right;
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
		`,

		editorBody: css`
			height: calc(100% - 40px - 28px);
		`,

		editorFooter: css`
			width: 100%;
			padding: 6px 12px;
			height: 28px;
			border-top: 1px solid ${token.colorBorder};
		`,

		editorFooterChar: css`
			color: ${token.magicColorUsages.text[1]};
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
		`,

		editorFooterTip: css`
			color: ${token.magicColorUsages.text[3]};
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
		`,

		editor: css`
			flex: 1;
			padding: 10px;
			height: calc(100% - 40px - 28px);
			width: 100%;
			overflow-y: auto;

			.ProseMirror {
				--editor-font-base: 14px;
			}
		`,

		// 统一的内容容器
		content: css`
			/* box-shadow: 0px 4px 14px 0px rgba(0, 0, 0, 0.1), 0px 0px 1px 0px rgba(0, 0, 0, 0.3); */
			/* overflow: hidden; */
			transition: none;

			transform-origin: top left;
			position: relative;

			&.animation {
				transition: all 0.3s ease-out;
			}
		`,
		contentSplitter: css`
			> .${prefixCls}-splitter-bar {
				width: 10px;
			}
		`,
		contentLeft: css`
			flex: 1 !important;
			background: ${token.colorBgContainer};
			display: flex;
			flex-direction: column;
			border-radius: 12px;
			box-shadow:
				0 4px 14px 0 rgba(0, 0, 0, 0.1),
				0 0 1px 0 rgba(0, 0, 0, 0.3);
			flex: 1 !important;
		`,

		contentRight: css`
			background: ${token.colorBgContainer};
			display: flex;
			flex-direction: column;
			border-radius: 12px;
			box-shadow:
				0 4px 14px 0 rgba(0, 0, 0, 0.1),
				0 0 1px 0 rgba(0, 0, 0, 0.3);
		`,

		// === 精简后的样式定义 ===
		expanded: css`
			width: calc(${expandedWidth});
			max-width: calc(${expandedMaxWidth});
			height: calc(${totalHeight});
			transform-origin: top left;
			animation: none;
			${expandedChildrenStyles}
			${expandAnimationStyles}

		@keyframes expandDown {
				0% {
					width: ${COLLAPSED.width}px;
				}
				100% {
					width: calc(${expandedWidth});
				}
			}

			&.animation {
				animation: expandDown 0.3s ease-out;
			}
		`,

		collapsed: css`
			width: ${COLLAPSED.width}px;
			height: auto;
			transform-origin: top left;
			${collapsedChildrenStyles}
			${collapseAnimationStyles}

		@keyframes collapse {
				0% {
					width: calc(${expandedWidth});
				}
				100% {
					width: ${COLLAPSED.width}px;
				}
			}

			&.animation {
				animation: collapse 0.25s ease-in;
			}
		`,

		// 头部区域
		header: css`
			border-radius: 12px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			transition: border-radius 0.3s ease-out;
			flex-shrink: 0;
		`,

		recordingInfo: css`
			display: flex;
			align-items: center;
			gap: 10px;
		`,
		projectSelectorButton: css`
			border: none;
			border-radius: 8px;
			padding: 4px;
			cursor: pointer;
			display: flex;
			align-items: center;
		`,

		toggleButton: css`
			border: none;
			border-radius: 8px;
			padding: 4px;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: all 0.2s ease-out;
			transform-origin: center;
			background: transparent;
			white-space: nowrap;

			color: ${token.magicColorUsages.text[1]};

			font-size: 12px;
			font-weight: 400;
			line-height: 16px;

			&:hover {
				background: rgba(46, 47, 56, 0.1);
			}

			&:active {
				transform: scale(0.98);
			}

			&.left-divider {
				position: relative;
				&::before {
					content: "";
					position: absolute;
					left: -10px;
					top: 50%;
					transform: translateY(-50%);
					width: 1px;
					height: 90%;
					background: ${token.colorBorder};
				}
			}
		`,

		microphoneIcon: css`
			display: flex;
			align-items: center;
			padding: 3px;
			border-radius: 4px;
			color: white;
			background: linear-gradient(
				121deg,
				#33d6c0 -11.13%,
				#5083fb 14.12%,
				#336df4 39.36%,
				#4752e6 64.61%,
				#8d55ed 89.85%
			);
		`,

		recordingText: css`
			font-weight: 600;
			font-size: 14px;
			line-height: 20px;
			color: rgba(28, 29, 35, 0.8);
			white-space: nowrap;
		`,

		controlsArea: css`
			display: flex;
			align-items: center;
			gap: 20px;
		`,

		cancelButton: css`
			background: ${token.magicColorUsages.danger.default};
			color: white;
			border-radius: 50%;
			border: 1px solid rgba(28, 29, 35, 0.01);
			padding: 4px;
			height: 20px;
			width: 20px;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 2px;
			font-size: 12px;
			line-height: 16px;
			white-space: nowrap;

			transition: all 0.2s ease-out;
			transform-origin: center;

			&:active {
				transform: scale(0.98);
			}

			&:disabled {
				cursor: not-allowed;
				opacity: 0.5;
			}
		`,

		primaryButton: css`
			border: 1px solid transparent;
			border-radius: 8px;
			background:
				linear-gradient(${token.colorBgContainer}, ${token.colorBgContainer}) padding-box,
				linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%) border-box;
			padding: 6px 8px;
			cursor: pointer;
			display: flex;
			align-items: center;

			&:hover {
				background:
					linear-gradient(${token.colorBgContainer}, ${token.colorBgContainer})
						padding-box,
					linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%) border-box;
			}
		`,

		primaryButtonText: css`
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
			background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
			background-clip: text;
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
		`,

		errorContainer: css`
			width: 100%;
			display: flex;
			height: 32px;
			padding: 6px 12px;
			justify-content: space-between;
			align-items: center;
			align-self: stretch;
			border-bottom: 1px solid ${token.colorBorder};
			background: ${token.magicColorUsages.warningLight.default};
			color: ${token.magicColorUsages.warning.default};
			cursor: pointer;

			font-size: 12px;
			font-weight: 400;
			line-height: 16px;
		`,

		// 消息容器 - 可动画的
		messagesContainer: css`
			flex: 1;
			overflow-y: hidden;
			/* max-height: ${SIZES.MESSAGE_MAX_HEIGHT}px; */
			height: 100%;
			transition: all 0.3s ease-out;
			transform-origin: top;

			> .${prefixCls}-splitter-bar {
				border-left: 1px solid ${token.colorBorder};
			}
		`,

		message: css`
			display: flex;
			flex-direction: column;
			gap: 4px;
			opacity: 0;
			transform: translateY(10px);
			animation: messageSlideIn 0.3s ease-out forwards;

			@keyframes messageSlideIn {
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

		messageHeader: css`
			display: flex;
			align-items: flex-start;
			gap: 14px;
			font-size: 12px;
			line-height: 16px;
		`,

		speaker: css`
			color: rgba(28, 29, 35, 0.8);
		`,

		messageText: css`
			color: ${token.magicColorUsages.text[0]};
			font-size: 14px;
			font-weight: 400;
			line-height: 20px;
		`,

		messageContent: css`
			font-size: 14px;
			line-height: 20px;
			color: #1c1d23;
			height: calc(${totalHeight} - 46px);
			cursor: text;
			overflow-y: auto;
			padding: 10px 10px 80px 10px;
			white-space: pre-wrap;
			position: relative;

			&::-webkit-scrollbar {
				width: 6px;
			}

			&::-webkit-scrollbar-thumb {
				background: rgba(46, 47, 56, 0.13);
				border-radius: 100px;
			}

			&::-webkit-scrollbar-track {
				background: transparent;
			}
		`,

		// 底部区域 - 可动画的
		footer: css`
			height: ${SIZES.FOOTER_HEIGHT}px;
			background: linear-gradient(to top, white, transparent);
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 10px;
			border-radius: 0 0 12px 12px;
			transition: all 0.3s ease-out;
			transform-origin: bottom;
			flex-shrink: 0;
			position: absolute;
			bottom: 0;
			width: calc(100% - 20px);
		`,

		completeButton: css`
			border-radius: 1000px;
			padding: 8px 20px;
			cursor: pointer;
			display: flex;
			align-items: center;
			gap: 4px;
			font-weight: 600;
			font-size: 14px;
			line-height: 20px;
			color: #ffffff;
			transition: all 0.2s ease-out;
			transform-origin: center;
			border-radius: 1000px;
			background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
			border: none;

			&:hover {
				box-shadow:
					0 4px 14px 0 rgba(0, 0, 0, 0.1),
					0 0 1px 0 rgba(0, 0, 0, 0.3);
			}

			&:active {
				transform: scale(0.98);
			}
		`,

		// 收起状态的特殊样式
		collapsedControls: css`
			display: flex;
			align-items: center;
			gap: 10px;
			width: 100%;
			border-radius: 12px;
			padding: 8px;
			border: none;
		`,

		collapsedControlsExpanded: css`
			padding: 10px 10px 10px 20px;
			border-bottom-left-radius: 0;
			border-bottom-right-radius: 0;
			border-bottom: 1px solid ${token.colorBorder};
		`,

		collapsedLeft: css`
			display: flex;
			align-items: center;
			gap: 10px;
			flex-shrink: 0;
		`,

		collapsedRight: css`
			display: flex;
			align-items: center;
			gap: 20px;
			margin-left: auto;
			overflow-x: auto;
			justify-content: flex-end;
			flex: 1;
		`,

		// Fullscreen styles
		fullscreen: css`
			position: fixed !important;
			top: 0 !important;
			left: 0 !important;
			width: calc(100vw - 20px) !important;
			height: calc(100vh - 20px) !important;
			margin: 10px !important;
			max-width: none !important;
			max-height: none !important;
			z-index: 230;
			transform: none !important;
			animation: none !important;
			border-radius: 12px !important;
			box-shadow:
				0 4px 14px 0 rgba(0, 0, 0, 0.1),
				0 0 1px 0 rgba(0, 0, 0, 0.3);

			.recording-header {
				border-radius: 0 !important;
			}

			.recording-messages {
				height: calc(100vh - 46px) !important;
				max-height: none !important;
			}
		`,

		fullscreenOverlay: css`
			position: fixed;
			top: 0;
			left: 0;
			width: 100vw;
			height: 100vh;
			background: rgba(0, 0, 0, 0.8);
			z-index: 219;
			animation: fadeIn 0.3s ease-out;

			@keyframes fadeIn {
				0% {
					opacity: 0;
				}
				100% {
					opacity: 1;
				}
			}
		`,

		fullscreenButton: css`
			border: none;
			border-radius: 8px;
			padding: 4px;
			cursor: pointer;
			display: flex;
			align-items: center;
			justify-content: center;
			transition: all 0.2s ease-out;
			background: transparent;
			white-space: nowrap;
			color: ${token.magicColorUsages.text[1]};
			font-size: 12px;
			font-weight: 400;
			line-height: 16px;

			&:hover {
				background: rgba(46, 47, 56, 0.1);
			}

			&:active {
				transform: scale(0.98);
			}
		`,
	}
})
