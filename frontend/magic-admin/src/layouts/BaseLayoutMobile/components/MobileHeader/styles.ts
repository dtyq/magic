import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	header: css`
		width: 100%;
		height: 56px;
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px;
		background-color: ${token.magicColorUsages.bg[0]};
		border-bottom: 1px solid ${token.colorBorder};
		z-index: 100;
	`,
	userHeader: css`
		padding: 0;
	`,
	logo: css`
		cursor: pointer;
		flex-shrink: 0;
		user-select: none;
		-webkit-tap-highlight-color: transparent;

		&:active {
			opacity: 0.7;
		}
	`,
	title: css`
		font-size: 16px;
		font-weight: 600;
		color: ${token.magicColorUsages.text[0]};
		line-height: 1.5;
	`,
	actions: css`
		flex-shrink: 0;
	`,
}))
