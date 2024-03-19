import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, isDarkMode }) => ({
	container: css`
		border: 1px solid ${token.colorBorder};
		border-radius: 8px;
		background: ${token.colorBgContainer};
		color: ${token.magicColorScales.green[5]};
		overflow: hidden;
	`,

	content: css`
		position: relative;
		pointer-events: none;
	`,
}))
