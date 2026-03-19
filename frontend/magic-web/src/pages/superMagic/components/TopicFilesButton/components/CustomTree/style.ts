import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => {
	return {
		customTreeNode: css`
			outline: none;
			border: 1px solid transparent;
		`,
	}
})
