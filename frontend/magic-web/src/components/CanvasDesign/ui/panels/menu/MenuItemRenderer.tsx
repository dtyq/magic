import {
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubTrigger,
	ContextMenuSubContent,
} from "../../primitives/shadcn/context-menu"
import { formatShortcut } from "../../../runtime/shared/lib/index"
import { cn } from "../../../runtime/shared/lib/utils"
import type { MenuItem, MenuOption } from "./types"
import styles from "./index.module.css"
import { createElement, isValidElement } from "react"
import { MenuActionItem } from "./MenuActionItem"
// import { isValidElement } from "react"

interface MenuItemRendererProps {
	menuWidth: number
	items: MenuItem[]
	isClickEnabled?: boolean
	submenuSideOffset?: number
}

export function MenuItemRenderer({
	menuWidth,
	items,
	isClickEnabled = true,
	submenuSideOffset,
}: MenuItemRendererProps) {
	return (
		<>
			{items.map((item, index) => {
				// 渲染分隔符
				if ("type" in item && item.type === "separator") {
					return <ContextMenuSeparator key={`separator-${index}`} />
				}

				const option = item as MenuOption

				// 检查是否可见
				if (option.visible && !option.visible()) {
					return null
				}

				// 检查是否禁用
				const isDisabled = option.disabled ? option.disabled() : false
				const iconNode = isValidElement(option.icon)
					? option.icon
					: createElement(option.icon, { size: 16 })

				// 判断 icon 是组件还是 ReactElement，并渲染
				// const renderIcon = () => {
				// 	if (isValidElement(option.icon)) {
				// 		return option.icon
				// 	}
				// 	const IconComponent = option.icon as React.ComponentType<{ size?: number }>
				// 	return <IconComponent size={16} />
				// }

				// 如果有子菜单，渲染子菜单结构
				if (option.children && option.children.length > 0) {
					return (
						<ContextMenuSub key={option.id}>
							<ContextMenuSubTrigger
								disabled={isDisabled}
								className={cn(styles.menuItem)}
							>
								{/* <div className={styles.menuItemIcon}>{renderIcon()}</div> */}
								<div className={styles.menuItemIcon}>{iconNode}</div>
								<div className={styles.menuItemLabel}>{option.label}</div>
								{option.rightContentRender ? (
									<div className={styles.menuItemRightContent}>
										{option.rightContentRender()}
									</div>
								) : (
									<div className={styles.menuItemShortcut}>
										{option.shortcut?.modifiers?.map((item) => {
											return (
												<div
													key={item}
													className={styles.menuItemShortcutItem}
												>
													{formatShortcut(item)}
												</div>
											)
										})}
										{option.shortcut?.key && (
											<div className={styles.menuItemShortcutItem}>
												{option.shortcut.key.toUpperCase()}
											</div>
										)}
									</div>
								)}
							</ContextMenuSubTrigger>
							<ContextMenuSubContent
								sideOffset={submenuSideOffset}
								className={cn(
									/* Radix 子菜单默认 minWidth 对齐触发项，显式改为按内容收缩 */
									"w-max min-w-0 max-w-[min(100vw,20rem)]",
									styles.subMenuContent,
								)}
							>
								<MenuItemRenderer
									menuWidth={menuWidth}
									items={option.children}
									isClickEnabled={isClickEnabled}
									submenuSideOffset={submenuSideOffset}
								/>
							</ContextMenuSubContent>
						</ContextMenuSub>
					)
				}

				// 普通菜单项
				return (
					<MenuActionItem
						key={option.id}
						option={option}
						iconNode={iconNode}
						isDisabled={isDisabled}
						isClickEnabled={isClickEnabled}
					/>
				)
			})}
		</>
	)
}
