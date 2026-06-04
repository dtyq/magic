import { Table, type TableProps } from "antd"
import { memo } from "react"
import type { AnyObject } from "antd/es/_util/type"
import { useStyles } from "./style"

export interface MagicTableProps<T extends AnyObject> extends TableProps<T> {
	className?: string
}

const MagicTable = <T extends AnyObject>({ className, ...props }: MagicTableProps<T>) => {
	const { styles, cx } = useStyles()
	return <Table className={cx(styles.magicTable, className)} {...props} />
}

export default memo(MagicTable) as <T extends AnyObject>(props: MagicTableProps<T>) => JSX.Element
