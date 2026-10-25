import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import type { MutableRefObject, RefObject } from "react"
import type { TemplateCanvasItem, TemplateCanvasPoint } from "./canvasLayout"
import type { SlidesTemplateCanvasTile } from "./canvasInteraction"
import { isSlidesTemplateCanvasFiller } from "./canvasInteraction"
import {
	getRebasedSlidesTemplateCanvasOffset,
	getLoopedVisibleSlidesTemplateCanvasItems,
	type SlidesTemplateCanvasLoopItemQuery,
	type SlidesTemplateCanvasLoopMetrics,
} from "./canvasLoop"
import { getVisibleTemplateCanvasItems } from "./canvasViewport"

interface UseTemplateCanvasVisibleItemsInput {
	canvasItems: Array<TemplateCanvasItem<SlidesTemplateCanvasTile>>
	loopItemQuery?: SlidesTemplateCanvasLoopItemQuery
	loopMetrics: SlidesTemplateCanvasLoopMetrics
	onOffsetRebase: () => void
	offsetRef: MutableRefObject<TemplateCanvasPoint>
	resetKey: string
	scaleRef: RefObject<number>
	viewportRef: RefObject<HTMLDivElement | null>
}

const FALLBACK_VIEWPORT_WIDTH = 1280
const FALLBACK_VIEWPORT_HEIGHT = 720

function getCanvasItemKey(items: Array<TemplateCanvasItem<SlidesTemplateCanvasTile>>) {
	return items
		.map(
			({ item }) =>
				`${item.id}:${item.template.is_favorite ? "favorite" : "unfavorite"}:${item.imageUrl ?? ""}`,
		)
		.join("|")
}

function doCanvasItemsOverlap(
	left: TemplateCanvasItem<SlidesTemplateCanvasTile>,
	right: TemplateCanvasItem<SlidesTemplateCanvasTile>,
) {
	return (
		Math.abs(left.position.x - right.position.x) < (left.size.width + right.size.width) / 2 &&
		Math.abs(left.position.y - right.position.y) < (left.size.height + right.size.height) / 2
	)
}

