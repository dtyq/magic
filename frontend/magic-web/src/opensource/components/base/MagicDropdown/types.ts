import type { MenuProps } from "antd"
import type { ReactNode } from "react"
import type { DropdownMenuContentProps } from "@radix-ui/react-dropdown-menu"
import type { ActionDrawerProps } from "@/opensource/components/shadcn-composed/action-drawer"

/**
 * MagicDropdown props - maintains backward compatibility with Ant Design API
 */
export interface MagicDropdownProps {
	/**
	 * Menu configuration
	 */
	menu?: MenuProps

	/**
	 * Custom class name for the dropdown overlay
	 */
	overlayClassName?: string

	/**
	 * Custom styles for the dropdown overlay (for positioning)
	 */
	overlayStyle?: React.CSSProperties

	/**
	 * Custom class name for the root element
	 */
	rootClassName?: string

	/**
	 * Trigger mode
	 * - 'click': Click to trigger (default)
	 * - 'hover': Hover to trigger
	 * - 'contextMenu': Right-click to trigger
	 */
	trigger?: ("click" | "hover" | "contextMenu")[]

	/**
	 * Placement of the dropdown
	 * e.g., 'bottomLeft', 'bottomRight', 'topLeft', 'topRight', etc.
	 */
	placement?: string

	/**
	 * Whether the dropdown is visible (controlled mode)
	 */
	open?: boolean

	/**
	 * Callback when dropdown visibility changes
	 */
	onOpenChange?: (open: boolean) => void

	/**
	 * Callback when interaction happens outside dropdown content (desktop only)
	 */
	onInteractOutside?: DropdownMenuContentProps["onInteractOutside"]

	/**
	 * Callback when Escape key is pressed while dropdown is open (desktop only)
	 */
	onEscapeKeyDown?: DropdownMenuContentProps["onEscapeKeyDown"]

	/**
	 * Custom render function for the dropdown content
	 */
	popupRender?: (menu?: MenuProps) => ReactNode

	/**
	 * Function to get the container element for the dropdown portal
	 * @param triggerNode - The trigger element (optional, for compatibility with Ant Design API)
	 */
	getPopupContainer?: (triggerNode?: HTMLElement) => HTMLElement

	/**
	 * Whether the dropdown trigger is disabled
	 */
	disabled?: boolean

	/**
	 * Whether to show an arrow pointing to the trigger
	 */
	arrow?: boolean

	/**
	 * Props for mobile ActionDrawer (only used on mobile)
	 * Includes title, showCancel, cancelText, className, etc.
	 */
	mobileProps?: Partial<Omit<ActionDrawerProps, "open" | "onOpenChange" | "children">>

	/**
	 * Trigger element
	 */
	children: ReactNode
	/**
	 * Whether to show a title for the dropdown
	 */
	model?: boolean
}
