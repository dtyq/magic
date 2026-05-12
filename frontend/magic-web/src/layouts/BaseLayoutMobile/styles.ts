import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	root: css`
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		background-color: ${token.magicColorScales.grey[0]};
	`,
	container: css`
		/* height: calc(100% - ${token.safeAreaInsetBottom} - ${token.safeAreaInsetTop}); */
		flex: 1 1 0;
		min-height: 0;
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
