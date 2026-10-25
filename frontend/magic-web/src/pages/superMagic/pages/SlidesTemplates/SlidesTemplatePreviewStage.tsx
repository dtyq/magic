import { Image as ImageIcon } from "lucide-react"
import { type ReactNode, type RefObject, useEffect, useMemo, useRef, useState } from "react"
import { cn } from "@/utils/cn"
import styles from "./SlidesTemplateInlinePreview.module.css"

interface SlidesTemplatePreviewStageProps {
	activeIndex: number
	navigation?: ReactNode
	pages: string[]
	previewUrl?: string
	stageRef?: RefObject<HTMLDivElement | null>
	title: string
}

const PRIORITY_PRELOAD_COUNT = 3
const DEFERRED_PRELOAD_DELAY_MS = 120
const DEFERRED_PRELOAD_STEP_MS = 45

function clampPageIndex(index: number, pageCount: number) {
	if (pageCount <= 0) return 0
	return Math.min(Math.max(index, 0), pageCount - 1)
}

function getOrderedPreviewUrls(pages: string[], activeIndex: number) {
	const ordered: string[] = []
	const used = new Set<string>()
	const safeActiveIndex = clampPageIndex(activeIndex, pages.length)

	function add(index: number) {
		const page = pages[index]
		if (!page || used.has(page)) return
		used.add(page)
		ordered.push(page)
	}

	add(safeActiveIndex)
	for (let offset = 1; offset < pages.length; offset += 1) {
		add(safeActiveIndex + offset)
		add(safeActiveIndex - offset)
	}

	return ordered
}

function usePreviewImagePreload(pages: string[], activeIndex: number) {
	const pageKey = useMemo(() => pages.join("\n"), [pages])

	useEffect(() => {
		if (!pages.length || typeof window === "undefined") return

		const images: HTMLImageElement[] = []
		const timers: number[] = []
		const orderedPages = getOrderedPreviewUrls(pages, activeIndex)

		function preload(url: string | undefined) {
			if (!url) return
			const image = new window.Image()
			image.crossOrigin = "anonymous"
			image.decoding = "async"
			image.src = url
			images.push(image)
		}

		orderedPages.forEach((page, index) => {
			const startPreload = () => {
				preload(page)
			}

			if (index < PRIORITY_PRELOAD_COUNT) {
				startPreload()
				return
			}

			timers.push(
				window.setTimeout(
					startPreload,
					DEFERRED_PRELOAD_DELAY_MS + index * DEFERRED_PRELOAD_STEP_MS,
				),
			)
		})

		return () => {
			timers.forEach((timer) => window.clearTimeout(timer))
			images.forEach((image) => {
				image.onload = null
				image.onerror = null
			})
		}
	}, [activeIndex, pageKey, pages])
}

function usePreviewImageSwap(activePage: string | undefined, resetKey: string) {
	const [displayedPage, setDisplayedPage] = useState(activePage)
	const [isLoading, setIsLoading] = useState(false)
	const displayedPageRef = useRef(activePage)
	const resetKeyRef = useRef(resetKey)

	useEffect(() => {
		if (resetKeyRef.current !== resetKey) {
			resetKeyRef.current = resetKey
			displayedPageRef.current = activePage
			setDisplayedPage(activePage)
			setIsLoading(false)
			return
		}

		if (!activePage) {
			displayedPageRef.current = undefined
			setDisplayedPage(undefined)
			setIsLoading(false)
			return
		}

		if (displayedPageRef.current === activePage) {
			setIsLoading(false)
			return
		}

		if (typeof window === "undefined") {
			displayedPageRef.current = activePage
			setDisplayedPage(activePage)
			setIsLoading(false)
			return
		}

		let cancelled = false
		const image = new window.Image()
		image.crossOrigin = "anonymous"
		image.decoding = "async"

		const commitPage = () => {
			if (cancelled) return
			displayedPageRef.current = activePage
			setDisplayedPage(activePage)
			setIsLoading(false)
		}
		const preparePage = () => {
			if (typeof image.decode !== "function") {
				commitPage()
				return
			}

			void image
				.decode()
				.catch(() => undefined)
				.then(commitPage)
		}

		setIsLoading(Boolean(displayedPageRef.current))
		image.onload = preparePage
		image.onerror = commitPage
		image.src = activePage

		if (image.complete) {
			preparePage()
		}

		return () => {
			cancelled = true
			image.onload = null
			image.onerror = null
		}
	}, [activePage, resetKey])

	return { displayedPage, isLoading }
}

function SlidesTemplatePreviewStage({
	activeIndex,
	navigation,
	pages,
	previewUrl,
	stageRef,
	title,
}: SlidesTemplatePreviewStageProps) {
	const safeActiveIndex = clampPageIndex(activeIndex, pages.length)
	const activePage = pages[safeActiveIndex]
	const pageKey = useMemo(() => pages.join("\n"), [pages])
	const { displayedPage, isLoading } = usePreviewImageSwap(activePage, pageKey)
	// The background and the foreground intentionally share one URL so each slide has one
	// network/cache entry; CSS handles the ambient presentation without another image variant.
	const ambientPage = displayedPage
	const displayedIndex = displayedPage ? pages.indexOf(displayedPage) : safeActiveIndex
	const displayedPageNumber = displayedIndex >= 0 ? displayedIndex + 1 : safeActiveIndex + 1

	usePreviewImagePreload(pages, safeActiveIndex)

	return (
		<div
			ref={stageRef}
			className="relative flex size-full min-h-0 justify-center"
			data-slides-template-preview-close-block="true"
			data-testid="slides-template-inline-preview-stage"
		>
			{displayedPage ? (
				<img
					crossOrigin="anonymous"
					src={ambientPage}
					alt=""
					className={styles.ambientPreview}
					loading="eager"
					decoding="async"
					draggable={false}
					aria-hidden="true"
					data-testid="slides-template-inline-preview-ambient-image"
				/>
			) : null}
			<div className={styles.previewShell}>
				<div
					className={cn("relative overflow-hidden bg-transparent", styles.previewFrame)}
					data-loading={isLoading ? "true" : "false"}
					data-testid="slides-template-inline-preview-pages"
				>
					{displayedPage ? (
						<img
							crossOrigin="anonymous"
							src={displayedPage}
							alt={`${title} ${displayedPageNumber}`}
							className={styles.previewPageImage}
							loading="eager"
							decoding="async"
							draggable={false}
							data-testid="slides-template-inline-preview-active-image"
						/>
					) : activePage ? (
						<div className="flex size-full items-center justify-center text-zinc-500">
							<ImageIcon className="size-6" />
						</div>
					) : previewUrl ? (
						<iframe
							data-testid="slides-template-inline-preview-iframe"
							title={title}
							src={previewUrl}
							className="size-full border-0 bg-white"
							referrerPolicy="no-referrer"
							sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
							allowFullScreen
						/>
					) : (
						<div className="flex size-full items-center justify-center text-zinc-500">
							<ImageIcon className="size-6" />
						</div>
					)}
					{isLoading ? (
						<div className={styles.pageLoadingIndicator} aria-hidden="true">
							<span />
							<span />
							<span />
						</div>
					) : null}
				</div>
				{pages.length ? (
					<div
						className={cn(
							"rounded-full px-3 py-1 text-sm font-medium text-white shadow-lg",
							styles.pagePill,
						)}
						data-testid="slides-template-inline-preview-page-index"
					>
						{safeActiveIndex + 1} / {pages.length}
					</div>
				) : null}
				{navigation}
			</div>
		</div>
	)
}

export default SlidesTemplatePreviewStage
