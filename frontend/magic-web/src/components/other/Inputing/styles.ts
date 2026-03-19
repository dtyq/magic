import { createStyles } from "antd-style"

export const useStyles = createStyles(({ css, prefixCls }) => {
	return {
		root: css`
			.${prefixCls}-popover-inner, .${prefixCls}-popover-arrow {
				margin-left: 10px;
				margin-bottom: 4px;
			}
		`,
		inputing: css`
			width: 4px;
			height: 10px;
			border-radius: 1000px;
			background: #d9d9d9;
			animation: inputing 1s linear infinite;

			@keyframes inputing {
				0% {
					opacity: 0.4;
				}
				100% {
					opacity: 1;
				}
			}

			&:nth-of-type(1) {
				animation-delay: 0s;
			}

			&:nth-of-type(2) {
				animation-delay: 0.2s;
			}

			&:nth-of-type(3) {
				animation-delay: 0.4s;
			}
		`,
	}
})
