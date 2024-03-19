import { memo } from "react"
import { Flex } from "antd"

import MagicIcon from "@/opensource/components/base/MagicIcon"

// Types
import type { MenuItemListProps } from "./types"

// Styles
import { useStyles } from "./styles"

/**
 * MenuItemList - Menu items rendering component
 *
 * @param props - Component props
 * @returns JSX.Element
 */
const MenuItemList = memo(({ menuItems, onItemClick, className }: MenuItemListProps) => {
	const { styles } = useStyles()

	const handleItemClick = (key: string, e: React.MouseEvent | React.TouchEvent) => {
		console.log("Menu item clicked:", key) // Debug log
		e.preventDefault()
		e.stopPropagation()

		onItemClick(key)
	}

	return (
		<Flex className={className}>
			{menuItems.map((item) => {
				return (
					<Flex
						vertical
						gap={4}
						align="center"
						key={item.key}
						className={styles.menuItem}
						data-menu-item="true"
						onTouchEnd={(e) => handleItemClick(item.key, e)}
						onClick={(e) => handleItemClick(item.key, e)}
					>
						{item.icon ? (
							<MagicIcon
								color={item.icon.color}
								component={item.icon.component as any}
								size={item.icon.size}
							/>
						) : undefined}
						<div>{item.label}</div>
					</Flex>
				)
			})}
		</Flex>
	)
})

MenuItemList.displayName = "MenuItemList"

export default MenuItemList
