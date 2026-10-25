import {
	useState,
	type ComponentProps,
	type MouseEventHandler,
	type PointerEventHandler,
	type RefCallback,
	type RefObject,
} from "react"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import type { TemplateCanvasGuideAnchor, TemplateCanvasItem } from "./canvasLayout"
import {
	getCanvasEdgeCursor,
	type CanvasEdgeCursor,
	type SlidesTemplateCanvasTile,
	type SlidesTemplatePreviewFocus,
} from "./canvasInteraction"
import SlidesTemplateCanvasControls from "./SlidesTemplateCanvasControls"
import SlidesTemplateCanvasItemsLayer from "./SlidesTemplateCanvasItemsLayer"
import SlidesTemplateCanvasStatus from "./SlidesTemplateCanvasStatus"
import SlidesTemplateInlinePreview from "./SlidesTemplateInlinePreview"

interface SlidesTemplateCanvasSurfaceProps {
	canZoomIn: boolean
	canZoomOut: boolean
	canvasItems: Array<TemplateCanvasItem<SlidesTemplateCanvasTile>>
	canvasScale: number
	contentRef: RefObject<HTMLDivElement | null>
	favoritePendingCodes?: ReadonlySet<string>
	focusedAnchorTileId: string
	isCanvasFocusSettling: boolean
	isDragging: boolean
	isCanvasMoving: boolean
	enableIdleLoops: boolean
	isIdleAnimationActive: boolean
	isInitialLoading: boolean
	isLoading: boolean
	isLoadingMore: boolean
	isRefreshFailed: boolean
	isRefreshing: boolean
	guideAnchor: TemplateCanvasGuideAnchor | null
	onCanvasClickCapture: MouseEventHandler<HTMLDivElement>
	onCanvasActivity: () => void
	onCanvasPointerLeave: () => void
	onControlMove: ComponentProps<typeof SlidesTemplateCanvasControls>["onMove"]
	onFindSimilarColors?: (template: OptionItem) => void
	onFavoriteToggle?: (template: OptionItem) => void
	onOpenProject?: (template: OptionItem) => void
	onPointerCancel: PointerEventHandler<HTMLDivElement>
	onPointerDown: PointerEventHandler<HTMLDivElement>
	onPointerLeave: PointerEventHandler<HTMLDivElement>
	onPointerMove: PointerEventHandler<HTMLDivElement>
	onPointerUp: PointerEventHandler<HTMLDivElement>
	onPreviewClose: () => void
	onPreviewIntent?: (template: OptionItem) => void
	onPreviewToggle: (anchorTileId: string, tile: SlidesTemplateCanvasTile) => void
	onResetView: () => void
	onRetryRefresh?: () => void
	onTemplateSelect: (template: OptionItem) => void
	onZoomIn: () => void
	onZoomOut: () => void
	previewFocus: SlidesTemplatePreviewFocus | null
	selectedTemplate?: OptionItem | null
	selectedTemplateValue: string
	setViewportNode: RefCallback<HTMLDivElement>
	templateCount: number
	visibleCanvasItems: Array<TemplateCanvasItem<SlidesTemplateCanvasTile>>
}

