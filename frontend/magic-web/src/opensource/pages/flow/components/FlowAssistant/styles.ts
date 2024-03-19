import { createStyles } from "antd-style"

const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		flowAssistant: css`
			position: fixed !important;
			z-index: 1000;
			max-height: 80vh !important;
			box-shadow: ${token.boxShadowSecondary};
			border-radius: 12px;
			overflow: hidden;
			background-color: ${token.colorBgContainer};
			border: 1px solid ${token.colorBorderSecondary};
		`,
		card: css`
			display: flex;
			flex-direction: column;
			height: 100%;
			overflow: hidden;
			border-radius: 12px;
			box-shadow: none;
			border: none;

			.${prefixCls}-card-head {
				padding: 12px 16px;
				border-bottom: 1px solid ${token.colorBorderSecondary};
				min-height: auto;
			}

			.${prefixCls}-card-body {
				flex: 1;
				overflow: hidden;
				display: flex;
				flex-direction: column;
				padding: 12px 16px !important;
			}
		`,
		titleContainer: css`
			display: flex;
			align-items: center;
			width: 100%;
			height: 100%;
			cursor: move;
			user-select: none;
		`,
		messageList: css`
			flex: 1;
			overflow-y: auto;
			padding: 4px 16px;
			margin-bottom: 12px;
			height: calc(100% - 48px - 60px);

			&::-webkit-scrollbar {
				width: 6px;
			}

			&::-webkit-scrollbar-thumb {
				background-color: ${token.colorTextQuaternary};
				border-radius: 3px;
			}

			&::-webkit-scrollbar-track {
				background-color: transparent;
			}
		`,
		messageContainer: css`
			flex: 1;
			overflow-y: auto;
			padding: 4px 16px;
			margin-bottom: 12px;
			height: 80%;

			&::-webkit-scrollbar {
				width: 6px;
			}

			&::-webkit-scrollbar-thumb {
				background-color: ${token.colorTextQuaternary};
				border-radius: 3px;
			}

			&::-webkit-scrollbar-track {
				background-color: transparent;
			}

			.${prefixCls}-list-item {
				padding: 0;
				border-bottom: none !important;
			}
		`,
		inputArea: css`
			padding: 10px 16px;
			border-top: 1px solid ${token.colorBorderSecondary};
			background-color: ${token.colorBgContainer};
			height: 60px;
		`,
		inputWrapper: css`
			display: flex;
			align-items: center;

			.${prefixCls}-input {
				background-color: ${token.colorFillQuaternary};
				border-radius: 8px;
				border-color: ${token.colorBorderSecondary};

				&:hover,
				&:focus {
					border-color: ${token.colorPrimary};
				}
			}
		`,
		sendIcon: css`
			color: ${token.colorPrimary};
			cursor: pointer;

			&:hover {
				color: ${token.colorPrimaryHover};
			}
		`,
		messageContentWrapper: css`
			width: 100%;
		`,
		confirmButtonsContainer: css`
			margin-top: 12px;
			display: flex;
			justify-content: flex-start;
		`,
		userMessageItem: css`
			width: 100%;
			display: flex;
			justify-content: flex-end;
		`,
		userMessageRow: css`
			display: flex;
			align-items: flex-start;
			justify-content: flex-end;
			padding: 8px 0;
			max-width: 90%;
		`,
		assistantMessageItem: css`
			display: flex;
			justify-content: flex-start;
			width: 100%;
		`,
		assistantMessageRow: css`
			display: flex;
			align-items: flex-start;
			justify-content: flex-start;
			padding: 8px 0;
			max-width: 90%;
		`,
		commandStatusContainer: css`
			margin-top: 12px;
			border-top: 1px dashed ${token.colorBorderSecondary};
			padding-top: 8px;
		`,
		commandStatusItem: css`
			display: flex;
			align-items: center;
			padding: 4px 0;
			font-size: 13px;
		`,
		executing: css`
			color: ${token.colorPrimary};
		`,
		completed: css`
			color: ${token.colorSuccess};
		`,
		failed: css`
			color: ${token.colorError};
		`,
		messageItem: css`
			margin-bottom: 8px;
			border-radius: 12px;
			overflow: hidden;
			padding: 2px 0;
		`,
		messageRow: css`
			display: flex;
			align-items: flex-start;
			padding: 8px 12px;
			border-radius: 8px;
			max-width: 90%;
		`,
		messageContent: css`
			flex: 1;
			white-space: pre-wrap;
			word-break: break-word;
			min-width: 0;
			font-size: 14px;
			line-height: 1.6;
			padding: 8px 12px;
			border-radius: 8px;

			pre {
				background-color: ${token.colorFillTertiary};
				padding: 12px;
				border-radius: 8px;
				overflow-x: auto;
				margin: 8px 0;
				border: 1px solid ${token.colorBorderSecondary};
			}

			code {
				font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace;
				font-size: 0.9em;
				background-color: ${token.colorFillQuaternary};
				padding: 2px 4px;
				border-radius: 4px;
			}

			p {
				margin-bottom: 8px;
				margin-top: 0;
			}

			ul,
			ol {
				margin-bottom: 8px;
				padding-left: 20px;
			}
		`,
		avatar: css`
			flex-shrink: 0;
			margin-right: 12px;
			margin-top: 2px;
			width: 32px !important;
			height: 32px !important;
			border-radius: 6px;
			overflow: hidden;
			border: 1px solid ${token.colorBorderSecondary};
		`,
		userAvatar: css`
			flex-shrink: 0;
			margin-right: 0;
			margin-left: 12px;
			margin-top: 2px;
			width: 32px !important;
			height: 32px !important;
			border-radius: 6px;
			overflow: hidden;
			border: 1px solid ${token.colorBorderSecondary};
		`,
		inputContainer: css`
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 0;
			margin-top: auto;

			.${prefixCls}-input {
				background-color: ${token.colorFillQuaternary};
				border-radius: 8px;
				border-color: ${token.colorBorderSecondary};

				&:hover,
				&:focus {
					border-color: ${token.colorPrimary};
				}
			}

			.${prefixCls}-btn {
				height: 36px;
				width: 36px;
				padding: 0;
				display: flex;
				align-items: center;
				justify-content: center;
				border-radius: 8px;
			}

			textarea {
				flex: 1;
				padding: 8px 12px;
				min-height: 36px;
				border-radius: 8px;
			}
		`,
		closeIcon: css`
			color: ${token.colorTextSecondary};

			&:hover {
				color: ${token.colorText};
			}
		`,
		user: css`
			background-color: ${token.colorFillQuaternary};
		`,
		assistant: css`
			background-color: ${token.colorInfoBg};
		`,
		resizeHandle: css`
			position: absolute;
			background-color: transparent;
			transition: background-color 0.2s;

			&:hover {
				background-color: ${token.colorPrimary}30;
			}
		`,
		resizeCornerHandle: css`
			position: absolute;
			background-color: transparent;
			border-radius: 50%;
			transition: background-color 0.2s;

			&:hover {
				background-color: ${token.colorPrimary}30;
			}
		`,
		errorMessageWrapper: css`
			display: flex;
			justify-content: space-between;
			align-items: center;
			width: 100%;
		`,
		errorText: css`
			color: ${token.colorError};
		`,
		retryButton: css`
			margin-left: 12px;
			font-size: 18px;
			color: ${token.colorError};
			align-self: center;
			&:hover {
				background-color: ${token.colorErrorBg};
			}
		`,
	}
})

export default useStyles
export { useStyles }
