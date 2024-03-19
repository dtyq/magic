import { colorUsages } from "@/opensource/providers/ThemeProvider/colors"
import { createStyles } from "antd-style"

export const useStyles = createStyles(({ prefixCls, css, isDarkMode }) => ({
	modal: css`
		.${prefixCls}-modal-header {
			padding: 10px;
			border: none;
		}
		.${prefixCls}-modal-body {
			padding: 4px 10px;
		}
		.${prefixCls}-modal-footer {
			border-top: 0;
			padding: 10px;
		}
	`,
	title: css`
		font-size: 14px;
		font-weight: 400;
		color: ${isDarkMode ? colorUsages.text[1] : colorUsages.text[1]};
	}
	`,
	subTitle: css`
		font-size: 16px;
		font-weight: 600;
		color: ${isDarkMode ? colorUsages.text[0] : colorUsages.text[0]};
	`,
	desc: css`
		font-size: 14px;
		line-height: 28px;
		color: ${isDarkMode ? colorUsages.text[2] : colorUsages.text[2]};
		margin: 0;
		padding-left: 20px;
	`,
	icon: css`
		background: #5c76da;
		border-radius: 4px;
	`,
	button: css`
		border-radius: 8px;
		min-width: unset !important;
		background: ${isDarkMode ? colorUsages.fill[0] : colorUsages.fill[0]};
	`,
	flex1: css`
		flex: 1;
	`,
}))
