import { createStyles } from "antd-style"

export const useStyles = createStyles(
	(
		{ css, prefixCls },
		{ scrollHeight, isLoading }: { scrollHeight?: number | string; isLoading?: boolean },
	) => {
		return {
			table: css`
				width: 100%;
				.${prefixCls}-table-body {
					overflow-y: auto !important;
				}

				.${prefixCls}-table-row {
					cursor: pointer;
				}

				.${prefixCls}-table-placeholder {
					height: ${scrollHeight ?? "unset"};
				}

				.${prefixCls}-empty {
					visibility: ${isLoading ? "hidden" : "visible"};
				}
			`,
		}
	},
)
