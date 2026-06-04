import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls }) => {
	return {
		magicSpin: css`
			width: 100%;
			display: flex;
			justify-content: center;
			align-items: center;
			.${prefixCls}-spin-container {
				width: 100%;
				height: 100%;
			}
		`,
	}
})
