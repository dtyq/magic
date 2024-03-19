import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, responsive }) => ({
	editor: css`
		padding: 10px;

		${responsive.mobile} {
			padding: 0 0 10px 0;
		}
	`,
}))
