import { useIsMobile } from "@/opensource/hooks/use-mobile"
import MagicDropdownDesktop from "./MagicDropdownDesktop"
import MagicDropdownMobile from "./MagicDropdownMobile"
import type { MagicDropdownProps } from "./types"

/**
 * MagicDropdown - A wrapper component that provides backward compatibility with Ant Design Dropdown API
 * while using shadcn/ui components internally.
 *
 * Features:
 * - Automatically switches between Desktop (DropdownMenu/ContextMenu) and Mobile (ActionDrawer) implementations
 * - Converts Ant Design menu.items to shadcn components
 * - Supports all common Ant Design Dropdown props
 * - Maintains visual consistency with Tailwind CSS
 */
function MagicDropdown(props: MagicDropdownProps) {
	const isMobile = useIsMobile()

	if (isMobile) {
		return <MagicDropdownMobile {...props} />
	}

	return <MagicDropdownDesktop {...props} />
}

export default MagicDropdown

export type { MagicDropdownProps }
export { MagicDropdown }
