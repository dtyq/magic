import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, isDarkMode }) => {
	// 为语法高亮定义主题色
	const syntaxColors = {
		keyword: token.colorPrimaryText || "#9c27b0",
		string: token.colorSuccess,
		comment: token.colorTextQuaternary,
		function: token.colorPrimary,
		variable: token.colorError,
		number: token.colorWarning,
		operator: token.colorInfo,
		property: token.colorWarningText,
	}

	// Mac终端的主要颜色 - 白色主题
	const macColors = {
		background: "#FFFFFF",
		text: "#333333",
		promptColor: "#0A8A0A",
		titleBar: "#E8E8E8",
		titleBarButtons: {
			close: "#FF5F56",
			minimize: "#FFBD2E",
			maximize: "#27C93F",
		},
	}

	const macDarkColors = {
		background: "#1E1E1E",
		text: "#FFFFFF",
		promptColor: "#0A8A0A",
		titleBar: "#333333",
		titleBarButtons: {
			close: "#FF5F56",
			minimize: "#FFBD2E",
			maximize: "#27C93F",
		},
	}

	return {
		terminalContainer: css`
			overflow: hidden;
			height: 100%;
			min-height: 0;
			min-width: 0;
			display: flex;
			flex-direction: column;
			box-sizing: border-box;
			background-color: ${token.colorBgContainer};
			color: ${token.colorText};
		`,

		toolbar: css`
			/* 仅终端采用常规操作尺寸；共享标题栏的其它消费者保留原默认值。 */
			--detail-action-font-size: 14px;
			--detail-action-line-height: 20px;
			--detail-action-height: 32px;
			--detail-action-gap: 6px;
			display: flex;
			align-items: center;
			flex-shrink: 0;
			min-height: 52px;
			padding: 10px 16px;
			border-bottom: 1px solid ${token.colorBorderSecondary};
			background-color: ${token.colorBgContainer};
			user-select: none;
			font-weight: 400;
			-webkit-user-select: none;

			@media (pointer: coarse) {
				--detail-action-height: 44px;
			}
		`,

		title: css`
			display: inline-flex;
			align-items: center;
			gap: 8px;
			font-size: 16px;
			line-height: 24px;
			font-weight: 500;
			cursor: default;
		`,

		readOnly: css`
			font-size: 12px;
			font-weight: 400;
			color: ${token.colorTextSecondary};

			@media (max-width: 440px) {
				display: none;
			}
		`,

		terminalContent: css`
			flex: 1;
			overflow: hidden;
			min-height: 0;
		`,

		switchButton: css`
			padding: 0 10px;
			height: 24px;
			border: none;
			border-radius: 4px;
			font-size: 14px;
			cursor: pointer;
			background-color: white;
			color: ${token.magicColorUsages.black};
			line-height: 24px;
			user-select: none;
		`,
		active: css`
			background-color: transparent;
			color: ${token.magicColorUsages.text[2]};
		`,

		terminalHeader: css`
			height: 36px;
			background-color: ${isDarkMode ? macDarkColors.titleBar : macColors.titleBar};
			display: flex;
			align-items: center;
			padding: 0 12px;
			border-top-left-radius: ${token.borderRadiusLG}px;
			border-top-right-radius: ${token.borderRadiusLG}px;
			user-select: none;
		`,

		windowButtons: css`
			display: flex;
			gap: 8px;
			margin-right: 12px;
		`,

		windowButton: css`
			width: 12px;
			height: 12px;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
		`,

		closeButton: css`
			background-color: ${
				isDarkMode ? macDarkColors.titleBarButtons.close : macColors.titleBarButtons.close
			};
		`,

		minimizeButton: css`
			background-color: ${
				isDarkMode
					? macDarkColors.titleBarButtons.minimize
					: macColors.titleBarButtons.minimize
			};
		`,

		maximizeButton: css`
			background-color: ${
				isDarkMode
					? macDarkColors.titleBarButtons.maximize
					: macColors.titleBarButtons.maximize
			};
		`,

		titleText: css`
			color: #666666;
			font-size: 13px;
			flex: 1;
			text-align: center;
			margin-left: -36px; /* 标题居中 */
		`,

		terminalBody: css`
			// padding: 12px 16px;
			overflow: hidden auto;
			flex: auto;
			background-color: ${isDarkMode ? macDarkColors.background : macColors.background};
			color: ${isDarkMode ? macDarkColors.text : macColors.text};
			position: relative;

			/* 自定义滚动条样式 */
			&::-webkit-scrollbar {
				width: 6px;
				height: 6px;
			}

			&::-webkit-scrollbar-track {
				background: rgba(0, 0, 0, 0.04);
				border-radius: ${token.borderRadiusSM}px;
			}

			&::-webkit-scrollbar-thumb {
				background: rgba(0, 0, 0, 0.12);
				border-radius: ${token.borderRadiusSM}px;
			}

			&::-webkit-scrollbar-thumb:hover {
				background: rgba(0, 0, 0, 0.18);
			}
		`,

		commandSection: css`
			padding: 4px 0;
			margin-bottom: 8px;
		`,

		commandText: css`
			color: ${isDarkMode ? macDarkColors.text : macColors.text};
			font-weight: 400;
			margin-bottom: 4px;
			font-size: 14px;
		`,

		promptSymbol: css`
			color: ${isDarkMode ? macDarkColors.promptColor : macColors.promptColor};
			margin-right: 8px;
			user-select: none;
			font-weight: bold;
		`,

		statusBadge: css`
			display: inline-block;
			border-radius: ${token.borderRadiusLG}px;
			font-size: ${token.fontSizeSM}px;
			background-color: ${token.colorSuccessBg};
			color: ${token.colorSuccessText};

			&.error {
				background-color: ${token.colorErrorBg};
				color: ${token.colorErrorText};
			}

			&.running {
				background-color: ${token.colorInfoBg};
				color: ${token.colorInfoText};
			}
		`,

		lineNumber: css`
			color: rgba(0, 0, 0, 0.3);
			min-width: 30px;
			user-select: none;
			text-align: right;
			padding-right: 10px;
		`,

		codeLine: css`
			margin-left: ${token.marginSM}px;
			flex: 1;
		`,

		exitCode: css`
			margin-top: ${token.margin}px;
			font-size: ${token.fontSizeSM}px;
			color: rgba(0, 0, 0, 0.65);
			border-radius: ${token.borderRadiusSM}px;
			display: inline-block;
		`,

		exitCodeSuccess: css`
			color: #2a9d58;
		`,

		exitCodeError: css`
			color: #d84a32;
		`,

		outputSection: css`
			white-space: pre-wrap;
			word-break: break-all;
			line-height: 1.5;
			border-radius: ${token.borderRadiusSM}px;
			font-size: 14px;
			padding: 4px 0;

			.output-line {
				padding: 2px 0;
				display: flex;
				flex-wrap: wrap;
			}

			.output-line:not(:last-child) {
				margin-bottom: 2px;
			}

			/* 语法高亮颜色，使用白色背景下的配色 */
			.keyword {
				color: #7b2f9d;
			}

			.string {
				color: #2e8744;
			}

			.comment {
				color: #777777;
				font-style: italic;
			}

			.function {
				color: #2f6ea6;
			}

			.variable {
				color: #c0392b;
			}

			.number {
				color: #d56c00;
			}

			.operator {
				color: #0e8a8a;
			}

			.property {
				color: #a66300;
			}
		`,
	}
})
