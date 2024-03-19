import { createStyles } from "antd-style"

const useStyles = createStyles(
	({ css, prefixCls }, { isHasContent }: { isHasContent: boolean }) => {
		return {
			popover: css`
				.${prefixCls}-popover-inner {
					padding: ${isHasContent ? "4px" : "0"};
					min-width: 180px;
					border-radius: 12px;
				}
				.${prefixCls}-popover-inner-content {
					display: flex;
					flex-direction: column;
					gap: 4px;
				}
				.${prefixCls}-btn {
					font-size: 14px;
					padding-left: 8px;
					padding-right: 8px;
				}
			`,
			icon: css`
				border: none;
				background-color: transparent;
			`,
		}
	},
)

export default useStyles
