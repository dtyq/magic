import { useExportFields } from "@/MagicJsonSchemaEditor/context/ExportFieldsContext/useExportFields"
import React from "react"

interface LineProps {
	x1: number
	y1: number
	x2: number
	y2: number
	horizontal?: boolean
	[key: string]: any
}

const SvgLine = ({ x1, y1, x2, y2, horizontal, ...props }: LineProps) => {
	const { showExportCheckbox } = useExportFields()

	const _x1 = showExportCheckbox ? x1 + 22 : x1
	const _x2 = showExportCheckbox ? x2 + 22 : x2

	if (horizontal)
		return (
			<svg width="100%" height="100%" {...props}>
				<line x1={_x1} y1={y1} x2={_x2} y2={y2} stroke="#888A92" strokeWidth="1" />
			</svg>
		)

	const endX = _x1 + 12 // 弧线的结束点 x 坐标
	const endY = y2

	const radius = 8
	let d = `M ${_x1} ${y1}`

	// 第一个折点
	const [curveX1, curveY1] = [_x2, y2]
	d = `${d} L ${curveX1} ${curveY1 - radius}`

	// 第一个折点圆弧
	d = `${d} Q ${curveX1} ${curveY1} ${curveX1 + 10} ${curveY1}`

	return (
		<svg width="100%" height="100%" {...props}>
			<line x1={_x1} y1={y1} x2={_x2} y2={y2 - radius} stroke="#888A92" strokeWidth="1" />
			{/* 绘制贝塞尔曲线和圆点 */}
			<path d={d} fill="none" stroke="#888A92" strokeWidth="1" />
			<circle cx={endX} cy={endY} r="2" fill="#888A92" />
		</svg>
	)
}

export default SvgLine
