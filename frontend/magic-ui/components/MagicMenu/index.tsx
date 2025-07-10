import { memo } from "react"
import type { MenuProps } from "antd"
import { Menu } from "antd"
import { useStyles } from "./style"

export type MagicMenuProps = MenuProps

const MagicMenu = memo(function MagicMenu({ rootClassName, className, ...props }: MagicMenuProps) {
	const { styles, cx } = useStyles()

	return (
		<Menu
			rootClassName={cx(styles.menuWrapper, rootClassName)}
			className={cx(styles.menu, className)}
			{...props}
		/>
	)
})

export default MagicMenu
