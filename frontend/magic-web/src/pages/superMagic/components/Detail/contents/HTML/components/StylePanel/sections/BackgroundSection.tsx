import { observer } from "mobx-react-lite"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useDebounceFn } from "ahooks"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"
import { Slider } from "@/components/shadcn-ui/slider"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type { StyleSectionProps } from "../types"

type BackgroundType = "solid" | "linear-gradient" | "radial-gradient"

interface ColorStop {
	id: string
	color: string
	position: number
}

/**
 * 背景样式配置区域
 */
const BackgroundSection = observer(function BackgroundSection({
	selectedElement,
	onStyleChange,
}: StyleSectionProps) {
	const { t } = useTranslation("super")
	const computedStyles = selectedElement?.computedStyles

	// 解析当前背景
	const currentBgColor = computedStyles?.backgroundColor || "transparent"
	const currentBgImage = computedStyles?.backgroundImage || "none"

	// 本地状态
	const [bgType, setBgType] = useState<BackgroundType>("solid")
	const [solidColor, setSolidColor] = useState(currentBgColor)
	const [gradientAngle, setGradientAngle] = useState(90)
	const [colorStops, setColorStops] = useState<ColorStop[]>([
		{ id: "1", color: "#3b82f6", position: 0 },
		{ id: "2", color: "#8b5cf6", position: 100 },
	])

	/**
	 * 从 backgroundImage 解析渐变设置
	 */
	useEffect(() => {
		if (currentBgImage && currentBgImage !== "none") {
			// 解析线性渐变: linear-gradient(90deg, #3b82f6 0%, #8b5cf6 100%)
			const linearMatch = currentBgImage.match(/linear-gradient\((\d+)deg,(.+)\)/)
			if (linearMatch) {
				setBgType("linear-gradient")
				setGradientAngle(Number.parseInt(linearMatch[1]))
				// 解析色标
				parseColorStops(linearMatch[2])
				return
			}

			// 解析径向渐变: radial-gradient(circle, #3b82f6 0%, #8b5cf6 100%)
			const radialMatch = currentBgImage.match(/radial-gradient\(circle,(.+)\)/)
			if (radialMatch) {
				setBgType("radial-gradient")
				parseColorStops(radialMatch[1])
				return
			}
		}

		// 默认为纯色
		if (currentBgColor !== "transparent") {
			setBgType("solid")
			setSolidColor(currentBgColor)
		}
	}, [currentBgColor, currentBgImage])

	/**
	 * 解析色标字符串
	 */
	function parseColorStops(stopsStr: string) {
		const stops = stopsStr.split(",").map((stop) => stop.trim())
		const parsed = stops
			.map((stop, index) => {
				const match = stop.match(/^(#[0-9a-f]{6}|rgb\(.+\))\s+(\d+)%$/i)
				if (match) {
					return {
						id: String(index + 1),
						color: match[1],
						position: Number.parseInt(match[2]),
					}
				}
				return null
			})
			.filter((stop): stop is ColorStop => stop !== null)

		if (parsed.length >= 2) {
			setColorStops(parsed)
		}
	}

	/**
	 * 生成渐变 CSS 值
	 */
	const generateGradientCSS = useCallback(
		(
			type: BackgroundType = bgType,
			stops: ColorStop[] = colorStops,
			angle: number = gradientAngle,
		) => {
			const sortedStops = [...stops].sort((a, b) => a.position - b.position)
			const stopsStr = sortedStops.map((stop) => `${stop.color} ${stop.position}%`).join(", ")

			if (type === "linear-gradient") {
				return `linear-gradient(${angle}deg, ${stopsStr})`
			}
			if (type === "radial-gradient") {
				return `radial-gradient(circle, ${stopsStr})`
			}
			return "none"
		},
		[bgType, colorStops, gradientAngle],
	)

	// Debounce for color input
	const { run: applyBackgroundDebounced } = useDebounceFn(
		(type: BackgroundType, color: string, gradient: string) => {
			if (type === "solid") {
				onStyleChange?.("backgroundColor", color)
				onStyleChange?.("backgroundImage", "none")
			} else {
				onStyleChange?.("backgroundColor", "transparent")
				onStyleChange?.("backgroundImage", gradient)
			}
		},
		{ wait: 300 },
	)

	/**
	 * 处理背景类型变化
	 */
	const handleBgTypeChange = useCallback(
		(value: BackgroundType) => {
			setBgType(value)
			// 立即应用新类型，使用参数而不是状态以避免时序问题
			if (value === "solid") {
				onStyleChange?.("backgroundColor", solidColor)
				onStyleChange?.("backgroundImage", "none")
			} else {
				onStyleChange?.("backgroundColor", "transparent")
				onStyleChange?.(
					"backgroundImage",
					generateGradientCSS(value, colorStops, gradientAngle),
				)
			}
		},
		[solidColor, colorStops, gradientAngle, generateGradientCSS, onStyleChange],
	)

	/**
	 * 处理纯色变化
	 */
	const handleSolidColorChange = useCallback(
		(value: string) => {
			setSolidColor(value)
			if (bgType === "solid") {
				applyBackgroundDebounced(bgType, value, "")
			}
		},
		[bgType, applyBackgroundDebounced],
	)

	/**
	 * 添加色标
	 */
	const handleAddColorStop = useCallback(() => {
		const newStop: ColorStop = {
			id: Date.now().toString(),
			color: "#6366f1",
			position: 50,
		}
		setColorStops([...colorStops, newStop])
	}, [colorStops])

	/**
	 * 删除色标
	 */
	const handleRemoveColorStop = useCallback(
		(id: string) => {
			if (colorStops.length <= 2) return
			setColorStops(colorStops.filter((stop) => stop.id !== id))
		},
		[colorStops],
	)

	// Debounce for gradient changes
	const { run: applyGradientDebounced } = useDebounceFn(
		(type: BackgroundType, stops: ColorStop[], angle: number) => {
			const sortedStops = [...stops].sort((a, b) => a.position - b.position)
			const stopsStr = sortedStops.map((stop) => `${stop.color} ${stop.position}%`).join(", ")

			let gradientCSS = "none"
			if (type === "linear-gradient") {
				gradientCSS = `linear-gradient(${angle}deg, ${stopsStr})`
			} else if (type === "radial-gradient") {
				gradientCSS = `radial-gradient(circle, ${stopsStr})`
			}

			onStyleChange?.("backgroundColor", "transparent")
			onStyleChange?.("backgroundImage", gradientCSS)
		},
		{ wait: 300 },
	)

	/**
	 * 更新色标颜色
	 */
	const handleColorStopColorChange = useCallback(
		(id: string, color: string) => {
			const newStops = colorStops.map((stop) => (stop.id === id ? { ...stop, color } : stop))
			setColorStops(newStops)
			if (bgType !== "solid") {
				applyGradientDebounced(bgType, newStops, gradientAngle)
			}
		},
		[colorStops, bgType, gradientAngle, applyGradientDebounced],
	)

	/**
	 * 更新色标位置
	 */
	const handleColorStopPositionChange = useCallback(
		(id: string, position: number) => {
			const newStops = colorStops.map((stop) =>
				stop.id === id ? { ...stop, position } : stop,
			)
			setColorStops(newStops)
			if (bgType !== "solid") {
				applyGradientDebounced(bgType, newStops, gradientAngle)
			}
		},
		[colorStops, bgType, gradientAngle, applyGradientDebounced],
	)

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<h4 className="text-sm font-medium">{t("stylePanel.backgroundStyles")}</h4>
			</div>

			{/* 背景类型选择 */}
			<div className="space-y-2">
				<Label className="text-xs">{t("stylePanel.backgroundType")}</Label>
				<Select value={bgType} onValueChange={handleBgTypeChange}>
					<SelectTrigger className="h-9">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="solid">{t("stylePanel.solidColor")}</SelectItem>
						<SelectItem value="linear-gradient">
							{t("stylePanel.linearGradient")}
						</SelectItem>
						<SelectItem value="radial-gradient">
							{t("stylePanel.radialGradient")}
						</SelectItem>
					</SelectContent>
				</Select>
			</div>

			{/* 纯色设置 */}
			{bgType === "solid" && (
				<div className="space-y-2">
					<Label htmlFor="bg-color" className="text-xs">
						{t("stylePanel.backgroundColor")}
					</Label>
					<div className="flex gap-2">
						<Input
							id="bg-color"
							type="color"
							value={solidColor === "transparent" ? "#ffffff" : solidColor}
							onChange={(e) => handleSolidColorChange(e.target.value)}
							className="h-9 w-16 cursor-pointer p-1"
						/>
						<Input
							type="text"
							value={solidColor}
							onChange={(e) => handleSolidColorChange(e.target.value)}
							placeholder={t("stylePanel.backgroundColorPlaceholder")}
							className="flex-1 font-mono text-xs"
						/>
					</div>
				</div>
			)}

			{/* 渐变设置 */}
			{bgType !== "solid" && (
				<>
					{/* 渐变角度（仅线性渐变） */}
					{bgType === "linear-gradient" && (
						<div className="space-y-2">
							<div className="flex items-center justify-between">
								<Label className="text-xs">{t("stylePanel.gradientAngle")}</Label>
								<span className="text-xs text-muted-foreground">
									{gradientAngle}°
								</span>
							</div>
							<Slider
								value={[gradientAngle]}
								onValueChange={([value]) => {
									setGradientAngle(value)
									applyGradientDebounced(bgType, colorStops, value)
								}}
								min={0}
								max={360}
								step={1}
								className="w-full"
							/>
						</div>
					)}

					{/* 渐变预览 */}
					<div className="space-y-2">
						<Label className="text-xs">{t("stylePanel.gradientPreview")}</Label>
						<div
							className="h-16 w-full rounded-md border"
							style={{
								background: generateGradientCSS(),
							}}
						/>
					</div>

					{/* 色标列表 */}
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label className="text-xs">{t("stylePanel.colorStops")}</Label>
							<Button
								size="sm"
								variant="ghost"
								onClick={handleAddColorStop}
								className="h-6 gap-1 px-2 text-xs"
							>
								<Plus className="h-3 w-3" />
								{t("stylePanel.addColorStop")}
							</Button>
						</div>

						<ScrollArea className="h-full max-h-60 space-y-3 overflow-y-auto">
							{colorStops.map((stop) => (
								<div key={stop.id} className="space-y-2 rounded-md border p-3">
									<div className="flex gap-2">
										<Input
											type="color"
											value={stop.color}
											onChange={(e) =>
												handleColorStopColorChange(stop.id, e.target.value)
											}
											className="h-9 w-16 cursor-pointer p-1"
										/>

										<Input
											type="text"
											value={stop.color}
											onChange={(e) =>
												handleColorStopColorChange(stop.id, e.target.value)
											}
											className="flex-1 font-mono text-xs"
										/>
										<Button
											size="sm"
											variant="ghost"
											onClick={() => handleRemoveColorStop(stop.id)}
											disabled={colorStops.length <= 2}
											className="h-9 w-9 p-0"
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>

									<div className="space-y-1">
										<div className="flex items-center justify-between">
											<span className="text-xs text-muted-foreground">
												{t("stylePanel.position")}
											</span>
											<span className="text-xs text-muted-foreground">
												{stop.position}%
											</span>
										</div>
										<Slider
											value={[stop.position]}
											onValueChange={([value]) =>
												handleColorStopPositionChange(stop.id, value)
											}
											min={0}
											max={100}
											step={1}
											className="w-full"
										/>
									</div>
								</div>
							))}
						</ScrollArea>
					</div>
				</>
			)}
		</div>
	)
})

export default BackgroundSection
