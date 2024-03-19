import {
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuSub,
	ContextMenuSubTrigger,
	ContextMenuSubContent,
} from "../ui/context-menu"
import { formatShortcut } from "../../lib/index"
import classNames from "classnames"
import type { MenuItem, MenuOption } from "./types"
import styles from "./index.module.css"
import { isValidElement } from "react"

interface MenuItemRendererProps {
	menuWidth: number
	items: MenuItem[]
	isClickEnabled?: boolean
}

export function MenuItemRenderer({
	menuWidth,
	items,
	isClickEnabled = true,
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

				// 判断 icon 是组件还是 ReactElement，并渲染
				const renderIcon = () => {
					if (isValidElement(option.icon)) {
						return option.icon
					}
					const IconComponent = option.icon as React.ComponentType<{ size?: number }>
					return <IconComponent size={16} />
				}

				// 如果有子菜单，渲染子菜单结构
				if (option.children && option.children.length > 0) {
					return (
						<ContextMenuSub key={option.id}>
							<ContextMenuSubTrigger
								disabled={isDisabled}
								className={classNames(styles.menuItem)}
							>
								<div className={styles.menuItemIcon}>{renderIcon()}</div>
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
							<ContextMenuSubContent className={`w-[${menuWidth}px]`}>
								<MenuItemRenderer
									menuWidth={menuWidth}
									items={option.children}
									isClickEnabled={isClickEnabled}
								/>
							</ContextMenuSubContent>
						</ContextMenuSub>
					)
				}

				// 普通菜单项
				return (
					<ContextMenuItem
						key={option.id}
						disabled={isDisabled}
						onClick={(e) => {
							if (!isClickEnabled) {
								e.preventDefault()
								e.stopPropagation()
								return
							}
							option.onClick?.()
						}}
						className={classNames(
							option.id === "delete" ? styles.menuItemDelete : undefined,
							styles.menuItem,
						)}
					>
						<div className={styles.menuItemIcon}>{renderIcon()}</div>
						<div className={styles.menuItemLabel}>{option.label}</div>
						{option.rightContentRender ? (
							<div className={styles.menuItemRightContent}>
								{option.rightContentRender()}
							</div>
						) : (
							<div className={styles.menuItemShortcut}>
								{option.shortcut?.modifiers?.map((item) => {
									return (
										<div key={item} className={styles.menuItemShortcutItem}>
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
					</ContextMenuItem>
				)
			})}
		</>
	)
}
