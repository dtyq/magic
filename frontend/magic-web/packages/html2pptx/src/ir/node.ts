import type PptxGenJS from "pptxgenjs"
import type { ElementNode } from "./dom"
import type {
	PPTFill,
	PPTLine,
	PPTRadialGradientFill,
	PPTLinearGradientFill,
	PPTShadow,
	PPTTableRow,
} from "./style"
import type { SlideConfig } from "../api/options"
import type { MediaSourceDescriptor } from "../media/source-descriptor"

/**
 * PPT intermediate representation (IR): the PPT node data shape passed between pipeline stages.
 * It integrates with pptxgenjs instances, but is plain data and does not operate on the SDK directly.
 */

// ============================================================================
// Base types
// ============================================================================

export type PPTXGenCore = typeof PptxGenJS
export type Pptx = InstanceType<PPTXGenCore>
export type Slide = ReturnType<Pptx["addSlide"]>

// ============================================================================
// Node unions and base structure
// ============================================================================

/** Base PPT node properties */
export interface PPTNodeBase {
	/** Node type */
	type: string
	/** X coordinate in inches */
	x: number
	/** Y coordinate in inches */
	y: number
	/** Width in inches */
	w: number
	/** Height in inches */
	h: number
	/** Draw order */
	zOrder: number
	/** Rotation angle in degrees */
	rotate?: number
}

/** custGeom path points */
export type CustGeomPoint =
	| { x: number; y: number; moveTo?: boolean }
	| { x: number; y: number; curve: { type: "quadratic"; x1: number; y1: number } }
	| {
			x: number
			y: number
			curve: { type: "cubic"; x1: number; y1: number; x2: number; y2: number }
	  }
	| {
			x: number
			y: number
			curve: { type: "arc"; hR: number; wR: number; stAng: number; swAng: number }
	  }
	| { close: true }

/** Shape node */
export interface PPTShapeNode extends PPTNodeBase {
	type: "shape"
	/** Shape type */
	shapeType: "rect" | "roundRect" | "ellipse" | "custGeom"
	/** Fill */
	fill: PPTFill | null
	/** Border line */
	line: PPTLine | null
	/** Shadow */
	shadow: PPTShadow | null
	/** Corner radius in inches */
	radius?: number
	/** custGeom path points (used when shapeType === "custGeom") */
	points?: CustGeomPoint[]
	/** Soft-edge radius in points */
	softEdge?: number
	/** Rotation angle in degrees */
	rotate?: number
	/** Text inside a shape, used for badges and similar cases where text and shape must be centered together */
	text?: {
		value: string
		fontSize: number
		fontFace: string
		color: string
		bold?: boolean
		italic?: boolean
		underline?: boolean
		strike?: boolean
		align?: "left" | "center" | "right"
		valign?: "top" | "middle" | "bottom"
		/** Text insets in CSS order: [top, right, bottom, left], points */
		margin?: [number, number, number, number]
		wrap?: boolean
	}
}

/** Image node */
export interface PPTImageNode extends PPTNodeBase {
	type: "image"
	/** Stable business identity (for example data-original-path) used for media deduplication. */
	assetKey?: string
	/** Repeatable binary/streaming source used by every export path. */
	source: MediaSourceDescriptor
	/** Capture source */
	capture?: "snapdom"
	/** Capture target element */
	captureElement?: Element
	/** Capture only the element background without children, used as fallback for multi-gradient backgrounds */
	captureBackgroundOnly?: boolean
	/** Exclude text when capturing the SVG root; keep only graphics */
	captureExcludeSvgText?: boolean
	/** Sizing mode */
	sizing: "cover" | "contain" | "crop" | "stretch"
	/** Intrinsic source dimensions, used to preserve the image aspect ratio for cover/contain sizing */
	intrinsicSize?: { width: number; height: number }
	/** CSS object-position expressed as an axis fraction plus an optional box-relative offset. */
	objectPosition?: { x: number; y: number; offsetX?: number; offsetY?: number }
	/** Crop rectangle */
	cropRect?: { x: number; y: number; w: number; h: number }
	/** Corner radius */
	radius?: number
	/** Transparency (0-100) */
	transparency?: number
}

/** Text gradient */
export type PPTTextGradient = PPTLinearGradientFill | PPTRadialGradientFill

