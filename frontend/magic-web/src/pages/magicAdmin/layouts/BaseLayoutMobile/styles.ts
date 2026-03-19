import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	container: css`
		height: calc(100% - 56px - 56px - ${token.safeAreaInsetBottom} - ${token.safeAreaInsetTop});
		overflow-y: auto;
		overflow-x: hidden;
		-webkit-overflow-scrolling: touch;
		background-color: ${token.magicColorScales.grey[0]};
	`,
}))
