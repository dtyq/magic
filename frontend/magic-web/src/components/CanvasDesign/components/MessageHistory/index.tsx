import { useCallback, useEffect, useMemo, useState } from "react"
import ImageMessageHistoryRender from "./ImageMessageHistoryRender"
import VideoMessageHistoryRender from "./VideoMessageHistoryRender"
import { useCanvasPanelUI } from "../../context/CanvasUIContext"
import { useCanvasElement } from "../../hooks/useCanvasElement"
import { ElementTypeEnum, type ImageElement, type VideoElement } from "../../canvas/types"
import MediaResourceFullscreenPreview, {
	type MediaResourceFullscreenPreviewItem,
} from "../MediaResourceFullscreenPreview"

export default function MessageHistory() {
	const { messageHistoryElementId } = useCanvasPanelUI()
	const [previewingMediaResource, setPreviewingMediaResource] =
		useState<MediaResourceFullscreenPreviewItem | null>(null)

	const handleCloseMediaPreview = useCallback(() => {
		setPreviewingMediaResource(null)
	}, [])

	const element = useCanvasElement(messageHistoryElementId)

	useEffect(() => {
		setPreviewingMediaResource(null)
	}, [messageHistoryElementId])

	const panel = useMemo(() => {
		if (!messageHistoryElementId || !element) return null
		if (element.id !== messageHistoryElementId) return null

		if (element.type === ElementTypeEnum.Image && element.generateImageRequest) {
			return (
				<ImageMessageHistoryRender
					key={element.id}
					imageElement={element as ImageElement}
					onPreviewMediaResource={setPreviewingMediaResource}
				/>
			)
		}

		if (element.type === ElementTypeEnum.Video && element.generateVideoRequest) {
			return (
				<VideoMessageHistoryRender
					key={element.id}
					videoElement={element as VideoElement}
					onPreviewMediaResource={setPreviewingMediaResource}
				/>
			)
		}

		return null
	}, [messageHistoryElementId, element])

	if (!panel) return null

	return (
		<>
			{panel}
			<MediaResourceFullscreenPreview
				resource={previewingMediaResource}
				onClose={handleCloseMediaPreview}
			/>
		</>
	)
}
