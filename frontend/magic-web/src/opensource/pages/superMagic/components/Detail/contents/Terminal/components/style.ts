import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token }) => {
	return {
		terminalDisplay: css`
			width: 100%;
			height: 100%;
			flex: 1;
			overflow: hidden;
			position: relative;

			& .terminal {
				width: 100% !important;
				height: 100% !important;
			}

			& .xterm-viewport {
				overflow-y: auto !important;
			}

			& .xterm-screen {
				width: 100% !important;
				height: 100% !important;
			}
			& .xterm-cursor {
				background-color: ${token.colorBgContainer};
			}
		`,
	}
})
