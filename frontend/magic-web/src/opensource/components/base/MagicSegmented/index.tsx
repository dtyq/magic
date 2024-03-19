import { Segmented as AntdSegmented } from "antd"
import type { SegmentedProps } from "antd/es/segmented"
import { cx } from "antd-style"
import useStyles from "./styles"

export interface MagicSegmentedProps<K> extends SegmentedProps<K> {
	circle?: boolean
}

function MagicSegmented<K>({ className, circle = true, ...props }: MagicSegmentedProps<K>) {
	const { styles } = useStyles({ circle })
	return <AntdSegmented className={cx(styles.segmented, className)} {...props} />
}

export default MagicSegmented
