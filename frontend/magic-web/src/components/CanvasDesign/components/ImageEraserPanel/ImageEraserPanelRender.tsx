import { useCallback, useEffect, useMemo, useState } from "react"
import { Undo2 } from "lucide-react"
import {
	getEraserRadiusDefault,
	MIN_RADIUS,
	MAX_RADIUS,
} from "../../canvas/interaction/EraserManager"
import { ElementTypeEnum, type ImageElement as ImageElementData } from "../../canvas/types"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"
import { createEraserMaskFile } from "../../canvas/utils/eraserMaskComposer"
import { flattenEraserStrokes } from "../../canvas/utils/eraserStrokeTransfer"
import { createEraserTaskMeta } from "../../canvas/utils/imageGenerationTaskMeta"
import {
	buildReferenceImageOptions,
	getImageProcessRequestPayload,
} from "../../canvas/utils/imageCropUtils"
import {
	calculateNewElementPosition,
	generateElementId,
	generateUUID,
} from "../../canvas/utils/utils"
import { useCanvas } from "../../context/CanvasContext"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import { useMagic } from "../../context/MagicContext"
import { useCanvasModeUI } from "../../context/CanvasUIContext"
import useElementPositionEffect from "../../hooks/useElementPositionEffect"
import { useCanvasEvent } from "../../hooks/useCanvasEvent"
import { useFloatingComponent } from "../../hooks/useFloatingComponent"
import { GenerationStatus } from "../../types.magic"
import { Button } from "../ui/button"
import { Slider } from "../ui/slider"
import styles from "./index.module.css"

function noop() {
	return undefined
}

