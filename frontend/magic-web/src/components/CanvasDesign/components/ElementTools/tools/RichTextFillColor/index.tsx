import { useCallback, useEffect, useMemo, useState } from "react"
import styles from "./index.module.css"
import transparentIcon from "../../../../assets/svg/transparent.svg"
import ColorPickerPopover from "../../../ui/custom/ColorPickerPopover/index"
import classNames from "classnames"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import { useTextToolController } from "../text/useTextToolController"

export default function RichTextFillColor() {
	const { t } = useCanvasDesignI18n()
	const { state, hasTextSelectionContext, resolvedDefaultStyle, restoreSelection, setFillColor } =
		useTextToolController()

	const [isPopoverOpen, setIsPopoverOpen] = useState(false)
	const [colorMode, setColorMode] = useState<"hex" | "rgb" | "hsl">("rgb")
	const [previewColor, setPreviewColor] = useState<string>("#0a0a0a")
	const defaultFillColor = resolvedDefaultStyle.color || "#0a0a0a"
	const isEditingText = state.active && state.canEdit

	useEffect(() => {
		if (isEditingText) {
			setPreviewColor(state.color || defaultFillColor)
			return
		}
		if (!hasTextSelectionContext) {
			setPreviewColor(defaultFillColor)
		}
	}, [defaultFillColor, hasTextSelectionContext, isEditingText, state.color])

	const fillColor = useMemo(() => previewColor || "#0a0a0a", [previewColor])
	const isTransparent = useMemo(() => isTransparentColor(fillColor), [fillColor])

	const handleRichTextFillColorChange = useCallback(
		(rgba: [number, number, number, number]) => {
			const [r, g, b, a] = rgba
			const color = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a})`
			setPreviewColor(color)
			setFillColor(color)
		},
		[setFillColor],
	)

	const handleRichTextColorModeChange = useCallback((mode: "hex" | "rgb" | "hsl") => {
		setColorMode(mode)
	}, [])

	const handleTriggerPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
		event.preventDefault()
	}, [])

	const handleTriggerMouseDown = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
		event.preventDefault()
	}, [])

	return (
		<ColorPickerPopover
			value={fillColor}
			onChange={handleRichTextFillColorChange}
			mode={colorMode}
			onModeChange={handleRichTextColorModeChange}
			side="top"
			showTransparentToggle={false}
			title={t("elementTools.fillColor.title", "填充")}
			onOpenChange={setIsPopoverOpen}
			onContentPreserveSelection={restoreSelection}
		>
			<div
				className={classNames(styles.fillColor, { [styles.active]: isPopoverOpen })}
				onPointerDown={handleTriggerPointerDown}
				onMouseDown={handleTriggerMouseDown}
			>
				<div className={styles.fillColorContent}>
					<div
						className={styles.colorBackground}
						style={{
							backgroundColor: fillColor,
						}}
					>
						{isTransparent && <img src={transparentIcon} alt="transparent" />}
					</div>
				</div>
			</div>
		</ColorPickerPopover>
	)
}

function isTransparentColor(color: string): boolean {
	const normalizedColor = color.trim().toLowerCase()
	if (normalizedColor === "transparent") {
		return true
	}

	const rgbaMatch = normalizedColor.match(
		/^rgba\(\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\s*,\s*\d+(?:\.\d+)?\s*,\s*([\d.]+)\s*\)$/,
	)
	if (rgbaMatch) {
		return Number.parseFloat(rgbaMatch[1]) === 0
	}

	if (/^#(?:[0-9a-f]{4}|[0-9a-f]{8})$/.test(normalizedColor)) {
		const alphaHex =
			normalizedColor.length === 5 ? normalizedColor.slice(4) : normalizedColor.slice(7)
		return Number.parseInt(alphaHex.repeat(normalizedColor.length === 5 ? 2 : 1), 16) === 0
	}

	return false
}
