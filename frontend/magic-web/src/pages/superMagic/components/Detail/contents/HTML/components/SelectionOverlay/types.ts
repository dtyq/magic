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
	computedStyles: Record<string, string>
	rotation?: number
}

export interface ResizeHandleConfig {
	id: string
	cursor: string
	directionX: number
	directionY: number
	style: CSSProperties
}
