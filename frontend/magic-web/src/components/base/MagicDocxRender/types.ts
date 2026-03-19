import type { ReactNode, CSSProperties } from "react"

// Base interfaces
export interface BaseComponentProps {
	className?: string
	style?: CSSProperties
	children?: ReactNode
}

// Component specific interfaces
export interface MagicDocxRenderProps extends BaseComponentProps {
	/** docx file to preview */
	file: File
	/** height of the preview container */
	height: string
	/** width of the preview container */
	width?: string
	/** show toolbar */
	showToolbar?: boolean
	/** initial scale */
	initialScale?: number
	/** minimum scale */
	minScale?: number
	/** maximum scale */
	maxScale?: number
	/** scale step */
	scaleStep?: number
	/** enable keyboard shortcuts */
	enableKeyboard?: boolean
	/** enable touch gestures */
	enableTouchGestures?: boolean
	/** auto scale to fit */
	autoScale?: boolean
	/** callback when preview is ready */
	onReady?: () => void
	/** callback when error occurs */
	onError?: (error: Error) => void
	/** callback when loading state changes */
	onLoadingChange?: (loading: boolean) => void
	/** callback when scale changes */
	onScaleChange?: (scale: number) => void

	/** enable dark mode */
	darkMode?: boolean
	/** custom render options */
	renderOptions?: DocxRenderOptions
	/** show download button */
	showDownload?: boolean
	/** show fullscreen button */
	showFullscreen?: boolean
	/** show reload button */
	showReload?: boolean
}

// docx-preview options interface
export interface DocxRenderOptions {
	/** enable page breaks */
	breakPages?: boolean
	/** ignore empty paragraphs */
	ignoreLastRenderedPageBreak?: boolean
	/** ignore width constraints */
	ignoreWidth?: boolean
	/** ignore height constraints */
	ignoreHeight?: boolean
	/** ignore fonts */
	ignoreFonts?: boolean
	/** use base64 URL for images */
	useBase64URL?: boolean
	/** use local file system for images */
	useMathMLPolyfill?: boolean
	/** render header and footer */
	renderHeaders?: boolean
	/** render footnotes */
	renderFootnotes?: boolean
	/** render endnotes */
	renderEndnotes?: boolean
	/** experimental features */
	experimental?: boolean
	/** trim XML whitespace */
	trimXmlDeclaration?: boolean
	/** debug mode */
	debug?: boolean
}

// Component state interface
export interface DocxRenderState {
	loading: boolean
	error?: Error
	ready: boolean
	scale: number
	currentSection: number
	totalSections: number
	isStabilizing: boolean
	isAutoScaling: boolean
}

// Toolbar props interface
export interface ToolbarProps {
	scale: number
	minScale: number
	maxScale: number
	scaleStep: number
	currentSection: number
	totalSections: number
	isCompactMode: boolean
	zoomIn: () => void
	zoomOut: () => void
	setZoomScale: (scale: number | null) => void
	reload: () => void
	downloadFile: () => void
	toggleFullscreen: () => void
	goToSection: (section: number | null) => void
	goToPrevSection: () => void
	goToNextSection: () => void
	styles: any
	showDownload?: boolean
	showFullscreen?: boolean
	showReload?: boolean
}

// Navigation props interface
export interface NavigationProps {
	currentSection: number
	totalSections: number
	goToPrevSection: () => void
	goToNextSection: () => void
	goToSection: (section: number | null) => void
	isCompactMode: boolean
	styles: any
}

// Zoom controls props interface
export interface ZoomControlsProps {
	scale: number
	minScale: number
	maxScale: number
	scaleStep: number
	zoomIn: () => void
	zoomOut: () => void
	setZoomScale: (scale: number | null) => void
	styles: any
}

// Error types
export class DocxRenderError extends Error {
	constructor(
		message: string,
		public cause?: Error,
	) {
		super(message)
		this.name = "DocxRenderError"
	}
}

// Event handler types
export type EventHandler<T = void> = (event: T) => void
export type AsyncEventHandler<T = void> = (event: T) => Promise<void>

// Container size interface
export interface ContainerSize {
	width: number
	height: number
}

// Section info interface
export interface SectionInfo {
	index: number
	title: string
	element: HTMLElement
	offsetTop: number
}
