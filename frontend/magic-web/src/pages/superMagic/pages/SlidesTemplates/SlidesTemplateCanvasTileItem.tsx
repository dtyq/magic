import { AnimatePresence, motion, type MotionValue, type Variants } from "framer-motion"
import { memo } from "react"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import { type TemplateCanvasPoint, type TemplateCanvasSize } from "./canvasLayout"
import {
	type SlidesTemplateCanvasTile,
	getTemplateKey,
	getTemplatePreviewUrls,
	isSlidesTemplateCanvasFiller,
} from "./canvasInteraction"
import { getFeaturedSlidesTemplateTag } from "@/pages/superMagic/components/MainInputContainer/panels/slides-preset/templateMeta"
import SlidesTemplateCoverTile from "./SlidesTemplateCoverTile"

export interface SlidesTemplateCanvasTileLoopState {
	duplicateY: MotionValue<number>
	isRunning: boolean
	show: boolean
	y: MotionValue<number>
}

const templateEmphasisVariants: Variants = {
	idle: {
		scale: 1,
		transition: { duration: 0 },
	},
	emphasized: {
		scale: [1, 1.07, 0.998, 1],
		transition: {
			duration: 0.52,
			times: [0, 0.2, 0.8, 1],
			ease: ["easeOut", "easeInOut", "easeOut"],
		},
	},
}

interface SlidesTemplateCanvasTileItemProps {
	anchorTileId: string
	column: number
	favoritePending?: boolean
	focusedAnchorTileId: string
	imageLoading?: "eager" | "lazy"
	isCanvasFocusSettling: boolean
	isCanvasMoving: boolean
	loopState?: SlidesTemplateCanvasTileLoopState
	onFindSimilarColors?: (template: OptionItem) => void
	onFavoriteToggle?: (template: OptionItem) => void
	onOpenProject?: (template: OptionItem) => void
	onPreviewClick: (anchorTileId: string, tile: SlidesTemplateCanvasTile) => void
	onPreviewIntent?: (template: OptionItem) => void
	onTemplateSelect: (template: OptionItem) => void
	position: TemplateCanvasPoint
	reduceMotion: boolean
	selectedTemplateValue: string
	shouldPlayIntro: boolean
	size: TemplateCanvasSize
	tile: SlidesTemplateCanvasTile
	visibleIndex: number
}

