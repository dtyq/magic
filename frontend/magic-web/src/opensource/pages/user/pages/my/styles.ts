import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	navBar: css`
		&& {
			background-color: transparent;
			border-bottom: none;
			padding: 12px;
		}
	`,
	content: css`
		padding: 0 20px 40px 20px;
		overflow-y: auto;
		height: calc(100% - 40px);
	`,
	avatar: css`
		margin: 4px;
	`,
	name: css`
		font-size: 16px;
		font-weight: 500;
	`,
}))
