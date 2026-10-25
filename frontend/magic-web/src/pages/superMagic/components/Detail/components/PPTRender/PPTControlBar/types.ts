export interface PPTControlBarProps {
	animationOnly?: boolean
	activeIndex: number
	buildProgress?: { step: number; total: number }
	totalSlides: number
	canGoPrevious?: boolean
	canGoNext?: boolean
	isTransitioning: boolean
	isMobile: boolean
	isFullscreen: boolean
	isStarting?: boolean
	isRefreshingCurrentSlide: boolean
	onRefreshCurrentSlide?: () => void
	onPrevSlide: () => void
	onNextSlide: () => void
	onGoToFirstSlide: () => void
	onRefreshSlides: () => void
	refreshAllProgress?: { done: number; total: number } | null
	onJumpToPage: (index: number) => void
	onToggleFullscreen: () => void
	presenterScreens?: ReadonlyArray<{ label?: string; isPrimary?: boolean }>
	selectedPresenterScreen?: number | null
	onSelectPresenterScreen?: (index: number) => void
	onReplaceTemplate?: () => void
	notesVisible?: boolean
	onToggleNotes?: () => void
	onOpenTransitions?: () => void
	onToggleBuildPanel?: () => void
	buildPanelOpen?: boolean
	scaleRatio: number
	isAutoScale: boolean
	portalContainer: HTMLElement | null
	onScaleChange: (scale: number) => void
	onResetScale: () => void
	className?: string
	/** Right offset (CSS length) that keeps the bar clear of a docked side panel. */
	rightInset?: string | number
	currentFileId?: string
}
