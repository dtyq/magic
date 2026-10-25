import { useCallback, useMemo } from "react"
import IconButton from "../../../../primitives/custom/IconButton/index"
import styles from "./index.module.css"
import { Wand2 } from "lucide-react"
import { useCanvasDesignI18n } from "../../../../../app/providers/I18nProvider"
import { useCanvas } from "../../../../../app/providers/CanvasProvider"
import { useCanvasUI } from "../../../../../app/providers/CanvasUIProvider"
import { useMagic } from "../../../../../app/providers/MagicProvider"
import { ElementToolTypeEnum } from "../../../../../public/props"
import { ElementTypeEnum, type ImageElement } from "../../../../../runtime/document/types"
import { ImageElement as ImageElementClass } from "../../../../../runtime/elements/image/ImageElement"
import { ElementFactory } from "../../../../../runtime/elements/core/ElementFactory"
import { createRemoveBackgroundTaskMeta } from "../../../../../runtime/resources/image/imageGenerationTaskMeta"
import { generateElementId, generateUUID } from "../../../../../runtime/shared/ids"
import { resolveDerivedRightPlacement } from "../../../../../runtime/shared/placement/placementEngine"
import {
	buildReferenceImageOptions,
	getImageProcessRequestPayload,
} from "../../../../../runtime/resources/image/imageCropUtils"
import {
	getActiveImageContent,
	getContentById,
} from "../../../../../runtime/document/elementContent"
import { useElementToolResolution } from "../../../model/ElementToolResolutionContext"
import { useElementToolCommand } from "../../../model/useElementToolCommand"

export default function ImageRemoveBackgroundButton() {
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const { selectedElements } = useCanvasUI()
	const { methods } = useMagic()
	const tool = useElementToolResolution()

	const handleRemoveBackground = useCallback(async () => {
		if (!canvas || !methods?.removeBackground) {
			return
		}

		const targetElementId = tool?.target.elementId ?? selectedElements[0]?.id
		if (!targetElementId) return
		const sourceElement = canvas.elementManager.getElementData(targetElementId) as
			| ImageElement
			| undefined
		if (!sourceElement || sourceElement.type !== ElementTypeEnum.Image) return
		const sourceInstance = canvas.elementManager.getElementInstance(sourceElement.id)
		if (!(sourceInstance instanceof ImageElementClass)) return
		const activeContent = tool
			? tool.target.contentId
				? getContentById(sourceElement, tool.target.contentId)
				: undefined
			: getActiveImageContent(sourceElement)
		if (!activeContent) return
		const filePath = activeContent.src
		if (!filePath) return

		canvas.eventEmitter.emit({
			type: "element:image:generate-submit-started",
			data: { elementId: sourceElement.id },
		})

		let imageInfo = sourceInstance.getImageInfo()
		if (!imageInfo?.naturalWidth || !imageInfo?.naturalHeight) {
			await sourceInstance.getHTMLImageElement({ variant: "preview" })
			imageInfo = sourceInstance.getImageInfo()
		}

		const imageProcessRequestPayload = getImageProcessRequestPayload({
			crop: activeContent.crop,
			sourceDimensions: {
				width: imageInfo?.naturalWidth ?? sourceElement.width ?? 0,
				height: imageInfo?.naturalHeight ?? sourceElement.height ?? 0,
			},
		})

		const newPosition = resolveDerivedRightPlacement(
			sourceElement,
			sourceInstance,
			canvas.elementManager,
			{ spacing: 0 },
		)
		if (!newPosition) return

		const newElementId = generateElementId()
		const newZIndex = canvas.elementManager.getNextZIndexInLevel()
		const originalBaseName = sourceElement.name || sourceInstance.getRenderName()
		const removeBackgroundSuffix = t("elementTools.imageRemoveBackground.title", "去背景")
		const requestImageId = generateUUID()

		const newImageElement = {
			...ElementFactory.createElementData(
				ElementTypeEnum.Image,
				newElementId,
				newPosition.x,
				newPosition.y,
				sourceElement.width ?? 1024,
				sourceElement.height ?? 1024,
				newZIndex,
			),
			name: `${originalBaseName} ${removeBackgroundSuffix}`,
		} as ImageElement
		const targetContentId = newImageElement.activeContentId
		if (!targetContentId) return

		// 去背景任务确认前只保留运行时结果占位，避免 Pending 元素进入 DSL。
		canvas.elementManager.createTemporaryElement(newImageElement, { silent: true })
		const attemptId = canvas.generationRuntimeManager.beginAttempt({
			operation: "image-remove-background",
			originElementId: sourceElement.id,
			phase: "submitting",
			failurePolicy: "remove-placeholder",
			targets: [
				{
					elementId: newElementId,
					contentId: targetContentId,
					imageGenerationTaskMeta: createRemoveBackgroundTaskMeta({
						image_id: requestImageId,
						file_path: filePath,
						size: imageProcessRequestPayload.size,
						reference_image_options: buildReferenceImageOptions({
							filePath,
							crop: imageProcessRequestPayload.crop,
						}),
					}),
				},
			],
		})
		const newElementInstance = canvas.elementManager.getElementInstance(newElementId)
		if (!newElementInstance || !(newElementInstance instanceof ImageElementClass)) {
			canvas.eventEmitter.emit({
				type: "element:image:generate-submit-failed",
				data: { elementId: sourceElement.id },
			})
			canvas.generationAttemptCoordinator.rejectAttempt(attemptId)
			return
		}

		try {
			const success = await newElementInstance.removeBackground(
				{
					image_id: requestImageId,
					file_path: filePath,
					size: imageProcessRequestPayload.size,
					reference_image_options: buildReferenceImageOptions({
						filePath,
						crop: imageProcessRequestPayload.crop,
					}),
				},
				{ attemptId },
			)
			if (!success) {
				canvas.eventEmitter.emit({
					type: "element:image:generate-submit-failed",
					data: { elementId: sourceElement.id },
				})
				return
			}
			canvas.selectionManager.select(newElementId, false)
		} catch {
			canvas.eventEmitter.emit({
				type: "element:image:generate-submit-failed",
				data: { elementId: sourceElement.id },
			})
			canvas.generationAttemptCoordinator.rejectAttempt(attemptId)
		}
	}, [canvas, methods, selectedElements, t, tool])

	useElementToolCommand(
		useMemo(
			() =>
				tool?.target.elementId && tool.target.contentId
					? {
							elementId: tool.target.elementId,
							contentId: tool.target.contentId,
							toolId: ElementToolTypeEnum.ContentRemoveBackground,
							state: { available: Boolean(methods?.removeBackground) },
							execute: () => handleRemoveBackground(),
						}
					: null,
			[handleRemoveBackground, methods?.removeBackground, tool],
		),
	)

	return (
		<IconButton
			onClick={() => {
				if (tool?.id === ElementToolTypeEnum.ContentRemoveBackground) {
					void tool.execute?.()
					return
				}
				void handleRemoveBackground()
			}}
			className={styles.imageRemoveBackgroundButton}
		>
			<Wand2 size={16} />
			<span className={styles.buttonText}>
				{t("elementTools.imageRemoveBackground.title", "去背景")}
			</span>
		</IconButton>
	)
}
