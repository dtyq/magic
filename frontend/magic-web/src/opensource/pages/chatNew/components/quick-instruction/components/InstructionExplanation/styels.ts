import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, token, prefixCls }) => {
	return {
		container: css`
			--${prefixCls}-popover-inner-padding: 10px !important;
      width: 160px;
		`,
		image: css`
			width: 100%;
			height: 80px;
			object-fit: cover;
			margin-bottom: 4px;
			border-radius: 8px;
		`,
		title: css`
			color: ${token.colorTextTertiary};
			font-size: 12px;
			font-style: normal;
			font-weight: 600;
			line-height: 16px;
		`,
		description: css`
			color: ${token.colorTextQuaternary};
			font-size: 10px;
			font-style: normal;
			font-weight: 400;
			line-height: 12px;
		`,
	}
})
