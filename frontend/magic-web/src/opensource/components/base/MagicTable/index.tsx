import type { TableProps } from "antd"
import { Table } from "antd"
import { createStyles } from "antd-style"
import type { AnyObject } from "antd/es/_util/type"
import { useMagicSpinProps } from "../MagicSpin/useMagicSpinProps"

const useStyles = createStyles(
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

function MagicTable<D extends AnyObject = AnyObject>({
	loading = false,
	scroll,
	className,
	...props
}: TableProps<D>) {
	const magicSpinProps = useMagicSpinProps(true)

	const { styles, cx } = useStyles({
		scrollHeight: scroll?.y,
		isLoading: typeof loading === "boolean" ? loading : loading?.spinning,
	})

	return (
		<Table<D>
			className={cx(styles.table, className)}
			loading={
				typeof loading === "object" ? loading : { spinning: loading, ...magicSpinProps }
			}
			scroll={{ x: "max-content", ...scroll }}
			{...props}
		/>
	)
}

export default MagicTable
