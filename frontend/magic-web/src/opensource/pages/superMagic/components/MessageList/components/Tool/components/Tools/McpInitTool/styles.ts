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
	mcpInitToolContainer: css`
		&:after {
			display: none;
		}
	`,
	mcpInitToolContent: css`
		overflow: auto;
		max-height: 240px;
		pointer-events: all;
	`,
	suffixContainer: css`
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 1;
		min-width: 0;
		flex: 1;
		pointer-events: none;
	`,
	suffix: css`
		flex-shrink: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	`,

	suffixMore: css`
		min-width: 35px;
		width: 35px;
		flex-shrink: 0;
		background: ${token.magicColorUsages.fill[0]};
		color: ${token.colorText};
		text-align: center;
		border-radius: 1000px;
		color: ${token.magicColorUsages.text[2]};
	`,
}))
