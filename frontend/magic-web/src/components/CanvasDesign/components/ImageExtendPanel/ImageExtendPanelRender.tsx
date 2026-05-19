import { useCallback, useEffect, useMemo, useState } from "react"
import type { ExtendSession, ImageElement as ImageElementData } from "../../canvas/types"
import { ElementTypeEnum } from "../../canvas/types"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import { useCanvasModeUI } from "../../context/CanvasUIContext"
import useElementPositionEffect from "../../hooks/useElementPositionEffect"
import { useFloatingComponent } from "../../hooks/useFloatingComponent"
import { useCanvas } from "../../context/CanvasContext"
import { useCanvasEvent } from "../../hooks/useCanvasEvent"
import { useMagic } from "../../context/MagicContext"
import { useUpdateEffect } from "ahooks"
import { GenerationStatus } from "../../types.magic"
import { Button } from "../ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select"
import SizeIconPreview from "../ui/custom/SizeIconPreview"
import { CollapsibleBlindsGroup, CollapsibleBlindsItem } from "../ui/custom/CollapsibleBlindsGroup"
import { ImageElement as ImageElementClass } from "../../canvas/element/elements/ImageElement"
import { createExtendImageFiles } from "../../canvas/utils/extendImageComposer"
import { createExpandImageTaskMeta } from "../../canvas/utils/imageGenerationTaskMeta"
import {
	buildReferenceImageOptions,
	getImageProcessRequestPayload,
} from "../../canvas/utils/imageCropUtils"
import { generateElementId, generateUUID } from "../../canvas/utils/utils"
import { extendPresetOptions, scaleOptions } from "./constants"
import {
	calculateExtendFrameSizeFromControls,
	calculateExtendPresetIconSize,
	createInitialExtendSession,
	parsePresetAspectRatio,
	resizeExtendSessionFrame,
} from "./utils"
import styles from "./index.module.css"

interface ImageExtendPanelRenderProps {
	imageElement: ImageElementData
}

type ProcessedPresetChild = {
	label: string
	ratioValue: string
	description?: string
	iconWidth: number
	iconHeight: number
}

