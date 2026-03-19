import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	container: css`
		/* height: calc(100% - ${token.safeAreaInsetBottom} - ${token.safeAreaInsetTop}); */
		height: 100%;
		background-color: ${token.magicColorScales.grey[0]};
	`,
	view: css`
		/* height: calc(100% - 68px - ${token.safeAreaInsetBottom} - ${token.safeAreaInsetTop}); */
	`,
	noGlobalSafeAreaWithoutTabBar: css`
		height: 100%;
	`,
	noGlobalSafeAreaWithTabBar: css`
		/* height: calc(100% - 60px); */
	`,
}))
