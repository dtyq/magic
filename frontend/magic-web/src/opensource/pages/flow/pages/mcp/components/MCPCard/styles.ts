import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		card: css`
			padding-left: 4px;
			padding-right: 4px;
			margin-bottom: 8px;
		`,
		wrapper: css`
			width: 100%;
			height: 130px;
			display: flex;
			flex-direction: column;
			gap: 8px;
			padding: 12px;
			border-radius: 8px;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		active: css`
			border: 1px solid ${token.magicColorUsages.primary.default};
		`,
		header: css`
			width: 100%;
			display: flex;
			gap: 8px;
		`,
		icon: css`
			width: 50px;
			height: 50px;
			border-radius: 8px;
			flex: none;
		`,
		fallback: css`
			width: 50px;
			height: 50px;
			border-radius: 8px;
			overflow: hidden;
			flex: none;
		`,
		section: css`
			display: inline-flex;
			flex-direction: column;
			gap: 8px;
			flex: auto;
			overflow: hidden;
		`,
		title: css`
			overflow: hidden;
			color: ${token.magicColorUsages.text[1]};
			text-overflow: ellipsis;
			font-size: 16px;
			font-style: normal;
			font-weight: 600;
			line-height: 22px; /* 137.5% */
			display: flex;
			align-items: center;
			justify-content: space-between;
		`,
		button: css`
			width: 28px;
			height: 28px;
			border-radius: 6px;
			display: inline-flex;
			align-items: center;
			justify-content: center;

			&:hover {
				background-color: ${token.magicColorUsages.fill[0]};
			}

			&:active {
				background-color: ${token.magicColorUsages.fill[1]};
			}
		`,
		desc: css`
			overflow: hidden;
			color: ${token.magicColorUsages.text[3]};
			text-overflow: ellipsis;
			white-space: nowrap;
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
		`,
		menu: css`
			width: 100%;
			height: 24px;
			display: flex;
			justify-content: space-between;
			gap: 8px;
		`,
		nav: css`
			display: inline-flex;
			gap: 4px;
		`,
		tag: css`
			display: inline-flex;
			height: 20px;
			padding: 2px 8px;
			align-items: center;
			gap: 2px;
			border-radius: 3px;
			background: ${token.magicColorUsages.fill[0]};
			color: ${token.magicColorUsages.text[2]};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
		`,
		switchLabel: css`
			color: ${token.magicColorUsages.text[2]};
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px; /* 133.333% */
		`,
		footer: css`
			width: 100%;
			height: 16px;
			overflow: hidden;
			display: flex;
			align-items: center;
			justify-content: space-between;
			color: ${token.magicColorUsages.text[3]};
			text-overflow: ellipsis;
			font-size: 12px;
			font-style: normal;
			font-weight: 400;
			line-height: 16px;
		`,
	}
})
