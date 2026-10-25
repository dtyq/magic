import { useMemo } from "react"
import { getMediaResourcePathKind } from "../../../runtime/resources/media-common/mediaResourcePathKind"
import { ReferenceImageLowPreview } from "./ReferenceImageLowPreview"
import { ReferenceNonImagePreview } from "./ReferenceNonImagePreview"
import { ReferenceVideoPosterPreview } from "./ReferenceVideoPosterPreview"
import type { ReferenceMediaPreviewProps } from "./types"

export type { ReferenceMediaPreviewProps } from "./types"

export default function ReferenceMediaPreview(props: ReferenceMediaPreviewProps) {
	const fileType = useMemo(
		() => getMediaResourcePathKind(props.path, { mediaType: props.mediaType }),
		[props.mediaType, props.path],
	)

	if (fileType === "video") {
		return (
			<ReferenceVideoPosterPreview
				fileName={props.fileName}
				path={props.path}
				fillParent={props.fillParent}
				objectFit={props.objectFit}
				enableTooltip={props.enableTooltip}
				tooltipSide={props.tooltipSide}
			/>
		)
	}

	if (fileType !== "image") {
		return (
			<ReferenceNonImagePreview
				fileName={props.fileName}
				path={props.path}
				fileType={fileType}
				fillParent={props.fillParent}
				objectFit={props.objectFit}
				enableTooltip={props.enableTooltip}
				tooltipSide={props.tooltipSide}
			/>
		)
	}

	return <ReferenceImageLowPreview {...props} />
}
