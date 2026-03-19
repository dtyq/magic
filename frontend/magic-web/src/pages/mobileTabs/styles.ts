import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => ({
	container: css`
		width: 100%;
		height: 100%;
		position: relative;
		overflow: hidden;
	`,
	tabContent: css`
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
	`,
	activeTab: css`
		opacity: 1;
		pointer-events: auto;
		z-index: 1;
	`,
	inactiveTab: css`
		opacity: 0;
		pointer-events: none;
		z-index: 0;
	`,
}))
