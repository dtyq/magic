import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	menuItem: css`
		white-space: nowrap;
		padding: 4px 4px;
		cursor: pointer;
		min-height: 40px;
		border-radius: 4px;
		&:hover {
			background-color: rgba(255, 255, 255, 0.1);
		}
		&:active {
			background-color: rgba(255, 255, 255, 0.2);
		}
	`,
}))
