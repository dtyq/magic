import { useCallback, useEffect, useState } from "react"
import { useCanvasSelectionUI } from "../../../../app/providers/CanvasUIProvider"
import { useCanvas } from "../../../../app/providers/CanvasProvider"
import { ElementTypeEnum, type VideoElement } from "../../../../runtime/document/types"
import {
	getActiveContent,
	getContentGenerationState,
	getContentState,
} from "../../../../runtime/document/elementContent"
import {
	useCanvasEvent,
	useGenerationRuntime,
	useIsMediaReplacing,
} from "../../../../app/hooks/canvas"
import MediaResourceFullscreenPreview, {
	type MediaResourceFullscreenPreviewItem,
} from "../../../fullscreen/media-resource/index"
import VideoGenerateEditorRender from "./VideoGenerateEditorRender"
import VideoSecondEdit from "./VideoSecondEdit"
import type { GenerationToolCommandRequest } from "../../../../runtime/element-tools"
import { useMediaEditorSubmission } from "../shared/useMediaEditorSubmission"

/**
 * 单选非临时视频元素且可编辑时挂载生成编辑器；上传中、生成中、已有成片等状态不展示
 */
export default function VideoGenerateEditor() {
	const { canvas } = useCanvas()
	const { selectedElements, isSelecting, isDragging } = useCanvasSelectionUI()
	const [previewingMediaResource, setPreviewingMediaResource] =
		useState<MediaResourceFullscreenPreviewItem | null>(null)
	const [retryEditingElementId, setRetryEditingElementId] = useState<string | null>(null)
	const [pendingToolCommand, setPendingToolCommand] =
		useState<GenerationToolCommandRequest | null>(null)

	// 与 ImageMessageEditor 相同：重试 emit 时 Active 可能尚未挂载（useCanvasEvent 在 effect 订阅）
	useCanvasEvent(
		"element:video:retryClick",
		({ data }) => {
			if (canvas?.mediaReplaceController?.isReplacing?.(data.elementId)) return
			setRetryEditingElementId(data.elementId)
		},
		[canvas],
	)

	const [targetElement] = selectedElements
	const videoElement =
		selectedElements.length === 1 && targetElement?.type === ElementTypeEnum.Video
			? targetElement
			: null
	const activeContentId = videoElement ? getActiveContent(videoElement)?.contentId : undefined

	useCanvasEvent(
		"element:video:toolCommand",
		({ data }) => {
			if (
				!videoElement ||
				data.elementId !== videoElement.id ||
				!data.contentId ||
				data.contentId !== activeContentId
			) {
				return
			}
			setPendingToolCommand({ toolId: data.toolId, contentId: data.contentId })
		},
		[activeContentId, videoElement?.id],
	)
	const isReplacing = useIsMediaReplacing(videoElement?.id)

	useEffect(() => {
		if (isReplacing) setRetryEditingElementId(null)
	}, [isReplacing])

	useEffect(() => {
		const selectedId = videoElement?.id
		if (selectedId == null) {
			setRetryEditingElementId(null)
			setPendingToolCommand(null)
			return
		}
		if (retryEditingElementId && retryEditingElementId !== selectedId) {
			setRetryEditingElementId(null)
		}
		if (pendingToolCommand && pendingToolCommand.contentId !== activeContentId) {
			setPendingToolCommand(null)
		}
	}, [activeContentId, pendingToolCommand, retryEditingElementId, videoElement?.id])

	const handleCloseMediaResourcePreview = useCallback(() => {
		setPreviewingMediaResource(null)
	}, [])

	useEffect(() => {
		if (isReplacing) setPreviewingMediaResource(null)
	}, [isReplacing])

	const editorEligible =
		videoElement != null && !isSelecting && !videoElement.locked && !isReplacing

	if (!editorEligible && !previewingMediaResource) {
		return null
	}

	return (
		<>
			{editorEligible ? (
				<ActiveVideoGenerateEditor
					videoElement={videoElement}
					isDragging={isDragging}
					retryEditingElementId={retryEditingElementId}
					pendingToolCommand={pendingToolCommand}
					onPendingToolCommandHandled={() => setPendingToolCommand(null)}
					setRetryEditingElementId={setRetryEditingElementId}
					onPreviewMediaResource={setPreviewingMediaResource}
					isMediaResourcePreviewOpen={previewingMediaResource != null}
				/>
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
	retryEditingElementId: string | null
	pendingToolCommand: GenerationToolCommandRequest | null
	onPendingToolCommandHandled: () => void
	setRetryEditingElementId: (id: string | null) => void
	onPreviewMediaResource: (resource: MediaResourceFullscreenPreviewItem) => void
	isMediaResourcePreviewOpen: boolean
}

function ActiveVideoGenerateEditor({
	videoElement,
	isDragging,
	retryEditingElementId,
	pendingToolCommand,
	onPendingToolCommandHandled,
	setRetryEditingElementId,
	onPreviewMediaResource,
	isMediaResourcePreviewOpen,
}: ActiveVideoGenerateEditorProps) {
	const { canvas } = useCanvas()
	const videoContent = getActiveContent(videoElement)
	const generationRuntime = useGenerationRuntime(videoElement.id, videoContent?.contentId)
	const { activeContentIsGenerating } = getContentGenerationState(videoElement)

	const hasSrc = !!videoContent?.src
	const isGenerating = activeContentIsGenerating || Boolean(generationRuntime)
	const isError = getContentState(videoContent) === "failed"
	const isRetryEditing = isError && retryEditingElementId === videoElement.id
	const submission = useMediaEditorSubmission({
		elementId: videoElement.id,
		contentId: videoContent?.contentId,
		isGenerating,
		isTimedOut: false,
		isRetryEditing,
	})

	useCanvasEvent(
		"element:video:generate-submit-failed",
		({ data }) => {
			if (data.elementId === videoElement.id) {
				submission.reveal()
			}
		},
		[videoElement.id, submission.reveal],
	)

	useCanvasEvent(
		"element:video:retryClick",
		({ data }) => {
			if (data.elementId === videoElement.id) submission.reveal()
		},
		[videoElement.id, submission.reveal],
	)

	const handleGenerateSubmitSucceeded = useCallback(() => {
		setRetryEditingElementId(null)
	}, [setRetryEditingElementId])

	const isTemporaryElement =
		canvas != null ? canvas.elementManager.isTemporary(videoElement.id) : false

	const hasGenerateVideoRequest = !!(
		generationRuntime?.generateVideoRequest || videoContent?.generateVideoRequest
	)

	const showEditor =
		!isTemporaryElement &&
		(!hasGenerateVideoRequest || isRetryEditing) &&
		!isDragging &&
		!hasSrc &&
		(!isError || isRetryEditing) &&
		!submission.hidden

	const showResultSecondEdit = hasSrc && !isDragging && !submission.busy && !isTemporaryElement

	const resultSecondEditNode = showResultSecondEdit ? (
		<VideoSecondEdit
			key={`${videoElement.id}-${videoContent?.contentId ?? ""}-result-regenerate`}
			videoElement={videoElement}
			pendingToolCommand={pendingToolCommand}
			onPendingToolCommandHandled={onPendingToolCommandHandled}
			onPreviewMediaResource={onPreviewMediaResource}
			isMediaResourcePreviewOpen={isMediaResourcePreviewOpen}
			submissionController={submission}
		/>
	) : null

	const editorNode = showEditor ? (
		<VideoGenerateEditorRender
			key={`${videoElement.id}-${videoContent?.contentId ?? ""}-${isRetryEditing ? "retry" : "create"}`}
			videoElement={videoElement}
			autoFocus={isRetryEditing}
			autoFocusAtDocumentEnd={isRetryEditing}
			onGenerateSubmitSucceeded={handleGenerateSubmitSucceeded}
			submitTarget={isRetryEditing ? "current-content" : "current-element"}
			onPreviewMediaResource={onPreviewMediaResource}
			isMediaResourcePreviewOpen={isMediaResourcePreviewOpen}
			submissionController={submission}
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
