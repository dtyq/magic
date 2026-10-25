import { animate as animateMotion, useMotionValue, useTransform } from "framer-motion"
import { useEffect, useRef, useState } from "react"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { SLIDES_TEMPLATE_CANVAS_STEP_Y, type TemplateCanvasItem } from "./canvasLayout"
import {
	EAGER_TEMPLATE_COVER_COUNT,
	getTemplateKey,
	type SlidesTemplateCanvasTile,
} from "./canvasInteraction"
import SlidesTemplateCanvasTileItem from "./SlidesTemplateCanvasTileItem"
import type { SlidesTemplateCanvasIdleLoop } from "./canvasIdleLoop"
import { resolveSlidesTemplateCanvasLoopItems } from "./canvasIdleLoop"

export interface SlidesTemplateCanvasColumnItem {
	canvasItem: TemplateCanvasItem<SlidesTemplateCanvasTile>
	visibleIndex: number
}

interface SlidesTemplateCanvasLoopColumnProps {
	allItems: Array<TemplateCanvasItem<SlidesTemplateCanvasTile>>
	favoritePendingCodes?: ReadonlySet<string>
	focusedAnchorTileId: string
	idleLoop: SlidesTemplateCanvasIdleLoop | null
	isCanvasFocusSettling: boolean
	isCanvasMoving: boolean
	isIdleAnimationActive: boolean
	keepIdleLoopMountedWhenPaused?: boolean
	items: SlidesTemplateCanvasColumnItem[]
	onFindSimilarColors?: (template: OptionItem) => void
	onFavoriteToggle?: (template: OptionItem) => void
	onOpenProject?: (template: OptionItem) => void
	onPreviewClick: (anchorTileId: string, tile: SlidesTemplateCanvasTile) => void
	onPreviewIntent?: (template: OptionItem) => void
	onTemplateSelect: (template: OptionItem) => void
	reduceMotion: boolean
	selectedTemplateValue: string
	shouldPlayIntro: boolean
}

export default function SlidesTemplateCanvasLoopColumn({
	allItems,
	favoritePendingCodes,
	focusedAnchorTileId,
	idleLoop,
	isCanvasFocusSettling,
	isCanvasMoving,
	isIdleAnimationActive,
	keepIdleLoopMountedWhenPaused = true,
	items,
	onFindSimilarColors,
	onFavoriteToggle,
	onOpenProject,
	onPreviewClick,
	onPreviewIntent,
	onTemplateSelect,
	reduceMotion,
	selectedTemplateValue,
	shouldPlayIntro,
}: SlidesTemplateCanvasLoopColumnProps) {
	const loopEndY = idleLoop ? idleLoop.direction * idleLoop.distance : 0
	const loopY = useMotionValue(0)
	const duplicateLoopY = useTransform(loopY, (currentY) => currentY - loopEndY)
	const loopAnimationRef = useRef<ReturnType<typeof animateMotion> | null>(null)
	const hasLoopStartedRef = useRef(false)
	const [showLoopOverlay, setShowLoopOverlay] = useState(false)
	const [loopItems, setLoopItems] = useState(items)
	const canAnimateIdleLoop = Boolean(idleLoop) && !reduceMotion
	const isLoopRunning = isIdleAnimationActive && canAnimateIdleLoop
	const shouldShowLoopOverlay = showLoopOverlay && keepIdleLoopMountedWhenPaused

	useEffect(() => {
		if (!idleLoop || !shouldShowLoopOverlay) {
			setLoopItems(items)
			return
		}

		let previousStep = Number.NaN
		const visibleItems = items.map(({ canvasItem }) => canvasItem)
		const visibleIndexById = new Map(
			items.map(({ canvasItem, visibleIndex }) => [canvasItem.item.id, visibleIndex]),
		)

		function updateLoopItems(currentY: number) {
			const currentStep = Math.floor(currentY / SLIDES_TEMPLATE_CANVAS_STEP_Y)
			if (currentStep === previousStep) return
			previousStep = currentStep

			setLoopItems(
				resolveSlidesTemplateCanvasLoopItems({
					allItems,
					currentY,
					loopEndY,
					visibleItems,
				}).map((canvasItem, index) => ({
					canvasItem,
					visibleIndex:
						visibleIndexById.get(canvasItem.item.id) ??
						EAGER_TEMPLATE_COVER_COUNT + index,
				})),
			)
		}

		updateLoopItems(loopY.get())
		return loopY.on("change", updateLoopItems)
	}, [allItems, idleLoop, items, loopEndY, loopY, shouldShowLoopOverlay])

	useEffect(() => {
		loopAnimationRef.current?.stop()
		loopAnimationRef.current = null

		if (!idleLoop || !canAnimateIdleLoop || focusedAnchorTileId) {
			loopY.set(0)
			hasLoopStartedRef.current = false
			setShowLoopOverlay(false)
			return
		}

		if (!showLoopOverlay) {
			if (!isLoopRunning) return
			setShowLoopOverlay(true)
			return
		}

		if (!isLoopRunning) {
			if (!keepIdleLoopMountedWhenPaused) setShowLoopOverlay(false)
			return
		}

		function startFullLoop(delay = 0) {
			loopY.set(0)
			hasLoopStartedRef.current = true
			loopAnimationRef.current = animateMotion(loopY, loopEndY, {
				delay,
				duration: idleLoop.duration,
				ease: "linear",
				repeat: Number.POSITIVE_INFINITY,
			})
		}

		const currentY = loopY.get()
		if (Math.abs(currentY) < 0.5) {
			startFullLoop(hasLoopStartedRef.current ? 0 : idleLoop.delay)
			return () => loopAnimationRef.current?.stop()
		}

		const remainingRatio = Math.min(1, Math.abs(loopEndY - currentY) / idleLoop.distance)
		loopAnimationRef.current = animateMotion(loopY, loopEndY, {
			duration: idleLoop.duration * remainingRatio,
			ease: "linear",
			onComplete: () => startFullLoop(),
		})

		return () => loopAnimationRef.current?.stop()
	}, [
		canAnimateIdleLoop,
		focusedAnchorTileId,
		idleLoop,
		isLoopRunning,
		keepIdleLoopMountedWhenPaused,
		loopEndY,
		loopY,
		showLoopOverlay,
	])

	const loopState = idleLoop
		? {
				duplicateY: duplicateLoopY,
				isRunning: isLoopRunning,
				show: shouldShowLoopOverlay,
				y: loopY,
			}
		: undefined

	return loopItems.map(({ canvasItem, visibleIndex }) => {
		const { grid, item: tile, position, size } = canvasItem
		const anchorTileId = tile.id

		return (
			<SlidesTemplateCanvasTileItem
				key={anchorTileId}
				anchorTileId={anchorTileId}
				column={grid.x}
				tile={tile}
				position={position}
				reduceMotion={reduceMotion}
				size={size}
				imageLoading={visibleIndex < EAGER_TEMPLATE_COVER_COUNT ? "eager" : "lazy"}
				focusedAnchorTileId={focusedAnchorTileId}
				favoritePending={favoritePendingCodes?.has(getTemplateKey(tile.template))}
				isCanvasFocusSettling={isCanvasFocusSettling}
				isCanvasMoving={isCanvasMoving}
				loopState={loopState}
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
	})
}
