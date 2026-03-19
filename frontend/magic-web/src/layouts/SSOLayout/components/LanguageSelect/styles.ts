import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, isDarkMode, prefixCls, token }) => {
	return {
		container: css`
			padding: 5px 12px;
			border-radius: 100px;
			background: ${isDarkMode
				? token.magicColorScales.grey[1]
				: token.magicColorUsages.white};
			box-shadow:
				0 4px 14px 0 rgba(0, 0, 0, 0.1),
				0 0 1px 0 rgba(0, 0, 0, 0.3);
		`,
		select: css`
			--${prefixCls}-control-height: fit-content;
			--${prefixCls}-padding-sm: 4px;
		`,
		selectPopup: css`
			width: fit-content !important;
		`,
	}
})
