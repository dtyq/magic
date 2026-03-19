import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		platformInfo: css``,
		platformImage: css`
			width: 24px;
			height: 24px;
			border-radius: 4px;
			border-width: 1px;
			margin-right: 4px;
			svg {
				width: 24px;
				height: 24px;
			}
		`,
		platformTitle: css`
			font-weight: 400;
			font-size: 14px;
			line-height: 20px;
			letter-spacing: 0px;
			color: ${token.magicColorUsages.text[1]};
			margin-right: 12px;
		`,
		platformDesc: css`
			font-weight: 400;
			font-size: 14px;
			line-height: 20px;
			letter-spacing: 0px;
			color: ${token.magicColorUsages.text[3]};
		`,
		checkbox: css`
			margin-right: 24px;
		`,
	}
})