export default function ImageEraserPanelRender() {
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const { methods } = useMagic()
	const { erasingElementId } = useCanvasModeUI()

	const [radius, setRadius] = useState(
		() => canvas?.eraserManager.getRadius() ?? getEraserRadiusDefault(),
	)
	const [canUndo, setCanUndo] = useState(() => canvas?.eraserManager.canUndo() ?? false)
	const [isSubmitting, setIsSubmitting] = useState(false)

	const radiusRange = useMemo(() => {
		return canvas?.eraserManager.getRadiusRange() ?? { min: MIN_RADIUS, max: MAX_RADIUS }
	}, [canvas])

	const erasingImageElement = useMemo(() => {
		if (!canvas || !erasingElementId) return null
		const element = canvas.elementManager.getElementData(erasingElementId)
		if (!element || element.type !== ElementTypeEnum.Image) return null
		return element as ImageElementData
	}, [canvas, erasingElementId])

	const erasingImageElementInstance = useMemo(() => {
		if (!canvas || !erasingElementId) return null
		const elementInstance = canvas.elementManager.getElementInstance(erasingElementId)
		if (!(elementInstance instanceof ImageElementClass)) return null
		return elementInstance
	}, [canvas, erasingElementId])

	useEffect(() => {
		if (!canvas || !erasingElementId) return
		setRadius(canvas.eraserManager.getRadius())
		setCanUndo(canvas.eraserManager.canUndo())
	}, [canvas, erasingElementId])

	useCanvasEvent(
		"eraser:sessionUpdate",
		({ data }) => {
			if (data.elementId !== erasingElementId) return
			setRadius(data.radius)
			setCanUndo(data.canUndo)
		},
		[erasingElementId],
	)

	const { containerRef: positionRef } = useElementPositionEffect({
		position: "right",
		offset: 8,
		verticalAlign: "top",
		shouldShow: () => !!erasingElementId,
		positionEventType: "eraser:position",
		trackedElementId: erasingElementId,
	})

	const { containerRef: floatingRef } = useFloatingComponent({
		id: "image-eraser-panel",
		enableWheelForwarding: true,
	})

	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			positionRef.current = node
			floatingRef.current = node
		},
		[positionRef, floatingRef],
	)

	const handleRadiusChange = useCallback(
		(value: number[]) => {
			const nextRadius = value[0]
			setRadius(nextRadius)
			canvas?.eraserManager.setRadius(nextRadius)
		},
		[canvas],
	)

	const handleUndo = useCallback(() => {
		canvas?.eraserManager.undoLastStroke()
	}, [canvas])

	const handleCancel = useCallback(() => {
		if (isSubmitting) return
		canvas?.eraserManager.cancelEraser()
	}, [canvas, isSubmitting])

	const handleConfirm = useCallback(async () => {
		if (
			!canvas ||
			!methods?.uploadPrivateFiles ||
			!erasingElementId ||
			!erasingImageElement ||
			!erasingImageElementInstance ||
			isSubmitting
		) {
			return
		}

		const strokes = canvas.eraserManager.getStrokes()
		if (strokes.length === 0 || !erasingImageElement.src) return

		setIsSubmitting(true)

		let createdElementId: string | undefined

		try {
			const newPosition = calculateNewElementPosition(
				erasingImageElement,
				erasingImageElementInstance,
				canvas.elementManager,
				0,
			)
			if (!newPosition) {
				throw new Error(t("elementTools.imageEraser.submitFailed", "提交失败，请重试"))
			}

			const requestImageId = generateUUID()
			const placeholderTaskMeta = createEraserTaskMeta({
				file_path: erasingImageElement.src,
				reference_image_options: buildReferenceImageOptions({
					filePath: erasingImageElement.src,
					crop: erasingImageElement.crop,
				}),
			})
			createdElementId = generateElementId()
			const newImageElement: ImageElementData = {
				id: createdElementId,
				type: ElementTypeEnum.Image,
				x: newPosition.x,
				y: newPosition.y,
				width: erasingImageElement.width ?? 1024,
				height: erasingImageElement.height ?? 1024,
				zIndex: canvas.elementManager.getNextZIndexInLevel(),
				name: `${
					erasingImageElement.name || erasingImageElementInstance.getRenderName()
				} ${t("elementTools.imageEraser.title", "橡皮工具")}`,
				status: GenerationStatus.Pending,
				imageGenerationTaskMeta: placeholderTaskMeta,
			}

			canvas.elementManager.create(newImageElement)
			canvas.eraserManager.exitEraserMode(false)
			canvas.selectionManager.select(createdElementId, false)

			let imageInfo = erasingImageElementInstance.getImageInfo()
			let sourceDimensions =
				imageInfo?.naturalWidth && imageInfo?.naturalHeight
					? {
							width: imageInfo.naturalWidth,
							height: imageInfo.naturalHeight,
						}
					: undefined

			const workerResult = await canvas.submitImageWorkerManager.createEraserMaskInWorker({
				src: erasingImageElement.src,
				crop: erasingImageElement.crop,
				elementSize: {
					width: erasingImageElement.width,
					height: erasingImageElement.height,
				},
				sourceDimensions,
				strokes: flattenEraserStrokes(strokes),
			})
			const maskFile = workerResult
				? new File([workerResult.blob], `${generateUUID()}.png`, {
						type: "image/png",
					})
				: await (async () => {
						if (!sourceDimensions) {
							await erasingImageElementInstance.getHTMLImageElement()
							imageInfo = erasingImageElementInstance.getImageInfo()
							if (!imageInfo?.naturalWidth || !imageInfo?.naturalHeight) {
								throw new Error(
									t("elementTools.imageEraser.submitFailed", "提交失败，请重试"),
								)
							}
							sourceDimensions = {
								width: imageInfo.naturalWidth,
								height: imageInfo.naturalHeight,
							}
						}

						return createEraserMaskFile({
							element: erasingImageElement,
							strokes,
							naturalWidth: sourceDimensions.width,
							naturalHeight: sourceDimensions.height,
						})
					})()

			sourceDimensions = workerResult?.sourceDimensions ?? sourceDimensions
			if (!sourceDimensions) {
				throw new Error(t("elementTools.imageEraser.submitFailed", "提交失败，请重试"))
			}

			const imageProcessRequestPayload = getImageProcessRequestPayload({
				crop: erasingImageElement.crop,
				sourceDimensions,
			})

			const uploadResults = await methods.uploadPrivateFiles([
				{
					file: maskFile,
					relativePath: "design-mark/",
					onUploadComplete: noop,
					onUploadFailed: noop,
				},
			])
			const maskPath = uploadResults[0]?.path
			if (!maskPath) {
				throw new Error(t("elementTools.imageEraser.submitFailed", "提交失败，请重试"))
			}

			const newElementInstance = canvas.elementManager.getElementInstance(createdElementId)
			if (!(newElementInstance instanceof ImageElementClass)) {
				throw new Error(t("elementTools.imageEraser.submitFailed", "提交失败，请重试"))
			}

			const success = await newElementInstance.eraser({
				image_id: requestImageId,
				file_path: erasingImageElement.src,
				mark_path: maskPath,
				size: imageProcessRequestPayload.size,
				reference_image_options: buildReferenceImageOptions({
					filePath: erasingImageElement.src,
					crop: imageProcessRequestPayload.crop,
				}),
			})
			if (!success) {
				throw new Error(t("elementTools.imageEraser.submitFailed", "提交失败，请重试"))
			}
		} catch (error) {
			if (createdElementId) {
				canvas.elementManager.delete(createdElementId)
			}
		} finally {
			setIsSubmitting(false)
		}
	}, [
		canvas,
		methods,
		erasingElementId,
		erasingImageElement,
		erasingImageElementInstance,
		isSubmitting,
		t,
	])

	return (
		<div ref={setRefs} className={styles.imageEraserPanel} data-canvas-ui-component>
			<div className={styles.titleRow}>
				<div className={styles.title}>
					{t("elementTools.imageEraser.title", "橡皮工具")}
				</div>
				<Button
					type="button"
					variant="outline"
					size="icon"
					className={styles.undoIconButton}
					disabled={!canUndo || isSubmitting}
					onClick={handleUndo}
					aria-label={t("common.undo", "撤销")}
					title={t("common.undo", "撤销")}
				>
					<Undo2 size={16} />
				</Button>
			</div>
			<div className={styles.section}>
				<Slider
					value={[radius]}
					min={radiusRange.min}
					max={radiusRange.max}
					step={1}
					disabled={isSubmitting}
					onValueChange={handleRadiusChange}
				/>
			</div>
			<div className={styles.buttons}>
				<Button
					type="button"
					variant="outline"
					onClick={handleCancel}
					disabled={isSubmitting}
				>
					{t("common.cancel", "取消")}
				</Button>
				<Button type="button" onClick={handleConfirm} disabled={!canUndo || isSubmitting}>
					{t("common.ok", "确定")}
				</Button>
			</div>
		</div>
	)
}
