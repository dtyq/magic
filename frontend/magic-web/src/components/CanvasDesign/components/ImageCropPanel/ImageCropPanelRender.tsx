import SizeInput from "../ElementTools/tools/Size/SizeInput"
import { Button } from "../ui/button"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import styles from "./index.module.css"
import { useMemo, useState, useCallback } from "react"
import { useUpdateEffect } from "ahooks"
import { presetOptions } from "./options"
import { Image } from "lucide-react"
import SizeIconPreview from "../ui/custom/SizeIconPreview"
import { CollapsibleBlindsGroup, CollapsibleBlindsItem } from "../ui/custom/CollapsibleBlindsGroup"
import type { PresetOptionItem } from "./options"
import {
	calculateSizeFromPreset,
	calculatePresetIconSize,
	centerCropRectInDisplayBounds,
	fitCommonPresetCropToElement,
} from "./utils"
import useElementPositionEffect from "../../hooks/useElementPositionEffect"
import { useFloatingComponent } from "../../hooks/useFloatingComponent"
import { useCanvas } from "../../context/CanvasContext"
import { useCanvasEvent } from "../../hooks/useCanvasEvent"
import type { ImageElement, CropConfig } from "../../canvas/types"
import { useCanvasModeUI } from "../../context/CanvasUIContext"

const FULL_CROP_EPSILON = 1e-6

type CurrentPresetOption = {
	label: string
	value: string
	children: (Required<PresetOptionItem> & {
		iconWidth: number
		iconHeight: number
	})[]
}

interface ImageCropPanelRenderProps {
	imageElement: ImageElement
}

