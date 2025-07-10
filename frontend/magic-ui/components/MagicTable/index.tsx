import type { TableProps } from "antd"
import { Table } from "antd"
import type { AnyObject } from "antd/es/_util/type"
import { useMagicSpinProps } from "../MagicSpin/style"
import { useStyles } from "./style"

export type MagicTableProps<D extends AnyObject = AnyObject> = TableProps<D>

function MagicTable<D extends AnyObject = AnyObject>({
	loading = false,
	scroll,
	...props
}: MagicTableProps<D>) {
	const magicSpinProps = useMagicSpinProps()

	const { styles } = useStyles({
		scrollHeight: scroll?.y,
		isLoading: typeof loading === "boolean" ? loading : loading?.spinning,
	})

	return (
		<Table<D>
			className={styles.table}
			loading={
				typeof loading === "object" ? loading : { spinning: loading, ...magicSpinProps }
			}
			scroll={{ x: "max-content", ...scroll }}
			{...props}
		/>
	)
}

export default MagicTable
