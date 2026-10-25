import { useCallback, useEffect, useState } from "react"
import {
	useCanvasModeUI,
	useCanvasPanelUI,
	useCanvasSelectionUI,
} from "../../../../app/providers/CanvasUIProvider"
import { useCanvas } from "../../../../app/providers/CanvasProvider"
import { ElementTypeEnum, type ImageElement } from "../../../../runtime/document/types"
import {
	getActiveImageContent,
	getActiveImageContentId,
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
import ImageMessageEditorRender from "./ImageMessageEditorRender"
import SecondEdit from "./SecondEdit"
import { useMediaEditorSubmission } from "../shared/useMediaEditorSubmission"
import { ImageElement as ImageElementClass } from "../../../../runtime/elements/image/ImageElement"
import type { GenerationToolCommandRequest } from "../../../../runtime/element-tools"

export default function ImageMessageEditor() {
	const { canvas } = useCanvas()
	const { selectedElements, isSelecting, isDragging, activeToolSession } = useCanvasSelectionUI()
	const { croppingElementId, extendingElementId, erasingElementId } = useCanvasModeUI()
	const { messageHistoryElementId } = useCanvasPanelUI()
	const [retryEditingElementId, setRetryEditingElementId] = useState<string | null>(null)
	const [pendingToolCommand, setPendingToolCommand] =
		useState<GenerationToolCommandRequest | null>(null)
	const [previewingMediaResource, setPreviewingMediaResource] =
		useState<MediaResourceFullscreenPreviewItem | null>(null)

	const [targetElement] = selectedElements
	const imageElement =
		selectedElements.length === 1 && targetElement?.type === ElementTypeEnum.Image
			? targetElement
			: null
	const activeContentId = imageElement ? getActiveImageContentId(imageElement) : undefined
	const isReplacing = useIsMediaReplacing(imageElement?.id)

	// 必须在父级订阅：useCanvasEvent 在 useEffect 注册，未选中时 ActiveImageMessageEditor 未挂载会漏掉同一次点击内的 emit
	useCanvasEvent(
		"element:image:retryClick",
		({ data }) => {
			if (canvas?.mediaReplaceController?.isReplacing?.(data.elementId)) return
			setRetryEditingElementId(data.elementId)
		},
		[canvas],
	)

	useCanvasEvent(
		"element:image:toolCommand",
		({ data }) => {
			if (
				!imageElement ||
				data.elementId !== imageElement.id ||
				!data.contentId ||
				data.contentId !== activeContentId
			) {
				return
			}
			setPendingToolCommand({ toolId: data.toolId, contentId: data.contentId })
		},
		[activeContentId, imageElement?.id],
	)

	useEffect(() => {
		if (isReplacing) setRetryEditingElementId(null)
	}, [isReplacing])

	useEffect(() => {
		const selectedId = imageElement?.id
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
	}, [activeContentId, imageElement?.id, pendingToolCommand, retryEditingElementId])

	const editorEligible =
		!!imageElement &&
		!isSelecting &&
		!imageElement.locked &&
		!croppingElementId &&
		!extendingElementId &&
		!erasingElementId &&
		!isReplacing &&
		!activeToolSession

	const handleCloseMediaResourcePreview = useCallback(() => {
		setPreviewingMediaResource(null)
	}, [])

	useEffect(() => {
		if (isReplacing) setPreviewingMediaResource(null)
	}, [isReplacing])

	if (!editorEligible && !previewingMediaResource) {
		return null
	}

	return (
		<>
			{editorEligible ? (
				// 只隐藏表面，保留编辑器及尚未持久化的草稿，详情关闭后继续编辑。
				<div hidden={messageHistoryElementId === imageElement.id}>
					<ActiveImageMessageEditor
						imageElement={imageElement}
						isDragging={isDragging}
						retryEditingElementId={retryEditingElementId}
						pendingToolCommand={pendingToolCommand}
						onPendingToolCommandHandled={() => setPendingToolCommand(null)}
						onPreviewMediaResource={setPreviewingMediaResource}
						isMediaResourcePreviewOpen={previewingMediaResource != null}
					/>
				</div>
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

interface ActiveImageMessageEditorProps {
	imageElement: ImageElement
	isDragging: boolean
	retryEditingElementId: string | null
	pendingToolCommand: GenerationToolCommandRequest | null
	onPendingToolCommandHandled: () => void
	onPreviewMediaResource: (resource: MediaResourceFullscreenPreviewItem) => void
	isMediaResourcePreviewOpen: boolean
}

function ActiveImageMessageEditor({
	imageElement,
	isDragging,
	retryEditingElementId,
	pendingToolCommand,
	onPendingToolCommandHandled,
	onPreviewMediaResource,
	isMediaResourcePreviewOpen,
}: ActiveImageMessageEditorProps) {
	const { canvas } = useCanvas()
	const activeContent = getActiveImageContent(imageElement)
	const generationRuntime = useGenerationRuntime(imageElement.id, activeContent.contentId)
	const activeContentState = getContentState(activeContent)
	const [, refreshDisplayState] = useState(0)
	useCanvasEvent(
		"element:image:displayStateChanged",
		({ data }) => {
			if (data.elementId === imageElement.id) refreshDisplayState((revision) => revision + 1)
		},
		[imageElement.id],
	)

	const hasGenerateImageRequest = !!(
		generationRuntime?.generateImageRequest || activeContent.generateImageRequest
	)
	const hasResultImage = !!activeContent.src

	const isTemporaryElement =
		canvas != null ? canvas.elementManager.isTemporary(imageElement.id) : false

	const imageInstance = canvas?.elementManager.getElementInstance(imageElement.id)
	const displayState =
		imageInstance instanceof ImageElementClass ? imageInstance.getDisplayState() : undefined
	const isTimedOut = displayState?.status === "timed-out"
	const isGenerating =
		!isTimedOut && (displayState?.status === "generating" || Boolean(generationRuntime))
	const isRetryEditing =
		activeContentState === "failed" && retryEditingElementId === imageElement.id
	const submission = useMediaEditorSubmission({
		elementId: imageElement.id,
		contentId: activeContent.contentId,
		isGenerating,
		isTimedOut,
		isRetryEditing,
	})
	const readOnly = !canvas?.permissionManager.can("sideEffect.generate")

	useCanvasEvent(
		"element:image:generate-submit-failed",
		({ data }) => {
			if (data.elementId === imageElement.id) {
				submission.reveal()
			}
		},
		[imageElement.id, submission.reveal],
	)

	useCanvasEvent(
		"element:image:retryClick",
		({ data }) => {
			if (data.elementId === imageElement.id) submission.reveal()
		},
		[imageElement.id, submission.reveal],
	)

	if (isTemporaryElement || isDragging || submission.hidden) return null

	// 如果没有生成图片请求且没有结果图片，则显示图片编辑器
	if (
		(!hasGenerateImageRequest && !hasResultImage) ||
		isRetryEditing ||
		(!hasResultImage && isTimedOut)
	) {
		return (
			<ImageMessageEditorRender
				key={`${imageElement.id}-${activeContent.contentId}-${isRetryEditing ? "retry" : "create"}`}
				imageElement={imageElement}
				readOnly={readOnly}
				request={
					generationRuntime?.generateImageRequest ?? activeContent.generateImageRequest
				}
				autoFocus={isRetryEditing}
				autoFocusAtDocumentEnd={isRetryEditing}
				onPreviewMediaResource={onPreviewMediaResource}
				isMediaResourcePreviewOpen={isMediaResourcePreviewOpen}
				submissionController={submission}
			/>
		)
	}

	// 结果资源可能已删除，但二次编辑器仍需挂载以展示失效引用并允许用户修复。
	if (hasResultImage) {
		return (
			<SecondEdit
				key={`${imageElement.id}-${activeContent.contentId}`}
				imageElement={imageElement}
				pendingToolCommand={pendingToolCommand}
				onPendingToolCommandHandled={onPendingToolCommandHandled}
				onPreviewMediaResource={onPreviewMediaResource}
				isMediaResourcePreviewOpen={isMediaResourcePreviewOpen}
				submissionController={submission}
			/>
		)
	}

	return null
}
