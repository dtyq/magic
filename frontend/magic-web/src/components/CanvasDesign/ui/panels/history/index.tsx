import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import ImageMessageHistoryRender from "./ImageMessageHistoryRender"
import VideoMessageHistoryRender from "./VideoMessageHistoryRender"
import { useCanvasPanelUI } from "../../../app/providers/CanvasUIProvider"
import { useCanvasElement, useGenerationRuntime } from "../../../app/hooks/canvas"
import {
	ElementTypeEnum,
	type ImageElement,
	type VideoElement,
	type VideoElementContent,
} from "../../../runtime/document/types"
import MediaResourceFullscreenPreview, {
	type MediaResourceFullscreenPreviewItem,
} from "../../fullscreen/media-resource/index"
import { getActiveContent } from "../../../runtime/document/elementContent"
import { useFloatingUI } from "../../../app/providers/FloatingUIProvider"
import { useCanvas } from "../../../app/providers/CanvasProvider"

export default function MessageHistory() {
	const { messageHistoryElementId, messageHistoryContentId } = useCanvasPanelUI()
	const { canvas } = useCanvas()
	const { activateFloatingComponent } = useFloatingUI()
	const [previewingMediaResource, setPreviewingMediaResource] =
		useState<MediaResourceFullscreenPreviewItem | null>(null)
	const previewOwnerIdRef = useRef<string | null>(null)

	const element = useCanvasElement(messageHistoryElementId)
	const generationRuntime = useGenerationRuntime(messageHistoryElementId, messageHistoryContentId)
	const historySurfaceId =
		element?.type === ElementTypeEnum.Image
			? "image-message-history"
			: element?.type === ElementTypeEnum.Video
				? "video-message-history"
				: null

	const handleCloseMediaPreview = useCallback(() => {
		const previewOwnerId = previewOwnerIdRef.current
		previewOwnerIdRef.current = null
		setPreviewingMediaResource(null)
		if (previewOwnerId) {
			requestAnimationFrame(() => activateFloatingComponent(previewOwnerId))
		}
	}, [activateFloatingComponent])

	const handlePreviewMediaResource = useCallback(
		(resource: MediaResourceFullscreenPreviewItem) => {
			previewOwnerIdRef.current = historySurfaceId
			if (historySurfaceId) activateFloatingComponent(historySurfaceId)
			setPreviewingMediaResource(resource)
		},
		[activateFloatingComponent, historySurfaceId],
	)

	useEffect(() => {
		setPreviewingMediaResource(null)
		previewOwnerIdRef.current = null
	}, [messageHistoryElementId, messageHistoryContentId])

	const panel = useMemo(() => {
		if (!messageHistoryElementId || !element) return null
		if (element.id !== messageHistoryElementId) return null

		// 生成占位图可能尚未收到请求详情，仍允许打开记录查看状态及缺失说明。
		if (element.type === ElementTypeEnum.Image) {
			return (
				<ImageMessageHistoryRender
					key={element.id}
					imageElement={element as ImageElement}
					contentId={messageHistoryContentId}
					onPreviewMediaResource={handlePreviewMediaResource}
				/>
			)
		}

		if (
			element.type === ElementTypeEnum.Video &&
			(generationRuntime?.generateVideoRequest ||
				(
					canvas?.getEffectiveContent<VideoElementContent>(element.id) ??
					getActiveContent(element)
				)?.generateVideoRequest)
		) {
			return (
				<VideoMessageHistoryRender
					key={element.id}
					videoElement={element as VideoElement}
					onPreviewMediaResource={handlePreviewMediaResource}
				/>
			)
		}

		return null
	}, [
		canvas,
		messageHistoryElementId,
		messageHistoryContentId,
		element,
		generationRuntime,
		handlePreviewMediaResource,
	])

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
