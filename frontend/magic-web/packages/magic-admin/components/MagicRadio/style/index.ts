import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, css, prefixCls }) => ({
	magicRadioGroup: css`
		display: flex;
		flex-direction: column;
		gap: 6px;
		color: ${token.magicColorUsages.text[0]};
		flex-shrink: 0;
		.${prefixCls}-radio-label {
			width: 100%;
		}
	`,
}))
