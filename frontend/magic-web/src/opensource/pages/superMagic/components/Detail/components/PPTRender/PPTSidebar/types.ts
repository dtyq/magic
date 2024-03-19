/**
 * Slide loading state
 */
export type SlideLoadingState = "idle" | "loading" | "loaded" | "error"

export interface PPTSidebarProps {
	onSlideClick: (index: number) => void
	onSortChange?: (newSlides: SlideItem[]) => void
	onInsertSlide?: (position: number, direction: "before" | "after") => void
	onDeleteSlide?: (index: number) => void
	onRenameSlide?: (index: number, newFileName: string) => void
	onRefreshSlide?: (index: number) => void
	onRegenerateScreenshot?: (index: number) => void // Regenerate screenshot only without reloading content
	onAddToCurrentChat?: (index: number) => void
	onAddToNewChat?: (index: number) => void
	mainFileId?: string
	isMobile?: boolean
	allowEdit?: boolean
	isCollapsed?: boolean // External control of collapsed state
	onCollapsedChange?: (collapsed: boolean) => void // Callback when collapsed state changes
}

export interface SlideItem {
	id: string
	url?: string
	index: number
	path: string
	title?: string
	rawContent?: string // Raw unprocessed HTML content
	content?: string // Processed HTML content
	loadingState?: SlideLoadingState // Slide loading state (idle -> loading -> loaded/error)
	loadingError?: Error // Error if loading failed
	// Screenshot properties
	thumbnailUrl?: string // Screenshot thumbnail URL (blob URL)
	thumbnailLoading?: boolean // Whether screenshot is being generated
	thumbnailError?: Error // Screenshot generation error if any
	// Expiration tracking
	lastLoadedAt?: number // Timestamp when content was last loaded
}

export interface SlideScreenshot {
	index: number
	thumbnailUrl: string
	isLoading: boolean
	error?: Error
}

export interface SortableSlideItemProps {
	item: SlideItem
	isActive: boolean
	onClick: () => void
	screenshot?: SlideScreenshot
	totalSlides: number
	onInsertAbove?: () => void
	onInsertBelow?: () => void
	onDelete?: () => void
	onRename?: (newFileName: string) => void
	onAddToCurrentChat?: () => void
	onAddToNewChat?: () => void
	onLocateFile?: () => void // Callback to locate file in file tree
	onRefresh?: () => void // Callback to refresh slide content
	onRegenerateScreenshot?: () => void // Callback to regenerate screenshot only
	onVisible?: () => void // Callback when slide becomes visible
	scrollContainerRef?: React.RefObject<HTMLElement> // Scroll container ref for Intersection Observer
	mainFileId?: string
	className?: string
	isMobile?: boolean
	allowEdit?: boolean
	slideFileId?: string
	onSlideDragStart?: (e: React.DragEvent, index: number) => void
	onSlideDragOver?: (e: React.DragEvent, index: number) => void
	onSlideDrop?: (e: React.DragEvent, index: number) => void
	onSlideDragLeave?: (e: React.DragEvent) => void
}
