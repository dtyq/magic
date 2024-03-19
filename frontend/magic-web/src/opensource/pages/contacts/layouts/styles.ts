import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, prefixCls }) => {
	return {
		container: css`
			width: 100%;
			height: 100%;
			border-radius: 8px;
			border: 1px solid ${token.colorBorder};
			overflow: hidden;
		`,
		header: css`
			height: 42px;
			flex-shrink: 0;
			padding: 9px 20px;
			background-color: ${token.magicColorUsages.bg[0]};
			border-bottom: 1px solid ${token.colorBorderSecondary};
			color: ${token.magicColorUsages.text[1]};
			font-size: 18px;
			font-weight: 600;
			line-height: 24px;
		`,
		content: css`
			height: calc(100% - 42px);
			flex: 1;
			display: flex;
		`,
		topBar: css`
			height: 50px;
			padding: 9px 20px;
			background-color: ${token.magicColorUsages.bg[0]};
			border-bottom: 1px solid ${token.colorBorderSecondary};
		`,
		title: css`
			color: ${token.colorTextSecondary};
			font-size: 18px;
			font-weight: 600;
			line-height: 24px;
		`,
		segmented: css`
			width: fit-content;
			border-radius: 4px;
			.${prefixCls}-segmented-item {
				border-radius: 4px;
			}
		`,
	}
})
