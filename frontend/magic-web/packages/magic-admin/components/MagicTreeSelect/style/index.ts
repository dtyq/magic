import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, isDarkMode, token, prefixCls }) => {
	return {
		magicTreeSelect: css`
			width: 100%;
			color: ${isDarkMode ? token.magicColorScales.grey[4] : token.magicColorUsages.text[3]};
			overflow: hidden;
			.${prefixCls}-select-prefix {
				color: ${token.magicColorUsages.text[3]} !important;
				font-weight: 600;
				font-size: 14px;
				margin-inline-end: 12px;
			}
		`,
		suffixIcon: css`
			color: ${token.magicColorUsages.text[2]};
		`,
	}
})
