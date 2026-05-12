import { useCallback, useEffect, useMemo, useState } from "react"
import { ElementTypeEnum } from "../../../../canvas/types"
import { useCanvasUI } from "../../../../context/CanvasUIContext"
import { Select, SelectContent, SelectItem, SelectTrigger } from "../../../ui/select"
import styles from "./index.module.css"
import { useCanvas } from "../../../../context/CanvasContext"
import { useCanvasDesignI18n } from "../../../../context/I18nContext"
import SizeIconPreview from "../../../ui/custom/SizeIconPreview"
import { cn } from "../../../../lib/utils"
import { getPersistedSourceCrop } from "../../../../canvas/utils/imageCropUtils"

interface SizeOption {
	label: string
	ratio: string
	width: number
	height: number
	iconWidth: number
	iconHeight: number
}

const ORIGINAL_SIZE_RATIO = "__original_size__"

const SIZE_OPTIONS: SizeOption[] = [
	{
		label: "1:1",
		ratio: "1:1",
		width: 1024,
		height: 1024,
		iconWidth: 12,
		iconHeight: 12,
	},
	{
		label: "2:3",
		ratio: "2:3",
		width: 1024,
		height: 1536,
		iconWidth: 10,
		iconHeight: 15,
	},
	{
		label: "9:16",
		ratio: "9:16",
		width: 1080,
		height: 1920,
		iconWidth: 9,
		iconHeight: 16,
	},
	{
		label: "3:2",
		ratio: "3:2",
		width: 1536,
		height: 1024,
		iconWidth: 15,
		iconHeight: 10,
	},
	{
		label: "16:9",
		ratio: "16:9",
		width: 1920,
		height: 1080,
		iconWidth: 16,
		iconHeight: 9,
	},
	{
		label: "A4",
		ratio: "A4",
		width: 1024,
		height: 1754,
		iconWidth: 10,
		iconHeight: 15,
	},
	{
		label: "Website",
		ratio: "Website",
		width: 1366,
		height: 768,
		iconWidth: 13,
		iconHeight: 7,
	},
]

export type SizeSelectProps = {
	selectTriggerClassName?: string
	/** 为 true 时 Select 触发器横向铺满容器（覆盖默认 98px） */
	fullWidth?: boolean
	/** 草稿宽高：与 onDraftPreset 同时传入时，选择预设只更新草稿，不写画布 */
	draftWidth?: number
	draftHeight?: number
	onDraftPreset?: (width: number, height: number) => void
}

