import type { Canvas } from "../../core/Canvas"
import { ElementTypeEnum } from "../../document/types"

interface TextSize {
	width: number
	height: number
}

export interface MediaLabelRect {
	x: number
	y: number
	width: number
	height: number
}

export interface MediaLabelLayout {
	inverseScale: number
	nameWidth: number
	showSize: boolean
	showOperation: boolean
	hasSpace: boolean
	/** Spatial candidates are reused across scale frames for the same geometry band. */
	candidateIds: readonly string[]
}

export interface MediaLabelLayoutOptions {
	name: TextSize
	size: TextSize
	/** Optional leading icon footprint in the name label's local coordinates. */
	nameLeadingWidth?: number
	nameLeadingHeight?: number
	fontSize: number
	offsetTop: number
	gap: number
	operationScreenWidth: number
	/** Live bounds used during a node-only transform before the geometry cache catches up. */
	boundsOverride?: MediaLabelRect
}

interface CachedLayout {
	key: string
	layout: MediaLabelLayout
}

interface CachedSpatialCandidates {
	key: string
	candidateIds: readonly string[]
}

interface CanvasMediaLabelCache {
	layouts: WeakMap<object, CachedLayout>
	spatialCandidates: WeakMap<object, CachedSpatialCandidates>
}

const cachesByCanvas = new WeakMap<Canvas, CanvasMediaLabelCache>()

/** Four spatial query bands per octave keep the candidate set stable for most scale frames. */
const SCALE_BANDS_PER_OCTAVE = 4

function getScaleBand(scale: number): number {
	return Math.floor(Math.log2(scale) * SCALE_BANDS_PER_OCTAVE)
}

function getScaleBandLowerBound(scaleBand: number): number {
	return 2 ** (scaleBand / SCALE_BANDS_PER_OCTAVE)
}

function getElementBounds(
	canvas: Canvas,
	elementId: string,
	boundsOverride?: MediaLabelRect,
): MediaLabelRect | null {
	if (boundsOverride) return boundsOverride
	return (
		canvas.geometryCacheManager.getElementBounds?.(elementId) ??
		canvas.elementManager.getElementInstance(elementId)?.getBoundingRect() ??
		null
	)
}

/**
 * 几何、显示状态或层级改变时，邻图预算必须重新计算。保留未受影响元素的缓存，避免一次
 * 局部拖动让所有已创建标签在下一帧同时重新查询空间索引。
 */
export function invalidateMediaLabelLayouts(canvas: Canvas, elementIds?: Iterable<string>): void {
	const cache = cachesByCanvas.get(canvas)
	if (!cache) return
	if (!elementIds) {
		cachesByCanvas.delete(canvas)
		return
	}

	for (const elementId of elementIds) {
		const element = canvas.elementManager.getElementInstance(elementId)
		if (element) {
			cache.layouts.delete(element)
			cache.spatialCandidates.delete(element)
		}
	}
}

/**
 * 整行只从完整文本和当前几何计算，名称/尺寸管理器的调用顺序不会改变结果。
 * 标题先占宽度，只有两项能完整并排时才显示分辨率；隐藏不影响下次度量。
 */