export default function ImageExtendPanelRender(props: ImageExtendPanelRenderProps) {
	const { imageElement } = props
	const { t } = useCanvasDesignI18n()
	const { canvas } = useCanvas()
	const { methods } = useMagic()
	const { extendingElementId } = useCanvasModeUI()
	const defaultScaleValue = String(scaleOptions[0].value)

	const { currentImageWidth, currentImageHeight } = useMemo(
		() => ({
			currentImageWidth: imageElement.width || 0,
			currentImageHeight: imageElement.height || 0,
		}),
		[imageElement.width, imageElement.height],
	)

	const [scale, setScale] = useState(() => defaultScaleValue)
	const [selectedRatioValue, setSelectedRatioValue] = useState("original")
	const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
	const [isSubmitting, setIsSubmitting] = useState(false)
	const [session, setSession] = useState<ExtendSession>(() => {
		return canvas?.extendManager.getTempSession() ?? createInitialExtendSession(imageElement)
	})

	const shouldShowExtendPanel = useCallback(() => {
		return !!extendingElementId && extendingElementId === imageElement.id
	}, [extendingElementId, imageElement.id])

	const { containerRef: positionRef } = useElementPositionEffect({
		position: "right",
		offset: 8,
		verticalAlign: "top",
		shouldShow: shouldShowExtendPanel,
		positionEventType: "extend:position",
		trackedElementId: extendingElementId,
	})

	const { containerRef: floatingRef } = useFloatingComponent({
		id: "image-extend-panel",
		// 与裁剪面板一致：面板内有可滚动预设列表，勿把 wheel 转发给画布
		enableWheelForwarding: false,
	})

	const setRefs = useCallback(
		(node: HTMLDivElement | null) => {
			positionRef.current = node
			floatingRef.current = node
		},
		[positionRef, floatingRef],
	)

	const togglePresetGroup = useCallback((value: string) => {
		setExpandedItems((prev) => {
			const next = new Set(prev)
			if (next.has(value)) next.delete(value)
			else next.add(value)
			return next
		})
	}, [])

	useEffect(() => {
		setScale(defaultScaleValue)
		setSelectedRatioValue("original")
		setSession(
			canvas?.extendManager.getTempSession() ?? createInitialExtendSession(imageElement),
		)
	}, [canvas, defaultScaleValue, imageElement])

	useCanvasEvent("extend:tempUpdate", ({ data }) => {
		if (data.elementId === extendingElementId) {
			setSession(data.session)
		}
	})

	useUpdateEffect(() => {
		if (!canvas || !extendingElementId) return
		canvas.extendManager.updateTempSessionFromPanel(session)
	}, [canvas, extendingElementId, session])

	const applyFrameByControls = useCallback(
		(nextScale: number, nextRatioValue: string) => {
			const targetAspectRatio =
				nextRatioValue === "original" ? null : parsePresetAspectRatio(nextRatioValue)
			const nextFrameSize = calculateExtendFrameSizeFromControls({
				imageWidth: currentImageWidth,
				imageHeight: currentImageHeight,
				scale: nextScale,
				targetAspectRatio,
			})

			const proxyLocal = canvas?.extendManager.getImageProxyLocalRect()
			let anchorCenter: { x: number; y: number } | undefined
			if (proxyLocal) {
				anchorCenter = {
					x: proxyLocal.x + proxyLocal.width / 2,
					y: proxyLocal.y + proxyLocal.height / 2,
				}
			}

			setSession((prev) =>
				resizeExtendSessionFrame({
					session: prev,
					imageWidth: currentImageWidth,
					imageHeight: currentImageHeight,
					targetWidth: nextFrameSize.width,
					targetHeight: nextFrameSize.height,
					anchorCenter,
				}),
			)
		},
		[canvas, currentImageHeight, currentImageWidth],
	)

	const handlePresetSelect = useCallback(
		(ratioValue: string) => {
			if (ratioValue !== "original" && !parsePresetAspectRatio(ratioValue)) return
			setSelectedRatioValue(ratioValue)
			applyFrameByControls(Number(scale), ratioValue)
		},
		[applyFrameByControls, scale],
	)

	const onScaleValueChange = useCallback(
		(v: string) => {
			setScale(v)
			applyFrameByControls(Number(v), selectedRatioValue)
		},
		[applyFrameByControls, selectedRatioValue],
	)

	const currentPresetOptions = useMemo(() => {
		const cw = currentImageWidth
		const ch = currentImageHeight
		return extendPresetOptions.map((option) => ({
			label: option.label,
			value: option.value,
			children: option.children.map((child): ProcessedPresetChild => {
				let ratioValue: string
				if (option.value === "common") {
					if (child.label === "原始比例") {
						ratioValue = "original"
					} else {
						ratioValue = child.label
					}
				} else {
					ratioValue = child.label
				}

				const { iconWidth, iconHeight } =
					ratioValue === "original"
						? calculateExtendPresetIconSize(`${Math.round(cw)}:${Math.round(ch)}`)
						: calculateExtendPresetIconSize(ratioValue)

				return {
					label: child.label,
					ratioValue,
					description: child.description,
					iconWidth,
					iconHeight,
				}
			}),
		}))
	}, [currentImageWidth, currentImageHeight])

	const handleCancel = useCallback(() => {
		if (isSubmitting) return
		if (!canvas) return

		const imageRect = canvas.extendManager.getImageProxyLocalRect()
		const imageBounds = canvas.extendManager.getImageBounds()
		if (imageRect && imageBounds) {
			const nextSourcePosition = getUpdatedImageElementPosition({
				canvas,
				elementId: imageElement.id,
				imageBounds,
				imageRect,
			})
			canvas.elementManager.update(imageElement.id, nextSourcePosition)
		}

		canvas.extendManager.exitExtendMode(false)
	}, [canvas, imageElement.id, isSubmitting])

	const handleComplete = useCallback(() => {
		if (
			!canvas ||
			!methods?.uploadPrivateFiles ||
			!methods?.expandImage ||
			!imageElement.src ||
			isSubmitting
		) {
			return
		}

		const currentSession = canvas.extendManager.getTempSession()
		const imageRect = canvas.extendManager.getImageProxyLocalRect()
		const imageBounds = canvas.extendManager.getImageBounds()
		if (!currentSession || !imageRect || !imageBounds) {
			return
		}

		setIsSubmitting(true)

		let createdElementId: string | undefined
		const imageSrc = imageElement.src

		void (async () => {
			try {
				const elementInstance = canvas.elementManager.getElementInstance(imageElement.id)
				if (!(elementInstance instanceof ImageElementClass)) {
					throw new Error(t("elementTools.imageExtend.submitFailed", "提交失败，请重试"))
				}

				const nextSourcePosition = getUpdatedImageElementPosition({
					canvas,
					elementId: imageElement.id,
					imageBounds,
					imageRect,
				})
				canvas.elementManager.update(imageElement.id, nextSourcePosition)

				const requestImageId = generateUUID()
				const placeholderTaskMeta = createExpandImageTaskMeta({
					file_path: imageSrc,
					reference_image_options: buildReferenceImageOptions({
						filePath: imageSrc,
						crop: imageElement.crop,
					}),
				})
				createdElementId = generateElementId()
				const newImageElement: ImageElementData = {
					id: createdElementId,
					type: ElementTypeEnum.Image,
					x: imageBounds.x + imageBounds.width,
					y: imageBounds.y,
					width: currentSession.frame.width,
					height: currentSession.frame.height,
					zIndex: canvas.elementManager.getNextZIndexInLevel(),
					name: `${imageElement.name || elementInstance.getRenderName()} ${t(
						"elementTools.imageExtend.title",
						"扩展",
					)}`,
					status: GenerationStatus.Pending,
					imageGenerationTaskMeta: placeholderTaskMeta,
				}

				canvas.elementManager.create(newImageElement)
				canvas.extendManager.confirmExtend()
				canvas.selectionManager.select(createdElementId, false)

				const workerResult =
					await canvas.submitImageWorkerManager.createExtendImagesInWorker({
						src: imageSrc,
						crop: imageElement.crop,
						elementSize: {
							width: imageElement.width,
							height: imageElement.height,
						},
						frame: currentSession.frame,
						imageRect,
					})

				const compositeResult = workerResult
					? {
							canvasFile: new File(
								[workerResult.canvasBlob],
								`${generateUUID()}-expand-canvas.png`,
								{
									type: "image/png",
								},
							),
							markFile: new File(
								[workerResult.markBlob],
								`${generateUUID()}-expand-mark.png`,
								{
									type: "image/png",
								},
							),
							size: workerResult.size,
							sourceDimensions: workerResult.sourceDimensions,
						}
					: await (async () => {
							let imageInfo = elementInstance.getImageInfo()
							let imageSource = await elementInstance.getHTMLImageElement()
							if (
								!imageInfo?.naturalWidth ||
								!imageInfo?.naturalHeight ||
								!imageSource
							) {
								imageSource = await elementInstance.getHTMLImageElement()
								imageInfo = elementInstance.getImageInfo()
							}
							if (
								!imageInfo?.naturalWidth ||
								!imageInfo?.naturalHeight ||
								!imageSource
							) {
								throw new Error(
									t("elementTools.imageExtend.submitFailed", "提交失败，请重试"),
								)
							}

							const files = await createExtendImageFiles({
								element: imageElement,
								image: imageSource,
								naturalWidth: imageInfo.naturalWidth,
								naturalHeight: imageInfo.naturalHeight,
								frame: currentSession.frame,
								imageRect,
							})

							return {
								...files,
								sourceDimensions: {
									width: imageInfo.naturalWidth,
									height: imageInfo.naturalHeight,
								},
							}
						})()

				const { crop } = getImageProcessRequestPayload({
					crop: imageElement.crop,
					sourceDimensions: compositeResult.sourceDimensions,
				})

				const uploadResults = await methods.uploadPrivateFiles([
					{
						file: compositeResult.canvasFile,
						relativePath: "design-mark/",
						// eslint-disable-next-line @typescript-eslint/no-empty-function
						onUploadComplete: () => {},
						// eslint-disable-next-line @typescript-eslint/no-empty-function
						onUploadFailed: () => {},
					},
					{
						file: compositeResult.markFile,
						relativePath: "design-mark/",
						// eslint-disable-next-line @typescript-eslint/no-empty-function
						onUploadComplete: () => {},
						// eslint-disable-next-line @typescript-eslint/no-empty-function
						onUploadFailed: () => {},
					},
				])

				const canvasPath = uploadResults[0]?.path
				const maskPath = uploadResults[1]?.path
				if (!canvasPath || !maskPath) {
					throw new Error(t("elementTools.imageExtend.submitFailed", "提交失败，请重试"))
				}

				const newElementInstance =
					canvas.elementManager.getElementInstance(createdElementId)
				if (!(newElementInstance instanceof ImageElementClass)) {
					throw new Error(t("elementTools.imageExtend.submitFailed", "提交失败，请重试"))
				}

				const success = await newElementInstance.expandImage({
					image_id: requestImageId,
					file_path: imageSrc,
					canvas_path: canvasPath,
					mask_path: maskPath,
					size: compositeResult.size,
					reference_image_options: buildReferenceImageOptions({
						filePath: imageSrc,
						crop,
					}),
				})
				if (!success) {
					throw new Error(t("elementTools.imageExtend.submitFailed", "提交失败，请重试"))
				}
			} catch (error) {
				if (createdElementId) {
					canvas.elementManager.delete(createdElementId)
				}
			} finally {
				setIsSubmitting(false)
			}
		})()
	}, [canvas, methods, imageElement, isSubmitting, t])

	return (
		<div ref={setRefs} className={styles.imageExtendPanel} data-canvas-ui-component>
			<div className={styles.titleRow}>
				<div className={styles.title}>{t("elementTools.imageExtend.title", "扩展")}</div>
			</div>
			<div className={styles.section}>
				<div className={styles.label}>
					{t("elementTools.imageExtend.scaleSection", "缩放比例")}
				</div>
				<Select value={scale} onValueChange={onScaleValueChange}>
					<SelectTrigger className={styles.scaleSelectTrigger}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{scaleOptions.map((opt) => (
							<SelectItem key={opt.value} value={String(opt.value)}>
								{opt.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className={styles.preset}>
				<div className={styles.presetTitle}>
					{t("elementTools.imageExtend.presetSection", "预设")}
				</div>
				<div className={styles.presetContent}>
					{currentPresetOptions.map((option) => {
						const isExpanded = expandedItems.has(option.value)
						return (
							<CollapsibleBlindsGroup
								key={option.value}
								title={option.label}
								expanded={isExpanded}
								onToggle={() => togglePresetGroup(option.value)}
								itemCount={option.children.length}
							>
								{option.children.map((child) => (
									<CollapsibleBlindsItem
										key={`${option.value}-${child.label}-${
											child.description ?? ""
										}`}
										onClick={() => handlePresetSelect(child.ratioValue)}
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
										right={
											option.value !== "common"
												? child.description
												: undefined
										}
									/>
								))}
							</CollapsibleBlindsGroup>
						)
					})}
				</div>
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
				<Button type="button" onClick={handleComplete} disabled={isSubmitting}>
					{t("common.complete", "完成")}
				</Button>
			</div>
		</div>
	)
}

function getUpdatedImageElementPosition(params: {
	canvas: NonNullable<ReturnType<typeof useCanvas>["canvas"]>
	elementId: string
	imageBounds: { x: number; y: number; width: number; height: number }
	imageRect: { x: number; y: number; width: number; height: number }
}): { x: number; y: number; width: number; height: number } {
	const { canvas, elementId, imageBounds, imageRect } = params
	const parentId = canvas.elementManager.findParentIdForElement(elementId)
	if (!parentId) {
		return {
			x: imageBounds.x,
			y: imageBounds.y,
			width: imageRect.width,
			height: imageRect.height,
		}
	}

	const parentNode = canvas.elementManager.getElementInstance(parentId)?.getNode()
	if (!parentNode) {
		return {
			x: imageBounds.x,
			y: imageBounds.y,
			width: imageRect.width,
			height: imageRect.height,
		}
	}

	const localPoint = parentNode.getAbsoluteTransform().copy().invert().point({
		x: imageBounds.x,
		y: imageBounds.y,
	})
	return {
		x: localPoint.x,
		y: localPoint.y,
		width: imageRect.width,
		height: imageRect.height,
	}
}
