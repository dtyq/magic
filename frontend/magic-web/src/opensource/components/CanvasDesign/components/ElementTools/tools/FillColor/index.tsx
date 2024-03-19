import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { useCallback, useMemo, useState } from "react"
import styles from "./index.module.css"
import transparentIcon from "../../../../assets/svg/transparent.svg"
import type { RectangleElement, EllipseElement } from "../../../../canvas/types"
import ColorPickerPopover from "../../../ui/custom/ColorPickerPopover/index"
import classNames from "classnames"
import { useCanvas } from "../../../../context/CanvasContext"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"

export default function FillColor() {
	const { t } = useCanvasDesignI18n()
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()

	// 追踪 Popover 的打开状态
	const [isPopoverOpen, setIsPopoverOpen] = useState(false)

	// 获取当前选中的第一个元素
	const selectedElement = useMemo(() => {
		if (selectedElements.length === 0) return null
		return selectedElements[0]
	}, [selectedElements])

	// 获取当前填充颜色
	const fillColor = useMemo(() => {
		if (!selectedElement) return undefined
		const element = selectedElement as RectangleElement | EllipseElement
		return element.fill || undefined
	}, [selectedElement])

	// 获取透明状态
	const isTransparent = useMemo(() => {
		return selectedElement?.interactionConfig?.fillTransparent || false
	}, [selectedElement])

	// 获取颜色模式
	const colorMode = useMemo(() => {
		return selectedElement?.interactionConfig?.fillColorMode || "rgb"
	}, [selectedElement])

	// 处理颜色变化
	const handleColorChange = useCallback(
		(rgba: [number, number, number, number]) => {
			if (!selectedElement || !canvas) return

			const [r, g, b, a] = rgba
			const color = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}${
				a ? `, ${a}` : ""
			})`
			// 只更新颜色,如果当前是透明状态,也会自动取消透明
			canvas.elementManager.update(selectedElement.id, {
				fill: color,
				interactionConfig: {
					...selectedElement.interactionConfig,
					fillTransparent: false,
				},
			})
		},
		[selectedElement, canvas],
	)

	// 处理颜色模式变化
	const handleModeChange = useCallback(
		(mode: "hex" | "rgb" | "hsl") => {
			if (!selectedElement || !canvas) return
			canvas.elementManager.update(selectedElement.id, {
				interactionConfig: {
					...selectedElement.interactionConfig,
					fillColorMode: mode,
				},
			})
		},
		[selectedElement, canvas],
	)

	// 处理透明色切换
	const handleTransparentClick = useCallback(() => {
		if (!selectedElement || !canvas) return
		// 切换透明状态,不修改颜色值
		canvas.elementManager.update(selectedElement.id, {
			interactionConfig: {
				...selectedElement.interactionConfig,
				fillTransparent: !selectedElement.interactionConfig?.fillTransparent,
			},
		})
	}, [selectedElement, canvas])

	return (
		<ColorPickerPopover
			value={fillColor}
			onChange={handleColorChange}
			mode={colorMode}
			onModeChange={handleModeChange}
			isTransparent={isTransparent}
			onTransparentClick={handleTransparentClick}
			title={t("elementTools.fillColor.title", "填充")}
			onOpenChange={setIsPopoverOpen}
		>
			<div className={classNames(styles.fillColor, { [styles.active]: isPopoverOpen })}>
				<div className={styles.fillColorContent}>
					<div
						className={styles.colorBackground}
						style={{
							backgroundColor: isTransparent ? "transparent" : fillColor || "#000000",
						}}
					>
						{isTransparent && <img src={transparentIcon} alt="transparent" />}
					</div>
				</div>
			</div>
		</ColorPickerPopover>
	)
}
