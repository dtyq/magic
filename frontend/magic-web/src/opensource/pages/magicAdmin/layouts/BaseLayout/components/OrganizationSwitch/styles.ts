import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls, token }) => {
	return {
		popover: css`
			.${prefixCls}-popover-inner {
				padding: 0;
				width: fit-content;
				min-width: 200px;
				border-radius: 12px;
				margin-bottom: 12px;
				margin-left: 4px;
			}

			.${prefixCls}-popover-inner-content {
				width: 300px;
				display: flex;
				flex-direction: column;
				gap: 4px;
			}

			.${prefixCls}-btn {
				// width: 100%;
				font-size: 14px;
				padding-left: 8px;
				padding-right: 8px;
			}
		`,
		avatar: css`
			color: white !important;
			border: 1px solid ${token.magicColorUsages.border};
		`,
		button: css`
			color: ${token.magicColorUsages.text[1]};
			background-color: ${token.magicColorScales.grey[0]};
			padding: 8px 10px;
		`,
	}
})
