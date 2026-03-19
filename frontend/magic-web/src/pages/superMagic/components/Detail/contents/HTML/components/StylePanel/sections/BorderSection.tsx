import { observer } from "mobx-react-lite"
import { useCallback, useState } from "react"
import { useDebounceFn } from "ahooks"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import type { StyleSectionProps } from "../types"

const BORDER_STYLES = ["none", "solid", "dashed", "dotted", "double"]

/**
 * 边框样式配置区域
 */
const BorderSection = observer(function BorderSection({
	selectedElement,
	editorRef,
	onStyleChange,
}: StyleSectionProps) {
	const computedStyles = selectedElement?.computedStyles

	// 解析当前值
	const currentBorderWidth = computedStyles?.borderWidth || "0px"
	const currentBorderStyle = computedStyles?.borderStyle || "solid"
	const currentBorderColor = computedStyles?.borderColor || "#000000"
	const currentBorderRadius = computedStyles?.borderRadius || "0px"

	// 本地状态
	const [borderWidth, setBorderWidth] = useState(parseInt(currentBorderWidth) || 0)
	const [borderColor, setBorderColor] = useState(currentBorderColor)
	const [borderRadius, setBorderRadius] = useState(parseInt(currentBorderRadius) || 0)

	// Debounce for input changes
	const { run: onStyleChangeDebounced } = useDebounceFn(
		(property: string, value: string) => {
			onStyleChange?.(property, value)
		},
		{ wait: 300 },
	)

	/**
	 * 处理边框宽度变化
	 */
	const handleBorderWidthChange = useCallback(
		(value: string) => {
			const numValue = parseInt(value)
			if (!isNaN(numValue) && numValue >= 0) {
				setBorderWidth(numValue)
				onStyleChangeDebounced("borderWidth", `${numValue}px`)
			}
		},
		[onStyleChangeDebounced],
	)

	/**
	 * 处理边框样式变化
	 */
	const handleBorderStyleChange = useCallback(
		(value: string) => {
			onStyleChange?.("borderStyle", value)
		},
		[onStyleChange],
	)

	/**
	 * 处理边框颜色变化
	 */
	const handleBorderColorChange = useCallback(
		(value: string) => {
			setBorderColor(value)
			onStyleChangeDebounced("borderColor", value)
		},
		[onStyleChangeDebounced],
	)

	/**
	 * 处理圆角变化
	 */
	const handleBorderRadiusChange = useCallback(
		(value: string) => {
			const numValue = parseInt(value)
			if (!isNaN(numValue) && numValue >= 0) {
				setBorderRadius(numValue)
				onStyleChangeDebounced("borderRadius", `${numValue}px`)
			}
		},
		[onStyleChangeDebounced],
	)

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<h4 className="text-sm font-medium">边框样式</h4>
			</div>

			{/* 边框宽度 */}
			<div className="space-y-2">
				<Label htmlFor="border-width" className="text-xs">
					边框宽度
				</Label>
				<div className="flex items-center gap-2">
					<Input
						id="border-width"
						type="number"
						value={borderWidth}
						onChange={(e) => handleBorderWidthChange(e.target.value)}
						className="flex-1"
						min="0"
					/>
					<span className="text-xs text-muted-foreground">px</span>
				</div>
			</div>

			{/* 边框样式 */}
			<div className="space-y-2">
				<Label htmlFor="border-style" className="text-xs">
					边框样式
				</Label>
				<Select value={currentBorderStyle} onValueChange={handleBorderStyleChange}>
					<SelectTrigger id="border-style">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{BORDER_STYLES.map((style) => (
							<SelectItem key={style} value={style}>
								{style}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>

			{/* 边框颜色 */}
			<div className="space-y-2">
				<Label htmlFor="border-color" className="text-xs">
					边框颜色
				</Label>
				<div className="flex gap-2">
					<Input
						id="border-color"
						type="color"
						value={borderColor}
						onChange={(e) => handleBorderColorChange(e.target.value)}
						className="h-9 w-16 cursor-pointer p-1"
					/>
					<Input
						type="text"
						value={borderColor}
						onChange={(e) => handleBorderColorChange(e.target.value)}
						placeholder="#000000"
						className="flex-1 font-mono text-xs"
					/>
				</div>
			</div>

			{/* 圆角 */}
			<div className="space-y-2">
				<Label htmlFor="border-radius" className="text-xs">
					圆角
				</Label>
				<div className="flex items-center gap-2">
					<Input
						id="border-radius"
						type="number"
						value={borderRadius}
						onChange={(e) => handleBorderRadiusChange(e.target.value)}
						className="flex-1"
						min="0"
					/>
					<span className="text-xs text-muted-foreground">px</span>
				</div>
			</div>
		</div>
	)
})

export default BorderSection