export default function SlidesTemplateCanvasSurface({
	canZoomIn,
	canZoomOut,
	canvasItems,
	canvasScale,
	contentRef,
	favoritePendingCodes,
	focusedAnchorTileId,
	guideAnchor,
	isCanvasFocusSettling,
	isDragging,
	isCanvasMoving,
	enableIdleLoops,
	isIdleAnimationActive,
	isInitialLoading,
	isLoading,
	isLoadingMore,
	isRefreshFailed,
	isRefreshing,
	onCanvasClickCapture,
	onCanvasActivity,
	onCanvasPointerLeave,
	onControlMove,
	onFindSimilarColors,
	onFavoriteToggle,
	onOpenProject,
	onPointerCancel,
	onPointerDown,
	onPointerLeave,
	onPointerMove,
	onPointerUp,
	onPreviewClose,
	onPreviewIntent,
	onPreviewToggle,
	onResetView,
	onRetryRefresh,
	onTemplateSelect,
	onZoomIn,
	onZoomOut,
	previewFocus,
	selectedTemplate,
	selectedTemplateValue,
	setViewportNode,
	templateCount,
	visibleCanvasItems,
}: SlidesTemplateCanvasSurfaceProps) {
	const isPreviewOpen = previewFocus !== null
	const [edgeCursor, setEdgeCursor] = useState<CanvasEdgeCursor | null>(null)

	function updateEdgeCursor(event: {
		currentTarget: HTMLDivElement
		clientX: number
		clientY: number
	}) {
		if (isPreviewOpen) return
		const nextCursor = getCanvasEdgeCursor(event.currentTarget.getBoundingClientRect(), event)
		setEdgeCursor((currentCursor) =>
			currentCursor === nextCursor ? currentCursor : nextCursor,
		)
	}

	return (
		<div
			ref={setViewportNode}
			data-testid="slides-template-canvas"
			className="relative size-full touch-none select-none overflow-hidden bg-[#101114]"
			style={{
				cursor: isPreviewOpen
					? "default"
					: isDragging
						? "grabbing"
						: (edgeCursor ?? "grab"),
			}}
			onPointerEnter={(event) => {
				onCanvasActivity()
				updateEdgeCursor(event)
			}}
			onPointerDown={(event) => {
				onCanvasActivity()
				updateEdgeCursor(event)
				onPointerDown(event)
			}}
			onPointerMove={(event) => {
				onCanvasActivity()
				updateEdgeCursor(event)
				onPointerMove(event)
			}}
			onPointerUp={(event) => {
				onCanvasActivity()
				updateEdgeCursor(event)
				onPointerUp(event)
			}}
			onPointerCancel={(event) => {
				onCanvasActivity()
				setEdgeCursor(null)
				onPointerCancel(event)
			}}
			onPointerLeave={(event) => {
				onCanvasPointerLeave()
				setEdgeCursor(null)
				onPointerLeave(event)
			}}
			onWheelCapture={onCanvasActivity}
			onFocusCapture={onCanvasActivity}
			onKeyDownCapture={onCanvasActivity}
			onClickCapture={(event) => {
				onCanvasActivity()
				onCanvasClickCapture(event)
			}}
		>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 opacity-[0.24] [background-image:linear-gradient(rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px)] [background-size:72px_72px]"
			/>
			<SlidesTemplateCanvasItemsLayer
				canvasItems={canvasItems}
				contentRef={contentRef}
				favoritePendingCodes={favoritePendingCodes}
				isCanvasFocusSettling={isCanvasFocusSettling}
				isCanvasMoving={isCanvasMoving}
				enableIdleLoops={enableIdleLoops}
				isIdleAnimationActive={isIdleAnimationActive}
				keepIdleLoopsMounted={canvasScale >= 0.8}
				prioritizeCoverLoading={!isDragging && !isCanvasMoving}
				visibleCanvasItems={visibleCanvasItems}
				focusedAnchorTileId={focusedAnchorTileId}
				guideAnchor={guideAnchor}
				selectedTemplateValue={selectedTemplateValue}
				onFindSimilarColors={onFindSimilarColors}
				onFavoriteToggle={onFavoriteToggle}
				onOpenProject={onOpenProject}
				onTemplateSelect={onTemplateSelect}
				onPreviewIntent={onPreviewIntent}
				onPreviewClick={onPreviewToggle}
			/>
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#101114_0%,transparent_12%,transparent_88%,#101114_100%),linear-gradient(to_bottom,#101114_0%,transparent_14%,transparent_84%,#101114_100%)]"
			/>
			<SlidesTemplateInlinePreview
				focus={previewFocus}
				selectedTemplate={selectedTemplate}
				onClose={onPreviewClose}
				onFindSimilarColors={onFindSimilarColors}
				onTemplateSelect={onTemplateSelect}
			/>
			{isPreviewOpen ? null : (
				<SlidesTemplateCanvasControls
					scale={canvasScale}
					canZoomIn={canZoomIn}
					canZoomOut={canZoomOut}
					onZoomIn={onZoomIn}
					onZoomOut={onZoomOut}
					onReset={onResetView}
					onMove={onControlMove}
				/>
			)}
			<SlidesTemplateCanvasStatus
				isInitialLoading={isInitialLoading}
				isLoading={isLoading}
				isLoadingMore={isLoadingMore}
				isRefreshFailed={isRefreshFailed}
				isRefreshing={isRefreshing}
				onRetryRefresh={onRetryRefresh}
				templateCount={templateCount}
			/>
		</div>
	)
}
