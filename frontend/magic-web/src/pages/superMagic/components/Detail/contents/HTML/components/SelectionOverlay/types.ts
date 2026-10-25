import type { CSSProperties } from "react"

export interface ElementRect {
	top: number
	left: number
	width: number
	height: number
}

export interface SelectedInfo {
	selector: string
	rect: ElementRect
	childRects?: Array<{
		top: number
		left: number
		width: number
		height: number
		position?: string
		display?: string
	}>
	computedStyles: Record<string, string>
	rotation?: number
	isImageElement?: boolean
	isTextElement?: boolean
	hasDirectTextContent?: boolean
	textContent?: string
	ancestors?: Array<{
		selector: string
		tagName: string
		textContent?: string
		rect: ElementRect
	}>
	inlineStyles?: Record<string, string>
	attributes?: {
		href?: string
		target?: string
		rel?: string
		download?: string
		title?: string
		ariaLabel?: string
	}
	intrinsicWidth?: number
	intrinsicHeight?: number
	intrinsicAspectRatio?: number
}

export interface ResizeHandleConfig {
	id: string
	cursor: string
	directionX: number
	directionY: number
	style: CSSProperties
}
