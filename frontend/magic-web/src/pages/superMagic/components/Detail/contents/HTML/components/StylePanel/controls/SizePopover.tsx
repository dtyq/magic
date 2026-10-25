import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { Label } from "@/components/shadcn-ui/label"
import { Switch } from "@/components/shadcn-ui/switch"
import { DimensionInput } from "./DimensionInput"
import { LayoutConstraintHintCard } from "./LayoutConstraintHint"
import { StylePopoverButton } from "./StylePopoverButton"
import { getLayoutConstraintHints } from "../utils/layoutConstraintHint"
import type { HTMLEditorV2Ref } from "../../../iframe-bridge/types/props"
import type { SelectedElementInfo } from "../types"
import { Ruler } from "lucide-react"

interface SizePopoverProps {
	selectedElement: SelectedElementInfo | null
	disabled?: boolean
	showLabel?: boolean
	/** Render the size fields inline in the contextual editor panel. */
	inline?: boolean
	onStyleChange: (property: "width" | "height", value: string) => void
	onBatchStyleChange: (styles: Record<string, string>) => void
	editorRef?: React.RefObject<HTMLEditorV2Ref>
}

interface ParsedDimensionValue {
	value: number | null
	unit: string
}

/**
 * Parse a CSS dimension string into numeric value and unit for ratio calculations.
 */
function parseDimensionValue(value: string): ParsedDimensionValue {
	if (!value || value === "auto") return { value: null, unit: "px" }

	const match = value.trim().match(/^(-?\d+(?:\.\d+)?)([a-z%]*)$/i)
	if (!match) return { value: null, unit: "px" }

	return {
		value: Number.parseFloat(match[1]),
		unit: match[2] || "px",
	}
}

/**
 * Format a linked dimension value while keeping the unit stable and the result readable.
 */
function formatDimensionValue(value: number, unit: string): string {
	const roundedValue = Math.round(value * 100) / 100
	return `${roundedValue}${unit}`
}

/**
 * Build a width/height style pair that preserves the provided aspect ratio.
 */
export function buildLockedImageSizeStyles(options: {
	property: "width" | "height"
	value: string
	intrinsicAspectRatio?: number
}): Record<string, string> | null {
	const { property, value, intrinsicAspectRatio } = options
	if (!intrinsicAspectRatio || intrinsicAspectRatio <= 0) return null

	const parsedValue = parseDimensionValue(value)
	if (parsedValue.value === null) return null

	if (property === "width") {
		return {
			width: value,
			height: formatDimensionValue(
				parsedValue.value / intrinsicAspectRatio,
				parsedValue.unit,
			),
		}
	}

	return {
		width: formatDimensionValue(parsedValue.value * intrinsicAspectRatio, parsedValue.unit),
		height: value,
	}
}

/**
 * Normalize the current image dimensions into a px-based locked pair when users enable ratio lock.
 */
export function buildNormalizedLockedImageSizeStyles(options: {
	width: string
	height: string
	intrinsicAspectRatio?: number
}): Record<string, string> | null {
	const { width, height, intrinsicAspectRatio } = options
	if (!intrinsicAspectRatio || intrinsicAspectRatio <= 0) return null

	const parsedWidth = parseDimensionValue(width)
	if (parsedWidth.value !== null) {
		return {
			width: formatDimensionValue(parsedWidth.value, "px"),
			height: formatDimensionValue(parsedWidth.value / intrinsicAspectRatio, "px"),
		}
	}

	const parsedHeight = parseDimensionValue(height)
	if (parsedHeight.value === null) return null

	return {
		width: formatDimensionValue(parsedHeight.value * intrinsicAspectRatio, "px"),
		height: formatDimensionValue(parsedHeight.value, "px"),
	}
}

/**
 * Render a dedicated size editing popover so image size controls stay near the main toolbar.
 */
