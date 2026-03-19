/**
 * Slide item for sorting
 */
export interface SortableSlide {
	id: string
	path: string
	url: string
	index: number
	content?: string // HTML content for the slide
	thumbnailUrl?: string // Screenshot URL for thumbnail display
}

/**
 * Props for SlidesSortPanel component
 */
export interface SlidesSortPanelProps {
	slides: string[] // URL array for display
	originalSlidesPaths: string[] // Original paths for saving
	filePathMapping: Map<string, string>
	attachments: any[]
	currentFileId: string
	currentFileName: string
	onSave: (newSlidesUrls: string[]) => void
	onCancel: () => void
	slideContents?: Map<number, string> // HTML contents for each slide
}

/**
 * Props for SortableSlideItem component
 */
export interface SortableSlideItemProps {
	slide: SortableSlide
	index: number
	screenshot?: {
		thumbnailUrl: string
		isLoading: boolean
		error?: Error
	}
}
