import { useEffect, useMemo, useRef, useState } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type { SlideItem } from "../PPTSidebar/types"
import PPTPresenterNextSlide from "./PPTPresenterNextSlide"
import { resolvePptScaleContentDimensions } from "../../../contents/HTML/utils/slide-dimensions"

const FilmstripSlide = observer(function FilmstripSlide({
	slide,
	height,
	active,
	disabled,
	viewport,
	onSelect,
	onLoad,
}: {
	slide: SlideItem
	height: number
	active: boolean
	disabled: boolean
	viewport: React.RefObject<HTMLDivElement>
	onSelect: (index: number) => void
	onLoad: (index: number) => void
}) {
	const { t } = useTranslation("super")
	const ref = useRef<HTMLButtonElement>(null)
	const [visible, setVisible] = useState(false)
	const dimensions = useMemo(
		() => resolvePptScaleContentDimensions(slide.content, slide.rawContent),
		[slide.content, slide.rawContent],
	)
	// Reserve 12px for padding/borders and 20px for the page label and gap.
	const width = (Math.max(0, height - 32) * dimensions.width) / dimensions.height + 12
	useEffect(() => {
		const node = ref.current
		if (!node) return
		// Observe against the popup's viewport and only load/render nearby previews.
		const Observer = node.ownerDocument.defaultView?.IntersectionObserver
		if (!Observer) {
			setVisible(true)
			return
		}
		const observer = new Observer(([entry]) => setVisible(entry.isIntersecting), {
			root: viewport.current,
			rootMargin: "160px",
		})
		observer.observe(node)
		return () => observer.disconnect()
	}, [viewport])
	useEffect(() => {
		if (
			visible &&
			!slide.thumbnailUrl &&
			!slide.content &&
			(!slide.loadingState || slide.loadingState === "idle")
		)
			onLoad(slide.index)
	}, [visible, slide.thumbnailUrl, slide.content, slide.loadingState, slide.index, onLoad])
	useEffect(() => {
		if (active) ref.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" })
	}, [active])
	return (
		<button
			ref={ref}
			type="button"
			aria-current={active ? "page" : undefined}
			aria-label={t("ppt.presenter.slideNumber", { number: slide.index + 1 })}
			disabled={disabled}
			onClick={() => onSelect(slide.index)}
			style={{ width, height }}
			className={`flex shrink-0 snap-center flex-col gap-1 rounded-lg border-2 p-1 text-left text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50 ${active ? "border-white bg-white/15" : "border-transparent hover:bg-white/10"}`}
		>
			<div className="pointer-events-none min-h-0 w-full flex-1 overflow-hidden rounded bg-black">
				{slide.thumbnailUrl ? (
					<img src={slide.thumbnailUrl} alt="" className="h-full w-full object-contain" />
				) : visible ? (
					<PPTPresenterNextSlide
						compact
						content={slide.content}
						rawContent={slide.rawContent}
						isLastSlide={false}
						loadingError={slide.loadingState === "error"}
					/>
				) : null}
			</div>
			<span className="h-4 w-full shrink-0 truncate px-1 text-xs leading-4">
				{slide.index + 1}
				{slide.title ? ` · ${slide.title}` : ""}
			</span>
		</button>
	)
})

export default function PPTPresenterFilmstrip({
	slides,
	indices,
	activeIndex,
	disabled,
	onSelect,
	onLoad,
}: {
	slides: SlideItem[]
	indices: number[]
	activeIndex: number
	disabled: boolean
	onSelect: (index: number) => void
	onLoad: (index: number) => void
}) {
	const { t } = useTranslation("super")
	const viewport = useRef<HTMLDivElement>(null)
	const [cardHeight, setCardHeight] = useState(120)
	useEffect(() => {
		const node = viewport.current
		if (!node) return
		// Explicit pixel heights avoid Radix's table wrapper sizing cards by their content.
		// Leave only the horizontal scrollbar gutter as the panel grows or shrinks.
		const update = (height: number) => setCardHeight(Math.max(0, height - 12))
		update(node.getBoundingClientRect().height)
		const observer = new ResizeObserver(([entry]) => update(entry.contentRect.height))
		observer.observe(node)
		return () => observer.disconnect()
	}, [])
	const scroll = (direction: number) => {
		const node = viewport.current
		if (node) node.scrollBy({ left: direction * node.clientWidth * 0.8, behavior: "auto" })
	}
	return (
		<nav
			aria-label={t("ppt.presenter.slides")}
			className="flex h-full min-h-0 items-center gap-1 rounded-xl bg-black/40 p-2"
		>
			<button
				type="button"
				onClick={() => scroll(-1)}
				aria-label={t("ppt.presenter.scrollPrevious")}
				className="rounded p-1 text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-white"
			>
				<ChevronLeft size={16} />
			</button>
			<ScrollArea
				viewportRef={viewport}
				scrollbarOrientation="horizontal"
				className="h-full min-w-0 flex-1"
				viewportClassName="h-full snap-x snap-proximity [&>div]:!h-full"
				viewportStyle={{ height: "100%" }}
			>
				<div className="flex w-max gap-2 pb-3" style={{ height: cardHeight + 12 }}>
					{indices.map(
						(index) =>
							slides[index] && (
								<FilmstripSlide
									key={slides[index].id}
									slide={slides[index]}
									height={cardHeight}
									active={index === activeIndex}
									disabled={disabled}
									viewport={viewport}
									onSelect={onSelect}
									onLoad={onLoad}
								/>
							),
					)}
				</div>
			</ScrollArea>
			<button
				type="button"
				onClick={() => scroll(1)}
				aria-label={t("ppt.presenter.scrollNext")}
				className="rounded p-1 text-white hover:bg-white/15 focus-visible:outline focus-visible:outline-white"
			>
				<ChevronRight size={16} />
			</button>
		</nav>
	)
}
