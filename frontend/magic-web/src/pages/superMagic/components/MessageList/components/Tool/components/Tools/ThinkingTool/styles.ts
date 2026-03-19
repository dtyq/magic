import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => ({
	container: css`
		min-height: auto !important;
		&::after {
			display: none;
		}
	`,
}))
