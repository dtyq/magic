import type { Canvas } from "../../core/Canvas"
import { resolveCanvasAccessContext } from "../../core/CanvasAccessPolicy"
import {
	getContentGenerationState,
	isContentGenerationPending,
} from "../../document/elementContent"
import type { LayerElement } from "../../document/types"
import { createContentIndex } from "../resolver/ElementToolResolver"
import type {
	ElementToolContext,
	ElementToolElementSnapshot,
	ElementToolSession,
	GenerationAttemptState,
} from "./ElementToolTypes"

function toElementSnapshot(
	element: LayerElement,
	canvas?: Canvas | null,
): ElementToolElementSnapshot {
	const parentId =
		typeof canvas?.elementManager?.findParentIdForElement === "function"
			? (canvas.elementManager.findParentIdForElement(element.id) ?? null)
			: null
	const parent =
		parentId && typeof canvas?.elementManager?.getElementData === "function"
			? canvas.elementManager.getElementData(parentId)
			: undefined
	return {
		id: element.id,
		type: element.type,
		locked: element.locked,
		visible: element.visible,
		parentId,
		parentLocked: parent?.locked === true,
		width: element.width,
		height: element.height,
	}
}

export interface CreateElementToolContextOptions {
	canvas?: Canvas | null
	selectedElements: readonly LayerElement[]
	isDragging?: boolean
	isSelecting?: boolean
	activeToolSession?: ElementToolSession | null
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
	runtimeRevision?: number
	toolRuntimeStates?: ElementToolContext["runtime"]["toolsById"]
}

export function createElementToolContext(
	options: CreateElementToolContextOptions,
): ElementToolContext | null {
	const [element] = options.selectedElements
	if (!element) return null

	const selectedSnapshots = options.selectedElements.map((element) =>
		toElementSnapshot(element, options.canvas),
	)
	const [activeSnapshot] = selectedSnapshots
	if (!activeSnapshot) return null
	const parentIds = selectedSnapshots.map((snapshot) => snapshot.parentId ?? null)
	const firstParentId = parentIds[0] ?? null
	const contentIndex = createContentIndex({
		...(element as unknown as Parameters<typeof createContentIndex>[0]),
		effectiveContentId:
			typeof options.canvas?.getEffectiveContentId === "function"
				? options.canvas.getEffectiveContentId(element.id)
				: undefined,
	})
	const generationState =
		"contents" in element
			? getContentGenerationState(element as never)
			: {
					activeContentIsGenerating: false,
					hasSiblingGenerating: false,
					hasAnyGenerating: false,
					activeContent: undefined,
				}
	const runtimeTargetStates =
		options.canvas?.generationRuntimeManager?.getTargetStates(element.id) ?? []
	const generatingContentIds = [...contentIndex.states.entries()]
		.filter(([, state]) => state === "pending" || state === "processing")
		.map(([contentId]) => contentId)
	for (const targetState of runtimeTargetStates) {
		if (targetState.contentId && !generatingContentIds.includes(targetState.contentId)) {
			generatingContentIds.push(targetState.contentId)
		}
	}
	const activeContentId = contentIndex.activeContentId
	const activeSubmission = options.canvas?.generationRuntimeManager?.getSubmissionState?.(
		element.id,
		activeContentId,
	)
	if (activeContentId && activeSubmission && !generatingContentIds.includes(activeContentId)) {
		generatingContentIds.push(activeContentId)
	}
	const activeContentState = activeContentId ? contentIndex.states.get(activeContentId) : "empty"
	const activeContent = contentIndex.active as
		| (typeof contentIndex.active & {
				contentRevision?: string | number
				revision?: string | number
		  })
		| undefined
	const siblingGeneratingContentIds = generatingContentIds.filter(
		(contentId) => contentId !== activeContentId,
	)
	const activeContentIsGenerating = activeContent
		? Boolean(activeSubmission) ||
			isContentGenerationPending(activeContent) ||
			(activeContentId ? generatingContentIds.includes(activeContentId) : false)
		: Boolean(activeSubmission) ||
			(generationState.activeContentIsGenerating && !activeContentId)
	const attemptsByContentId = new Map<string, GenerationAttemptState>()
	for (const targetState of runtimeTargetStates) {
		if (!targetState.contentId) continue
		attemptsByContentId.set(targetState.contentId, {
			attemptId: targetState.attemptId,
			elementId: targetState.elementId,
			contentId: targetState.contentId,
			operation: targetState.operation,
			phase: targetState.phase,
		})
	}

	return {
		commandBus: options.canvas?.elementToolCommandBus,
		// Reuse the first selection snapshot so parent lookup and geometry metadata
		// stay consistent without scanning the document tree twice for the active node.
		element: activeSnapshot,
		selection: {
			elements: selectedSnapshots,
			isSingleElement: selectedSnapshots.length === 1,
			parentId: selectedSnapshots.length > 0 ? firstParentId : null,
			hasMixedParents: parentIds.some((parentId) => parentId !== firstParentId),
			isDragging: Boolean(options.isDragging),
			isSelecting: Boolean(options.isSelecting),
			activeToolSession: options.activeToolSession,
		},
		content: {
			...contentIndex,
			activeResource: activeContent
				? {
						src: typeof activeContent.src === "string" ? activeContent.src : undefined,
						width:
							typeof activeContent.width === "number"
								? activeContent.width
								: undefined,
						height:
							typeof activeContent.height === "number"
								? activeContent.height
								: undefined,
					}
				: undefined,
			activeRevision: activeContent?.contentRevision ?? activeContent?.revision,
		},
		access: options.canvas?.permissionManager?.getContext?.() ?? resolveCanvasAccessContext(),
		generation: {
			activeContentIsGenerating,
			siblingGeneratingContentIds,
			generatingContentIds,
			attemptsByContentId,
		},
		interaction: {
			isReplacing: Boolean(options.isReplacing),
			isDragging: Boolean(options.isDragging),
			isSelecting: Boolean(options.isSelecting),
			isEditing: Boolean(options.isEditing),
			isCropping: Boolean(options.isCropping),
			isExtending: Boolean(options.isExtending),
			isErasing: Boolean(options.isErasing),
			isFullscreenPreviewOpen: Boolean(options.isFullscreenPreviewOpen),
		},
		runtime: {
			revision: options.runtimeRevision ?? 0,
			toolsById: options.toolRuntimeStates ?? new Map(),
		},
		capabilities: {
			canSwitchVersion: contentIndex.byId.size > 1,
			canSetMainVersion:
				contentIndex.byId.size > 1 &&
				!activeContentIsGenerating &&
				activeContentState === "completed",
			// 版本删除只针对当前 Content；兄弟 Content 的生成状态不参与判断。
			canDeleteVersion: contentIndex.byId.size > 1 && Boolean(contentIndex.active),
			canGenerateContent:
				!activeContentIsGenerating &&
				(Boolean(contentIndex.active?.src) || element.type === "audio"),
			canConcurrentGenerate:
				options.canConcurrentGenerate ??
				(element.type === "image" || element.type === "video"),
		},
		flags: {
			convertHightSupported: Boolean(options.convertHightSupported),
			removeBackgroundSupported: options.removeBackgroundSupported ?? true,
			eraserSupported: options.eraserSupported ?? true,
			expandSupported: options.expandSupported ?? true,
			showMediaOriginalSize: Boolean(options.showMediaOriginalSize),
			isStoryboardOutputFrame: Boolean(options.isStoryboardOutputFrame),
		},
	}
}
