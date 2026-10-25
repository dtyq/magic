import { useReducedMotion } from "framer-motion"
import { memo, useMemo, type CSSProperties, type RefObject } from "react"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { HomeOnboardingAnchor } from "@/pages/superMagic/components/LazyGuideTour/GuideTourManager"
import type { TemplateCanvasGuideAnchor, TemplateCanvasItem } from "./canvasLayout"
import {
	EAGER_TEMPLATE_COVER_COUNT,
	getTemplateKey,
	type SlidesTemplateCanvasTile,
} from "./canvasInteraction"
import SlidesTemplateCanvasTileItem from "./SlidesTemplateCanvasTileItem"
import SlidesTemplateCanvasLoopColumn, {
	type SlidesTemplateCanvasColumnItem,
} from "./SlidesTemplateCanvasLoopColumn"
import { resolveSlidesTemplateCanvasIdleLoops } from "./canvasIdleLoop"
import { SLIDES_TEMPLATE_CANVAS_DEFAULT_SCALE } from "./canvasZoom"

interface SlidesTemplateCanvasItemsLayerProps {
	canvasItems: Array<TemplateCanvasItem<SlidesTemplateCanvasTile>>
	contentRef: RefObject<HTMLDivElement | null>
	enableIdleLoops: boolean
	favoritePendingCodes?: ReadonlySet<string>
	focusedAnchorTileId: string
	guideAnchor: TemplateCanvasGuideAnchor | null
	isCanvasFocusSettling: boolean
	isCanvasMoving: boolean
	isIdleAnimationActive: boolean
	keepIdleLoopsMounted: boolean
	prioritizeCoverLoading: boolean
	onFindSimilarColors?: (template: OptionItem) => void
	onFavoriteToggle?: (template: OptionItem) => void
	onOpenProject?: (template: OptionItem) => void
	onPreviewClick: (anchorTileId: string, tile: SlidesTemplateCanvasTile) => void
	onPreviewIntent?: (template: OptionItem) => void
	onTemplateSelect: (template: OptionItem) => void
	selectedTemplateValue: string
	visibleCanvasItems: Array<TemplateCanvasItem<SlidesTemplateCanvasTile>>
}

const contentStyle = {
	transform: `translate3d(0px, 0px, 0) scale(${SLIDES_TEMPLATE_CANVAS_DEFAULT_SCALE})`,
	"--slides-template-canvas-action-scale": String(1 / SLIDES_TEMPLATE_CANVAS_DEFAULT_SCALE),
} as CSSProperties

