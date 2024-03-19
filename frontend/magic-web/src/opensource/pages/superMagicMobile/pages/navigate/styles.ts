import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	navBar: css`
		background-color: transparent;
		border-bottom: none;
		padding: 12px;
		height: 48px;
	`,
	content: css`
		padding: 20px 20px 40px 20px;
	`,
}))