function SlidesTemplateCanvasTileItem({
	anchorTileId,
	column,
	favoritePending,
	focusedAnchorTileId,
	imageLoading,
	isCanvasFocusSettling,
	isCanvasMoving,
	loopState,
	onFindSimilarColors,
	onFavoriteToggle,
	onOpenProject,
	onPreviewClick,
	onPreviewIntent,
	onTemplateSelect,
	position,
	reduceMotion,
	selectedTemplateValue,
	shouldPlayIntro,
	size,
	tile,
	visibleIndex,
}: SlidesTemplateCanvasTileItemProps) {
	const value = getTemplateKey(tile.template)
	const isExpanded = focusedAnchorTileId === anchorTileId
	const isSelected = selectedTemplateValue === value
	const isEmphasized = isSelected || isExpanded
	const isEmphasisAnimationReady = isEmphasized && (!isCanvasMoving || isCanvasFocusSettling)
	const emphasisAnimationState = !reduceMotion && isEmphasisAnimationReady ? "emphasized" : "idle"
	const isFeatured = Boolean(getFeaturedSlidesTemplateTag(tile.template))
	const previewImageUrls = getTemplatePreviewUrls(tile.template)
	const introDelay = Math.min(visibleIndex * 0.018, 0.3)
	const showLoopOverlay = Boolean(loopState?.show) && !reduceMotion
	const isLoopRunning = Boolean(loopState?.isRunning) && !reduceMotion

	function renderCover() {
		return (
			<SlidesTemplateCoverTile
				template={tile.template}
				imageUrl={tile.imageUrl}
				imageLoading={imageLoading}
				isSelected={isSelected}
				isExpanded={isExpanded}
				canPreview={previewImageUrls.length > 0}
				favoritePending={favoritePending}
				onFindSimilarColors={onFindSimilarColors}
				onFavoriteToggle={onFavoriteToggle}
				onOpenProject={onOpenProject}
				onSelect={onTemplateSelect}
				onPreviewIntent={onPreviewIntent}
				onPreviewClick={() => onPreviewClick(anchorTileId, tile)}
			/>
		)
	}

	function renderLoopCover(isDuplicate: boolean) {
		return (
			<div data-testid="slides-template-loop-cover" className="pointer-events-auto size-full">
				<SlidesTemplateCoverTile
					template={tile.template}
					imageUrl={tile.imageUrl}
					imageLoading="lazy"
					isKeyboardAccessible={!isDuplicate}
					isSelected={isSelected}
					isExpanded={isExpanded}
					canPreview={previewImageUrls.length > 0}
					favoritePending={favoritePending}
					onFindSimilarColors={onFindSimilarColors}
					onFavoriteToggle={onFavoriteToggle}
					onOpenProject={onOpenProject}
					onSelect={onTemplateSelect}
					onPreviewIntent={onPreviewIntent}
					onPreviewClick={() => onPreviewClick(anchorTileId, tile)}
				/>
			</div>
		)
	}

	return (
		<div
			data-slides-template-canvas-item="true"
			data-slides-template-layout-filler={
				isSlidesTemplateCanvasFiller(tile) ? "true" : undefined
			}
			data-testid="slides-template-canvas-tile-item"
			className="absolute [contain:layout_style]"
			style={{
				height: size.height,
				transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
				width: size.width,
				zIndex: isExpanded ? 30 : isSelected ? 20 : isFeatured ? 10 : 1,
			}}
		>
			<motion.div
				className="size-full"
				data-testid="slides-template-static-cover"
				data-slides-template-emphasis-ready={isEmphasisAnimationReady ? "true" : "false"}
				data-slides-template-idle-animation={isLoopRunning ? "true" : "false"}
				initial={
					shouldPlayIntro && !reduceMotion
						? { opacity: 0, y: 14 + (Math.abs(column) % 2) * 6 }
						: false
				}
				animate={{
					opacity: showLoopOverlay ? 0 : 1,
					y: 0,
				}}
				aria-hidden={showLoopOverlay || undefined}
				style={{
					pointerEvents: showLoopOverlay ? "none" : undefined,
					willChange:
						shouldPlayIntro || showLoopOverlay ? "transform, opacity" : undefined,
				}}
				transition={{
					opacity: { duration: 0.42, delay: shouldPlayIntro ? introDelay : 0 },
					y: {
						duration: shouldPlayIntro ? 0.62 : 0.45,
						delay: shouldPlayIntro ? introDelay : 0,
						ease: [0.22, 1, 0.36, 1],
					},
				}}
			>
				<motion.div
					className="size-full"
					initial={false}
					variants={templateEmphasisVariants}
					animate={emphasisAnimationState}
				>
					{renderCover()}
				</motion.div>
			</motion.div>
			<AnimatePresence>
				{showLoopOverlay && loopState ? (
					<motion.div
						key="idle-column-loop"
						className="pointer-events-none absolute inset-0"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.3 }}
					>
						<motion.div
							className="absolute inset-0 will-change-transform"
							style={{ y: loopState.y }}
						>
							{renderLoopCover(false)}
						</motion.div>
						<motion.div
							className="absolute inset-0 will-change-transform"
							style={{ y: loopState.duplicateY }}
						>
							{renderLoopCover(true)}
						</motion.div>
					</motion.div>
				) : null}
			</AnimatePresence>
		</div>
	)
}

function areTileItemPropsEqual(
	previous: SlidesTemplateCanvasTileItemProps,
	next: SlidesTemplateCanvasTileItemProps,
) {
	return (
		previous.anchorTileId === next.anchorTileId &&
		previous.column === next.column &&
		previous.favoritePending === next.favoritePending &&
		previous.focusedAnchorTileId === next.focusedAnchorTileId &&
		previous.imageLoading === next.imageLoading &&
		previous.isCanvasFocusSettling === next.isCanvasFocusSettling &&
		previous.isCanvasMoving === next.isCanvasMoving &&
		previous.loopState === next.loopState &&
		previous.onFindSimilarColors === next.onFindSimilarColors &&
		previous.onFavoriteToggle === next.onFavoriteToggle &&
		previous.onPreviewClick === next.onPreviewClick &&
		previous.onTemplateSelect === next.onTemplateSelect &&
		previous.position.x === next.position.x &&
		previous.position.y === next.position.y &&
		previous.reduceMotion === next.reduceMotion &&
		previous.selectedTemplateValue === next.selectedTemplateValue &&
		previous.shouldPlayIntro === next.shouldPlayIntro &&
		(!next.shouldPlayIntro || previous.visibleIndex === next.visibleIndex) &&
		previous.size.height === next.size.height &&
		previous.size.width === next.size.width &&
		previous.tile.id === next.tile.id &&
		previous.tile.imageUrl === next.tile.imageUrl &&
		previous.tile.template === next.tile.template
	)
}

// 可见窗口每次换入少量卡片时复用其余卡片，避免拖拽过程中重复执行封面和颜色计算。
export default memo(SlidesTemplateCanvasTileItem, areTileItemPropsEqual)
