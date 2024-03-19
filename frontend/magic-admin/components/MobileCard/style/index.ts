import { createStyles } from "antd-style"

export const useStyles = createStyles(({ token, prefixCls, css }) => ({
	card: css`
		font-size: 14px;
		color: ${token.magicColorUsages.text[1]};
		.${prefixCls}-card-body {
			padding: 10px;
		}
		.${prefixCls}-card-head {
			padding: 0 10px;
			min-height: 50px;
			color: ${token.magicColorUsages.text[1]};
		}
	`,
	desc: css`
		color: ${token.magicColorUsages.text[3]};
		font-size: 12px;
	`,
}))
