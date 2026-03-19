import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	divider: css`
		width: 1px;
		background-color: ${token.colorBorder};
	`,
	organizationPanel: css`
		padding: 0 20px;
		height: 400px;
		flex: 1;
	`,
	section: css`
		flex: 1;
	`,
	selectedMembers: css`
		flex: 1;
		padding: 10px 10px 0 10px;
	`,
	footer: css`
		padding: 10px;
		border-top: 1px solid ${token.colorBorder};
	`,
}))
