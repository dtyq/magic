import { useMemo } from "react"
import { useCanvas } from "../../../app/providers/CanvasProvider"
import { useCanvasElement } from "../../../app/hooks/canvas/useCanvasElement"
import { useGenerationRuntimeRevision } from "../../../app/hooks/canvas/useGenerationRuntime"
import { createElementToolContext, resolveElementTools } from "../../../runtime/element-tools"
import type { ElementToolResolution, ElementToolSurface } from "../../../runtime/element-tools"
import { useElementToolRuntimeStates } from "./useElementToolCommand"
import useShowMediaOriginalSizeButton from "../shared/hooks/useShowMediaOriginalSizeButton"

interface UseElementToolsOptions {
	selectedElements?: Parameters<typeof createElementToolContext>[0]["selectedElements"]
	isDragging?: boolean
	isSelecting?: boolean
	activeToolSession?: Parameters<typeof createElementToolContext>[0]["activeToolSession"]
	isReplacing?: boolean
	isEditing?: boolean
	isCropping?: boolean
	isExtending?: boolean
	isErasing?: boolean
	isFullscreenPreviewOpen?: boolean
	convertHightSupported?: boolean
	removeBackgroundSupported?: boolean
	eraserSupported?: boolean
	expandSupported?: boolean
	showMediaOriginalSize?: boolean
	isStoryboardOutputFrame?: boolean
	canConcurrentGenerate?: boolean
}

/** 统一的 ElementTool 订阅入口，顶部和底部展示面共享同一解析结果。 */
export function useElementTools(
	elementId: string | null,
	surface: ElementToolSurface,
	options: UseElementToolsOptions = {},
): ElementToolResolution[] {
	const { canvas } = useCanvas()
	// 展示面可以直接提供快照，但仍保留 Canvas 元素订阅，让异步 Content 状态
	// 和会话 Content 预览变化能够触发重新解析；测试/降级宿主没有完整 Canvas 时跳过。
	const canSubscribeToElement = Boolean(
		canvas?.elementManager?.getElementData && canvas?.eventEmitter?.on,
	)
	const element = useCanvasElement(canSubscribeToElement ? elementId : null)
	const generationRuntimeRevision = useGenerationRuntimeRevision(elementId)
	const runtimeStates = useElementToolRuntimeStates(elementId)
	const selectedElements = useMemo(() => {
		if (!options.selectedElements) return element ? [element] : []
		if (
			options.selectedElements.length === 1 &&
			element &&
			options.selectedElements[0]?.id === element.id
		) {
			return [element]
		}
		return options.selectedElements
	}, [element, options.selectedElements])
	const activeMediaSrc =
		element?.type === "video" || element?.type === "image"
			? (element.contents?.find(
					(content) =>
						content.contentId ===
						(canvas?.getEffectiveContentId?.(element.id) ?? element.activeContentId),
				)?.src as string | undefined)
			: undefined
	const showMediaOriginalSize = useShowMediaOriginalSizeButton({
		canvas,
		isSingleElement: selectedElements?.length === 1 || (!selectedElements && Boolean(element)),
		elementType: element?.type,
		elementId: element?.id,
		mediaSrc: activeMediaSrc,
		elementWidth: element?.width,
		elementHeight: element?.height,
	})
	const context = useMemo(
		() =>
			createElementToolContext({
				canvas,
				selectedElements,
				isDragging: options.isDragging,
				isSelecting: options.isSelecting,
				activeToolSession: options.activeToolSession,
				isReplacing: options.isReplacing,
				isEditing: options.isEditing,
				isCropping: options.isCropping,
				isExtending: options.isExtending,
				isErasing: options.isErasing,
				isFullscreenPreviewOpen: options.isFullscreenPreviewOpen,
				convertHightSupported: options.convertHightSupported,
				removeBackgroundSupported: options.removeBackgroundSupported,
				eraserSupported: options.eraserSupported,
				expandSupported: options.expandSupported,
				showMediaOriginalSize: options.showMediaOriginalSize ?? showMediaOriginalSize,
				isStoryboardOutputFrame: options.isStoryboardOutputFrame,
				canConcurrentGenerate: options.canConcurrentGenerate,
				runtimeRevision: generationRuntimeRevision,
				toolRuntimeStates: runtimeStates,
			}),
		[
			canvas,
			options.isDragging,
			options.isEditing,
			options.isCropping,
			options.isExtending,
			options.isErasing,
			options.isFullscreenPreviewOpen,
			options.isStoryboardOutputFrame,
			options.isReplacing,
			options.isSelecting,
			options.canConcurrentGenerate,
			options.convertHightSupported,
			options.removeBackgroundSupported,
			options.eraserSupported,
			options.expandSupported,
			options.showMediaOriginalSize,
			showMediaOriginalSize,
			options.activeToolSession,
			runtimeStates,
			generationRuntimeRevision,
			selectedElements,
		],
	)
	return useMemo(() => (context ? resolveElementTools(context, surface) : []), [context, surface])
}
