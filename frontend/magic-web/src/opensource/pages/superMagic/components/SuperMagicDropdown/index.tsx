import SuperMagicDropdown from "./SuperMagicDropdown"

// 默认导出
export default SuperMagicDropdown

export { default as SuperMagicDropdown } from "./SuperMagicDropdown"
export { default as useSuperMagicDropdown } from "./useSuperMagicDropdown"
export type {
	SuperMagicDropdownProps,
	UseSuperMagicDropdownReturn,
	DropdownDelegateProps,
} from "./types"
export {
	selectBestPlacement,
	createEventHandler,
	createSmartEventHandler,
	getViewportSize,
	adjustPositionForBoundary,
} from "./utils"
