import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		container: css`
			padding: 12px;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			min-width: 200px;
			width: 100%;
			background-color: ${token.magicColorUsages.bg[0]};
			overflow: hidden;
		`,
		title: css`
			width: 100%;
			font-size: 16px;
			color: ${token.magicColorUsages.text[1]};
			font-weight: 600;
			line-height: 22px;
			line-clamp: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			display: -webkit-box;
			-webkit-line-clamp: 1;
			-webkit-box-orient: vertical;
			word-break: break-all;
		`,
		description: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[3]};
			line-height: 16px;
			line-clamp: 1;
			overflow: hidden;
			text-overflow: ellipsis;
			display: -webkit-box;
			-webkit-line-clamp: 1;
			-webkit-box-orient: vertical;
			word-break: break-all;
		`,
		lineClamp2: css`
			line-clamp: 2;
			-webkit-line-clamp: 2;
			height: 32px;
		`,
		tag: css`
			font-size: 12px;
			color: white;
		`,
	}
})
