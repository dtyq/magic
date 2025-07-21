import type { DropDownProps } from "antd"
import { Dropdown } from "antd"
import { cx } from "antd-style"
import { useStyles } from "./style"

export type MagicDropdownProps = DropDownProps

function MagicDropdown({
	menu: { rootClassName, ...menu } = {},
	overlayClassName,
	...props
}: MagicDropdownProps) {
	const { styles } = useStyles()

	return (
		<Dropdown
			overlayClassName={cx(styles.dropdown, overlayClassName)}
			menu={{
				rootClassName: cx(styles.dropdown, styles.subMenu, rootClassName),
				...menu,
			}}
			{...props}
		/>
	)
}

export default MagicDropdown