export function useTemplateCanvasVisibleItems({
	canvasItems,
	loopItemQuery,
	loopMetrics,
	onOffsetRebase,
	offsetRef,
	resetKey,
	scaleRef,
	viewportRef,
}: UseTemplateCanvasVisibleItemsInput) {
	const canvasItemsRef = useRef(canvasItems)
	const canvasItemCountRef = useRef(canvasItems.length)
	const loopItemQueryRef = useRef(loopItemQuery)
	const loopMetricsRef = useRef(loopMetrics)
	const preservedCanvasItemsRef = useRef<Array<TemplateCanvasItem<SlidesTemplateCanvasTile>>>([])
	const resetKeyRef = useRef(resetKey)
	const visibleKeyRef = useRef<string | null>(null)
	const visibleCanvasItemsRef = useRef<Array<TemplateCanvasItem<SlidesTemplateCanvasTile>>>([])
	const frameRef = useRef<number | null>(null)
	const [visibleCanvasItems, setVisibleCanvasItems] = useState<
		Array<TemplateCanvasItem<SlidesTemplateCanvasTile>>
	>([])

	const updateVisibleCanvasItems = useCallback(() => {
		const viewport = viewportRef.current
		const items = canvasItemsRef.current
		if (!viewport) return

		const { width, height } = viewport.getBoundingClientRect()
		const viewportWidth = width > 0 ? width : FALLBACK_VIEWPORT_WIDTH
		const viewportHeight = height > 0 ? height : FALLBACK_VIEWPORT_HEIGHT

		const scale = scaleRef.current
		const nextLayoutItems = getLoopedVisibleSlidesTemplateCanvasItems({
			itemQuery: loopItemQueryRef.current,
			items,
			loopMetrics: loopMetricsRef.current,
			offset: offsetRef.current,
			scale,
			viewportHeight,
			viewportWidth,
		})
		const preservedItems = getVisibleTemplateCanvasItems({
			items: preservedCanvasItemsRef.current,
			offset: offsetRef.current,
			scale,
			viewportHeight,
			viewportWidth,
		})
		preservedCanvasItemsRef.current = preservedItems
		const nextItems = [
			...preservedItems,
			...nextLayoutItems.filter(
				(nextItem) =>
					!preservedItems.some((preservedItem) =>
						doCanvasItemsOverlap(preservedItem, nextItem),
					),
			),
		]
		const nextKey = getCanvasItemKey(nextItems)
		if (nextKey === visibleKeyRef.current) return

		visibleKeyRef.current = nextKey
		visibleCanvasItemsRef.current = nextItems
		setVisibleCanvasItems(nextItems)
	}, [offsetRef, scaleRef, viewportRef])

	const scheduleVisibleCanvasItemsUpdate = useCallback(() => {
		if (frameRef.current != null) return

		frameRef.current = requestAnimationFrame(() => {
			frameRef.current = null
			updateVisibleCanvasItems()
		})
	}, [updateVisibleCanvasItems])

	useLayoutEffect(() => {
		const previousOffset = offsetRef.current
		const rebasedOffset = getRebasedSlidesTemplateCanvasOffset({
			nextLoopMetrics: loopMetrics,
			offset: offsetRef.current,
			previousLoopMetrics: loopMetricsRef.current,
			scale: scaleRef.current,
		})
		const hasReset = resetKeyRef.current !== resetKey
		const hasAppendedItems = canvasItems.length > canvasItemCountRef.current
		if (hasReset) {
			preservedCanvasItemsRef.current = []
		} else if (hasAppendedItems && visibleCanvasItemsRef.current.length > 0) {
			// 分页会改变循环周期。先保留当前视口中的旧卡片，等它们移出视口后再显示新布局，
			// 避免接口返回的瞬间替换用户正在看的真实模板。循环边界补位项不属于真实数据，
			// 必须随新布局一起移除，否则新分页模板会被旧补位项挡住。
			const scale = Math.max(scaleRef.current, 0.01)
			const positionAdjustment = {
				x: (previousOffset.x - rebasedOffset.x) / scale,
				y: (previousOffset.y - rebasedOffset.y) / scale,
			}
			preservedCanvasItemsRef.current = visibleCanvasItemsRef.current
				.filter((canvasItem) => !isSlidesTemplateCanvasFiller(canvasItem.item))
				.map((canvasItem, index) => ({
					...canvasItem,
					position: {
						x: canvasItem.position.x + positionAdjustment.x,
						y: canvasItem.position.y + positionAdjustment.y,
					},
					renderKey: `preserved:${index}:${canvasItem.renderKey ?? canvasItem.item.id}`,
				}))
		} else {
			// 收藏状态、详情字段等原地更新不属于分页追加。保留旧可见项会让旧对象
			// 覆盖新布局，导致接口成功后按钮仍显示旧状态。
			preservedCanvasItemsRef.current = []
		}
		if (rebasedOffset.x !== offsetRef.current.x || rebasedOffset.y !== offsetRef.current.y) {
			offsetRef.current = rebasedOffset
			onOffsetRebase()
		}
		canvasItemsRef.current = canvasItems
		canvasItemCountRef.current = canvasItems.length
		loopItemQueryRef.current = loopItemQuery
		loopMetricsRef.current = loopMetrics
		resetKeyRef.current = resetKey
		// null 表示强制重新提交可见项。空布局的 key 本身是空字符串，不能用空字符串作哨兵，
		// 否则筛选切换到预取阶段时会跳过 setVisibleCanvasItems([])，把旧卡片留在画布上。
		visibleKeyRef.current = null
		updateVisibleCanvasItems()
	}, [
		canvasItems,
		loopItemQuery,
		loopMetrics,
		onOffsetRebase,
		offsetRef,
		resetKey,
		scaleRef,
		updateVisibleCanvasItems,
	])

	useEffect(() => {
		if (typeof window === "undefined") return

		window.addEventListener("resize", scheduleVisibleCanvasItemsUpdate)
		return () => {
			window.removeEventListener("resize", scheduleVisibleCanvasItemsUpdate)
		}
	}, [scheduleVisibleCanvasItemsUpdate])

	useEffect(() => {
		return () => {
			if (frameRef.current != null) {
				cancelAnimationFrame(frameRef.current)
				frameRef.current = null
			}
		}
	}, [])

	return {
		scheduleVisibleCanvasItemsUpdate,
		updateVisibleCanvasItems,
		visibleCanvasItems,
	}
}
