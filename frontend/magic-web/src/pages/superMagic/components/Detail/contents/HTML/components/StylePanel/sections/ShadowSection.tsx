import { observer } from "mobx-react-lite"
import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, Sparkles } from "lucide-react"
import { Input } from "@/components/shadcn-ui/input"
import { NumericDragInput } from "../controls"
import { Label } from "@/components/shadcn-ui/label"
import { Slider } from "@/components/shadcn-ui/slider"
import { Checkbox } from "@/components/shadcn-ui/checkbox"
import { Switch } from "@/components/shadcn-ui/switch"
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/shadcn-ui/collapsible"
import { cn } from "@/utils/cn"
import type { StyleSectionProps } from "../types"
import { STYLE_PANEL_STYLES } from "../styles"
import {
	parseBoxShadow,
	buildBoxShadow,
	extractHexColor,
	hexToRgba,
	type BoxShadowValue,
} from "../utils/shadowParser"

function parseOpacity(value: string): number {
	const parsed = Number.parseFloat(value)
	return Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 1
}

function parseColorAlpha(color: string): number {
	const match = color.match(/rgba\([^,]+,\s*[^,]+,\s*[^,]+,\s*([\d.]+)\)/i)
	if (!match) return 1
	const alpha = Number.parseFloat(match[1])
	return Number.isFinite(alpha) ? Math.min(1, Math.max(0, alpha)) : 1
}

