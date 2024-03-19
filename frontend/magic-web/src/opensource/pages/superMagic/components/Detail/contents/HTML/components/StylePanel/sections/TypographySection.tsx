import { observer } from "mobx-react-lite"
import { useCallback, useState } from "react"
import { useDebounceFn } from "ahooks"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { Label } from "@/opensource/components/shadcn-ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/opensource/components/shadcn-ui/select"
import { Button } from "@/opensource/components/shadcn-ui/button"
import type { StyleSectionProps } from "../types"

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96]
const FONT_WEIGHTS = ["300", "400", "500", "600", "700", "800", "900"]
const FONT_WEIGHT_LABELS: Record<string, string> = {
	"300": "Light",
	"400": "Regular",
	"500": "Medium",
	"600": "Semibold",
	"700": "Bold",
	"800": "Extrabold",
	"900": "Black",
}

/**
 * 文字样式配置区域
 */
const TypographySection = observer(function TypographySection({
	selectedElement,
	editorRef,
	onStyleChange,
}: StyleSectionProps) {
	const { computedStyles } = selectedElement

	// 解析当前值
	const currentFontSize = parseInt(computedStyles.fontSize) || 16
	const currentFontWeight = computedStyles.fontWeight || "400"
	const currentLineHeight = computedStyles.lineHeight || "normal"
	const currentColor = computedStyles.color || "#000000"

	// 本地状态（用于输入框）
	const [fontSize, setFontSize] = useState(String(currentFontSize))
	const [lineHeight, setLineHeight] = useState(currentLineHeight)
	const [color, setColor] = useState(currentColor)

	// Debounce for input changes
	const { run: onStyleChangeDebounced } = useDebounceFn(
		(property: string, value: string) => {
			onStyleChange?.(property, value)
		},
		{ wait: 300 },
	)

	/**
	 * 处理字体大小变化
	 */
	const handleFontSizeChange = useCallback(
		(value: string) => {
			setFontSize(value)
			const numValue = parseInt(value)
			if (!isNaN(numValue) && numValue > 0) {
				onStyleChangeDebounced("fontSize", `${numValue}px`)
			}
		},
		[onStyleChangeDebounced],
	)

	/**
	 * 处理字体粗细变化
	 */
	const handleFontWeightChange = useCallback(
		(value: string) => {
			onStyleChange?.("fontWeight", value)
		},
		[onStyleChange],
	)

	/**
	 * 处理行高变化
	 */
	const handleLineHeightChange = useCallback(
		(value: string) => {
			setLineHeight(value)
			if (value.trim()) {
				onStyleChangeDebounced("lineHeight", value)
			}
		},
		[onStyleChangeDebounced],
	)

	/**
	 * 处理颜色变化
	 */
	const handleColorChange = useCallback(
		(value: string) => {
			setColor(value)
			onStyleChangeDebounced("color", value)
		},
		[onStyleChangeDebounced],
	)

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<h4 className="text-sm font-medium">文字样式</h4>
			</div>

			{/* 颜色选择 */}
			<div className="space-y-2">
				<Label htmlFor="text-color" className="text-xs">
					文字颜色
				</Label>
				<div className="flex gap-2">
					<Input
						id="text-color"
						type="color"
						value={color}
						onChange={(e) => handleColorChange(e.target.value)}
						className="h-9 w-16 cursor-pointer p-1"
					/>
					<Input
						type="text"
						value={color}
						onChange={(e) => handleColorChange(e.target.value)}
						placeholder="#000000"
						className="flex-1 font-mono text-xs"
					/>
				</div>
			</div>

			{/* 字体大小 */}
			<div className="space-y-2">
				<Label htmlFor="font-size" className="text-xs">
					字体大小
				</Label>
				<div className="flex gap-2">
					<Select value={fontSize} onValueChange={handleFontSizeChange}>
						<SelectTrigger className="flex-1">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{FONT_SIZES.map((size) => (
								<SelectItem key={size} value={String(size)}>
									{size}px
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Input
						id="font-size"
						type="number"
						value={fontSize}
						onChange={(e) => handleFontSizeChange(e.target.value)}
						className="w-20"
						min="1"
					/>
				</div>
			</div>

			{/* 字体粗细 */}
			<div className="space-y-2">
				<Label htmlFor="font-weight" className="text-xs">
					字体粗细
				</Label>
				<Select value={currentFontWeight} onValueChange={handleFontWeightChange}>
					<SelectTrigger id="font-weight">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{FONT_WEIGHTS.map((weight) => (
							<SelectItem key={weight} value={weight}>
								{FONT_WEIGHT_LABELS[weight]} ({weight})
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* 行高 */}
			<div className="space-y-2">
				<Label htmlFor="line-height" className="text-xs">
					行高
				</Label>
				<Input
					id="line-height"
					type="text"
					value={lineHeight}
					onChange={(e) => handleLineHeightChange(e.target.value)}
					placeholder="normal, 1.5, 24px"
					className="font-mono text-xs"
				/>
				<p className="text-xs text-muted-foreground">
					可以是数字（如 1.5）、长度值（如 24px）或 normal
				</p>
			</div>
		</div>
	)
})

export default TypographySection
