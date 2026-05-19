import type { MediaResourcePathKind } from "../../canvas/utils/mediaResourcePathKind"
import { cn } from "../../lib/utils"
import { CanvasFileIcon, ReferenceSlotAudioIcon } from "../ui/icons"
import styles from "../MessageEditor/index.module.css"

export interface ReferenceNonImageThumbnailProps {
	fileType: Exclude<MediaResourcePathKind, "image" | "video">
	fillParent?: boolean
	objectFit?: "cover" | "contain"
}

export function ReferenceNonImageThumbnail(props: ReferenceNonImageThumbnailProps) {
	const { fileType, fillParent, objectFit = "cover" } = props
	const thumbWrapperClass = cn(
		styles.referenceImageThumbnail,
		fillParent && styles.referenceImageThumbnailFill,
		fillParent && objectFit === "contain" && styles.referenceImageThumbnailFillContain,
	)
	const slotIcon =
		fileType === "audio" ? (
			<ReferenceSlotAudioIcon size={28} />
		) : (
			<CanvasFileIcon size={28} className="text-muted-foreground" />
		)
	return (
		<div className={thumbWrapperClass}>
			<div className="flex h-full w-full items-center justify-center bg-muted/40">
				{slotIcon}
			</div>
		</div>
	)
}
