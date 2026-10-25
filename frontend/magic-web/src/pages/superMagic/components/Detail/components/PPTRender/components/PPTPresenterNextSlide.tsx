import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { resolvePptScaleContentDimensions } from "../../../contents/HTML/utils/slide-dimensions"
import { stripSlideNotes } from "../utils/slideNotes"

interface PPTPresenterNextSlideProps {
	current?: boolean
	compact?: boolean
	content?: string
	rawContent?: string
	isLastSlide: boolean
	loadingError?: boolean
	onRetry?: () => void
}

/** A passive preview: the audience window remains the only interactive slide surface. */
export default function PPTPresenterNextSlide({
	current = false,
	compact = false,
	content,
	rawContent,
	isLastSlide,
	loadingError = false,
	onRetry,
}: PPTPresenterNextSlideProps) {
	const { t } = useTranslation("super")
	const viewportRef = useRef<HTMLDivElement>(null)
	const [viewport, setViewport] = useState({ width: 0, height: 0 })
	const dimensions = useMemo(
		() => resolvePptScaleContentDimensions(content, rawContent),
		[content, rawContent],
	)
	const preview = useMemo(() => (content ? stripSlideNotes(content) : ""), [content])
	useEffect(() => {
		const element = viewportRef.current
		if (!element) return
		const observer = new ResizeObserver(([entry]) => {
			setViewport({ width: entry.contentRect.width, height: entry.contentRect.height })
		})
		observer.observe(element)
		return () => observer.disconnect()
	}, [])
	const scale = Math.min(viewport.width / dimensions.width, viewport.height / dimensions.height)

	return (
		<section
			className="flex h-full min-h-0 min-w-0 flex-col gap-2"
			data-testid={current ? "ppt-presenter-current-slide" : "ppt-presenter-next-slide"}
		>
			{!compact && (
				<h2 className="shrink-0 text-sm text-white/70">
					{current ? t("ppt.speakerNotes.currentPage") : t("ppt.presenter.nextSlide")}
				</h2>
			)}
			<div
				ref={viewportRef}
				className="relative min-h-0 flex-1 overflow-hidden rounded-lg bg-black"
			>
				{isLastSlide || !preview ? (
					<div
						role="status"
						className="flex h-full items-center justify-center gap-2 text-sm text-white/70"
					>
						{!isLastSlide && !loadingError && (
							<Loader2 className="size-4 animate-spin" />
						)}
						{isLastSlide
							? t("ppt.presenter.endOfPresentation")
							: loadingError
								? t("ppt.presenter.loadNextSlideFailed")
								: t("ppt.presenter.loadingNextSlide")}
						{!isLastSlide && loadingError && onRetry && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onRetry}
								className="text-white hover:bg-white/15 hover:text-white"
							>
								{t("ppt.speakerNotes.retry")}
							</Button>
						)}
					</div>
				) : (
					// Preserve the slide's canonical canvas and contain it without cropping.
					<iframe
						// Keep scripts isolated and prevent focus entering the next-slide preview.
						ref={(element) => element?.setAttribute("inert", "")}
						title={
							current
								? t("ppt.speakerNotes.currentPage")
								: t("ppt.presenter.nextSlide")
						}
						sandbox="allow-scripts"
						tabIndex={-1}
						aria-hidden
						srcDoc={preview}
						className="pointer-events-none absolute origin-top-left border-0"
						style={{
							width: dimensions.width,
							height: dimensions.height,
							left: (viewport.width - dimensions.width * scale) / 2,
							top: (viewport.height - dimensions.height * scale) / 2,
							transform: `scale(${scale})`,
						}}
					/>
				)}
			</div>
		</section>
	)
}
