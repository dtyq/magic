import { createStyles } from "antd-style"

export const useStyles = createStyles(({ isDarkMode, css, prefixCls, token }) => ({
	spin: css`
		.${prefixCls}-spin-blur {
			opacity: 1;
		}

		.${prefixCls}-spin {
			--${prefixCls}-spin-content-height: unset;
		}
	`,
	container: css`
		background-color: ${isDarkMode
			? token.magicColorUsages.black
			: token.magicColorUsages.white};
		height: 100vh;
		width: 100%;
	`,
}))
