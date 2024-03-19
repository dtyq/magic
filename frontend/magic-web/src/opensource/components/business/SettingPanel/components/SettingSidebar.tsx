import { memo, useMemo } from "react"
import type { SettingSidebarProps, MenuItem } from "../types"
import { useStyles } from "../styles"
import SidebarFooterExtra from "./SidebarFooterExtra"

interface MenuGroup {
	groupTitle?: string
	items: MenuItem[]
}

function SettingSidebar({ menuItems, activeKey, onActiveKeyChange }: SettingSidebarProps) {
	const { styles, cx } = useStyles()

	// Group menu items by groupTitle
	const groupedItems = useMemo(() => {
		const groups: MenuGroup[] = []
		let currentGroup: MenuGroup | null = null

		for (const item of menuItems) {
			if (item.groupTitle !== undefined) {
				// Start a new group
				if (currentGroup) {
					groups.push(currentGroup)
				}
				currentGroup = {
					groupTitle: item.groupTitle,
					items: [item],
				}
			} else if (currentGroup) {
				// Add to current group
				currentGroup.items.push(item)
			} else {
				// No group, create one without title
				currentGroup = {
					groupTitle: undefined,
					items: [item],
				}
			}
		}

		// Push the last group
		if (currentGroup) {
			groups.push(currentGroup)
		}

		return groups
	}, [menuItems])

	function handleItemClick(key: string) {
		onActiveKeyChange(key)
	}

	return (
		<div className={styles.sidebar}>
			<div className={styles.sidebarContent}>
				{groupedItems.map((group, groupIndex) => (
					<div key={groupIndex} className={styles.menuGroup}>
						{group.groupTitle && (
							<div className={styles.groupTitle}>{group.groupTitle}</div>
						)}
						{group.items.map((item) => (
							<div
								key={item.key}
								className={cx(
									styles.menuItem,
									activeKey === item.key && styles.activeMenuItem,
								)}
								onClick={() => handleItemClick(item.key)}
							>
								{item.icon && <div className={styles.menuIcon}>{item.icon}</div>}
								<span>{item.label}</span>
							</div>
						))}
					</div>
				))}
			</div>
			<div className={styles.sidebarFooter}>
				<SidebarFooterExtra />
			</div>
		</div>
	)
}

export default memo(SettingSidebar)
