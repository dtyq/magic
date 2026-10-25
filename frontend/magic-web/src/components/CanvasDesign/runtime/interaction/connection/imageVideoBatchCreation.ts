import type { VideoModelItem } from "../../../public/magic-types"
import type { Canvas } from "../../core/Canvas"
import { ElementTypeEnum, type VideoElement as VideoElementData } from "../../document/types"
import { getActiveContent } from "../../document/elementContent"
import { ElementFactory } from "../../elements/core/ElementFactory"
import { VideoElement } from "../../elements/video/VideoElement"
import { generateElementId } from "../../shared/ids"
import type { ConnectionOrigin } from "../../shared/connectionOrigin"
import {
	resolveConnectionCreateGapForAxisSize,
	resolveConnectionCreateGapForElement,
} from "../../shared/placement/connectionCreateGap"
import { resolveConnectedPlacement } from "../../shared/placement/placementEngine"
import {
	collectSelectionContentSnapshot,
	createSelectionRevision,
	type SelectionContentSnapshot,
} from "../selection/selectionContentCollector"
import {
	canUseImageReferenceVideoModel,
	resolveImageReferenceVideoModel,
	type ResolvedImageReferenceVideoModel,
} from "./imageVideoReferenceModel"
import {
	createContentFrameData,
	getVerticalFrameContentHeight,
	getVerticalFrameContentOffset,
	resolveFrameContentLayout,
} from "../frame/frameCreation"
import { buildMediaEditSourceFingerprint } from "../media-edit-recovery/MediaEditRecoveryManager"

const COLUMN_GAP = 64

function resolveStoryboardVideoFrameName(canvas: Canvas): string {
	return canvas.t?.("storyboardVideo.outputFrameName", "分镜视频组合") || "分镜视频组合"
}

type ElementConnectionOrigin = Extract<ConnectionOrigin, { kind: "element" }>

interface CreatedImageVideoPair {
	imageElementId: string
	videoElementId: string
}

function createEmptyVideoData(options: {
	x: number
	y: number
	width: number
	height: number
	zIndex: number
}): VideoElementData {
	const id = generateElementId()
	return ElementFactory.createElementData(
		ElementTypeEnum.Video,
		id,
		options.x,
		options.y,
		options.width,
		options.height,
		options.zIndex,
	) as VideoElementData
}

/** 按 image → video 一对一注册关联种子，避免依赖多选 snapshot 的 items 快照。 */
function registerSeedsForPairs(canvas: Canvas, pairs: CreatedImageVideoPair[]): void {
	for (const pair of pairs) {
		if (
			!canvas.elementManager.hasElement(pair.imageElementId) ||
			!canvas.elementManager.hasElement(pair.videoElementId)
		) {
			continue
		}
		canvas.connectionAssociationSeedManager.register({
			targetElementId: pair.videoElementId,
			targetKind: "video-generator",
			rootElementIds: [pair.imageElementId],
			orderedSources: [{ elementId: pair.imageElementId, kind: "image" }],
			originRevision: createSelectionRevision([pair.imageElementId]),
			createdBy: "connection-menu",
			mediaRole: "reference",
		})
	}
}

/** 写入支持参考图的默认 input_mode，保证编辑器打开后策略允许勾选连接图片。 */
function applyReferenceVideoDraft(
	canvas: Canvas,
	videoElementId: string,
	model: ResolvedImageReferenceVideoModel,
): void {
	const instance = canvas.elementManager.getElementInstance(videoElementId)
	if (!(instance instanceof VideoElement)) return
	const activeContent = getActiveContent(instance.getData())
	if (!activeContent) return
	canvas.mediaEditRecoveryManager.saveDraft(
		{
			elementId: videoElementId,
			contentId: activeContent.contentId,
			intent: "generate",
		},
		buildMediaEditSourceFingerprint(activeContent.contentId, activeContent.src),
		{
			request: {
				model_id: model.model.model_id,
				input_mode: model.inputMode,
				task: model.task,
			},
			modeDrafts: {},
		},
	)
}

