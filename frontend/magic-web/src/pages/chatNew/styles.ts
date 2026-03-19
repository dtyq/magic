import { createStyles } from "antd-style"
import { transparentize } from "polished"

export const useStyles = createStyles(({ css, isDarkMode, token }) =>
	/* { headerSize }: { headerSize?: { width: number; height: number } */
	{
		return {
			chat: css`
				width: 100%;
				height: 100%;
				background: ${token.magicColorScales.grey[0]};
				border-radius: 8px;
				border: 1px solid ${token.colorBorder};
				overflow: hidden;
			`,
			mainSplitterPanel: css`
				flex-grow: 1 !important;
			`,
			previewPanel: css`
				height: calc(100vh - ${token.titleBarHeight}px);
			`,
			splitter: css`
				height: calc(100vh - ${token.titleBarHeight}px);
			`,
			container: {
				width: "100%",
				minWidth: 375,
				height: `calc(100vh - ${token.titleBarHeight}px)`,
				flex: 1,
				margin: "0 0 24px",
				overflow: "hidden",
				position: "relative",
				display: "flex",
				"--message-max-width": "100%",
				userSelect: "none",
			},
			main: css`
				height: 100%;
				flex: 1;
				min-width: 375px;
			`,
			header: css``,
			chatList: css`
				overflow-x: hidden;
				flex: 1;
				min-height: 300px;
				height: 100%;
			`,
			editor: css`
				height: 100%;
			`,
			chatListInner: css``,
			magicInput: css`
				width: 100%;
				height: auto;
				overflow: visible !important;
			`,
			magicInputWrapperShadow: css`
				background: linear-gradient(
					to top,
					${isDarkMode ? "#141414" : token.magicColorUsages.white} 50%,
					rgba(255, 255, 255, 0) 100%
				);
			`,
			extra: css`
				border-left: 1px solid ${token.colorBorder};
				user-select: none;
				width: 240px;
			`,

			dragEnteredTipWrapper: css`
				width: 100%;
				height: 100%;
				padding: 20px;
				position: absolute;
				top: 0;
				left: 0;
				z-index: 10;
				backdrop-filter: blur(10px);
				background-color: ${transparentize(
					0.2,
					token.magicColorUsages.primaryLight.default,
				)};
			`,
			dragEnteredInnerWrapper: css`
				height: 100%;
				display: flex;
				justify-content: center;
				align-items: center;
				font-size: 12px;
				color: ${token.magicColorUsages.text[1]};
				border: 2px dashed ${token.magicColorUsages.text[3]};
				border-radius: 8px;
				text-align: center;
			`,
			dragEnteredMainTip: css`
				font-size: 20px;
				font-weight: 600;
				line-height: 28px;
			`,
			dragEnteredTip: css`
				color: ${token.magicColorUsages.text[2]};
				text-align: center;
				font-size: 14px;
				font-weight: 400;
				line-height: 20px;
			`,
			dragEnteredLoader: css`
				@keyframes spin {
					to {
						transform: rotate(360deg);
					}
				}
				animation: spin 0.8s infinite linear;
			`,
		}
	},
)
