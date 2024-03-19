import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		layout: css`
			width: 100%;
			border-radius: 12px;
			overflow: hidden;
		`,
		header: css`
			width: 100%;
			height: 70px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 20px;
			color: ${token.magicColorUsages.text[1]};
			font-size: 18px;
			font-style: normal;
			font-weight: 600;
			line-height: 24px; /* 133.333% */
		`,
		icon: css`
			width: 30px;
			height: 30px;
			border-radius: 6px;
			overflow: hidden;
		`,
		close: css`
			width: 24px;
			height: 24px;
			display: flex;
			align-items: center;
			justify-content: center;
			cursor: pointer;
			transition: all linear 0.1s;
			border-radius: 6px;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}

			&:active {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		body: css`
			padding: 0 20px 20px 20px;
		`,
		wrapper: css`
			width: 100%;
			height: 400px;
			background-color: ${token.magicColorScales.grey[0]};
			overflow: hidden;
			border: 1px solid ${token.magicColorUsages.border};
			border-radius: 8px;
			padding: 10px 0 10px 10px;

			& .monaco-editor {
				--vscode-editorGutter-background: ${token.magicColorScales.grey[0]};
				--vscode-editor-background: ${token.magicColorScales.grey[0]};
				--vscode-editorStickyScroll-background: ${token.magicColorScales.grey[0]};
			}
		`,
		menu: css`
			width: 100%;
		`,
	}
})
