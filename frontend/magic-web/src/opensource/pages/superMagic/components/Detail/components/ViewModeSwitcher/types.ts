export type ViewMode = "code" | "desktop" | "phone"

export interface ViewModeSwitcherProps {
	/** Current view mode */
	viewMode: ViewMode
	/** Callback when view mode changes */
	onViewModeChange: (mode: ViewMode) => void
	/** Whether in mobile layout */
	isMobile?: boolean
	/** Whether to enable phone mode */
	enableMobileMode?: boolean
	/** Test id for the root element */
	"data-testid"?: string
}
