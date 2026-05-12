import { useEffect, useState } from "react"
import AudioFullscreenOverlay from "../AudioFullscreenOverlay"
import ImageFullscreenOverlay from "../ImageFullscreenOverlay"
import VideoPreviewContent from "./VideoPreviewContent"
import type { MediaResourceFullscreenPreviewItem } from "./types"
export type { MediaResourceFullscreenPreviewItem, PreviewableMediaResourceKind } from "./types"

interface MediaResourceFullscreenPreviewProps {
	resource: MediaResourceFullscreenPreviewItem | null
	onClose: () => void
}

export default function MediaResourceFullscreenPreview(props: MediaResourceFullscreenPreviewProps) {
	const { resource, onClose } = props
	const [isClient, setIsClient] = useState(false)

	useEffect(() => {
		setIsClient(true)
	}, [])

	if (!isClient || !resource) {
		return null
	}

	if (resource.kind === "video") {
		return <VideoPreviewContent resource={resource} onClose={onClose} />
	}

	if (resource.kind === "image") {
		return (
			<ImageFullscreenOverlay
				path={resource.path}
				title={resource.fileName}
				isOpen
				onClose={onClose}
			/>
		)
	}

	return (
		<AudioFullscreenOverlay
			path={resource.path}
			title={resource.fileName}
			isOpen
			onClose={onClose}
		/>
	)
}
