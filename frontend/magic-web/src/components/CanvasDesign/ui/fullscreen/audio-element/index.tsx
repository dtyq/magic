import { useEffect } from "react"
import { useCanvasElement } from "../../../app/hooks/canvas"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { ElementTypeEnum, type AudioElement } from "../../../runtime/document/types"
import AudioFullscreenOverlay from "../audio/index"

interface AudioElementFullscreenOverlayProps {
	elementId: string
	onClose: () => void
}

/** 画布音频全屏层：进入前释放画布内联会话，关闭后不自动恢复。 */
export default function AudioElementFullscreenOverlay(props: AudioElementFullscreenOverlayProps) {
	const { elementId, onClose } = props
	const { canvas } = useCanvas()
	const element = useCanvasElement(elementId)
	const audioElement = element?.type === ElementTypeEnum.Audio ? (element as AudioElement) : null
	const playbackEnabled = canvas?.permissionManager?.can("interaction.playback") ?? true
	const audioPath = audioElement
		? ((typeof canvas?.getEffectiveContent === "function"
				? (canvas.getEffectiveContent(audioElement.id) as { src?: string } | undefined)
				: (audioElement.contents?.find(
						(content) => content.contentId === audioElement.activeContentId,
					) ?? audioElement.contents?.[0])
			)?.src ?? "")
		: ""
	const audioDisplayName = audioElement
		? canvas?.elementManager.getElementInstance(elementId)?.getNameLabelText()
		: undefined

	useEffect(() => {
		if (audioElement && audioPath) return
		onClose()
	}, [audioElement, audioPath, onClose])

	useEffect(() => {
		if (!canvas || !audioElement) return
		canvas.mediaPlaybackCoordinator.pauseAll()
		canvas.audioPlaybackManager.release(audioElement.id)
	}, [audioElement, canvas])

	return (
		<AudioFullscreenOverlay
			path={audioPath}
			fileName={audioDisplayName}
			isOpen={Boolean(audioPath)}
			autoPlay={false}
			playbackEnabled={playbackEnabled}
			onClose={onClose}
		/>
	)
}
