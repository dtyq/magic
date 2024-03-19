import { MagicDropdown } from "@/opensource/components/base"
import { MagicDropdownProps } from "@/opensource/components/base/MagicDropdown"

/**
 * SuperMagicDropdown - Wrapper for MagicDropdown
 * Note: Custom menu item height and submenu offset styles are now part of MagicDropdown's default styles
 */
function SuperMagicDropdown(props: MagicDropdownProps) {
	return <MagicDropdown {...props} />
}

export default SuperMagicDropdown
