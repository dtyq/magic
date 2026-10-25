import { useEffect, useMemo, useRef } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import { useCenteredHorizontalScroll } from "../../hooks/useCenteredHorizontalScroll"
import {
	useSlidesPreviewNavigation,
	useSlidesPreviewWheelNavigation,
} from "../../hooks/useSlidesPreviewNavigation"
import { getSlidesTemplatePreviewImageUrl } from "@/pages/superMagic/pages/SlidesTemplates/slidesTemplateImages"

interface SlidesPresetPreviewPagesProps {
	className?: string
	dataTestIdPrefix?: string
	iframeClassName?: string
	initialIndex?: number
	keyboardEnabled?: boolean
	mainFrameClassName?: string
	onEscape?: () => void
	pages: string[]
	previewUrl?: string
	resetKey?: string
	showThumbnails?: boolean
	thumbnailButtonClassName?: string
	title: string
}

function SlidesPresetPreviewPages({
	className,
	dataTestIdPrefix = "slides-preset-preview-dialog",
	iframeClassName,
	initialIndex = 0,
	keyboardEnabled = true,
	mainFrameClassName,
	onEscape,
	pages,
	previewUrl,
	resetKey,
	showThumbnails = true,
	thumbnailButtonClassName,
	title,
}: SlidesPresetPreviewPagesProps) {
	const previewPages = useMemo(() => pages.map(getSlidesTemplatePreviewImageUrl), [pages])
	const pageKey = useMemo(() => previewPages.join("\n"), [previewPages])
	const previewStageRef = useRef<HTMLDivElement | null>(null)
	const { activeIndex, canSwitch, goToNext, goToPage, goToPrevious } = useSlidesPreviewNavigation(
		{
			enabled: keyboardEnabled,
			initialIndex,
			onEscape,
			pageCount: previewPages.length,
			resetKey: `${resetKey ?? ""}:${pageKey}`,
		},
	)
	const activePage = previewPages[activeIndex] ?? previewPages[0]
	const { scrollContainerRef, setItemRef } = useCenteredHorizontalScroll({
		activeKey: String(activeIndex),
		itemCount: previewPages.length,
	})

	useEffect(() => {
		if (!previewPages.length || typeof window === "undefined") return

		const preloadImages = previewPages.map((page) => {
			const image = new window.Image()
			image.crossOrigin = "anonymous"
			image.decoding = "async"
			image.src = page
			return image
		})

		return () => {
			preloadImages.forEach((image) => {
				image.onload = null
				image.onerror = null
			})
		}
	}, [pageKey, previewPages])

	useSlidesPreviewWheelNavigation({
		containerRef: previewStageRef,
		enabled: canSwitch,
		onNext: goToNext,
		onPrevious: goToPrevious,
	})

	if (previewPages.length && activePage) {
		return (
			<div className={cn("flex min-h-0 flex-col gap-3 overflow-hidden", className)}>
				<div className="relative w-full shrink-0">
					<div
						ref={previewStageRef}
						className={cn(
							"relative mx-auto aspect-video w-[min(100%,calc(clamp(280px,52vh,680px)*16/9))] overflow-hidden rounded-md border border-border/60 bg-white shadow-sm",
							mainFrameClassName,
						)}
						data-testid={`${dataTestIdPrefix}-pages`}
					>
						<img
							crossOrigin="anonymous"
							src={activePage}
							alt={`${title} ${activeIndex + 1}`}
							className="size-full object-contain"
							loading="eager"
							decoding="async"
						/>
					</div>
					<div
						className="absolute bottom-0 right-0 text-sm font-medium text-neutral-500"
						data-testid={`${dataTestIdPrefix}-page-index`}
					>
						{activeIndex + 1} / {previewPages.length}
					</div>
				</div>
				{canSwitch && showThumbnails ? (
					<HeadlessHorizontalScroll
						className="shrink-0 overflow-hidden rounded-xl border border-neutral-950/[0.10] bg-neutral-950/[0.08] p-2 shadow-sm backdrop-blur-xl"
						controlBackground="rgba(245,245,245,0.92)"
						scrollContainerRef={scrollContainerRef}
						scrollContainerClassName="no-scrollbar flex gap-4 overflow-x-auto overflow-y-hidden p-1.5"
						scrollStep={280}
						data-testid={`${dataTestIdPrefix}-thumbnail-strip`}
						renderLeftControl={({ scroll }) => (
							<div className="pointer-events-none absolute left-0 top-0 z-10 flex h-full w-12 items-center justify-start">
								<Button
									type="button"
									variant="secondary"
									size="icon"
									className="pointer-events-auto ml-2 size-9 rounded-full border border-border/70 bg-white text-neutral-900 shadow-md hover:bg-white"
									onClick={() => scroll("left")}
								>
									<ChevronLeft className="size-4" />
								</Button>
							</div>
						)}
						renderRightControl={({ scroll }) => (
							<div className="pointer-events-none absolute right-0 top-0 z-10 flex h-full w-12 items-center justify-end">
								<Button
									type="button"
									variant="secondary"
									size="icon"
									className="pointer-events-auto mr-2 size-9 rounded-full border border-border/70 bg-white text-neutral-900 shadow-md hover:bg-white"
									onClick={() => scroll("right")}
								>
									<ChevronRight className="size-4" />
								</Button>
							</div>
						)}
					>
						{previewPages.map((page, index) => (
							<div
								key={`${page}-${index}`}
								ref={(element) => setItemRef(String(index), element)}
								className="shrink-0"
							>
								<button
									type="button"
									aria-label={`${title} ${index + 1}`}
									onClick={() => goToPage(index)}
									className={cn(
										"relative aspect-video w-[156px] overflow-hidden rounded-md border bg-white shadow-sm transition sm:w-[220px] xl:w-[264px]",
										activeIndex === index
											? "border-neutral-950 ring-2 ring-neutral-950"
											: "border-border/60 hover:border-primary/50",
										thumbnailButtonClassName,
									)}
								>
									<img
										crossOrigin="anonymous"
										src={page}
										alt=""
										className="size-full object-cover"
										loading="eager"
										decoding="async"
										draggable={false}
										aria-hidden="true"
									/>
									<span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
										{index + 1}
									</span>
								</button>
							</div>
						))}
					</HeadlessHorizontalScroll>
				) : null}
			</div>
		)
	}

	if (!previewUrl) return null

	return (
		<div className={cn("min-h-0", className)}>
			<iframe
				data-testid={`${dataTestIdPrefix}-iframe`}
				title={title}
				src={previewUrl}
				className={cn(
					"size-full rounded-md border border-border/60 bg-white shadow-sm",
					iframeClassName,
				)}
				referrerPolicy="no-referrer"
				sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
				allowFullScreen
			/>
		</div>
	)
}

export default SlidesPresetPreviewPages
