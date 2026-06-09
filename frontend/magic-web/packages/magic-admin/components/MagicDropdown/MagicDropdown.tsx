import { IconChevronDown } from "@tabler/icons-react"
import type { DropdownProps } from "antd"
import { Dropdown } from "antd"
import type { DropdownButtonProps } from "antd/es/dropdown"
import { memo } from "react"
import { useStyles } from "./style"

export type MagicDropdownProps = DropdownProps
export type MagicDropdownButtonProps = DropdownButtonProps
const MagicDropdown = ({ className, ...props }: MagicDropdownProps) => {
	const { styles, cx } = useStyles()
	return <Dropdown overlayClassName={cx(styles.magicDropdown, className)} {...props} />
}

const MagicDropdownButton = memo(({ className, menu, ...props }: MagicDropdownButtonProps) => {
	const { styles, cx } = useStyles()
	return (
		<Dropdown.Button
			className={cx(styles.magicButton, className)}
			icon={<IconChevronDown size={20} />}
			menu={{
				rootClassName: cx(styles.subMenu),
				...menu,
			}}
			{...props}
		/>
	)
})

MagicDropdown.Button = MagicDropdownButton

export default MagicDropdown
