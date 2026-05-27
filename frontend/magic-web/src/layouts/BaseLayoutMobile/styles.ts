import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => ({
	root: css`
		display: flex;
		flex-direction: column;
		height: 100%;
		overflow: hidden;
		/* 移动端页面底色与上下安全区统一收敛到 mobile-background，避免露出旧灰底。 */
		background-color: rgb(var(--mobile-background-rgb));
	`,
	container: css`
		/* height: calc(100% - ${token.safeAreaInsetBottom} - ${token.safeAreaInsetTop}); */
		flex: 1 1 0;
		min-height: 0;
		background-color: rgb(var(--mobile-background-rgb));
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
