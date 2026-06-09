import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	container: css`
		height: calc(100% - 52px - 56px);
		overflow: hidden;
		background-color: ${token.magicColorScales.grey[0]};
	`,
}))
