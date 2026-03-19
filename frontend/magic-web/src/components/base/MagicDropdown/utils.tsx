import type { MenuProps } from "antd"
import { Fragment } from "react"
import {
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuLabel,
	DropdownMenuSub,
	DropdownMenuSubTrigger,
	DropdownMenuSubContent,
} from "@/components/shadcn-ui/dropdown-menu"
import {
	ContextMenuItem,
	ContextMenuSeparator,
	ContextMenuLabel,
	ContextMenuSub,
	ContextMenuSubTrigger,
	ContextMenuSubContent,
} from "@/components/shadcn-ui/context-menu"
import { cn } from "@/lib/utils"

interface ConvertOptions {
	onClick?: (info: { key: string; keyPath?: string[]; domEvent?: Event }) => void
	isContextMenu?: boolean
}

/**
 * Convert Ant Design placement to Radix side and align
 */
export function convertPlacement(placement?: string): {
	side: "top" | "right" | "bottom" | "left"
	align?: "start" | "center" | "end"
} {
	const placementMap: Record<
		string,
		{ side: "top" | "right" | "bottom" | "left"; align?: "start" | "center" | "end" }
	> = {
		top: { side: "top", align: "center" },
		topLeft: { side: "top", align: "start" },
		topRight: { side: "top", align: "end" },
		bottom: { side: "bottom", align: "center" },
		bottomLeft: { side: "bottom", align: "start" },
		bottomRight: { side: "bottom", align: "end" },
		left: { side: "left", align: "center" },
		leftTop: { side: "left", align: "start" },
		leftBottom: { side: "left", align: "end" },
		right: { side: "right", align: "center" },
		rightTop: { side: "right", align: "start" },
		rightBottom: { side: "right", align: "end" },
	}

	return placementMap[placement || "bottom"] || { side: "bottom", align: "center" }
}

/**
 * Convert Ant Design menu items to shadcn components
 */
export function convertMenuItemsToComponents(
	items: MenuProps["items"],
	options: ConvertOptions = {},
): React.ReactNode {
	const { onClick, isContextMenu = false } = options

	if (!items) return null

	const ItemComponent = isContextMenu ? ContextMenuItem : DropdownMenuItem
	const SeparatorComponent = isContextMenu ? ContextMenuSeparator : DropdownMenuSeparator
	const LabelComponent = isContextMenu ? ContextMenuLabel : DropdownMenuLabel
	const SubComponent = isContextMenu ? ContextMenuSub : DropdownMenuSub
	const SubTriggerComponent = isContextMenu ? ContextMenuSubTrigger : DropdownMenuSubTrigger
	const SubContentComponent = isContextMenu ? ContextMenuSubContent : DropdownMenuSubContent

	return items.map((item, index) => {
		if (!item) return null

		// Handle divider/separator
		if (item.type === "divider") {
			return <SeparatorComponent key={`divider-${index}`} />
		}

		// Handle group
		if (item.type === "group") {
			return (
				<Fragment key={item.key || `group-${index}`}>
					{item.label && <LabelComponent>{item.label}</LabelComponent>}
					{convertMenuItemsToComponents((item as any).children, options)}
				</Fragment>
			)
		}

		// Handle submenu (items with children)
		if ((item as any).children && Array.isArray((item as any).children)) {
			const submenuItem = item as any
			const submenuTestId = submenuItem["data-testid"]
			return (
				<SubComponent key={submenuItem.key || `sub-${index}`}>
					<SubTriggerComponent data-testid={submenuTestId} className="!gap-1.5 !p-1.5">
						{submenuItem.icon && (
							<span
								className={cn(
									"flex size-4 shrink-0 items-center justify-center",
									submenuItem?.danger && "text-red-500",
								)}
							>
								{submenuItem.icon}
							</span>
						)}
						{submenuItem.label}
					</SubTriggerComponent>
					<SubContentComponent>
						{convertMenuItemsToComponents(submenuItem.children, options)}
					</SubContentComponent>
				</SubComponent>
			)
		}

		// Handle regular menu item
		const menuItem = item as any
		const menuItemTestId = menuItem["data-testid"]
		return (
			<ItemComponent
				key={menuItem.key || `item-${index}`}
				disabled={menuItem.disabled}
				variant={menuItem.danger ? "destructive" : "default"}
				data-testid={menuItemTestId}
				className="!gap-1.5 !p-1.5"
				onSelect={(event) => {
					// Call the global onClick handler
					if (onClick) {
						onClick({
							key: menuItem.key as string,
							keyPath: [menuItem.key as string],
							domEvent: event as unknown as Event,
						})
					}
					// Call item-specific onClick if it exists
					if (menuItem.onClick) {
						menuItem.onClick({
							key: menuItem.key as string,
							keyPath: [menuItem.key as string],
							domEvent: event as unknown as Event,
						})
					}
				}}
			>
				{menuItem.icon && (
					<span className={cn("shrink-0", menuItem?.danger && "text-red-500")}>
						{menuItem.icon}
					</span>
				)}
				<span className="flex-1">{menuItem.label}</span>
			</ItemComponent>
		)
	})
}