export default function ImageCropPanelRender(props: ImageCropPanelRenderProps) {
	const { imageElement } = props
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const { croppingElementId } = useCanvasModeUI()

	const { currentImageWidth, currentImageHeight } = useMemo(() => {
		return {
			currentImageWidth: imageElement.width || 0,
			currentImageHeight: imageElement.height || 0,
		}
	}, [imageElement.width, imageElement.height])

	// tempCrop state(双向绑定)
	const [tempCrop, setTempCrop] = useState<CropConfig | null>(() => {
		return canvas?.cropManager.getTempCrop() || null
	})

	// 是否锁定比例
	const [isLocked, setIsLocked] = useState<boolean>(false)

	// 展开/收起预设选项
	const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())

	// 容器位置（裁剪模式使用 crop:position，复用 useElementPositionEffect 的定位逻辑）
	const { containerRef: positionRef } = useElementPositionEffect({
		position: "right",
		offset: 8,
		verticalAlign: "top",
		shouldShow: () => !!croppingElementId,
		positionEventType: "crop:position",
		trackedElementId: croppingElementId,
	})

	const { containerRef: floatingRef } = useFloatingComponent({
		id: "image-crop-panel",
		enableWheelForwarding: false,
	})

	// 合并 refs
	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			positionRef.current = node
			floatingRef.current = node
		},
		[positionRef, floatingRef],
	)

	// 取消
	const handleCancel = () => {
		if (!canvas) return
		canvas.cropManager.cancelCrop()
	}

	// 完成
	const handleComplete = () => {
		if (!canvas) return
		canvas.cropManager.confirmCrop()
	}

	// 恢复原图：临时裁剪框铺满当前显示区域（确认后由 CropManager 写回元素）
	const handleRestoreOriginal = () => {
		const restoreOriginalCrop = canvas?.cropManager.restoreOriginalFromPanel()
		if (!restoreOriginalCrop) return
		setTempCrop(restoreOriginalCrop)
		setIsLocked(false)
	}

	// 展开/收起预设选项
	const toggleItem = (value: string) => {
		setExpandedItems((prev) => {
			const next = new Set(prev)
			if (next.has(value)) {
				next.delete(value)
			} else {
				next.add(value)
			}
			return next
		})
	}

	// tempCrop 更新后同步至 Manager（跳过首次挂载）
	useUpdateEffect(() => {
		if (!canvas || !croppingElementId || !tempCrop) return
		canvas.cropManager.updateTempCropFromPanel(tempCrop, isLocked)
	}, [tempCrop, isLocked])

	// 处理宽度变化
	const handleWidthChange = (value: number) => {
		if (!tempCrop) return
		setTempCrop({ ...tempCrop, width: value })
	}

	// 处理高度变化
	const handleHeightChange = (value: number) => {
		if (!tempCrop) return
		setTempCrop({ ...tempCrop, height: value })
	}

	// 切换锁定比例
	const handleToggleLock = () => {
		setIsLocked((prev) => !prev)
	}

	// 处理预设选项点击
	const handlePresetClick = (value: string) => {
		if (!tempCrop) return

		const [presetWidth, presetHeight] = value?.split("x").map(Number) || []
		if (presetWidth && presetHeight) {
			const calculatedSize = calculateSizeFromPreset(
				presetWidth,
				presetHeight,
				currentImageWidth,
				currentImageHeight,
			)
			const { x: nextX, y: nextY } = centerCropRectInDisplayBounds(
				currentImageWidth,
				currentImageHeight,
				calculatedSize.width,
				calculatedSize.height,
			)
			setTempCrop({
				...tempCrop,
				x: nextX,
				y: nextY,
				width: calculatedSize.width,
				height: calculatedSize.height,
			})
			setIsLocked(true)
		}
	}

	// 当前预设选项
	const currentPresetOptions: CurrentPresetOption[] = useMemo(() => {
		return presetOptions.map((option) => {
			return {
				label: option.label,
				value: option.value,
				children: option.children.map((child) => {
					let processedChild: Required<PresetOptionItem>
					if (option.value === "common") {
						const [ratioWidth, ratioHeight] = child.label.split(":").map(Number)
						const { width: newWidth, height: newHeight } = fitCommonPresetCropToElement(
							currentImageWidth,
							currentImageHeight,
							ratioWidth,
							ratioHeight,
						)

						processedChild = {
							label: child.label,
							value: `${newWidth}x${newHeight}`,
						}
					} else {
						processedChild = child as Required<PresetOptionItem>
					}

					const { iconWidth, iconHeight } = calculatePresetIconSize(processedChild)
					return {
						...processedChild,
						iconWidth,
						iconHeight,
					}
				}),
			}
		})
	}, [currentImageWidth, currentImageHeight])

	const canRestoreOriginal = useMemo(() => {
		if (!tempCrop) return false

		return (
			Math.abs(tempCrop.x) > FULL_CROP_EPSILON ||
			Math.abs(tempCrop.y) > FULL_CROP_EPSILON ||
			Math.abs(tempCrop.width - currentImageWidth) > FULL_CROP_EPSILON ||
			Math.abs(tempCrop.height - currentImageHeight) > FULL_CROP_EPSILON
		)
	}, [currentImageHeight, currentImageWidth, tempCrop])

	// 监听临时crop更新事件(来自CropManager)
	useCanvasEvent("crop:tempCropUpdate", ({ data }) => {
		if (data.elementId === croppingElementId) {
			setTempCrop(data.tempCrop)
		}
	})

	return (
		<div ref={setRefs} className={styles.imageCropPanel} data-canvas-ui-component>
			<div className={styles.titleRow}>
				<div className={styles.title}>{t("elementTools.imageCrop.title", "裁剪")}</div>
				<Button
					type="button"
					variant="outline"
					size="sm"
					className={styles.restoreOriginalButton}
					disabled={!canRestoreOriginal}
					onClick={handleRestoreOriginal}
					aria-label={t("elementTools.imageCrop.restoreOriginal", "恢复原图")}
					title={t("elementTools.imageCrop.restoreOriginal", "恢复原图")}
				>
					<Image className={styles.restoreOriginalIcon} size={14} aria-hidden />
					<span className={styles.restoreOriginalLabel}>
						{t("elementTools.imageCrop.restoreOriginal", "恢复原图")}
					</span>
				</Button>
			</div>
			<SizeInput
				width={tempCrop ? Math.round(tempCrop.width) : 0}
				height={tempCrop ? Math.round(tempCrop.height) : 0}
				isAutoFill
				isLocked={isLocked}
				onWidthChange={handleWidthChange}
				onHeightChange={handleHeightChange}
				onToggleLock={handleToggleLock}
			/>
			<div className={styles.preset}>
				<div className={styles.presetTitle}>
					{t("elementTools.imageCrop.preset", "预设")}
				</div>
				<div className={styles.presetContent}>
					{currentPresetOptions.map((option) => {
						const isExpanded = expandedItems.has(option.value)
						return (
							<CollapsibleBlindsGroup
								key={option.value}
								title={option.label}
								expanded={isExpanded}
								onToggle={() => toggleItem(option.value)}
								itemCount={option.children.length}
							>
								{option.children.map((child) => (
									<CollapsibleBlindsItem
										key={child.value}
										onClick={() => handlePresetClick(child.value)}
										left={
											<>
												<SizeIconPreview
													iconWidth={child.iconWidth}
													iconHeight={child.iconHeight}
													wrapperWidth={20}
													wrapperHeight={20}
												/>
												<span>{child.label}</span>
											</>
										}
										right={option.value !== "common" ? child.value : undefined}
									/>
								))}
							</CollapsibleBlindsGroup>
						)
					})}
				</div>
			</div>
			<div className={styles.buttons}>
				<Button variant="outline" onClick={handleCancel}>
					{t("common.cancel", "取消")}
				</Button>
				<Button onClick={handleComplete}>{t("common.complete", "完成")}</Button>
			</div>
		</div>
	)
}
