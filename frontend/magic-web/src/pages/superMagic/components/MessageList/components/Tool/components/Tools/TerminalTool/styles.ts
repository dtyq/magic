import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css }) => ({
	terminal: css`
		border-radius: 8px;
		height: 200px;
		overflow: hidden;
		min-height: 200px;
		position: relative;

		.xterm {
			.xterm-viewport {
				overflow-y: hidden;
			}
		}
	`,
}))
