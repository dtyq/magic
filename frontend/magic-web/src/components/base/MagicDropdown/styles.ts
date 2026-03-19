/**
 * Tailwind CSS class utilities for MagicDropdown
 * These classes help maintain visual consistency with the original antd-style implementation
 */

/**
 * Base dropdown content styles
 * Matches the original design with:
 * - 10px border radius
 * - Proper spacing for menu items
 * - Hover effects
 */
export const dropdownContentStyles = [
	"rounded-[10px]",
	"border",
	"border-border",
	"bg-popover",
	"p-1",
	"text-popover-foreground",
	"shadow-md",
].join(" ")

/**
 * Menu item styles
 * Matches the original design with:
 * - 4px gap between icon and label
 * - 8px horizontal padding
 * - 10px vertical padding
 * - 10px border radius on hover
 */
export const menuItemStyles = [
	"gap-1",
	"rounded-[10px]",
	"px-2",
	"py-2.5",
	"cursor-pointer",
	"select-none",
	"text-sm",
	"transition-colors",
	"focus:bg-accent",
	"focus:text-accent-foreground",
	"data-[disabled]:pointer-events-none",
	"data-[disabled]:opacity-50",
].join(" ")

/**
 * Destructive (danger) menu item styles
 */
export const destructiveItemStyles = [
	"text-destructive",
	"focus:bg-destructive/10",
	"focus:text-destructive",
	"dark:focus:bg-destructive/20",
].join(" ")

/**
 * Submenu offset
 * Original had transform: translateX(8px)
 * Using sideOffset prop in the component instead
 */
export const submenuSideOffset = 8

/**
 * Icon wrapper styles to match original spacing
 */
export const iconWrapperStyles = "mr-2 flex-shrink-0 flex items-center justify-center"

/**
 * Label wrapper styles
 */
export const labelWrapperStyles = "flex-1"
