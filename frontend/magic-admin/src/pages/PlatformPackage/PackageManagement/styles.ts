import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		container: css`
			padding: 10px;
			background-color: transparent;
		`,
		card: css`
			padding: 12px;
			overflow: hidden;
			background-color: ${token.magicColorUsages.bg[0]};
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			cursor: pointer;
		`,
		title: css`
			font-size: 16px;
			font-weight: 600;
			line-height: 22px;
			color: ${token.magicColorUsages.text[1]};
		`,
		status: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[2]};
			text-wrap: noWrap;
		`,
		description: css`
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.text[3]};
		`,
		addService: css`
			font-size: 12px;
			color: ${token.magicColorUsages.text[2]};
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
			min-width: 200px;
			width: 100%;
			height: 100%;
			min-height: 106px;
			background-color: ${token.magicColorUsages.bg[0]};
			cursor: pointer;
		`,
		divider: css`
			margin: 0;
		`,
		link: css`
			font-size: 12px;
			line-height: 16px;
			color: ${token.magicColorUsages.primary.default};
			cursor: pointer;
		`,
		dangerLink: css`
			color: ${token.magicColorUsages.danger.default};
		`,
		avatar: css`
			width: 42px;
			height: 42px;
			border-radius: 8px;
			background: linear-gradient(128deg, #3f8fff 5.59%, #ef2fdf 95.08%);
			border: none;
		`,
	}
})
