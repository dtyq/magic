import { createStyles, useTheme } from "antd-style"
import { useMemo } from "react"
import type { ITheme } from "@xterm/xterm"

export const terminalTheme = {
	// One Dark theme colors from https://github.com/janoamaral/Xresources-themes
	background: "#1E2127",
	foreground: "#D6DAE2",
	cursor: "#5C6370",
	selectionBackground: "#3A3F4B",
	// ANSI colors
	black: "#1E2127",
	red: "#E06C75",
	green: "#98C379",
	yellow: "#D19A66",
	blue: "#61AFEF",
	magenta: "#C678DD",
	cyan: "#56B6C2",
	white: "#ABB2BF",
	// Bright ANSI colors
	brightBlack: "#5C6370",
	brightRed: "#E06C75",
	brightGreen: "#98C379",
	brightYellow: "#D19A66",
	brightBlue: "#61AFEF",
	brightMagenta: "#C678DD",
	brightCyan: "#56B6C2",
	brightWhite: "#FFFFFF",
} satisfies ITheme

export function useTerminalTheme(): ITheme {
	const { isDarkMode } = useTheme()
	return useMemo(
		() =>
			isDarkMode
				? { ...terminalTheme, background: "#1C2027" }
				: {
						...terminalTheme,
						background: "#F7F8FA",
						foreground: "#485464",
						cursor: "#485464",
						selectionBackground: "#BFDBFE",
						selectionForeground: "#172554",
						black: "#485464",
						red: "#C9333E",
						green: "#16824B",
						yellow: "#946200",
						blue: "#2563EB",
						magenta: "#9044B8",
						cyan: "#167D90",
						white: "#596775",
						brightBlack: "#737373",
						brightRed: "#C9333E",
						brightGreen: "#16824B",
						brightYellow: "#946200",
						brightBlue: "#2563EB",
						brightMagenta: "#9044B8",
						brightCyan: "#167D90",
						brightWhite: "#485464",
					},
		[isDarkMode],
	)
}

export const useStyles = createStyles(({ css, token, isDarkMode }) => {
	return {
		terminalDisplay: css`
			width: 100%;
			height: 100%;
			flex: 1;
			min-width: 0;
			min-height: 0;
			display: flex;
			flex-direction: column;
			overflow: hidden;
			background-color: ${token.colorBgContainer};
			color: ${token.colorText};
		`,
		terminalBody: css`
			flex: 1;
			min-width: 0;
			min-height: 0;
			position: relative;
			overflow: hidden;
			box-sizing: border-box;
			background-color: ${isDarkMode ? "#1C2027" : "#F7F8FA"};
		`,
		detailView: css`
			/* 详情正文采用主文字色；ANSI 显式颜色仍由原有 decoration 保留。 */
			& .monaco-editor .view-lines .mtk1 {
				color: ${token.colorText};
			}
			& .monaco-editor .line-numbers {
				color: ${token.colorTextSecondary};
				font-size: 12px;
			}
		`,
		outputEditor: css`
			width: 100%;
			height: 100%;
			/* 只调整当前输出视图的底色，不注册全局 Monaco 主题影响其它文件编辑器。 */
			& .monaco-editor,
			& .monaco-editor-background,
			& .margin {
				background-color: ${isDarkMode ? "#1C2027" : "#F7F8FA"} !important;
			}
			& .view-lines .mtk1 {
				color: ${isDarkMode ? "#D6DAE2" : "#485464"};
			}
		`,
		searchMatch: css`
			background-color: ${token.colorWarningBg} !important;
		`,
		activeMatch: css`
			background-color: ${token.colorPrimaryBg} !important;
			outline: 1px solid ${token.colorPrimaryBorder};
		`,
		footer: css`
			display: flex;
			align-items: center;
			justify-content: space-between;
			flex-shrink: 0;
			gap: 16px;
			min-height: 36px;
			padding: 6px 14px 6px 16px;
			box-sizing: border-box;
			border-top: 1px solid ${token.colorBorderSecondary};
			background-color: ${token.colorBgContainer};
			font-size: 12px;
			line-height: 1.4;
		`,
		status: css`
			display: inline-flex;
			align-items: center;
			gap: 7px;
			font-weight: 500;
			white-space: nowrap;

			& svg {
				color: ${token.colorSuccess};
			}
		`,
		detailFooter: css`
			min-height: 44px;
			padding: 10px 16px;
			font-size: 14px;
			line-height: 22px;
			font-weight: 400;
			color: ${token.colorText};
		`,
		detailExitCode: css`
			color: ${token.colorText};
		`,
		exitCode: css`
			display: inline-flex;
			align-items: center;
			gap: 7px;
			color: ${token.colorTextSecondary};
			white-space: nowrap;
		`,
		exitCodeValue: css`
			display: inline-flex;
			align-items: center;
			justify-content: center;
			min-width: 22px;
			height: 22px;
			padding: 0 5px;
			border-radius: 4px;
			background-color: ${token.colorFillQuaternary};
			font-family: "SF Mono", Menlo, Monaco, Consolas, monospace;
			color: ${token.colorText};
		`,
		error: css`
			& svg,
			& [data-terminal-exit-code] {
				color: ${token.colorError};
			}
		`,
		warning: css`
			& svg,
			& [data-terminal-exit-code] {
				color: ${token.colorWarning};
			}
		`,
	}
})
