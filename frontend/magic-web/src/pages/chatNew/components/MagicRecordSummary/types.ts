import type { CSSProperties, DetailedHTMLProps, HTMLAttributes } from "react"

export type LengthType = number | string

interface CommonProps extends DetailedHTMLProps<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement> {
	color?: string
	loading?: boolean
	cssOverride?: CSSProperties
	speedMultiplier?: number
}

export interface LoaderHeightWidthRadiusProps extends CommonProps {
	height?: LengthType
	width?: LengthType
	radius?: LengthType
	margin?: LengthType
}