function SlidesTemplateCanvasItemsLayer({
	canvasItems,
	contentRef,
	enableIdleLoops,
	favoritePendingCodes,
	focusedAnchorTileId,
	guideAnchor,
	isCanvasFocusSettling,
	isCanvasMoving,
	isIdleAnimationActive,
	keepIdleLoopsMounted,
	prioritizeCoverLoading,
	onFindSimilarColors,
	onFavoriteToggle,
	onOpenProject,
	onPreviewClick,
	onPreviewIntent,
	onTemplateSelect,
	selectedTemplateValue,
	visibleCanvasItems,
}: SlidesTemplateCanvasItemsLayerProps) {
	const reduceMotion = Boolean(useReducedMotion())
	// 分页追加会替换部分循环副本。卡片入场透明动画会让这些副本短暂显示为空白，
	// 因此模板墙只保留空闲状态的循环动画，不对卡片本身做初始透明入场。
	const shouldPlayIntro = false
	const idleLoopsByColumn = useMemo(
		() =>
			enableIdleLoops
				? new Map(
						resolveSlidesTemplateCanvasIdleLoops(canvasItems).map((loop) => [
							loop.column,
							loop,
						]),
					)
				: new Map(),
		[canvasItems, enableIdleLoops],
	)
	const { columnItems, standaloneItems } = useMemo(() => {
		const nextColumnItems = new Map<number, SlidesTemplateCanvasColumnItem[]>()
		const nextStandaloneItems: SlidesTemplateCanvasColumnItem[] = []

		visibleCanvasItems.forEach((canvasItem, visibleIndex) => {
			const entry = { canvasItem, visibleIndex }
			if (canvasItem.renderKey || canvasItem.span.columns !== 1) {
				nextStandaloneItems.push(entry)
				return
			}

			const currentItems = nextColumnItems.get(canvasItem.grid.x) ?? []
			currentItems.push(entry)
			nextColumnItems.set(canvasItem.grid.x, currentItems)
		})

		return { columnItems: nextColumnItems, standaloneItems: nextStandaloneItems }
	}, [visibleCanvasItems])
	const allItemsByColumn = useMemo(() => {
		const nextItems = new Map<number, Array<TemplateCanvasItem<SlidesTemplateCanvasTile>>>()

		canvasItems.forEach((canvasItem) => {
			if (!idleLoopsByColumn.has(canvasItem.grid.x) || canvasItem.span.columns !== 1) return
			const currentItems = nextItems.get(canvasItem.grid.x) ?? []
			currentItems.push(canvasItem)
			nextItems.set(canvasItem.grid.x, currentItems)
		})

		return nextItems
	}, [canvasItems, idleLoopsByColumn])

	return (
		<div
			ref={contentRef}
			data-testid="slides-template-canvas-content"
			className="absolute left-1/2 top-1/2 size-0 will-change-transform"
			style={contentStyle}
		>
			{/*
			 * The box an onboarding run frames. It carries no styling and takes no pointer events —
			 * it exists only to be measured, and it sits inside the transformed content so its
			 * measured box already accounts for the pan and the zoom. It is placed exactly like the
			 * card it stands for, so the tour's frame and the card coincide.
			 */}
			{guideAnchor ? (
				<div
					aria-hidden="true"
					data-guide-anchor={HomeOnboardingAnchor.SlidesTemplateFeaturedCard}
					data-testid="slides-template-canvas-guide-anchor"
					className="pointer-events-none absolute"
					style={{
						height: guideAnchor.height,
						transform: `translate3d(${guideAnchor.x}px, ${guideAnchor.y}px, 0) translate(-50%, -50%)`,
						width: guideAnchor.width,
					}}
				/>
			) : null}
			{Array.from(columnItems.entries()).map(([column, items]) => (
				<SlidesTemplateCanvasLoopColumn
					key={column}
					allItems={
						allItemsByColumn.get(column) ?? items.map(({ canvasItem }) => canvasItem)
					}
					items={items}
					idleLoop={idleLoopsByColumn.get(column) ?? null}
					isIdleAnimationActive={isIdleAnimationActive}
					keepIdleLoopMountedWhenPaused={keepIdleLoopsMounted}
					reduceMotion={reduceMotion}
					focusedAnchorTileId={focusedAnchorTileId}
					favoritePendingCodes={favoritePendingCodes}
					isCanvasFocusSettling={isCanvasFocusSettling}
					isCanvasMoving={isCanvasMoving}
					selectedTemplateValue={selectedTemplateValue}
					onFindSimilarColors={onFindSimilarColors}
					onFavoriteToggle={onFavoriteToggle}
					onOpenProject={onOpenProject}
					onTemplateSelect={onTemplateSelect}
					onPreviewIntent={onPreviewIntent}
					onPreviewClick={onPreviewClick}
					shouldPlayIntro={shouldPlayIntro}
				/>
			))}
			{standaloneItems.map(({ canvasItem, visibleIndex }) => {
				const { grid, item: tile, position, size } = canvasItem
				const anchorTileId = tile.id

				return (
					<SlidesTemplateCanvasTileItem
						key={canvasItem.renderKey ?? anchorTileId}
						anchorTileId={anchorTileId}
						column={grid.x}
						tile={tile}
						position={position}
						reduceMotion={reduceMotion}
						size={size}
						imageLoading={
							prioritizeCoverLoading && visibleIndex < EAGER_TEMPLATE_COVER_COUNT
								? "eager"
								: "lazy"
						}
						focusedAnchorTileId={focusedAnchorTileId}
						favoritePending={favoritePendingCodes?.has(getTemplateKey(tile.template))}
						isCanvasFocusSettling={isCanvasFocusSettling}
						isCanvasMoving={isCanvasMoving}
						selectedTemplateValue={selectedTemplateValue}
						onFindSimilarColors={onFindSimilarColors}
						onFavoriteToggle={onFavoriteToggle}
						onOpenProject={onOpenProject}
						onTemplateSelect={onTemplateSelect}
						onPreviewIntent={onPreviewIntent}
						onPreviewClick={onPreviewClick}
						shouldPlayIntro={shouldPlayIntro}
						visibleIndex={visibleIndex}
					/>
				)
			})}
		</div>
	)
}

// 画布 transform 由父级直接写入 DOM。缩放时比例标签会更新状态，但卡片数据未变化时不应重渲染整层封面。
export default memo(SlidesTemplateCanvasItemsLayer)
