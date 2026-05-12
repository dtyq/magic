import { useCallback, useEffect, useMemo, useState } from "react"
import { useCanvasSelectionUI } from "../../context/CanvasUIContext"
import { useCanvas } from "../../context/CanvasContext"
import { ElementTypeEnum, type VideoElement } from "../../canvas/types"
import { GenerationStatus } from "../../types.magic"
import { useCanvasEvent } from "../../hooks/useCanvasEvent"
import MediaResourceFullscreenPreview, {
	type MediaResourceFullscreenPreviewItem,
} from "../MediaResourceFullscreenPreview"
import VideoGenerateEditorRender from "./VideoGenerateEditorRender"
import VideoSecondEdit from "./VideoSecondEdit"
import { VideoElement as VideoElementClass } from "../../canvas/element/elements/VideoElement"

/**
 * 单选非临时视频元素且可编辑时挂载生成编辑器；上传中、生成中、已有成片等状态不展示
 */
export default function VideoGenerateEditor() {
	const { selectedElements, isSelecting, isDragging } = useCanvasSelectionUI()
	const [targetElement] = selectedElements
	const videoElement =
		selectedElements.length === 1 && targetElement?.type === ElementTypeEnum.Video
			? targetElement
			: null
	const [previewingMediaResource, setPreviewingMediaResource] =
		useState<MediaResourceFullscreenPreviewItem | null>(null)

	const handleCloseMediaResourcePreview = useCallback(() => {
		setPreviewingMediaResource(null)
	}, [])

	const editorEligible = videoElement != null && !isSelecting && !videoElement.locked

	if (!editorEligible && !previewingMediaResource) {
		return null
	}

	return (
		<>
			{editorEligible ? (
				<ActiveVideoGenerateEditor videoElement={videoElement} isDragging={isDragging} />
			) : null}
			{previewingMediaResource != null ? (
				<MediaResourceFullscreenPreview
					resource={previewingMediaResource}
					onClose={handleCloseMediaResourcePreview}
				/>
			) : null}
		</>
	)
}

interface ActiveVideoGenerateEditorProps {
	videoElement: VideoElement
	isDragging: boolean
}

function ActiveVideoGenerateEditor({ videoElement, isDragging }: ActiveVideoGenerateEditorProps) {
	const { canvas } = useCanvas()
	const [hiddenAfterSubmit, setHiddenAfterSubmit] = useState(false)
	const [retryEditingElementId, setRetryEditingElementId] = useState<string | null>(null)

	const isGenerating = useMemo(() => {
		if (!canvas) return false
		const videoInstance = canvas.elementManager.getElementInstance(videoElement.id)
		if (!(videoInstance instanceof VideoElementClass)) return false
		return !!videoInstance.isGenerating
	}, [canvas, videoElement.id])

	useEffect(() => {
		setHiddenAfterSubmit(false)
	}, [videoElement.id])

	useEffect(() => {
		if (retryEditingElementId && retryEditingElementId !== videoElement.id) {
			setRetryEditingElementId(null)
		}
	}, [retryEditingElementId, videoElement.id])

	useCanvasEvent(
		"element:video:generate-submit-started",
		({ data }) => {
			if (data.elementId === videoElement.id) {
				setHiddenAfterSubmit(true)
			}
		},
		[videoElement.id],
	)

	useCanvasEvent(
		"element:video:generate-submit-failed",
		({ data }) => {
			if (data.elementId === videoElement.id) {
				setHiddenAfterSubmit(false)
			}
		},
		[videoElement.id],
	)

	useCanvasEvent(
		"element:video:retryClick",
		({ data }) => {
			setHiddenAfterSubmit(false)
			setRetryEditingElementId(data.elementId)
		},
		[],
	)

	const handleGenerateSubmitSucceeded = useCallback(() => {
		setRetryEditingElementId(null)
	}, [])

	const isTemporaryElement =
		canvas != null ? canvas.elementManager.isTemporary(videoElement.id) : false

	const hasGenerateVideoRequest = !!videoElement.generateVideoRequest
	const isError = videoElement.status === GenerationStatus.Failed
	const isRetryEditing = isError && retryEditingElementId === videoElement.id
	const hasSrc = !!videoElement.src

	const showEditor =
		!isTemporaryElement &&
		(!hasGenerateVideoRequest || isRetryEditing) &&
		!isDragging &&
		!hasSrc &&
		(!isError || isRetryEditing) &&
		!hiddenAfterSubmit &&
		!isGenerating

	const showResultSecondEdit =
		hasSrc && hasGenerateVideoRequest && !isDragging && !isGenerating && !isTemporaryElement

	const resultSecondEditNode = showResultSecondEdit ? (
		<VideoSecondEdit key={`${videoElement.id}-result-regenerate`} videoElement={videoElement} />
	) : null

	const editorNode = showEditor ? (
		<VideoGenerateEditorRender
			key={`${videoElement.id}-${isRetryEditing ? "retry" : "create"}`}
			videoElement={videoElement}
			onGenerateSubmitSucceeded={handleGenerateSubmitSucceeded}
		/>
	) : null

	if (!editorNode && !resultSecondEditNode) {
		return null
	}

	return (
		<>
			{editorNode}
			{resultSecondEditNode}
		</>
	)
}
