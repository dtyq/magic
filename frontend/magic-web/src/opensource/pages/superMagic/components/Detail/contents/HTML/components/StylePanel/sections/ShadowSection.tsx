import { observer } from "mobx-react-lite"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { Label } from "@/opensource/components/shadcn-ui/label"
import { Slider } from "@/opensource/components/shadcn-ui/slider"
import { Checkbox } from "@/opensource/components/shadcn-ui/checkbox"
import type { StyleSectionProps } from "../types"
import {
	parseBoxShadow,
	buildBoxShadow,
	extractHexColor,
	type BoxShadowValue,
} from "../utils/shadowParser"

/**
 * Shadow & Effects style configuration section
 */
const ShadowSection = observer(function ShadowSection({
	selectedElement,
	onStyleChange,
}: StyleSectionProps) {
	const { t } = useTranslation("super")
	const computedStyles = selectedElement?.computedStyles

	// Parse current box shadow
	const currentBoxShadow = computedStyles?.boxShadow || "none"
	const currentOpacity = computedStyles?.opacity || "1"

	// Local state for box shadow
	const [shadow, setShadow] = useState<BoxShadowValue>(() => parseBoxShadow(currentBoxShadow))
	const [opacity, setOpacity] = useState<number>(parseFloat(currentOpacity))

	// Track if user is actively editing
	const isEditingRef = useRef(false)
	const updateTimerRef = useRef<number>()
	const prevSelectorRef = useRef<string>()

	// Sync with computed styles when:
	// 1. Selector changes (new element selected)
	// 2. Not actively editing
	useEffect(() => {
		const currentSelector = selectedElement?.selector
		const selectorChanged = currentSelector !== prevSelectorRef.current

		// Update selector ref
		prevSelectorRef.current = currentSelector

		// Only sync when selector changes and not actively editing
		if (selectorChanged && !isEditingRef.current && computedStyles) {
			setShadow(parseBoxShadow(computedStyles.boxShadow || "none"))
			setOpacity(parseFloat(computedStyles.opacity || "1"))
		}
	}, [selectedElement?.selector, computedStyles])

	// Store latest shadow and opacity in refs
	const shadowRef = useRef(shadow)
	const opacityRef = useRef(opacity)

	// Update refs when state changes
	useEffect(() => {
		shadowRef.current = shadow
	}, [shadow])

	useEffect(() => {
		opacityRef.current = opacity
	}, [opacity])

	/**
	 * Apply box shadow change with debounce
	 */
	const applyBoxShadowChange = useCallback(
		(newShadow: BoxShadowValue) => {
			if (updateTimerRef.current) {
				clearTimeout(updateTimerRef.current)
			}

			updateTimerRef.current = window.setTimeout(() => {
				isEditingRef.current = false
				const shadowString = buildBoxShadow(newShadow)
				onStyleChange?.("boxShadow", shadowString)
			}, 100)
		},
		[onStyleChange],
	)

	/**
	 * Handle offset X change
	 */
	const handleOffsetXChange = useCallback(
		(value: number[]) => {
			isEditingRef.current = true
			const newShadow = { ...shadowRef.current, offsetX: value[0] }
			setShadow(newShadow)
			applyBoxShadowChange(newShadow)
		},
		[applyBoxShadowChange],
	)

	/**
	 * Handle offset Y change
	 */
	const handleOffsetYChange = useCallback(
		(value: number[]) => {
			isEditingRef.current = true
			const newShadow = { ...shadowRef.current, offsetY: value[0] }
			setShadow(newShadow)
			applyBoxShadowChange(newShadow)
		},
		[applyBoxShadowChange],
	)

	/**
	 * Handle blur change
	 */
	const handleBlurChange = useCallback(
		(value: number[]) => {
			isEditingRef.current = true
			const newShadow = { ...shadowRef.current, blur: value[0] }
			setShadow(newShadow)
			applyBoxShadowChange(newShadow)
		},
		[applyBoxShadowChange],
	)

	/**
	 * Handle spread change
	 */
	const handleSpreadChange = useCallback(
		(value: number[]) => {
			isEditingRef.current = true
			const newShadow = { ...shadowRef.current, spread: value[0] }
			setShadow(newShadow)
			applyBoxShadowChange(newShadow)
		},
		[applyBoxShadowChange],
	)

	/**
	 * Handle color change
	 */
	const handleColorChange = useCallback(
		(color: string) => {
			isEditingRef.current = true
			const newShadow = { ...shadowRef.current, color }
			setShadow(newShadow)
			applyBoxShadowChange(newShadow)
		},
		[applyBoxShadowChange],
	)

	/**
	 * Handle inset toggle
	 */
	const handleInsetChange = useCallback(
		(checked: boolean) => {
			isEditingRef.current = true
			const newShadow = { ...shadowRef.current, inset: checked }
			setShadow(newShadow)
			// Apply immediately for checkbox
			const shadowString = buildBoxShadow(newShadow)
			onStyleChange?.("boxShadow", shadowString)
			setTimeout(() => {
				isEditingRef.current = false
			}, 200)
		},
		[onStyleChange],
	)

	/**
	 * Apply opacity change with debounce
	 */
	const applyOpacityChange = useCallback(
		(value: number) => {
			if (updateTimerRef.current) {
				clearTimeout(updateTimerRef.current)
			}

			updateTimerRef.current = window.setTimeout(() => {
				isEditingRef.current = false
				onStyleChange?.("opacity", value.toString())
			}, 100)
		},
		[onStyleChange],
	)

	/**
	 * Handle opacity change
	 */
	const handleOpacityChange = useCallback(
		(value: number[]) => {
			isEditingRef.current = true
			const newOpacity = value[0]
			setOpacity(newOpacity)
			applyOpacityChange(newOpacity)
		},
		[applyOpacityChange],
	)

	/**
	 * Handle opacity input change
	 */
	const handleOpacityInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = parseFloat(e.target.value)
			if (!isNaN(value) && value >= 0 && value <= 1) {
				isEditingRef.current = true
				setOpacity(value)
				applyOpacityChange(value)
			}
		},
		[applyOpacityChange],
	)

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (updateTimerRef.current) {
				clearTimeout(updateTimerRef.current)
			}
		}
	}, [])

	// Extract hex color for color input
	const hexColor = extractHexColor(shadow.color)

	return (
		<div className="space-y-4">
			{/* Box Shadow */}
			<div className="space-y-3">
				<h5 className="text-xs font-medium text-muted-foreground">
					{t("stylePanel.shadow")}
				</h5>

				{/* Offset X */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label className="text-xs">{t("stylePanel.shadowOffsetX")}</Label>
						<span className="text-xs text-muted-foreground">{shadow.offsetX}px</span>
					</div>
					<Slider
						value={[shadow.offsetX]}
						onValueChange={handleOffsetXChange}
						min={-100}
						max={100}
						step={1}
						className="w-full"
					/>
				</div>

				{/* Offset Y */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label className="text-xs">{t("stylePanel.shadowOffsetY")}</Label>
						<span className="text-xs text-muted-foreground">{shadow.offsetY}px</span>
					</div>
					<Slider
						value={[shadow.offsetY]}
						onValueChange={handleOffsetYChange}
						min={-100}
						max={100}
						step={1}
						className="w-full"
					/>
				</div>

				{/* Blur */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label className="text-xs">{t("stylePanel.shadowBlur")}</Label>
						<span className="text-xs text-muted-foreground">{shadow.blur}px</span>
					</div>
					<Slider
						value={[shadow.blur]}
						onValueChange={handleBlurChange}
						min={0}
						max={50}
						step={1}
						className="w-full"
					/>
				</div>

				{/* Spread */}
				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label className="text-xs">{t("stylePanel.shadowSpread")}</Label>
						<span className="text-xs text-muted-foreground">{shadow.spread}px</span>
					</div>
					<Slider
						value={[shadow.spread]}
						onValueChange={handleSpreadChange}
						min={-50}
						max={50}
						step={1}
						className="w-full"
					/>
				</div>

				{/* Color */}
				<div className="space-y-2">
					<Label className="text-xs">{t("stylePanel.shadowColor")}</Label>
					<div className="flex gap-2">
						<Input
							type="color"
							value={hexColor}
							onChange={(e) => handleColorChange(e.target.value)}
							className="h-9 w-16 cursor-pointer p-1"
						/>
						<Input
							type="text"
							value={shadow.color}
							onChange={(e) => handleColorChange(e.target.value)}
							placeholder={t("stylePanel.shadowColorPlaceholder")}
							className="flex-1 font-mono text-xs"
						/>
					</div>
				</div>

				{/* Inset */}
				<div className="flex items-center space-x-2">
					<Checkbox
						id="shadow-inset"
						checked={shadow.inset}
						onCheckedChange={handleInsetChange}
					/>
					<Label htmlFor="shadow-inset" className="cursor-pointer text-xs font-normal">
						{t("stylePanel.shadowInset")}
					</Label>
				</div>
			</div>

			{/* Opacity */}

			<div className="space-y-3">
				<h5 className="text-xs font-medium text-muted-foreground">
					{t("stylePanel.opacity")}
				</h5>

				<div className="space-y-2">
					<div className="flex items-center justify-between">
						<Label className="text-xs">{t("stylePanel.transparency")}</Label>
						<Input
							type="number"
							value={opacity.toFixed(2)}
							onChange={handleOpacityInputChange}
							min="0"
							max="1"
							step="0.01"
							className="h-8 w-20 text-xs"
						/>
					</div>
					<Slider
						value={[opacity]}
						onValueChange={handleOpacityChange}
						min={0}
						max={1}
						step={0.01}
						className="w-full"
					/>
				</div>
			</div>
		</div>
	)
})

export default ShadowSection