interface BatchVideoPlacement {
	imageElementId: string
	centerX: number
	centerY: number
}

/**
 * 按源图视觉中心 Y 对齐右侧一列视频，避免文档序与画面上下不一致导致连线交叉。
 * 重叠时沿 Y 方向做最小间距错开，保持相对上下关系。
 */
function resolveBatchVideoPlacements(options: {
	canvas: Canvas
	imageElementIds: string[]
	columnLeft: number
	videoSize: { width: number; height: number }
	fallbackBounds: { x: number; y: number; width: number; height: number }
}): BatchVideoPlacement[] {
	const { canvas, imageElementIds, columnLeft, videoSize, fallbackBounds } = options
	const centerX = columnLeft + videoSize.width / 2
	const halfHeight = videoSize.height / 2

	const placements = imageElementIds.map((imageElementId, index) => {
		const rect =
			canvas.geometryCacheManager.getElementBounds(imageElementId) ??
			({
				x: fallbackBounds.x,
				y: fallbackBounds.y + index * (videoSize.height + COLUMN_GAP),
				width: fallbackBounds.width,
				height: videoSize.height,
			} as const)
		return {
			imageElementId,
			centerX,
			centerY: rect.y + rect.height / 2,
		}
	})

	const ordered = placements
		.map((placement, index) => ({ placement, index }))
		.sort((left, right) => {
			const delta = left.placement.centerY - right.placement.centerY
			return delta !== 0 ? delta : left.index - right.index
		})

	let previousBottom = Number.NEGATIVE_INFINITY
	for (const item of ordered) {
		const minCenterY = previousBottom + COLUMN_GAP + halfHeight
		if (item.placement.centerY < minCenterY) item.placement.centerY = minCenterY
		previousBottom = item.placement.centerY + halfHeight
	}

	return placements
}

/** 按图片的视觉中心 Y 排列组合内的视频，保持图片与视频的纵向顺序一致。 */
function sortImageElementIdsByVisualOrder(canvas: Canvas, imageElementIds: string[]): string[] {
	const positioned = imageElementIds.map((imageElementId, index) => {
		const rect = canvas.geometryCacheManager.getElementBounds(imageElementId)
		return {
			imageElementId,
			index,
			centerY: rect ? rect.y + rect.height / 2 : undefined,
		}
	})

	if (positioned.some((item) => item.centerY === undefined)) return imageElementIds

	return positioned
		.sort((left, right) => {
			const delta = (left.centerY ?? 0) - (right.centerY ?? 0)
			return delta !== 0 ? delta : left.index - right.index
		})
		.map((item) => item.imageElementId)
}

function selectAndFocus(canvas: Canvas, elementIds: string[]): void {
	canvas.toolManager.switchToSelection()
	if (elementIds.length === 1) canvas.selectionManager.select(elementIds[0])
	else canvas.selectionManager.selectMultiple(elementIds)
	requestAnimationFrame(() => {
		if (!elementIds.every((elementId) => canvas.elementManager.hasElement(elementId))) return
		if (canvas.viewportController.isElementInViewport(elementIds)) return
		canvas.viewportController.moveElementToViewport(elementIds, {
			animated: true,
			padding: { top: 50, right: 50, bottom: 50, left: 100 },
		})
	})
}

/** 多选批量：至少 2 张可用图，且默认视频模型支持单张参考图。 */
export function canCreateBatchImageVideos(
	canvas: Canvas,
	snapshot: SelectionContentSnapshot,
	videoModelList: VideoModelItem[],
): boolean {
	return (
		snapshot.allRootsCanConnect &&
		snapshot.imageSequence.length >= 2 &&
		canUseImageReferenceVideoModel(canvas, videoModelList, 1)
	)
}

/**
 * 多选图片 → N 个空视频，右侧纵向一列落点；每条边为 image → video。
 * 不自动提交生成。
 */
