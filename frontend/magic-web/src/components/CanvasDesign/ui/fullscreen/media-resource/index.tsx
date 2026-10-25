import { useEffect, useState } from "react"
import AudioFullscreenOverlay from "../audio/index"
import ImageFullscreenOverlay from "../image/index"
import VideoFullscreenPlayerOverlay from "../video/VideoFullscreenPlayerOverlay"
import VideoPreviewContent from "./VideoPreviewContent"
import type { MediaResourceFullscreenPreviewItem } from "./types"
import { useCanvas } from "../../../app/providers/CanvasProvider"
export type { MediaResourceFullscreenPreviewItem, PreviewableMediaResourceKind } from "./types"

interface MediaResourceFullscreenPreviewProps {
	resource: MediaResourceFullscreenPreviewItem | null
	onClose: () => void
}

export default function MediaResourceFullscreenPreview(props: MediaResourceFullscreenPreviewProps) {
	const { resource, onClose } = props
	const { canvas } = useCanvas()
	const [isClient, setIsClient] = useState(false)
	const playbackEnabled = canvas?.permissionManager?.can("interaction.playback") ?? true

	useEffect(() => {
		setIsClient(true)
	}, [])

	if (!isClient || !resource) {
		return null
	}

	if (resource.kind === "video") {
		// 资产库等场景已有可直播 URL，跳过 videoPlaybackManager 的 path 解析。
		if (resource.previewSrc) {
			return (
				<VideoFullscreenPlayerOverlay
					src={resource.previewSrc}
					isOpen
					playbackEnabled={playbackEnabled}
					onClose={onClose}
					fileName={resource.fileName}
					resourcePath={resource.path}
				/>
			)
		}
		return (
			<VideoPreviewContent
				resource={resource}
				onClose={onClose}
				playbackEnabled={playbackEnabled}
			/>
		)
	}

	if (resource.kind === "image") {
		return (
			<ImageFullscreenOverlay
				path={resource.path}
				fileName={resource.fileName}
				crop={resource.crop}
				src={resource.previewSrc}
				isOpen
				onClose={onClose}
			/>
		)
	}

	return (
		<AudioFullscreenOverlay
			path={resource.path}
			fileName={resource.fileName}
			isOpen
			playbackEnabled={playbackEnabled}
			onClose={onClose}
		/>
	)
}
