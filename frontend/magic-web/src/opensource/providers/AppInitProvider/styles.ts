import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls, token }) => {
	return {
		spin: css`
			.${prefixCls}-spin-blur {
				opacity: 1;
			}

			& > div > .${prefixCls}-spin {
				--${prefixCls}-spin-content-height: unset;
				max-height: unset;
			}
		`,
		error: css`
			min-height: 100vh;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 24px;
			background: ${token.colorBgLayout};
		`,
	}
})