export function SizePopover({
	selectedElement,
	disabled = false,
	showLabel = false,
	inline = false,
	onStyleChange,
	onBatchStyleChange,
	editorRef,
}: SizePopoverProps) {
	const { t } = useTranslation("super")
	const [isAspectRatioLocked, setIsAspectRatioLocked] = useState(false)

	const isImageElement = selectedElement?.isImageElement === true
	const intrinsicAspectRatio = selectedElement?.intrinsicAspectRatio
	const canLockAspectRatio = isImageElement && Boolean(intrinsicAspectRatio)

	const currentWidth = useMemo(() => {
		return selectedElement?.computedStyles.width || "auto"
	}, [selectedElement?.computedStyles.width])

	const currentHeight = useMemo(() => {
		return selectedElement?.computedStyles.height || "auto"
	}, [selectedElement?.computedStyles.height])

	useEffect(() => {
		setIsAspectRatioLocked(false)
	}, [selectedElement?.selector])

	/**
	 * Apply width or height changes and batch both sides when image ratio locking is enabled.
	 */
	const handleDimensionChange = useCallback(
		(property: "width" | "height", value: string) => {
			if (!isAspectRatioLocked || !canLockAspectRatio) {
				onStyleChange(property, value)
				return
			}

			const lockedStyles = buildLockedImageSizeStyles({
				property,
				value,
				intrinsicAspectRatio,
			})

			if (!lockedStyles) {
				onStyleChange(property, value)
				return
			}

			onBatchStyleChange(lockedStyles)
		},
		[
			canLockAspectRatio,
			intrinsicAspectRatio,
			isAspectRatioLocked,
			onBatchStyleChange,
			onStyleChange,
		],
	)

	/**
	 * Enable ratio locking only after normalizing the current dimensions into a px-based pair.
	 */
	const handleLockCheckedChange = useCallback(
		(checked: boolean) => {
			if (!checked) {
				setIsAspectRatioLocked(false)
				return
			}

			const normalizedStyles = buildNormalizedLockedImageSizeStyles({
				width: currentWidth,
				height: currentHeight,
				intrinsicAspectRatio,
			})

			if (normalizedStyles) {
				onBatchStyleChange(normalizedStyles)
			}

			setIsAspectRatioLocked(true)
		},
		[currentHeight, currentWidth, intrinsicAspectRatio, onBatchStyleChange],
	)

	const sizeFields = (
		<div className="space-y-3" data-testid="html-style-panel-size-popover">
			{canLockAspectRatio && (
				<div
					className="flex items-center justify-between gap-3"
					data-testid="html-style-panel-size-lock-row"
				>
					<Label
						htmlFor="html-style-panel-size-lock-switch"
						className="text-xs font-medium"
					>
						{t("stylePanel.lockAspectRatio")}
					</Label>
					<Switch
						id="html-style-panel-size-lock-switch"
						checked={isAspectRatioLocked}
						onCheckedChange={handleLockCheckedChange}
						data-testid="html-style-panel-size-lock-switch"
					/>
				</div>
			)}

			<div className="grid min-w-0 grid-cols-2 gap-2 [&>*]:min-w-0">
				<DimensionInput
					label={t("stylePanel.width")}
					value={currentWidth}
					onChange={(value) => handleDimensionChange("width", value)}
					placeholder="auto"
					id="html-style-panel-size-width"
					fixedUnit="px"
					testIdPrefix="html-style-panel-size-width"
				/>
				<DimensionInput
					label={t("stylePanel.height")}
					value={currentHeight}
					onChange={(value) => handleDimensionChange("height", value)}
					placeholder="auto"
					id="html-style-panel-size-height"
					fixedUnit="px"
					testIdPrefix="html-style-panel-size-height"
				/>
			</div>
			{getLayoutConstraintHints({
				...(selectedElement?.computedStyles || {}),
				declaredWidth: selectedElement?.inlineStyles?.width,
				declaredHeight: selectedElement?.inlineStyles?.height,
			})
				.filter((hint) => hint.kind === "parent-owned-size")
				.map((hint) => (
					<LayoutConstraintHintCard
						key={`${hint.kind}-${hint.axis}`}
						hint={hint}
						selector={selectedElement?.selector}
						editorRef={editorRef}
						onApply={onBatchStyleChange}
					/>
				))}
		</div>
	)

	if (inline) {
		return (
			<div className="min-w-0 space-y-2">
				<div className="text-[11px] font-medium text-muted-foreground">
					{t("stylePanel.size")}
				</div>
				{sizeFields}
			</div>
		)
	}

	return (
		<StylePopoverButton
			icon={<Ruler className="h-4 w-4" />}
			tooltip={t("stylePanel.sizeSettings")}
			title={t("stylePanel.size")}
			disabled={disabled}
			showLabel={showLabel}
			triggerTestId="html-style-panel-size-trigger"
			contentTestId="html-style-panel-size-content"
			contentClassName="w-[26rem] max-w-[calc(100vw-2rem)]"
		>
			{sizeFields}
		</StylePopoverButton>
	)
}
