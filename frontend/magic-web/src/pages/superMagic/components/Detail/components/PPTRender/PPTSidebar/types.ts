/**
 * Slide loading state
 */
import type { PPTDeckTools } from "../hooks/usePPTDeckTools"

export type SlideLoadingState = "idle" | "loading" | "loaded" | "error"

export interface PPTSidebarProps {
	onOpenTransitions?: (index?: number) => void
	tools?: PPTDeckTools
	hiddenPaths?: ReadonlySet<string>
	onOpenFile?: (fileId: string, path: string) => void
	onSlideClick: (index: number) => void
	onSortChange?: (newSlides: SlideItem[]) => void
	onInsertSlide?: (position: number, direction: "before" | "after") => void | Promise<void>
	onDuplicateSlide?: (index: number) => void | Promise<void>
	onDeleteSlide?: (index: number) => void
	onRenameSlide?: (index: number, newFileName: string) => void | Promise<void | boolean>
	onRefreshSlide?: (index: number) => void | Promise<void>
	onRegenerateScreenshot?: (index: number) => void // Regenerate screenshot only without reloading content
	onAddToCurrentChat?: (index: number) => void
	onAddToNewChat?: (index: number) => void | Promise<void>
	onReplaceSlideTemplate?: (index: number) => void
	isMobile?: boolean
	sidebarWidth?: number
	allowEdit?: boolean
	canReplaceTemplate?: boolean
	isCollapsed?: boolean // External control of collapsed state
	isPreviewLoadingEnabled?: boolean // Whether the sidebar may request HTML and thumbnails
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
	/** 与 rawContent/content 配对；直接覆盖内容时必须清除，避免持久缓存复用旧依赖。 */
	resourceVersionSignature?: string | null
	loadingState?: SlideLoadingState // Slide loading state (idle -> loading -> loaded/error)
	loadingError?: Error // Error if loading failed
	// Screenshot properties
	thumbnailUrl?: string // Screenshot thumbnail URL (blob URL)
	thumbnailLoading?: boolean // Whether screenshot is being generated
	thumbnailError?: Error // Screenshot generation error if any
	// Expiration tracking
	lastLoadedAt?: number // Timestamp when content was last loaded
	/** Increments when raw HTML metadata changes without changing visual content. */
	rawRevision?: number
}

export interface SlideScreenshot {
	index: number
	thumbnailUrl: string
	isLoading: boolean
	error?: Error
}

export interface SortableSlideItemProps {
	onOpenTransitions?: () => void
	item: SlideItem
	isActive: boolean
	onClick: (
		event?: React.MouseEvent<HTMLDivElement> | React.KeyboardEvent<HTMLDivElement>,
	) => void
	isSelected?: boolean
	selectionMode?: boolean
	onSelect?: (range: boolean) => void
	isHidden?: boolean
	onToggleHidden?: () => void | Promise<void>
	removeOnly?: boolean
	screenshot?: SlideScreenshot
	totalSlides: number
	onInsertAbove?: () => void | Promise<void>
	onInsertBelow?: () => void | Promise<void>
	onDuplicate?: () => void | Promise<void>
	onDelete?: () => void
	onRename?: (newFileName: string) => void | Promise<void | boolean>
	onAddToCurrentChat?: () => void
	onAddToNewChat?: () => void | Promise<void>
	onReplaceTemplate?: () => void
	onOpenFile?: (fileId: string, path: string) => void
	onLocateFile?: () => void // Callback to locate file in file tree
	onRefresh?: () => void | Promise<void> // Callback to refresh slide content
	onRegenerateScreenshot?: () => void // Callback to regenerate screenshot only
	className?: string
	isMobile?: boolean
	allowEdit?: boolean
	slideFileId?: string
	slideFullRelativePath?: string
	slideDimensions?: {
		width: number
		height: number
	}
	onSlideDragStart?: (e: React.DragEvent, slideId: string) => void
}
