import { useCallback, useState } from "react"
import { LoaderCircle, RotateCcw, SquarePen } from "lucide-react"
import { useCanvasUI } from "../../context/CanvasUIContext"
import { useCanvas } from "../../context/CanvasContext"
import useElementPositionEffect from "../../hooks/useElementPositionEffect"
import { useFloatingComponent } from "../../hooks/useFloatingComponent"
import { ElementTypeEnum, type VideoElement } from "../../canvas/types"
import { VideoElement as VideoElementClass } from "../../canvas/element/elements/VideoElement"
import { generateUUID } from "../../canvas/utils/utils"
import IconButton from "../ui/custom/IconButton"
import { MediaResultActionBar } from "../canvas-editor/MediaResultActionBar"
import { useCanvasDesignI18n } from "../../context/I18nContext"
import VideoGenerateEditorRender from "./VideoGenerateEditorRender"
import styles from "./index.module.css"
import { createAndSubmitVideoGeneration } from "./createAndSubmitVideoGeneration"

interface VideoSecondEditProps {
	videoElement: VideoElement
}

/**
 * 视频成片后的结果态：仅提供「重新生成」，展开后与主生成编辑器一致，且仅按 generateVideoRequest 恢复。
 */
export default function VideoSecondEdit(props: VideoSecondEditProps) {
	const { videoElement } = props
	const { selectedElements } = useCanvasUI()
	const { canvas } = useCanvas()
	const { t } = useCanvasDesignI18n()
	const [isEditing, setIsEditing] = useState(false)
	const [isGeneratingAgain, setIsGeneratingAgain] = useState(false)

	const { containerRef: positionRef } = useElementPositionEffect({
		position: "bottom",
		offset: 12,
		shouldShow: () => {
			return selectedElements.some((element) => element?.type === ElementTypeEnum.Video)
		},
	})

	const { containerRef: floatingRef } = useFloatingComponent({
		id: "video-second-edit",
		enableWheelForwarding: true,
	})

	const setCollapsedRefs = useCallback(
		(node: HTMLDivElement | null) => {
			positionRef.current = node
			floatingRef.current = node
		},
		[positionRef, floatingRef],
	)

	const handleStartRegenerate = useCallback(() => {
		if (!canvas || !videoElement.generateVideoRequest) return
		const inst = canvas.elementManager.getElementInstance(videoElement.id)
		if (inst instanceof VideoElementClass) {
			inst.clearTempGenerateVideoRequest()
		}
		setIsEditing(true)
	}, [canvas, videoElement.id, videoElement.generateVideoRequest])

	const handleGenerateAgain = useCallback(async () => {
		if (!canvas || !videoElement.generateVideoRequest || isGeneratingAgain) return
		setIsGeneratingAgain(true)
		try {
			await createAndSubmitVideoGeneration({
				canvas,
				sourceVideoElement: videoElement,
				request: {
					...videoElement.generateVideoRequest,
					video_id: generateUUID(),
				},
			})
		} finally {
			setIsGeneratingAgain(false)
		}
	}, [canvas, isGeneratingAgain, videoElement])

	const canRestore = Boolean(videoElement.generateVideoRequest?.model_id)

	if (!isEditing) {
		if (!canRestore) {
			return null
		}
		return (
			<div
				ref={setCollapsedRefs}
				className={`${styles.videoMessageEditor} ${styles.videoSecondEditNoEditing}`}
				data-canvas-ui-component
			>
				<MediaResultActionBar
					showDividers
					dividerBeforeIndices={[]}
					actions={[
						<IconButton
							className={styles.secondEditButton}
							onClick={handleStartRegenerate}
							key="re-edit"
						>
							<SquarePen size={14} />
							<span>{t("videoEditor.reEditFromSaved", "重新编辑")}</span>
						</IconButton>,
						<IconButton
							className={styles.secondEditButton}
							onClick={handleGenerateAgain}
							key="generate-again"
						>
							{isGeneratingAgain ? (
								<LoaderCircle size={14} className="animate-spin" />
							) : (
								<RotateCcw size={14} />
							)}
							<span>{t("videoEditor.generateAgain", "再次生成")}</span>
						</IconButton>,
					]}
				/>
			</div>
		)
	}

	return (
		<VideoGenerateEditorRender
			key={`${videoElement.id}-from-result`}
			videoElement={videoElement}
			autoFocus
			restoreOnMount="originalRequestOnly"
			submitTarget="new-element"
		/>
	)
}
