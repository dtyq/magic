import { useMemo, useState, useCallback, useEffect } from "react"
import styles from "../index.module.css"
import { type ImageElement } from "../../../../../canvas/types"
import { getPersistedSourceCrop } from "../../../../../canvas/utils/imageCropUtils"
import { useCanvas } from "../../../../../context/CanvasContext"
import { ImageElement as ImageElementClass } from "../../../../../canvas/element/elements/ImageElement"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { Tooltip, TooltipTrigger, TooltipContent } from "../../../../ui/tooltip"
import { usePortalContainer } from "../../../../ui/custom/PortalContainerContext"

const LAYER_IMAGE_THUMBNAIL_SIZE = 16
const TOOLTIP_PREVIEW_MAX_SIZE = 160

export default function LayerImageThumbnail(props: {
	element: ImageElement
	src: string
	alt: string
}) {
	const { element, src, alt } = props
	const { canvas } = useCanvas()
	const portalContainer = usePortalContainer()
	const elementInstance = canvas?.elementManager.getElementInstance(element.id)
	const imageInfo =
		elementInstance instanceof ImageElementClass ? elementInstance.getImageInfo() : undefined

	const [tooltipOpen, setTooltipOpen] = useState(false)
	const [tooltipImageUrl, setTooltipImageUrl] = useState<string | null>(null)
	const [isTooltipLoading, setIsTooltipLoading] = useState(false)
	const [hasTooltipError, setHasTooltipError] = useState(false)

	useEffect(() => {
		setTooltipImageUrl(null)
		setIsTooltipLoading(false)
		setHasTooltipError(false)
	}, [element.src])

	const loadTooltipImageUrl = useCallback(() => {
		if (!canvas || !element.src) return
		setIsTooltipLoading(true)
		setHasTooltipError(false)
		canvas.imageResourceManager.getResource(element.src).then((resource) => {
			setTooltipImageUrl(resource?.ossSrc ?? null)
			setHasTooltipError(!resource?.ossSrc)
			setIsTooltipLoading(false)
		})
	}, [canvas, element.src])

	const handleTooltipOpenChange = useCallback(
		(open: boolean) => {
			setTooltipOpen(open)
			if (open && !tooltipImageUrl) loadTooltipImageUrl()
		},
		[tooltipImageUrl, loadTooltipImageUrl],
	)

	const { viewportStyle, contentStyle, tooltipPreview } = useMemo(() => {
		const baseViewportStyle = {
			width: "100%",
			height: "100%",
			left: "0px",
			top: "0px",
		}
		const baseContentStyle = {
			backgroundImage: `url("${src}")`,
			backgroundPosition: "center",
			backgroundSize: "contain",
		}
		const noTooltipPreview = null

		if (!imageInfo) {
			return {
				viewportStyle: baseViewportStyle,
				contentStyle: baseContentStyle,
				tooltipPreview: noTooltipPreview,
			}
		}

		const sourceWidth = imageInfo.naturalWidth ?? 0
		const sourceHeight = imageInfo.naturalHeight ?? 0
		if (sourceWidth <= 0 || sourceHeight <= 0) {
			return {
				viewportStyle: baseViewportStyle,
				contentStyle: baseContentStyle,
				tooltipPreview: noTooltipPreview,
			}
		}

		const sourceCrop = getPersistedSourceCrop(element.crop, {
			width: sourceWidth,
			height: sourceHeight,
		})
		if (sourceCrop.width <= 0 || sourceCrop.height <= 0) {
			return {
				viewportStyle: baseViewportStyle,
				contentStyle: baseContentStyle,
				tooltipPreview: noTooltipPreview,
			}
		}

		const scale = Math.min(
			LAYER_IMAGE_THUMBNAIL_SIZE / sourceCrop.width,
			LAYER_IMAGE_THUMBNAIL_SIZE / sourceCrop.height,
		)
		const viewportWidth = sourceCrop.width * scale
		const viewportHeight = sourceCrop.height * scale
		const viewportOffsetX = (LAYER_IMAGE_THUMBNAIL_SIZE - viewportWidth) / 2
		const viewportOffsetY = (LAYER_IMAGE_THUMBNAIL_SIZE - viewportHeight) / 2

		const tooltipScale = Math.min(
			TOOLTIP_PREVIEW_MAX_SIZE / sourceCrop.width,
			TOOLTIP_PREVIEW_MAX_SIZE / sourceCrop.height,
		)
		const tooltipViewportWidth = sourceCrop.width * tooltipScale
		const tooltipViewportHeight = sourceCrop.height * tooltipScale

		return {
			viewportStyle: {
				width: `${viewportWidth}px`,
				height: `${viewportHeight}px`,
				left: `${viewportOffsetX}px`,
				top: `${viewportOffsetY}px`,
			},
			contentStyle: {
				...baseContentStyle,
				width: `${sourceWidth * scale}px`,
				height: `${sourceHeight * scale}px`,
				transform: `translate(${-sourceCrop.x * scale}px, ${-sourceCrop.y * scale}px)`,
				backgroundSize: "100% 100%",
			},
			tooltipPreview: {
				viewportStyle: {
					width: `${tooltipViewportWidth}px`,
					height: `${tooltipViewportHeight}px`,
				},
				contentStyle: {
					...baseContentStyle,
					width: `${sourceWidth * tooltipScale}px`,
					height: `${sourceHeight * tooltipScale}px`,
					transform: `translate(${-sourceCrop.x * tooltipScale}px, ${
						-sourceCrop.y * tooltipScale
					}px)`,
					backgroundSize: "100% 100%",
				},
			},
		}
	}, [element.crop, imageInfo, src])

	return (
		<Tooltip open={tooltipOpen} onOpenChange={handleTooltipOpenChange}>
			<TooltipTrigger asChild>
				<div className={styles.layerNodeElementIcon}>
					<div className={styles.layerNodeImageThumbnail} role="img" aria-label={alt}>
						<div
							className={styles.layerNodeImageThumbnailViewport}
							style={viewportStyle}
						>
							<div
								className={styles.layerNodeImageThumbnailContent}
								style={contentStyle}
							/>
						</div>
					</div>
				</div>
			</TooltipTrigger>
			<TooltipPrimitive.Portal container={portalContainer || undefined}>
				<TooltipContent
					side="right"
					sideOffset={6}
					className={styles.layerNodeImageThumbnailTooltip}
				>
					{isTooltipLoading ? (
						<div className={styles.layerNodeImageThumbnailTooltipLoading} />
					) : hasTooltipError ? (
						<div className={styles.layerNodeImageThumbnailTooltipLoading} />
					) : tooltipPreview ? (
						<div
							className={styles.layerNodeImageThumbnailTooltipViewport}
							style={tooltipPreview.viewportStyle}
						>
							<div
								className={styles.layerNodeImageThumbnailContent}
								style={{
									...tooltipPreview.contentStyle,
									backgroundImage: `url("${tooltipImageUrl}")`,
								}}
							/>
						</div>
					) : (
						<img
							src={tooltipImageUrl ?? undefined}
							alt={alt}
							className={styles.layerNodeImageThumbnailTooltipImg}
						/>
					)}
				</TooltipContent>
			</TooltipPrimitive.Portal>
		</Tooltip>
	)
}
