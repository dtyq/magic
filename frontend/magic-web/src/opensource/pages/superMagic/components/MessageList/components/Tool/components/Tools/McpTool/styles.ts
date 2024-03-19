import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	serverName: css`
		color: ${token.magicColorUsages.text[3]};
		font-size: 10px;
		font-weight: 400;
		line-height: 13px;
		position: absolute;
		right: 10px;
	`,
	successIcon: css`
		color: ${token.colorSuccess};
	`,
	errorIcon: css`
		color: ${token.colorError};
	`,
	mcpToolContainer: css`
		&:after {
			display: none;
		}
	`,
	mcpToolContent: css`
		overflow: auto;
		height: 200px;
		pointer-events: all;
	`,
}))
