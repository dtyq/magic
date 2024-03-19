import { memo, useEffect, useState } from "react"
import type { MenuProps } from "antd"
import { Menu, Flex, Divider } from "antd"
import type { MenuItemType } from "antd/es/menu/interface"
import { IconChevronDown, IconChevronUp, IconLayoutSidebar } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import { useAdminComponents } from "../AdminComponentsProvider"
import { useStyles } from "./style"

export interface SideMenuItem extends MenuItemType {
	validate?: (permissions: string[], isSuperAdmin?: boolean) => boolean
	children?: Array<SideMenuItem>
}

export interface SideMenuProps extends MenuProps {
	items: Array<SideMenuItem>
	pathname: string
	navigate: (key: string) => void
	onCollapse?: (collapsed: boolean) => void
	menuClassName?: string
}

const SideMenu = memo((props: SideMenuProps) => {
	const { items, pathname, navigate, onCollapse, defaultOpenKeys, menuClassName, ...rest } = props

	const { getLocale } = useAdminComponents()
	const locale = getLocale("SideMenu")

	const [collapsed, setCollapsed] = useState(false)
	const [selectedKeys, setSelectedKeys] = useState<string[]>([])
	const [openKeys, setOpenKeys] = useState<string[]>(defaultOpenKeys || [])

	const { styles, cx } = useStyles({ collapsed })

	const handleNavigate: MenuProps["onClick"] = ({ key }) => {
		setSelectedKeys([key])
		navigate(key)
	}

	// 查找匹配的菜单项，返回匹配项和路径上的所有父级菜单 key
	const findMatchedItemWithPath = useMemoizedFn(
		(
			routes: SideMenuItem[],
			parentKeys: string[] = [],
		): { item: SideMenuItem | null; path: string[] } => {
			const result = routes.reduce<{ item: SideMenuItem | null; path: string[] }>(
				(acc, route) => {
					if (acc.item) return acc // 已找到，直接返回

					const routeKey = route.key?.toString() || ""

					// 精确匹配
					if (pathname === routeKey) {
						return { item: route, path: [...parentKeys] }
					}

					// 前缀匹配（用于详情页等子路径）
					if (pathname.startsWith(routeKey)) {
						// 如果有子菜单，继续递归查找
						if (route.children && Array.isArray(route.children)) {
							const childResult = findMatchedItemWithPath(route.children, [
								...parentKeys,
								routeKey,
							])
							if (childResult.item) {
								return childResult
							}
						}
						// 如果没有子菜单或子菜单中没找到，返回当前项
						return { item: route, path: [...parentKeys] }
					}

					return acc
				},
				{ item: null, path: [] },
			)

			return result
		},
	)

	useEffect(() => {
		const { item: matchedItem, path: parentPath } = findMatchedItemWithPath(items)

		if (matchedItem?.key) {
			const itemKey = matchedItem.key.toString()
			// 设置选中的菜单项
			setSelectedKeys([itemKey])

			// 自动展开父级菜单（包括所有祖先级别）
			if (parentPath.length > 0) {
				setOpenKeys((prev) => {
					const newKeys = new Set([...prev, ...parentPath])
					return Array.from(newKeys)
				})
			}
		}
	}, [pathname, items, findMatchedItemWithPath])

	const handleOpenChange: MenuProps["onOpenChange"] = (keys) => {
		setOpenKeys(keys)
	}

	return (
		<div className={styles.side}>
			<Menu
				mode="inline"
				selectedKeys={selectedKeys}
				defaultOpenKeys={defaultOpenKeys}
				openKeys={openKeys}
				className={cx(styles.menu, menuClassName)}
				items={items}
				onClick={handleNavigate}
				onOpenChange={handleOpenChange}
				expandIcon={
					!collapsed
						? ({ isOpen }) =>
								isOpen ? (
									<IconChevronDown size={20} color="currentColor" />
								) : (
									<IconChevronUp size={20} color="currentColor" />
								)
						: null
				}
				{...rest}
			/>
			<Flex vertical className={styles.collapseWrapper} justify="flex-start">
				<Divider type="horizontal" className={styles.divider} />
				<Menu
					mode="inline"
					className={cx(styles.menu, styles.collapse)}
					items={[
						{
							icon: <IconLayoutSidebar size={20} />,
							label: locale.collapseNav,
							key: "collapse",
						},
					]}
					selectable={false}
					onClick={() => {
						const newCollapsed = !collapsed
						setCollapsed(newCollapsed)
						onCollapse?.(newCollapsed)
					}}
				/>
			</Flex>
		</div>
	)
})

export default SideMenu
