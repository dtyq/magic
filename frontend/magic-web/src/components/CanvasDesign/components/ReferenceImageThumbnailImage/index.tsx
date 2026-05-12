import { useMemo } from "react"
import { getMediaResourcePathKind } from "../../canvas/utils/mediaResourcePathKind"
import { ReferenceImageThumbnailForImage } from "./ReferenceImageThumbnailForImage"
import { ReferenceNonImageThumbnail } from "./ReferenceNonImageThumbnail"
import { ReferenceVideoPosterThumbnail } from "./ReferenceVideoPosterThumbnail"
import type { ReferenceImageThumbnailImageProps } from "./types"

export type { ReferenceImageThumbnailImageProps } from "./types"

export default function ReferenceImageThumbnailImage(props: ReferenceImageThumbnailImageProps) {
	const fileType = useMemo(() => getMediaResourcePathKind(props.path), [props.path])

	if (fileType === "video") {
		return (
			<ReferenceVideoPosterThumbnail
				fileName={props.fileName}
				path={props.path}
				fillParent={props.fillParent}
				objectFit={props.objectFit}
			/>
		)
	}

	if (fileType !== "image") {
		return (
			<ReferenceNonImageThumbnail
				fileType={fileType}
				fillParent={props.fillParent}
				objectFit={props.objectFit}
			/>
		)
	}

	return <ReferenceImageThumbnailForImage {...props} />
}