export function createBatchImageVideos(options: {
	canvas: Canvas
	snapshot: SelectionContentSnapshot
	videoModelList: VideoModelItem[]
}): string[] {
	const { canvas, snapshot, videoModelList } = options
	if (!canCreateBatchImageVideos(canvas, snapshot, videoModelList)) return []

	const imageElementIds = snapshot.imageSequence.filter((elementId) =>
		canvas.elementManager.hasElement(elementId),
	)
	if (imageElementIds.length < 2) return []

	const referenceModel = resolveImageReferenceVideoModel(canvas, videoModelList, 1)
	if (!referenceModel) return []

	const videoTool = canvas.toolManager.getVideoGeneratorTool()
	const size = videoTool.getVideoElementSizeForModelList([referenceModel.model])
	const bounds = snapshot.boundingRect
	if (!bounds) return []

	const columnLeft = bounds.x + bounds.width + resolveConnectionCreateGapForAxisSize(bounds.width)
	const placements = resolveBatchVideoPlacements({
		canvas,
		imageElementIds,
		columnLeft,
		videoSize: size,
		fallbackBounds: bounds,
	})

	const createdPairs = canvas.historyManager.runTransaction(
		() => {
			const pairs: CreatedImageVideoPair[] = []
			const rollback = () => {
				pairs.forEach((pair) => {
					if (canvas.elementManager.hasElement(pair.videoElementId)) {
						canvas.elementManager.delete(pair.videoElementId)
					}
				})
			}

			try {
				for (const placement of placements) {
					if (!canvas.elementManager.hasElement(placement.imageElementId)) {
						rollback()
						return []
					}

					const videoElementId = videoTool.createVideoAtCanvasPoint(
						placement.centerX,
						placement.centerY,
						[referenceModel.model],
						{ select: false, ensureInViewport: false, completeTask: false },
					)
					applyReferenceVideoDraft(canvas, videoElementId, referenceModel)
					pairs.push({
						imageElementId: placement.imageElementId,
						videoElementId,
					})
				}

				const connection = canvas.connectionManager.connectElementsBatch({
					edges: pairs.map((pair) => ({
						sourceElementId: pair.imageElementId,
						targetElementId: pair.videoElementId,
					})),
				})
				if (connection.status !== "created") {
					rollback()
					return []
				}

				return pairs
			} catch {
				rollback()
				return []
			}
		},
		(pairs) => pairs.length > 0,
	)

	if (createdPairs.length === 0) return []

	// 种子是运行时状态，放在历史事务外注册，避免与历史快照时机耦合。
	registerSeedsForPairs(canvas, createdPairs)
	const createdElementIds = createdPairs.map((pair) => pair.videoElementId)
	selectAndFocus(canvas, createdElementIds)
	return createdElementIds
}

/** Frame 右侧：至少 1 张可用图，且模型支持单张参考图。 */
export function canCreateStoryboardVideosFromConnection(
	canvas: Canvas | null | undefined,
	origin: ElementConnectionOrigin | null | undefined,
	videoModelList: VideoModelItem[],
): boolean {
	if (!canvas || !origin || origin.side !== "right") return false
	const originElement = canvas.elementManager.getElementData(origin.elementId)
	if (!originElement || originElement.type !== ElementTypeEnum.Frame) return false

	const snapshot = collectSelectionContentSnapshot(canvas, [origin.elementId])
	return (
		snapshot.allRootsCanConnect &&
		snapshot.imageSequence.length >= 1 &&
		canUseImageReferenceVideoModel(canvas, videoModelList, 1)
	)
}

/**
 * Frame 内图片 → 新建「分镜视频组合」Frame，内含按序排列的空视频；
 * 每条边为 image → video，不建 Frame→Frame 连接。
 */