export function getMediaLabelLayout(
	canvas: Canvas,
	elementId: string,
	options: MediaLabelLayoutOptions,
): MediaLabelLayout | null {
	const element = canvas.elementManager.getElementInstance(elementId)
	const type = element?.getData().type
	if (!element || (type !== ElementTypeEnum.Image && type !== ElementTypeEnum.Video)) return null
	const bounds = getElementBounds(canvas, elementId, options.boundsOverride)
	if (!bounds) return null
	const viewportScale = canvas.stage.scaleX()
	const scale = Number.isFinite(viewportScale) && viewportScale > 0 ? viewportScale : 1
	let cache = cachesByCanvas.get(canvas)
	if (!cache) {
		cache = {
			layouts: new WeakMap(),
			spatialCandidates: new WeakMap(),
		}
		cachesByCanvas.set(canvas, cache)
	}
	const geometryRevision = canvas.geometryCacheManager.getRevision()
	const parentId = canvas.elementManager.findParentIdForElement(elementId)
	const nameLeadingWidth = Math.max(0, options.nameLeadingWidth ?? 0)
	const nameLeadingHeight = Math.max(0, options.nameLeadingHeight ?? 0)
	const rowHeight =
		Math.max(options.name.height, options.size.height, nameLeadingHeight) + options.offsetTop
	const operationExtraHeight =
		Math.max(
			0,
			options.operationScreenWidth - Math.max(options.name.height, nameLeadingHeight),
		) / 2
	const scaleBand = getScaleBand(scale)
	const key = [
		geometryRevision,
		scale,
		bounds.x,
		bounds.y,
		bounds.width,
		bounds.height,
		options.name.width,
		options.name.height,
		options.size.width,
		options.size.height,
		nameLeadingWidth,
		nameLeadingHeight,
		options.fontSize,
		options.offsetTop,
		options.gap,
		options.operationScreenWidth,
	].join(":")
	const cached = cache.layouts.get(element)
	if (cached?.key === key) return cached.layout

	// The final layout depends on the exact scale, but the spatial candidate set only needs to
	// cover the largest label row in this scale band. Reusing that set removes one R-tree query per
	// media label on every zoom frame while the exact overlap calculation below remains unchanged.
	const spatialKey = [
		geometryRevision,
		scaleBand,
		parentId ?? "",
		bounds.x,
		bounds.y,
		bounds.width,
		bounds.height,
		rowHeight,
		operationExtraHeight,
	].join(":")
	const cachedSpatial = cache.spatialCandidates.get(element)
	let candidateIds: readonly string[]
	if (cachedSpatial?.key === spatialKey) {
		candidateIds = cachedSpatial.candidateIds
	} else {
		const queryHeight = (rowHeight + operationExtraHeight) / getScaleBandLowerBound(scaleBand)
		candidateIds = canvas.geometryCacheManager.queryElementIdsByExpandedRect(
			{
				x: bounds.x,
				y: bounds.y - queryHeight,
				width: bounds.width,
				height: queryHeight,
			},
			0,
		)
		cache.spatialCandidates.set(element, { key: spatialKey, candidateIds })
	}

	// Labels keep one shared screen size. Vertical overlap is handled by hiding the row,
	// instead of shrinking the text differently for each media element.
	let availableHeight = (rowHeight + operationExtraHeight) / scale
	for (const candidateId of candidateIds) {
		if (candidateId === elementId) continue
		const candidate = canvas.elementManager.getElementInstance(candidateId)
		const candidateType = candidate?.getData().type
		if (
			!candidate ||
			(candidateType !== ElementTypeEnum.Image && candidateType !== ElementTypeEnum.Video) ||
			canvas.elementManager.findParentIdForElement(candidateId) !== parentId
		)
			continue
		const node = candidate.getNode()
		if (!node?.isVisible() || node.getAbsoluteOpacity() === 0) continue
		// During a node-only transform the geometry index intentionally remains on the
		// committed revision. The target uses boundsOverride in that path, so read the
		// same live bounds for candidates as well; ordinary scale/layout passes keep the
		// cheaper indexed bounds lookup.
		const other = options.boundsOverride
			? (candidate.getBoundingRect() ?? getElementBounds(canvas, candidateId))
			: getElementBounds(canvas, candidateId)
		if (!other || other.x >= bounds.x + bounds.width || other.x + other.width <= bounds.x)
			continue
		const distance = bounds.y - (other.y + other.height)
		// 只约束本体不相交的上排媒体；真实叠放仍遵守原有 zIndex 遮挡规则。
		if (distance >= 0) availableHeight = Math.min(availableHeight, distance)
	}
	const hasSpace = availableHeight * scale >= rowHeight
	if (!hasSpace || bounds.width <= 0) {
		const layout = {
			inverseScale: 1 / scale,
			nameWidth: 0,
			showSize: false,
			showOperation: false,
			hasSpace: false,
			candidateIds,
		}
		cache.layouts.set(element, { key, layout })
		return layout
	}
	const screenWidth = bounds.width * scale
	// The rename action follows the shared permission capability. If the thumbnail is
	// narrower than the operation area, the label may extend beyond the thumbnail so the
	// action remains available; the name still receives a minimum ellipsis width.
	const showOperation = options.operationScreenWidth > 0 && availableHeight > 0
	const operationWidth = showOperation ? options.operationScreenWidth : 0
	const localWidth = Math.max(0, screenWidth - operationWidth)
	const gap = options.name.width > 0 && options.size.width > 0 ? options.gap : 0
	const minimumTextWidth =
		options.name.width > 0 ? Math.min(options.name.width, options.fontSize) : 1
	// The size label is all-or-nothing and lower priority than the complete name (including its
	// mandatory status suffix). The optional leading icon may still yield independently.
	const showSize =
		options.size.width > 0 &&
		options.name.width + gap + options.size.width <= localWidth &&
		minimumTextWidth + gap + options.size.width <= localWidth
	const nameAvailableWidth = Math.max(0, localWidth - (showSize ? options.size.width + gap : 0))
	// If the icon would leave no room for text, hide the icon and give its space back to the
	// name. This keeps the icon optional while preserving the name-first layout rule.
	const minimumNameWidth = nameLeadingWidth + minimumTextWidth
	const leadingFits = nameLeadingWidth === 0 || nameAvailableWidth >= minimumNameWidth
	const effectiveLeadingWidth = leadingFits ? nameLeadingWidth : 0
	const minimumOperationNameWidth = showOperation ? minimumTextWidth : 0
	const layout = {
		inverseScale: 1 / scale,
		nameWidth: Math.max(
			Math.min(options.name.width + effectiveLeadingWidth, nameAvailableWidth),
			minimumOperationNameWidth + effectiveLeadingWidth,
		),
		showSize,
		showOperation,
		hasSpace,
		candidateIds,
	}
	cache.layouts.set(element, { key, layout })
	return layout
}
