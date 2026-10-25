import { observer } from "mobx-react-lite"
import { useCallback, useEffect, useState } from "react"
import { useDebounceFn } from "ahooks"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Label } from "@/components/shadcn-ui/label"
import { Switch } from "@/components/shadcn-ui/switch"
import type { StyleSectionProps } from "../types"
import { NumericDragInput } from "../controls"
import { STYLE_PANEL_STYLES } from "../styles"

const BORDER_STYLES = ["none", "solid", "dashed", "dotted", "double"] as const
const BORDER_WIDTH_PRESETS = [0, 1, 2, 4, 8]
type BorderStyle = (typeof BORDER_STYLES)[number]

function parseNumericStyle(value: string | undefined, fallback = 0): number {
	const parsed = Number.parseFloat(value?.trim().split(/\s+/)[0] ?? "")
	return Number.isFinite(parsed) ? Math.max(0, parsed) : fallback
}

function getColorInputValue(value: string): string {
	if (/^#[0-9a-f]{6}$/i.test(value)) return value
	if (/^#[0-9a-f]{3}$/i.test(value)) {
		return `#${value
			.slice(1)
			.split("")
			.map((char) => `${char}${char}`)
			.join("")}`
	}
	return "#000000"
}

/**
 * 边框样式配置区域
 */
const BorderSection = observer(function BorderSection({
	selectedElement,
	onStyleChange,
}: StyleSectionProps) {
	const { t } = useTranslation("super")
	const computedStyles = selectedElement?.computedStyles

	// 解析当前值
	const currentBorderWidth = computedStyles?.borderWidth || "0px"
	const rawBorderStyle = computedStyles?.borderStyle || "none"
	const currentBorderStyle = BORDER_STYLES.includes(rawBorderStyle as BorderStyle)
		? (rawBorderStyle as BorderStyle)
		: "solid"
	const currentBorderColor = computedStyles?.borderColor || "#000000"
	const currentBorderRadius = computedStyles?.borderRadius || "0px"

	// 本地状态
	const [borderWidth, setBorderWidth] = useState(parseNumericStyle(currentBorderWidth))
	const [borderStyle, setBorderStyle] = useState<BorderStyle>(currentBorderStyle)
	const [borderColor, setBorderColor] = useState(currentBorderColor)
	const [borderRadius, setBorderRadius] = useState(parseNumericStyle(currentBorderRadius))
	const borderEnabled = borderStyle !== "none" && borderWidth > 0

	useEffect(() => {
		setBorderWidth(parseNumericStyle(currentBorderWidth))
		setBorderStyle(currentBorderStyle)
		setBorderColor(currentBorderColor)
		setBorderRadius(parseNumericStyle(currentBorderRadius))
	}, [
		currentBorderColor,
		currentBorderRadius,
		currentBorderStyle,
		currentBorderWidth,
		selectedElement?.selector,
	])

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
			const numValue = Number.parseFloat(value)
			if (!isNaN(numValue) && numValue >= 0) {
				setBorderWidth(numValue)
				onStyleChangeDebounced("borderWidth", `${numValue}px`)
				if (numValue === 0 && borderStyle !== "none") {
					setBorderStyle("none")
					onStyleChange?.("borderStyle", "none")
				} else if (numValue > 0 && borderStyle === "none") {
					setBorderStyle("solid")
					onStyleChange?.("borderStyle", "solid")
				}
			}
		},
		[borderStyle, onStyleChange, onStyleChangeDebounced],
	)

	const handleBorderEnabledChange = useCallback(
		(enabled: boolean) => {
			if (enabled) {
				const nextStyle = borderStyle === "none" ? "solid" : borderStyle
				setBorderStyle(nextStyle)
				if (borderWidth === 0) {
					setBorderWidth(1)
					onStyleChange?.("borderWidth", "1px")
				}
				onStyleChange?.("borderStyle", nextStyle)
				return
			}
			setBorderStyle("none")
			onStyleChange?.("borderStyle", "none")
		},
		[borderWidth, borderStyle, onStyleChange],
	)

	/**
	 * 处理边框样式变化
	 */
	const handleBorderStyleChange = useCallback(
		(value: BorderStyle) => {
			setBorderStyle(value)
			if (value !== "none" && borderWidth === 0) {
				setBorderWidth(1)
				onStyleChange?.("borderWidth", "1px")
			}
			onStyleChange?.("borderStyle", value)
		},
		[borderWidth, onStyleChange],
	)

	const getBorderStyleLabel = useCallback(
		(style: BorderStyle) => {
			switch (style) {
				case "none":
					return t("stylePanel.borderStyleOptions.none")
				case "solid":
					return t("stylePanel.borderStyleOptions.solid")
				case "dashed":
					return t("stylePanel.borderStyleOptions.dashed")
				case "dotted":
					return t("stylePanel.borderStyleOptions.dotted")
				case "double":
					return t("stylePanel.borderStyleOptions.double")
			}
		},
		[t],
	)

	/**
	 * 处理边框颜色变化
	 */
	const handleBorderColorChange = useCallback(
		(value: string) => {
			setBorderColor(value)
			if (value.trim() && borderWidth === 0) {
				setBorderWidth(1)
				onStyleChange?.("borderWidth", "1px")
			}
			if (value.trim() && borderStyle === "none") {
				setBorderStyle("solid")
				onStyleChange?.("borderStyle", "solid")
			}
			onStyleChangeDebounced("borderColor", value)
		},
		[borderStyle, borderWidth, onStyleChange, onStyleChangeDebounced],
	)

	/**
	 * 处理圆角变化
	 */
	const handleBorderRadiusChange = useCallback(
		(value: string) => {
			const numValue = Number.parseFloat(value)
			if (!isNaN(numValue) && numValue >= 0) {
				setBorderRadius(numValue)
				onStyleChangeDebounced("borderRadius", `${numValue}px`)
			}
		},
		[onStyleChangeDebounced],
	)

	return (
		<div
			className={STYLE_PANEL_STYLES.sectionContent}
			data-testid="html-style-panel-border-section"
		>
			<div className="flex items-center justify-between gap-3">
				<div className="min-w-0">
					<div className="text-xs font-semibold text-foreground">
						{t("stylePanel.border")}
					</div>
					<div className="mt-0.5 text-[10px] text-muted-foreground">
						{borderEnabled
							? t("stylePanel.borderEnabledDescription")
							: t("stylePanel.borderDisabledDescription")}
					</div>
				</div>
				<Switch
					checked={borderEnabled}
					onCheckedChange={handleBorderEnabledChange}
					aria-label={t("stylePanel.borderEnabled")}
				/>
			</div>

			{/* 预览使用本地输入状态，避免等待 iframe 回传样式后才给出反馈。 */}
			<div
				className="mt-3 flex h-14 items-center justify-center rounded-md border border-border/60 bg-background/80"
				data-testid="html-style-panel-border-preview"
			>
				<div
					className="flex h-8 w-32 items-center justify-center bg-muted/50 text-[10px] text-muted-foreground"
					style={{
						borderColor,
						borderRadius: `${borderRadius}px`,
						borderStyle: borderEnabled ? borderStyle : "solid",
						borderWidth: borderEnabled ? `${borderWidth}px` : "0px",
					}}
				>
					{t("stylePanel.borderPreview")}
				</div>
			</div>

			{/* 边框宽度 */}
			<div className="mt-3 min-w-0 space-y-1">
				<Label
					htmlFor="border-width"
					className="text-[11px] font-medium leading-4 text-muted-foreground"
				>
					{t("stylePanel.borderWidth")}
				</Label>
				<div className="flex items-center gap-2">
					<NumericDragInput
						id="border-width"
						value={String(borderWidth)}
						onChange={handleBorderWidthChange}
						className="h-7 min-w-0 flex-1 rounded-md"
						min={0}
					/>
					<span className="text-xs text-muted-foreground">px</span>
				</div>
				<div className="flex gap-1" aria-label={t("stylePanel.borderWidthPresets")}>
					{BORDER_WIDTH_PRESETS.map((preset) => (
						<Button
							key={preset}
							type="button"
							variant={borderWidth === preset ? "secondary" : "ghost"}
							size="sm"
							className="h-6 min-w-8 px-1.5 text-[10px]"
							onClick={() => handleBorderWidthChange(String(preset))}
						>
							{preset}
						</Button>
					))}
				</div>
			</div>

			{/* 边框样式 */}
			<div className="mt-3 min-w-0 space-y-1">
				<Label className="text-[11px] font-medium leading-4 text-muted-foreground">
					{t("stylePanel.borderStyle")}
				</Label>
				<div
					className="grid grid-cols-5 gap-1"
					role="group"
					aria-label={t("stylePanel.borderStyle")}
				>
					{BORDER_STYLES.map((style) => (
						<Button
							key={style}
							type="button"
							variant={borderStyle === style ? "secondary" : "outline"}
							size="sm"
							className="h-9 min-w-0 flex-col gap-0.5 px-1 text-[9px]"
							aria-pressed={borderStyle === style}
							aria-label={getBorderStyleLabel(style)}
							onClick={() => handleBorderStyleChange(style)}
						>
							<span
								className="block w-full"
								style={{
									borderTopColor: "currentColor",
									borderTopStyle: style === "none" ? "solid" : style,
									borderTopWidth: style === "none" ? 0 : 2,
								}}
							/>
							<span className="truncate">{getBorderStyleLabel(style)}</span>
						</Button>
					))}
				</div>
			</div>

			{/* 边框颜色 */}
			<div className="mt-3 min-w-0 space-y-1">
				<Label
					htmlFor="border-color"
					className="text-[11px] font-medium leading-4 text-muted-foreground"
				>
					{t("stylePanel.borderColor")}
				</Label>
				<div className="flex gap-2">
					<Input
						id="border-color-picker"
						aria-label={t("stylePanel.borderColorPicker")}
						type="color"
						value={getColorInputValue(borderColor)}
						onChange={(event) => handleBorderColorChange(event.target.value)}
						className="h-7 w-12 cursor-pointer rounded-md p-1"
					/>
					<Input
						id="border-color"
						type="text"
						value={borderColor}
						onChange={(e) => handleBorderColorChange(e.target.value)}
						placeholder="#000000"
						className="h-7 min-w-0 flex-1 rounded-md font-mono text-xs"
					/>
				</div>
			</div>

			{/* 圆角 */}
			<div className="mt-3 min-w-0 space-y-1">
				<Label
					htmlFor="border-radius"
					className="text-[11px] font-medium leading-4 text-muted-foreground"
				>
					{t("stylePanel.borderRadius")}
				</Label>
				<div className="flex items-center gap-2">
					<NumericDragInput
						id="border-radius"
						value={String(borderRadius)}
						onChange={handleBorderRadiusChange}
						className="h-7 min-w-0 flex-1 rounded-md"
						min={0}
					/>
					<span className="text-xs text-muted-foreground">px</span>
				</div>
			</div>
		</div>
	)
})

export default BorderSection
