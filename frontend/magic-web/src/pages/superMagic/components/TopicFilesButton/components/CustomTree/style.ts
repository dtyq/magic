import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => {
	return {
		customTreeNode: css`
			outline: none;
			border: 1px solid transparent;
			/* Allow inline validation messages to expand the row instead of covering the next file. */
			min-height: 32px;
		`,
	}
})
