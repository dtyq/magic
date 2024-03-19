import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		default: css`
			font-weight: 400;
			padding: 2px 4px;
			font-size: inherit;
			background-color: ${token.magicColorUsages.bg[1]};
			border-radius: 4px;
			margin: 0 4px !important;

			&:first-child {
				margin-left: 0;
			}

			&:last-child {
				margin-right: 0;
			}
		`,
		mention: css`
			color: ${token.colorPrimary};
			background-color: ${token.colorBgTextHover};
			display: inline-flex;
			border-radius: 4px;
			padding: 2px 4px;
			cursor: default;
			user-select: none;
			margin: 0 4px !important;

			&:first-child {
				margin-left: 0;
			}

			&:last-child {
				margin-right: 0;
			}
		`,
		avatar: css`
			border-radius: 50%;
			width: 14px;
			height: 14px;
		`,
		error: css`
			color: ${token.colorError};
			background-color: ${token.colorErrorBg};
			padding: 2px 4px;
			border-radius: 4px;
		`,
	}
})
