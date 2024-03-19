import { createStyles } from "antd-style"

const useMemberCardButtonsStyles = createStyles(({ token, css, isDarkMode, prefixCls }) => ({
	button: css`
		border: none;
		padding: 6px 12px;
		gap: 4px;
		background-color: ${isDarkMode
			? token.magicColorUsages.primaryLight.default
			: token.magicColorScales.brand[0]};
		color: ${token.magicColorScales.brand[5]};

		.${prefixCls}-btn-icon {
			line-height: 10px;
		}
	`,
}))

export default useMemberCardButtonsStyles
