import { TreeSelect, type TreeSelectProps } from "antd"
import { IconChevronDown } from "@tabler/icons-react"
import { useStyles } from "./style"

export type MagicTreeSelectProps = TreeSelectProps

const MagicTreeSelect = ({ className, placeholder, ...props }: MagicTreeSelectProps) => {
	const { styles, cx } = useStyles()

	return (
		<TreeSelect
			className={cx(styles.magicTreeSelect, className)}
			suffixIcon={<IconChevronDown size={16} className={styles.suffixIcon} />}
			{...props}
		/>
	)
}

export default MagicTreeSelect