const SHADOW_PRESETS: Array<{
	id: "soft" | "lifted" | "strong"
	labelKey:
		| "stylePanel.shadowPresetSoft"
		| "stylePanel.shadowPresetLifted"
		| "stylePanel.shadowPresetStrong"
	shadow: BoxShadowValue
}> = [
	{
		id: "soft",
		labelKey: "stylePanel.shadowPresetSoft",
		shadow: {
			offsetX: 0,
			offsetY: 2,
			blur: 8,
			spread: 0,
			color: "rgba(0, 0, 0, 0.1)",
			inset: false,
		},
	},
	{
		id: "lifted",
		labelKey: "stylePanel.shadowPresetLifted",
		shadow: {
			offsetX: 0,
			offsetY: 8,
			blur: 24,
			spread: -4,
			color: "rgba(0, 0, 0, 0.14)",
			inset: false,
		},
	},
	{
		id: "strong",
		labelKey: "stylePanel.shadowPresetStrong",
		shadow: {
			offsetX: 0,
			offsetY: 12,
			blur: 32,
			spread: 0,
			color: "rgba(0, 0, 0, 0.22)",
			inset: false,
		},
	},
]

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
	const currentShadowEnabled = currentBoxShadow.trim().toLowerCase() !== "none"

	// Local state for box shadow
	const [shadow, setShadow] = useState<BoxShadowValue>(() => parseBoxShadow(currentBoxShadow))
	const [shadowEnabled, setShadowEnabled] = useState(currentShadowEnabled)
	const [opacity, setOpacity] = useState<number>(() => parseOpacity(currentOpacity))
	const [advancedOpen, setAdvancedOpen] = useState(false)

	// Keep separate timers so editing opacity cannot cancel a pending shadow update.
	const shadowUpdateTimerRef = useRef<number>()
	const opacityUpdateTimerRef = useRef<number>()

	// Computed styles are the source of truth after undo/redo and external updates.
	// The selector alone is not enough because history replay keeps the same element selected.
	useEffect(() => {
		// Cancel stale local writes when a new computed value arrives from the iframe.
		// This prevents an external restore from being overwritten by an old debounce callback.
		if (shadowUpdateTimerRef.current !== undefined) {
			clearTimeout(shadowUpdateTimerRef.current)
			shadowUpdateTimerRef.current = undefined
		}
		if (opacityUpdateTimerRef.current !== undefined) {
			clearTimeout(opacityUpdateTimerRef.current)
			opacityUpdateTimerRef.current = undefined
		}

		setShadow(parseBoxShadow(currentBoxShadow))
		setShadowEnabled(currentShadowEnabled)
		setOpacity(parseOpacity(currentOpacity))
	}, [currentBoxShadow, currentOpacity, currentShadowEnabled, selectedElement?.selector])

	useEffect(() => {
		setAdvancedOpen(false)
	}, [selectedElement?.selector])

	// Store latest shadow and opacity in refs
	const shadowRef = useRef(shadow)

	// Update refs when state changes
	useEffect(() => {
		shadowRef.current = shadow
	}, [shadow])

	/**
	 * Apply box shadow change with debounce
	 */
	const applyBoxShadowChange = useCallback(
		(newShadow: BoxShadowValue) => {
			setShadowEnabled(true)
			if (shadowUpdateTimerRef.current !== undefined) {
				clearTimeout(shadowUpdateTimerRef.current)
			}

			shadowUpdateTimerRef.current = window.setTimeout(() => {
				shadowUpdateTimerRef.current = undefined
				const shadowString = buildBoxShadow(newShadow)
				onStyleChange?.("boxShadow", shadowString)
			}, 100)
		},
		[onStyleChange],
	)

	/**
	 * Handle blur change
	 */
	const handleBlurChange = useCallback(
		(value: number[]) => {
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
			const newShadow = { ...shadowRef.current, spread: value[0] }
			setShadow(newShadow)
			applyBoxShadowChange(newShadow)
		},
		[applyBoxShadowChange],
	)

	const handleShadowValueInput = useCallback(
		(property: "offsetX" | "offsetY" | "blur" | "spread", inputValue: string) => {
			const value = Number.parseFloat(inputValue)
			if (!Number.isFinite(value)) return
			const newShadow = { ...shadowRef.current, [property]: value }
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
			// The native color input only returns hex. Keep the existing alpha so choosing
			// a new hue does not unexpectedly turn a subtle shadow fully opaque.
			const newShadow = {
				...shadowRef.current,
				color: hexToRgba(color, parseColorAlpha(shadowRef.current.color)),
			}
			setShadow(newShadow)
			applyBoxShadowChange(newShadow)
		},
		[applyBoxShadowChange],
	)

	const applyPreset = useCallback(
		(preset: BoxShadowValue) => {
			setShadowEnabled(true)
			setShadow(preset)
			if (shadowUpdateTimerRef.current !== undefined) {
				clearTimeout(shadowUpdateTimerRef.current)
				shadowUpdateTimerRef.current = undefined
			}
			onStyleChange?.("boxShadow", buildBoxShadow(preset))
		},
		[onStyleChange],
	)

	/**
	 * Handle inset toggle
	 */
	const handleInsetChange = useCallback(
		(checked: boolean) => {
			setShadowEnabled(true)
			if (shadowUpdateTimerRef.current !== undefined) {
				clearTimeout(shadowUpdateTimerRef.current)
				shadowUpdateTimerRef.current = undefined
			}

			const newShadow = { ...shadowRef.current, inset: checked }
			setShadow(newShadow)
			// Apply immediately for checkbox
			const shadowString = buildBoxShadow(newShadow)
			onStyleChange?.("boxShadow", shadowString)
		},
		[onStyleChange],
	)

	const handleShadowEnabledChange = useCallback(
		(enabled: boolean) => {
			if (shadowUpdateTimerRef.current !== undefined) {
				clearTimeout(shadowUpdateTimerRef.current)
				shadowUpdateTimerRef.current = undefined
			}

			setShadowEnabled(enabled)
			onStyleChange?.("boxShadow", enabled ? buildBoxShadow(shadowRef.current) : "none")
		},
		[onStyleChange],
	)

	/**
	 * Apply opacity change with debounce
	 */
	const applyOpacityChange = useCallback(
		(value: number) => {
			if (opacityUpdateTimerRef.current !== undefined) {
				clearTimeout(opacityUpdateTimerRef.current)
			}

			opacityUpdateTimerRef.current = window.setTimeout(() => {
				opacityUpdateTimerRef.current = undefined
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
		(inputValue: string) => {
			const value = parseFloat(inputValue)
			if (!isNaN(value) && value >= 0 && value <= 1) {
				setOpacity(value)
				applyOpacityChange(value)
			}
		},
		[applyOpacityChange],
	)

	// Cleanup timer on unmount
	useEffect(() => {
		return () => {
			if (shadowUpdateTimerRef.current !== undefined) {
				clearTimeout(shadowUpdateTimerRef.current)
			}
			if (opacityUpdateTimerRef.current !== undefined) {
				clearTimeout(opacityUpdateTimerRef.current)
			}
		}
	}, [])

	// Extract hex color for color input
	const hexColor = extractHexColor(shadow.color)

	return (
		<div className={STYLE_PANEL_STYLES.sectionContent}>
			<div className="flex items-center justify-between gap-2">
				<div className="flex min-w-0 items-center gap-2">
					<Sparkles className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
					<div className="min-w-0">
						<div className="text-sm font-semibold leading-5 text-foreground">
							{t("stylePanel.shadow")}
						</div>
						<div className="text-[10px] leading-4 text-muted-foreground">
							{shadowEnabled
								? t("stylePanel.shadowEnabledDescription")
								: t("stylePanel.shadowDisabledDescription")}
						</div>
					</div>
				</div>
				<Switch
					checked={shadowEnabled}
					onCheckedChange={handleShadowEnabledChange}
					aria-label={t("stylePanel.shadowEnabled")}
				/>
			</div>

			<div className="flex items-center gap-1" aria-label={t("stylePanel.shadowPresets")}>
				{SHADOW_PRESETS.map((preset) => (
					<button
						key={preset.id}
						type="button"
						className={cn(
							"h-6 rounded-md border px-2 text-[10px] font-medium text-muted-foreground transition-[background-color,border-color,color,transform] duration-150 hover:border-primary/40 hover:bg-primary/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.96]",
							"dark:hover:bg-primary/15",
						)}
						onClick={() => applyPreset(preset.shadow)}
						data-testid={`shadow-preset-${preset.id}`}
					>
						{t(preset.labelKey)}
					</button>
				))}
			</div>

			<div className="space-y-2">
				<div className="w-full" title={t("stylePanel.shadowPreview")}>
					<div
						aria-label={t("stylePanel.shadowPreview")}
						className="flex h-16 w-full min-w-0 items-center justify-center rounded-lg border border-border/60 bg-muted/20"
						data-testid="html-style-panel-shadow-preview"
					>
						<div
							className="h-8 w-16 rounded-md border border-border/70 bg-background transition-[box-shadow,opacity] duration-150 ease-out"
							style={{
								boxShadow: shadowEnabled ? buildBoxShadow(shadow) : "none",
								opacity,
							}}
						/>
					</div>
				</div>

				{/* Keep both offset values on one row: they are related and no longer need two full slider blocks. */}
				<div className="flex items-center justify-between gap-2">
					<Label className="text-[11px] font-medium leading-4 text-muted-foreground">
						{t("stylePanel.shadowOffset")}
					</Label>
					<div className="grid grid-cols-2 gap-1.5">
						<div className="flex items-center gap-1">
							<NumericDragInput
								value={String(shadow.offsetX)}
								onChange={(value) => handleShadowValueInput("offsetX", value)}
								min={-100}
								max={100}
								className="h-6 w-14 rounded-md px-1 text-right text-xs"
								aria-label={t("stylePanel.shadowOffsetX")}
							/>
							<span className="text-xs text-muted-foreground">px</span>
						</div>
						<div className="flex items-center gap-1">
							<NumericDragInput
								value={String(shadow.offsetY)}
								onChange={(value) => handleShadowValueInput("offsetY", value)}
								min={-100}
								max={100}
								className="h-6 w-14 rounded-md px-1 text-right text-xs"
								aria-label={t("stylePanel.shadowOffsetY")}
							/>
							<span className="text-xs text-muted-foreground">px</span>
						</div>
					</div>
				</div>

				{/* Blur is the main visual adjustment, so keep one slider in the default view. */}
				<div className="space-y-1.5">
					<div className="flex items-center justify-between">
						<Label className="text-[11px] font-medium leading-4 text-muted-foreground">
							{t("stylePanel.shadowSoftness")}
						</Label>
						<span className="font-mono text-[11px] text-muted-foreground">
							{shadow.blur}px
						</span>
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

				{/* Keep color as one compact control; precise RGBA editing remains in Advanced. */}
				<div className="min-w-0 space-y-1.5">
					<Label className="text-[11px] font-medium leading-4 text-muted-foreground">
						{t("stylePanel.shadowColor")}
					</Label>
					<div className="flex min-w-0 items-center gap-2">
						<Input
							type="color"
							value={hexColor}
							onChange={(e) => handleColorChange(e.target.value)}
							className="h-8 w-12 shrink-0 cursor-pointer rounded-md p-1"
							aria-label={t("stylePanel.shadowColor")}
						/>
						<span className="min-w-0 truncate font-mono text-[11px] text-muted-foreground">
							{shadow.color}
						</span>
					</div>
				</div>

				<div className="space-y-1.5">
					<div className="flex items-center justify-between">
						<Label className="text-[11px] font-medium leading-4 text-muted-foreground">
							{t("stylePanel.transparency")}
						</Label>
						<NumericDragInput
							value={opacity.toFixed(2)}
							onChange={handleOpacityInputChange}
							min={0}
							max={1}
							step={0.01}
							precision={2}
							className="h-6 w-16 rounded-md text-xs"
							aria-label={t("stylePanel.transparency")}
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

				<Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
					<CollapsibleTrigger
						type="button"
						className="flex min-h-7 w-full items-center justify-between rounded-md px-1 py-1 text-xs font-medium text-muted-foreground transition-[background-color,color] duration-150 hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
					>
						<span>{t("stylePanel.shadowAdvanced")}</span>
						<ChevronDown
							className={cn(
								"h-3.5 w-3.5 transition-transform",
								advancedOpen && "rotate-180",
							)}
						/>
					</CollapsibleTrigger>
					<CollapsibleContent className="space-y-2 pt-1">
						<div className="space-y-1.5">
							<div className="flex items-center justify-between">
								<Label className="text-[11px] font-medium leading-4 text-muted-foreground">
									{t("stylePanel.shadowSpread")}
								</Label>
								<NumericDragInput
									value={String(shadow.spread)}
									onChange={(value) => handleShadowValueInput("spread", value)}
									min={-50}
									max={50}
									className="h-6 w-14 rounded-md px-1 text-right text-xs"
									aria-label={t("stylePanel.shadowSpread")}
								/>
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

						<div className="min-w-0 space-y-1.5">
							<Label className="text-[11px] font-medium leading-4 text-muted-foreground">
								{t("stylePanel.shadowColor")}
							</Label>
							<Input
								type="text"
								value={shadow.color}
								onChange={(e) => {
									const newShadow = {
										...shadowRef.current,
										color: e.target.value,
									}
									setShadow(newShadow)
									applyBoxShadowChange(newShadow)
								}}
								placeholder={t("stylePanel.shadowColorPlaceholder")}
								className="h-7 min-w-0 rounded-md font-mono text-xs"
								aria-label={t("stylePanel.shadowColor")}
							/>
						</div>

						<div className="flex items-center space-x-2">
							<Checkbox
								id="shadow-inset"
								checked={shadow.inset}
								onCheckedChange={handleInsetChange}
							/>
							<Label
								htmlFor="shadow-inset"
								className="cursor-pointer text-xs font-normal"
							>
								{t("stylePanel.shadowInset")}
							</Label>
						</div>
					</CollapsibleContent>
				</Collapsible>
			</div>
		</div>
	)
})

export default ShadowSection
