export interface PPTControlBarProps {
	activeIndex: number
	totalSlides: number
	isTransitioning: boolean
	isMobile: boolean
	isFullscreen: boolean
	onPrevSlide: () => void
	onNextSlide: () => void
	onGoToFirstSlide: () => void
	onRefreshSlides: () => void
	onJumpToPage: (index: number) => void
	onToggleFullscreen: () => void
	t: (key: string) => string
	className?: string
}
