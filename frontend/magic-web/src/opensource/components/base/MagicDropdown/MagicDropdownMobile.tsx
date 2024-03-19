import { useState, useEffect } from "react"
import type { MenuProps } from "antd"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import {
	ActionDrawer,
	ActionGroup,
	ActionItem,
} from "@/opensource/components/shadcn-composed/action-drawer"
import type { MagicDropdownProps } from "./types"

type MenuItem = NonNullable<MenuProps["items"]>[number]

interface MenuLevel {
	items: MenuItem[]
	title?: React.ReactNode
}

/**
 * MagicDropdownMobile - Mobile implementation using ActionDrawer with submenu navigation
 */
function MagicDropdownMobile({
	menu,
	trigger = ["click"],
	open,
	onOpenChange,
	disabled = false,
	mobileProps,
	children,
	popupRender,
}: MagicDropdownProps) {
	// Mobile doesn't support hover or contextMenu triggers - always use click
	const isContextMenu = trigger?.includes("contextMenu")

	// Internal state for uncontrolled mode
	const [internalOpen, setInternalOpen] = useState(false)
	const isControlled = open !== undefined
	const actualOpen = isControlled ? open : internalOpen

	// Track current menu level (for submenu navigation)
	const [menuStack, setMenuStack] = useState<MenuLevel[]>([])

	// Reset menu stack when drawer opens/closes
	useEffect(() => {
		if (!actualOpen) {
			setMenuStack([])
		}
	}, [actualOpen])

	// Handle open change
	const handleOpenChange = (newOpen: boolean) => {
		if (!isControlled) {
			setInternalOpen(newOpen)
		}
		onOpenChange?.(newOpen)
	}

	// Get current menu level
	const currentLevel = menuStack.length > 0 ? menuStack[menuStack.length - 1] : null
	const currentItems = currentLevel ? currentLevel.items : (menu?.items as MenuItem[])
	const currentTitle = currentLevel?.title

	// Navigate to submenu
	const navigateToSubmenu = (items: MenuItem[], title: React.ReactNode) => {
		setMenuStack((prev) => [...prev, { items, title }])
	}

	// Navigate back to previous level
	const navigateBack = () => {
		setMenuStack((prev) => prev.slice(0, -1))
	}

	// Convert menu items to ActionDrawer items, grouped by dividers
	const renderMenuItems = (items: MenuItem[] | undefined) => {
		if (!items || items.length === 0) return null

		// Split items into groups based on dividers
		const groups: MenuItem[][] = []
		let currentGroup: MenuItem[] = []

		items.forEach((item) => {
			if (!item) return

			if (item.type === "divider") {
				// When encountering a divider, save current group and start new one
				if (currentGroup.length > 0) {
					groups.push(currentGroup)
					currentGroup = []
				}
			} else {
				currentGroup.push(item)
			}
		})

		// Add the last group if it has items
		if (currentGroup.length > 0) {
			groups.push(currentGroup)
		}

		// Render each group as a separate ActionGroup
		return (
			<>
				{groups.map((group, groupIndex) => (
					<ActionGroup key={`group-${groupIndex}`}>
						{group.map((item, index) => {
							const menuItem = item as unknown as Record<string, unknown>
							const key = (menuItem.key as string) || `item-${groupIndex}-${index}`

							// Check if item has children (submenu)
							const hasChildren = Boolean(
								menuItem.children && Array.isArray(menuItem.children),
							)

							// Handle disabled state
							if (menuItem.disabled) {
								return (
									<ActionItem
										key={key}
										label={
											<div className="flex w-full items-center justify-between">
												<span>{menuItem.label as React.ReactNode}</span>
												{hasChildren && (
													<ChevronRightIcon className="size-4 text-muted-foreground" />
												)}
											</div>
										}
										icon={menuItem.icon as React.ReactNode}
										disabled
										className={menuItem.className as string | undefined}
									/>
								)
							}

							// Handle danger variant
							const variant = menuItem.danger ? "destructive" : "default"

							return (
								<ActionItem
									key={key}
									label={
										<div className="flex w-full items-center justify-between">
											<span>{menuItem.label as React.ReactNode}</span>
											{hasChildren && (
												<ChevronRightIcon className="size-4 text-muted-foreground" />
											)}
										</div>
									}
									icon={menuItem.icon as React.ReactNode}
									variant={variant}
									disabled={menuItem.disabled as boolean | undefined}
									className={menuItem.className as string | undefined}
									onClick={() => {
										// If has children, navigate to submenu instead of executing action
										if (hasChildren) {
											navigateToSubmenu(
												menuItem.children as MenuItem[],
												menuItem.label as React.ReactNode,
											)
											return
										}

										// Call item's onClick if exists
										const itemOnClick = menuItem.onClick as
											| (() => void)
											| undefined
										itemOnClick?.()

										// Call menu's onClick if exists
										if (menu?.onClick) {
											const clickEvent = new MouseEvent("click")
											;(
												menu.onClick as (info: {
													key: string
													keyPath: string[]
													domEvent: React.MouseEvent<HTMLElement>
												}) => void
											)({
												key,
												keyPath: [key],
												domEvent:
													clickEvent as unknown as React.MouseEvent<HTMLElement>,
											})
										}

										// Close drawer after clicking
										handleOpenChange(false)
									}}
								/>
							)
						})}
					</ActionGroup>
				))}
			</>
		)
	}

	// Handle click on trigger
	const handleTriggerClick = (e: React.MouseEvent) => {
		if (disabled) return

		// For context menu trigger, we need to handle it differently
		if (isContextMenu) {
			e.preventDefault()
			handleOpenChange(!actualOpen)
		} else {
			handleOpenChange(!actualOpen)
		}
	}

	// For context menu, we need to handle onContextMenu event
	const triggerProps = isContextMenu
		? {
				onContextMenu: (e: React.MouseEvent) => {
					e.preventDefault()
					if (!disabled) {
						handleOpenChange(!actualOpen)
					}
				},
			}
		: {
				onClick: handleTriggerClick,
			}

	return (
		<>
			{/* Trigger element */}
			<span {...triggerProps} className="inline-flex">
				{children}
			</span>

			{/* Action Drawer */}
			<ActionDrawer
				{...mobileProps}
				open={actualOpen}
				onOpenChange={handleOpenChange}
				title={
					currentTitle ? (
						<div className="flex w-full items-center gap-2">
							<button
								type="button"
								onClick={navigateBack}
								className="flex items-center justify-center rounded-md p-1 hover:bg-accent"
							>
								<ChevronLeftIcon className="size-4" />
							</button>
							<span className="flex-1">{currentTitle}</span>
						</div>
					) : (
						mobileProps?.title
					)
				}
				showCancel={mobileProps?.showCancel ?? true}
			>
				{popupRender ? popupRender(menu) : renderMenuItems(currentItems)}
			</ActionDrawer>
		</>
	)
}

export default MagicDropdownMobile
