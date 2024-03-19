/**
 * 对齐类型
 */
export type AlignmentType = "left" | "center" | "right" | "top" | "middle" | "bottom"

/**
 * 对齐信息
 */
export interface AlignmentInfo {
	type: AlignmentType
	position: number
	targetElementId: string
	dragPoints: Array<{ x: number; y: number }>
	targetPoints: Array<{ x: number; y: number }>
}
