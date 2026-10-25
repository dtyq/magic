import type { MediaResourcePathKind } from "../../../runtime/resources/media-common/mediaResourcePathKind"
import { cn } from "../../../runtime/shared/lib/utils"
import { CanvasFileIcon } from "../../primitives/icons/index"
import styles from "../../editors/message/index.module.css"
import { ReferenceAudioPreview } from "./ReferenceAudioPreview"

export interface ReferenceNonImagePreviewProps {
	fileName: string
	path: string
	fileType: Exclude<MediaResourcePathKind, "image" | "video">
	fillParent?: boolean
	objectFit?: "cover" | "contain"
	enableTooltip?: boolean
	tooltipSide?: "top" | "right" | "bottom" | "left"
}

export function ReferenceNonImagePreview(props: ReferenceNonImagePreviewProps) {
	const {
		fileName,
		path,
		fileType,
		fillParent,
		objectFit = "cover",
		enableTooltip,
		tooltipSide,
	} = props
	if (fileType === "audio") {
		return (
			<ReferenceAudioPreview
				fileName={fileName}
				path={path}
				fillParent={fillParent}
				objectFit={objectFit}
				enableTooltip={enableTooltip}
				tooltipSide={tooltipSide}
			/>
		)
	}

	const previewWrapperClass = cn(
		styles.referenceImagePreview,
		fillParent && styles.referenceImagePreviewFill,
		fillParent && objectFit === "contain" && styles.referenceImagePreviewFillContain,
	)
	const slotIcon = <CanvasFileIcon size={28} className="text-muted-foreground" />
	return (
		<div className={previewWrapperClass}>
			<div className="flex h-full w-full items-center justify-center bg-muted/40">
				{slotIcon}
			</div>
		</div>
	)
}