/** Rich text run style; fontWeight is kept internally for font detection and stripped during drawing */
export interface PPTTextRunOptions {
	fontSize?: number
	fontFace?: string
	fontWeight?: number
	color?: string
	bold?: boolean
	italic?: boolean
	underline?: boolean
	strike?: boolean
	charSpacing?: number
	transparency?: number
	/** Start this run with a PowerPoint soft line break (`<a:br/>`) */
	softBreakBefore?: boolean
	/** End the current visual line after this run */
	breakLine?: boolean
}

/** Rich text run within one PPT text box */
export interface PPTTextRun {
	text: string
	options?: PPTTextRunOptions
}

/** Text node; legacy may split by DOM Text Node, while inline-rich can carry multiple rich text runs */
export interface PPTTextNode extends PPTNodeBase {
	type: "text"
	/** Plain text content, or rich text runs within one text box */
	text: string | PPTTextRun[]
	/** Font size (pt) */
	fontSize: number
	/** Font */
	fontFace: string
	/** Font weight */
	fontWeight: number
	/** Color (HEX or gradient object) */
	color: string | PPTTextGradient
	/** Bold */
	bold: boolean
	/** Italic */
	italic: boolean
	/** Underline */
	underline: boolean
	/** Strikethrough */
	strike?: boolean
	/** Horizontal alignment */
	align?: "left" | "center" | "right" | "justify"
	/** Vertical alignment */
	valign?: "top" | "middle" | "bottom"
	/** Legacy line-spacing multiple (for example, 1.4 means 140%) */
	lineSpacing?: number
	/** Exact line spacing in points; takes precedence over the legacy line-spacing multiple */
	lineSpacingPt?: number
	/** Whether text wraps */
	wrap?: boolean
	/** Transparency (0-100) */
	transparency?: number
	/** Character spacing in points */
	charSpacing?: number
	/** Shadow */
	shadow?: PPTShadow | null
	/** Text insets in CSS order: [top, right, bottom, left], points */
	margin?: [number, number, number, number]
	/** Rotation angle in degrees */
	rotate?: number
	/** Text outline, used to simulate text-stroke */
	outline?: {
		color: string
		size: number
		transparency?: number
	}
}

/** Table node */
export interface PPTTableNode extends PPTNodeBase {
	type: "table"
	/** Table rows */
	rows: PPTTableRow[]
	/** Column widths in inches */
	colWidths: number[]
	/** Row heights in inches */
	rowHeights?: number[]
}

/** Per-side border line node */
export interface PPTBorderLineNode extends PPTNodeBase {
	type: "borderLine"
	/** Border side */
	side: "top" | "right" | "bottom" | "left"
	/** Line style */
	line: PPTLine
	/** Custom geometry path, used when rounded borders are rendered as filled shapes instead of straight lines */
	points?: CustGeomPoint[]
	/** Fill color for rounded border fills */
	fillColor?: string
	/** Fill transparency (0-100) */
	fillTransparency?: number
}

/** Media node */
export interface PPTMediaNode extends PPTNodeBase {
	type: "media"
	/** Media type */
	mediaType: "video" | "audio" | "online"
	/** Stable business identity used for media deduplication across signed URLs/pages. */
	assetKey?: string
	/** Optional stable identity for a video poster/cover resource. */
	coverAssetKey?: string
	/** Repeatable binary/streaming source; required for audio/video and omitted for online media. */
	source?: MediaSourceDescriptor
	/** Online video link, such as YouTube */
	link?: string
	/** Binary/streaming video poster source. */
	coverSource?: MediaSourceDescriptor
	/** Whether to autoplay */
	autoplay?: boolean
	/** Only used for main-thread materialization and stripped before serialization; points to `<video>` for first-frame capture when there is no poster */
	coverCaptureElement?: HTMLVideoElement
}

/** PPT node union type */
export type PPTNode =
	| PPTShapeNode
	| PPTImageNode
	| PPTTextNode
	| PPTTableNode
	| PPTBorderLineNode
	| PPTMediaNode

// ============================================================================
// Parser context
// ============================================================================

/** Parser context kept for external compatibility; currently not used directly inside the package */
export interface ParserContext {
	/** Current PPTX instance */
	pptx: Pptx
	/** Current slide */
	slide: Slide
	/** Current element node */
	node: ElementNode
	/** iframe window object */
	iWindow: Window
	/** iframe document object */
	iDocument: Document
	/** Slide configuration */
	config: SlideConfig
}