export function createStoryboardVideosFromConnection(options: {
	canvas: Canvas
	origin: ElementConnectionOrigin
	videoModelList: VideoModelItem[]
}): string | null {
	const { canvas, origin, videoModelList } = options
	if (!canCreateStoryboardVideosFromConnection(canvas, origin, videoModelList)) return null

	// 点击执行时重新收集，避免菜单打开后图片状态变化
	const snapshot = collectSelectionContentSnapshot(canvas, [origin.elementId])
	const imageElementIds = sortImageElementIdsByVisualOrder(
		canvas,
		snapshot.imageSequence.filter((elementId) => canvas.elementManager.hasElement(elementId)),
	)
	if (imageElementIds.length < 1) return null

	const sourceFrame = canvas.elementManager.getElementData(origin.elementId)
	if (!sourceFrame || sourceFrame.type !== ElementTypeEnum.Frame) return null

	const referenceModel = resolveImageReferenceVideoModel(canvas, videoModelList, 1)
	if (!referenceModel) return null

	const videoTool = canvas.toolManager.getVideoGeneratorTool()
	const size = videoTool.getVideoElementSizeForModelList([referenceModel.model])
	const heights = imageElementIds.map(() => size.height)
	const frameLayout = resolveFrameContentLayout({
		width: size.width,
		height: getVerticalFrameContentHeight(heights),
	})
	const sourceRect = canvas.geometryCacheManager.getElementBounds(origin.elementId) ?? {
		x: sourceFrame.x ?? 0,
		y: sourceFrame.y ?? 0,
		width: sourceFrame.width ?? 0,
		height: sourceFrame.height ?? 0,
	}
	const frameOrigin = resolveConnectedPlacement(
		canvas,
		{
			originSide: "right",
			source: "handle",
			canvasX: sourceRect.x + sourceRect.width,
			canvasY: sourceRect.y + sourceRect.height / 2,
		},
		{ width: frameLayout.width, height: frameLayout.height },
		{
			output: "top-left",
			originElementId: origin.elementId,
			originRect: sourceRect,
			gap: resolveConnectionCreateGapForElement(sourceFrame, "right"),
		},
	)

	const created = canvas.historyManager.runTransaction(
		() => {
			const pairs: CreatedImageVideoPair[] = []
			let createdFrameId: string | null = null
			const rollback = () => {
				if (createdFrameId && canvas.elementManager.hasElement(createdFrameId)) {
					canvas.elementManager.delete(createdFrameId)
				}
			}

			try {
				const videoChildren = imageElementIds.map((imageElementId, index) => {
					const videoData = createEmptyVideoData({
						x: frameLayout.padding,
						y: frameLayout.padding + getVerticalFrameContentOffset(heights, index),
						width: size.width,
						height: size.height,
						zIndex: imageElementIds.length - index,
					})
					pairs.push({ imageElementId, videoElementId: videoData.id })
					return videoData
				})

				const { frameData } = createContentFrameData({
					id: generateElementId(),
					x: frameOrigin.x,
					y: frameOrigin.y,
					width: size.width,
					height: getVerticalFrameContentHeight(heights),
					zIndex: canvas.elementManager.getNextZIndexInLevel(),
					name: resolveStoryboardVideoFrameName(canvas),
					children: videoChildren,
					padding: frameLayout.padding,
				})

				const createResult = canvas.elementManager.create(frameData)
				if (!createResult) return null
				createdFrameId = createResult.elementId
				pairs.forEach((pair) => {
					applyReferenceVideoDraft(canvas, pair.videoElementId, referenceModel)
				})

				const connection = canvas.connectionManager.connectElementsBatch({
					edges: pairs.map((pair) => ({
						sourceElementId: pair.imageElementId,
						targetElementId: pair.videoElementId,
					})),
				})
				if (connection.status !== "created") {
					rollback()
					return null
				}

				return { frameId: createdFrameId, pairs }
			} catch {
				rollback()
				return null
			}
		},
		(result) => result !== null,
	)

	if (!created) return null

	registerSeedsForPairs(canvas, created.pairs)
	selectAndFocus(canvas, [created.frameId])
	return created.frameId
}

export function getStoryboardVideoMenuLabel(imageCount: number): {
	key: string
	fallback: string
} {
	if (imageCount >= 1) {
		return {
			key: "storyboardVideo.menuNameWithCount",
			fallback: "制作分镜视频（{{count}} 个）",
		}
	}
	return {
		key: "storyboardVideo.menuName",
		fallback: "制作分镜视频",
	}
}
