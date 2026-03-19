import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { usePortalContainer } from "../ui/custom/PortalContainerContext"
import { useReferenceImageUrls } from "../../hooks/useReferenceImageUrls"
import { LoaderCircle, ImagePlus } from "../ui/icons"
import { TOOLTIP_THUMBNAIL_MIN_SIZE } from "../../canvas/utils/imageThumbnailUtils"
import styles from "./index.module.css"

interface ReferenceImageThumbnailImageProps {
	fileName: string
	path: string
}

export default function ReferenceImageThumbnailImage(props: ReferenceImageThumbnailImageProps) {
	const { fileName, path } = props
	const portalContainer = usePortalContainer()
	const {
		thumbnailUrl,
		fullUrl,
		isLoading,
		previewSize,
		isFullUrlLoading,
		open,
		handleOpenChange,
	} = useReferenceImageUrls(path)

	const hasError = false

	return (
		<Tooltip open={open} onOpenChange={handleOpenChange}>
			<TooltipTrigger asChild>
				<div className={styles.referenceImageThumbnail}>
					{isLoading && (
						<div className={styles.referenceImageLoading}>
							<LoaderCircle size={12} className={styles.loadingIcon} />
						</div>
					)}
					{hasError && (
						<div className={styles.referenceImageError}>
							<ImagePlus size={12} />
						</div>
					)}
					{thumbnailUrl && <img src={thumbnailUrl} alt={fileName} />}
				</div>
			</TooltipTrigger>
			<TooltipPrimitive.Portal container={portalContainer || undefined}>
				<TooltipContent
					side="left"
					sideOffset={8}
					className={styles.referenceImageTooltip}
					style={{
						...(previewSize.width ? { width: previewSize.width } : {}),
						maxWidth: TOOLTIP_THUMBNAIL_MIN_SIZE,
						maxHeight: TOOLTIP_THUMBNAIL_MIN_SIZE,
					}}
				>
					{isFullUrlLoading ? (
						<div
							style={{
								display: "flex",
								alignItems: "center",
								justifyContent: "center",
								width: previewSize.width || TOOLTIP_THUMBNAIL_MIN_SIZE,
								height: previewSize.height || TOOLTIP_THUMBNAIL_MIN_SIZE,
							}}
						>
							<LoaderCircle
								size={16}
								className={styles.loadingIcon}
								style={{ animation: "spin 1s linear infinite" }}
							/>
						</div>
					) : (
						fullUrl && (
							<img
								src={fullUrl}
								alt={fileName}
								className={styles.referenceImagePreview}
								style={{
									...(previewSize.width ? previewSize : {}),
									maxWidth: TOOLTIP_THUMBNAIL_MIN_SIZE,
									maxHeight: TOOLTIP_THUMBNAIL_MIN_SIZE,
								}}
							/>
						)
					)}
				</TooltipContent>
			</TooltipPrimitive.Portal>
		</Tooltip>
	)
}