export default function SizeSelect(props: SizeSelectProps) {
	const { selectTriggerClassName, fullWidth, draftWidth, draftHeight, onDraftPreset } = props
	const isDraftMode = onDraftPreset != null
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()
	const [originalSizeOption, setOriginalSizeOption] = useState<SizeOption | null>(null)

	// 获取当前选中的第一个元素
	const selectedElement = useMemo(() => {
		if (selectedElements.length === 0) return null
		return selectedElements[0]
	}, [selectedElements])

	const selectedMediaElement = useMemo(() => {
		if (!selectedElement) {
			return null
		}
		if (
			selectedElement.type !== ElementTypeEnum.Image &&
			selectedElement.type !== ElementTypeEnum.Video
		) {
			return null
		}
		return selectedElement
	}, [selectedElement])

	const selectedImageElement = useMemo(() => {
		if (selectedMediaElement?.type !== ElementTypeEnum.Image) {
			return null
		}
		return selectedMediaElement
	}, [selectedMediaElement])

	const sizeOptions = useMemo(() => {
		if (!originalSizeOption) {
			return SIZE_OPTIONS
		}
		return [originalSizeOption, ...SIZE_OPTIONS]
	}, [originalSizeOption])

	useEffect(() => {
		if (!canvas || !selectedMediaElement?.src) {
			setOriginalSizeOption(null)
			return
		}

		let cancelled = false
		const mediaSrc = selectedMediaElement.src

		const buildOriginalSizeOption = (
			width: number,
			height: number,
			kind: "image" | "video",
		): SizeOption | null => {
			if (width <= 0 || height <= 0) {
				return null
			}

			const maxPreviewEdge = 16
			const scale = Math.min(maxPreviewEdge / width, maxPreviewEdge / height, 1)

			return {
				label:
					kind === "image"
						? t("sizeSelect.originalImageSize", "原图尺寸")
						: t("sizeSelect.originalVideoSize", "原始尺寸"),
				ratio: ORIGINAL_SIZE_RATIO,
				width,
				height,
				iconWidth: Math.max(1, Math.round(width * scale)),
				iconHeight: Math.max(1, Math.round(height * scale)),
			}
		}

		const syncOriginalSizeOption = async () => {
			try {
				if (selectedMediaElement.type === ElementTypeEnum.Image) {
					const resource = await canvas.imageResourceManager.getResource(mediaSrc)
					if (cancelled) return
					const naturalWidth = resource?.imageInfo?.naturalWidth ?? 0
					const naturalHeight = resource?.imageInfo?.naturalHeight ?? 0
					const sourceCrop = getPersistedSourceCrop(selectedImageElement?.crop, {
						width: naturalWidth,
						height: naturalHeight,
					})
					setOriginalSizeOption(
						buildOriginalSizeOption(
							Math.round(sourceCrop.width),
							Math.round(sourceCrop.height),
							"image",
						),
					)
					return
				}

				const resource = await canvas.videoResourceManager.getPreviewResource(mediaSrc)
				if (cancelled) return
				setOriginalSizeOption(
					buildOriginalSizeOption(
						resource?.metadata?.videoWidth ?? 0,
						resource?.metadata?.videoHeight ?? 0,
						"video",
					),
				)
			} catch (error) {
				if (!cancelled) {
					setOriginalSizeOption(null)
				}
			}
		}

		void syncOriginalSizeOption()

		return () => {
			cancelled = true
		}
	}, [
		canvas,
		selectedImageElement?.crop,
		selectedMediaElement?.id,
		selectedMediaElement?.src,
		selectedMediaElement?.type,
		t,
	])

	// 根据当前元素的宽高（或草稿），找到最匹配的尺寸选项
	const currentOption = useMemo(() => {
		const currentWidth = isDraftMode ? draftWidth : selectedElement?.width
		const currentHeight = isDraftMode ? draftHeight : selectedElement?.height
		if (currentWidth == null || currentHeight == null) return null
		if (!currentWidth || !currentHeight) return null

		return sizeOptions.find(
			(option) => option.width === currentWidth && option.height === currentHeight,
		)
	}, [isDraftMode, draftWidth, draftHeight, selectedElement, sizeOptions])

	// 获取当前值
	const currentValue = useMemo(() => {
		return currentOption?.ratio || ""
	}, [currentOption])

	// 获取显示文本
	const displayText = useMemo(() => {
		if (currentOption) {
			return currentOption.label
		}
		if (isDraftMode || selectedElement) {
			return t("sizeSelect.custom", "自定义")
		}
		return t("sizeSelect.selectSize", "选择尺寸")
	}, [currentOption, isDraftMode, selectedElement, t])

	// 处理选择变化
	const handleSelectChange = useCallback(
		(selectedRatio: string) => {
			const option = sizeOptions.find((opt) => opt.ratio === selectedRatio)
			if (!option) return
			if (isDraftMode && onDraftPreset) {
				onDraftPreset(option.width, option.height)
				return
			}
			if (selectedElement && canvas) {
				canvas.elementManager.update(selectedElement.id, {
					width: option.width,
					height: option.height,
				})
			}
		},
		[isDraftMode, onDraftPreset, selectedElement, canvas, sizeOptions],
	)

	return (
		<Select value={currentValue} onValueChange={handleSelectChange}>
			<SelectTrigger
				className={cn(
					styles.selectTrigger,
					fullWidth && styles.selectTriggerFull,
					selectTriggerClassName,
				)}
			>
				<span className={styles.triggerText}>{displayText}</span>
			</SelectTrigger>
			<SelectContent>
				{sizeOptions.map((option) => (
					<SelectItem
						key={option.ratio}
						value={option.ratio}
						className={styles.selectOptionItem}
					>
						<div className={styles.selectOptionItemContent}>
							<SizeIconPreview
								iconWidth={option.iconWidth}
								iconHeight={option.iconHeight}
							/>
							<span className={styles.label}>{option.label}</span>
							<span className={styles.size}>
								{option.width}*{option.height}
							</span>
						</div>
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	)
}
