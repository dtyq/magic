import styles from "./index.module.css"
import { ImagePlus, LoaderCircle } from "../ui/icons/index"
import { useReferenceImageUrls } from "../../hooks/useReferenceImageUrls"
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover"
import { TOOLTIP_THUMBNAIL_MIN_SIZE } from "../../canvas/utils/imageThumbnailUtils"

interface ReferenceImageItemProps {
	path: string
}

export default function ReferenceImageItem({ path }: ReferenceImageItemProps) {
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
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<div className={styles.image}>
					{isLoading && (
						<div className={styles.imageLoading}>
							<LoaderCircle size={16} className={styles.loadingIcon} />
						</div>
					)}
					{hasError && (
						<div className={styles.imageError}>
							<ImagePlus size={16} />
						</div>
					)}
					{thumbnailUrl && <img src={thumbnailUrl} alt="" />}
				</div>
			</PopoverTrigger>
			<PopoverContent
				className={styles.imagePopover}
				align="start"
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
							alt=""
							className={styles.imagePopoverContent}
							style={{
								...(previewSize.width ? previewSize : {}),
								maxWidth: TOOLTIP_THUMBNAIL_MIN_SIZE,
								maxHeight: TOOLTIP_THUMBNAIL_MIN_SIZE,
							}}
						/>
					)
				)}
			</PopoverContent>
		</Popover>
	)
}
