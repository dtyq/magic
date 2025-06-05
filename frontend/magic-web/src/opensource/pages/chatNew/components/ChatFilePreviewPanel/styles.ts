import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css }) => ({
	container: css`
		background-color: ${token.magicColorUsages.bg[0]};
		height: calc(100vh - ${token.titleBarHeight}px);
		border-left: 1px solid ${token.magicColorUsages.border};
	`,
	fullscreen: css`
		position: fixed;
		top: 0;
		left: 0;
		width: 100vw;
		height: 100vh;
		z-index: 9999;
		border: none;
	`,
	header: css`
		height: 40px;
		border-bottom: 1px solid ${token.magicColorUsages.border};
		padding: 0 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	`,
	headerLeft: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
	`,
	headerRight: css`
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	`,
	headerLeftTitle: css`
		font-size: 16px;
		font-weight: 600;
	`,
	content: css`
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		width: 100%;
	`,
}))
