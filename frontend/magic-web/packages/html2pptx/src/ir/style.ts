/**
 * Style subtype collection referenced by PPT nodes: fills, borders, shadows, table cells, and related types.
 * These are small plain types composed inside PPTNode and decoupled from concrete nodes.
 */

/** Solid fill */
export interface PPTSolidFill {
	type: "solid"
	color: string
	transparency?: number
}

/** Linear gradient fill */
export interface PPTLinearGradientFill {
	type: "gradient"
	gradientType: "linear"
	/** Gradient stop; position is a 0-1 ratio */
	stops: Array<{ position: number; color: string; transparency?: number }>
	/** Gradient angle (0-360), where 0 is left-to-right and 90 is top-to-bottom */
	angle?: number
	/** Whether to scale with the shape */
	scaled?: boolean
	/** Whether to rotate with the shape */
	rotWithShape?: boolean
	/** Flip mode */
	flip?: "none" | "x" | "xy" | "y"
	/** Tile rectangle settings */
	tileRect?: { t?: number; r?: number; b?: number; l?: number }
}

/** Radial gradient fill */
export interface PPTRadialGradientFill {
	type: "gradient"
	gradientType: "radial"
	/** Gradient stop; position is a 0-1 ratio */
	stops: Array<{ position: number; color: string; transparency?: number }>
	/** Gradient style: 'circle' (default) | 'ellipse' */
	style?: "circle" | "ellipse"
	/** Whether to rotate with the shape */
	rotWithShape?: boolean
	/** Flip mode */
	flip?: "none" | "x" | "xy" | "y"
	/** Tile rectangle settings */
	tileRect?: { t?: number; r?: number; b?: number; l?: number }
}

/** Fill type */
export type PPTFill = PPTSolidFill | PPTLinearGradientFill | PPTRadialGradientFill

/** Union type alias kept for backward compatibility */
export type PPTGradientFill = PPTLinearGradientFill | PPTRadialGradientFill

/** Border line */
export interface PPTLine {
	color: string
	width: number
	style: "solid" | "dashed" | "dotted"
	transparency?: number
}

/** Shadow, using polar coordinates to match the pptxgenjs API */
export interface PPTShadow {
	/** Shadow type */
	type: "outer" | "inner"
	/** Shadow color (HEX) */
	color: string
	/** Blur radius in points */
	blur: number
	/** Offset distance in points */
	offset: number
	/** Angle in degrees, 0-360 */
	angle: number
	/** Transparency (0-1) */
	opacity: number
}

/** Table rows */
export interface PPTTableRow {
	cells: PPTTableCell[]
}

/** Table cell border */
export interface PPTTableCellBorder {
	color?: string
	/** Border transparency (0-100, 0=opaque, 100=fully transparent) */
	transparency?: number
	pt?: number
	type?: "solid" | "dash" | "dot" | "none"
}

/** Table cell text run */
export interface PPTTableTextRun {
	text: string
	options?: {
		color?: string
		fontSize?: number
		fontFace?: string
		bold?: boolean
		italic?: boolean
		charSpacing?: number
		transparency?: number
		paraSpaceBefore?: number
		breakLine?: boolean
	}
}

/** Table cell */
export interface PPTTableCell {
	text: string | PPTTableTextRun[]
	options?: {
		fill?: string
		/** Fill transparency (0-100, 0=opaque, 100=fully transparent) */
		fillTransparency?: number
		color?: string
		fontSize?: number
		fontFace?: string
		bold?: boolean
		italic?: boolean
		charSpacing?: number
		transparency?: number
		align?: "left" | "center" | "right"
		valign?: "top" | "middle" | "bottom"
		colspan?: number
		rowspan?: number
		/** Margin in inches (TRBL), consistent with the default PptxGenJS branch */
		margin?: number | [number, number, number, number]
		/** false emits table-cell bodyPr wrap="none" through the native PptxGenJS v5 runtime */
		wrap?: boolean
		border?:
			| PPTTableCellBorder
			| [PPTTableCellBorder, PPTTableCellBorder, PPTTableCellBorder, PPTTableCellBorder]
	}
}
