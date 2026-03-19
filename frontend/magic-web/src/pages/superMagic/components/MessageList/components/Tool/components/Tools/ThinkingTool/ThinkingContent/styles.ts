import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, isDarkMode }) => ({
	thinkingContent: css`
		border-radius: 100px;
		padding: 0 6px 8px 6px;
		gap: 8px;
	`,
	quote: css`
		width: 20px;
		height: 20px;
		flex-shrink: 0;
		padding: 4px;
	`,
	text: css`
		font-size: 14px;
		color: ${token.magicColorUsages.text[1]};
		line-height: 20px;
	`,

	editorBody: css`
		flex: 1;
		flex-shrink: 1;
		overflow: hidden auto;

		&::-webkit-scrollbar {
			width: 6px;
		}

		&::-webkit-scrollbar-thumb {
			background-color: ${isDarkMode ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 0, 0, 0.15)"};
			border-radius: 3px;
		}

		&::-webkit-scrollbar-track {
			background-color: transparent;
		}
		overflow: auto;
		text-overflow: ellipsis;
		white-space: wrap;
	`,
}))
