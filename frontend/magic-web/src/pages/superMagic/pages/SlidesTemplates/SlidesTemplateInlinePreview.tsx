import {
	Check,
	ChevronLeft,
	ChevronRight,
	Image as ImageIcon,
	MousePointerClick,
	Palette,
	X,
} from "lucide-react"
import { type MouseEvent, useCallback, useEffect, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import HeadlessHorizontalScroll from "@/components/base/HeadlessHorizontalScroll"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import { formatNumber } from "@/utils/format"
import { useCenteredHorizontalScroll } from "@/pages/superMagic/components/MainInputContainer/hooks/useCenteredHorizontalScroll"
import {
	useSlidesPreviewNavigation,
	useSlidesPreviewWheelNavigation,
} from "@/pages/superMagic/components/MainInputContainer/hooks/useSlidesPreviewNavigation"
import { useLocaleText } from "@/pages/superMagic/components/MainInputContainer/panels/hooks/useLocaleText"
import type { OptionItem } from "@/pages/superMagic/components/MainInputContainer/panels/types"
import {
	FEATURED_SLIDES_TEMPLATE_TAG_CODE,
	getSlidesTemplateTagDisplayName,
	hasSlidesTemplateUsageCount,
} from "@/pages/superMagic/components/MainInputContainer/panels/slides-preset/templateMeta"
import {
	type SlidesTemplatePreviewFocus,
	getTemplateCoverUrl,
	getTemplateKey,
	getTemplatePreviewUrls,
} from "./canvasInteraction"
import { getSlidesTemplatePreviewImageUrl } from "./slidesTemplateImages"
import styles from "./SlidesTemplateInlinePreview.module.css"
import SlidesTemplatePreviewStage from "./SlidesTemplatePreviewStage"
import SlidesTemplateColorPalette from "./SlidesTemplateColorPalette"
import SlidesTemplateThumbnailRailScrollControl from "./SlidesTemplateThumbnailRailScrollControl"
import { applyResolvedTemplateColors, templateColorToRgba } from "./templateColors"
import { useResolvedTemplateColors } from "./useResolvedTemplateColors"

interface SlidesTemplateInlinePreviewProps {
	focus: SlidesTemplatePreviewFocus | null
	onClose: () => void
	onFindSimilarColors?: (template: OptionItem) => void
	onTemplateSelect: (template: OptionItem) => void
	selectedTemplate?: OptionItem | null
}

const PREVIEW_AUTO_DISMISS_MS = 9000
const PREVIEW_BACKGROUND_CLOSE_BLOCK_SELECTOR =
	'button, a, input, textarea, select, iframe, [data-slides-template-preview-close-block="true"]'

function getInitialPageIndex(focus: SlidesTemplatePreviewFocus, pages: string[]) {
	if (!focus.tile.imageUrl) return 0
	const normalizedImageUrl = getSlidesTemplatePreviewImageUrl(focus.tile.imageUrl)
	const matchedIndex = pages.findIndex((page) => page === normalizedImageUrl)
	return matchedIndex >= 0 ? matchedIndex : 0
}

export default function SlidesTemplateInlinePreview({
	focus,
	onClose,
	onFindSimilarColors,
	onTemplateSelect,
	selectedTemplate,
}: SlidesTemplateInlinePreviewProps) {
	const lt = useLocaleText()
	const { t, i18n } = useTranslation("crew/create")
	const autoDismissTimerRef = useRef<number | null>(null)
	const previewStageRef = useRef<HTMLDivElement | null>(null)
	const onCloseRef = useRef(onClose)
	const template = focus?.tile.template
	const colorImageUrl = template ? getTemplateCoverUrl(template) : undefined
	const colors = useResolvedTemplateColors({
		colors: template?.colors,
		imageUrl: colorImageUrl,
		priority: "interactive",
	})
	const pages = useMemo(
		() => getTemplatePreviewUrls(template).map(getSlidesTemplatePreviewImageUrl),
		[template],
	)
	const pageKey = useMemo(() => pages.join("\n"), [pages])
	const initialIndex = focus ? getInitialPageIndex(focus, pages) : 0

	useEffect(() => {
		onCloseRef.current = onClose
	}, [onClose])

	const clearAutoDismissTimer = useCallback(() => {
		if (autoDismissTimerRef.current == null) return
		window.clearTimeout(autoDismissTimerRef.current)
		autoDismissTimerRef.current = null
	}, [])

	const resetAutoDismissTimer = useCallback(() => {
		if (typeof window === "undefined") return
		clearAutoDismissTimer()
		autoDismissTimerRef.current = window.setTimeout(() => {
			autoDismissTimerRef.current = null
			onCloseRef.current()
		}, PREVIEW_AUTO_DISMISS_MS)
	}, [clearAutoDismissTimer])
	const handleClosePreview = useCallback(() => onCloseRef.current(), [])

	useEffect(() => {
		if (!focus) {
			clearAutoDismissTimer()
			return
		}

		resetAutoDismissTimer()
		return () => {
			clearAutoDismissTimer()
		}
	}, [clearAutoDismissTimer, focus, resetAutoDismissTimer])

	const {
		activeIndex: safeActiveIndex,
		canSwitch,
		goToNext: handleNextPage,
		goToPage: handleSelectPage,
		goToPrevious: handlePreviousPage,
	} = useSlidesPreviewNavigation({
		enabled: Boolean(focus),
		initialIndex,
		onEscape: handleClosePreview,
		onInteraction: resetAutoDismissTimer,
		pageCount: pages.length,
		resetKey: `${focus?.anchorTileId ?? ""}:${focus?.tile.id ?? ""}:${pageKey}`,
	})
	const { scrollContainerRef, setItemRef } = useCenteredHorizontalScroll({
		activeKey: String(safeActiveIndex),
		itemCount: pages.length,
	})

	useSlidesPreviewWheelNavigation({
		containerRef: previewStageRef,
		enabled: canSwitch,
		onNext: handleNextPage,
		onPrevious: handlePreviousPage,
	})

	if (!focus || !template) return null

	const title = lt(template.preview_title) ?? lt(template.label) ?? lt(template.value) ?? ""
	const tagLabels = (template.tags ?? []).map((tag) => ({
		code: tag.code,
		label: getSlidesTemplateTagDisplayName(tag, i18n.language, {
			zh_CN: tag.code,
			en_US: tag.code,
		}),
	}))
	const featuredTagLabel = tagLabels.find((tag) => tag.code === FEATURED_SLIDES_TEMPLATE_TAG_CODE)
	const regularTagLabels = tagLabels.filter(
		(tag) => tag.code !== FEATURED_SLIDES_TEMPLATE_TAG_CODE,
	)
	const description =
		lt(template.preview_description) ?? lt(template.description) ?? lt(template.sub_text)
	const showUsageCount = hasSlidesTemplateUsageCount(template)
	const usageCount = Math.max(0, template.usage_count ?? 0)
	const formattedUsageCount = formatNumber(usageCount)
	const previewImageUrl = focus.tile.imageUrl ?? colorImageUrl
	const templateKey = getTemplateKey(template)
	const isSelected = selectedTemplate ? getTemplateKey(selectedTemplate) === templateKey : false
	const primaryAmbientColor = templateColorToRgba(colors[0], 0.18)

	function handleUseTemplate() {
		if (template) {
			onTemplateSelect(template)
		}
		onClose()
	}

	function handleFindSimilarColors() {
		if (template) {
			onFindSimilarColors?.(applyResolvedTemplateColors(template, colors))
		}
		onClose()
	}

	function handlePreviewBackgroundClick(event: MouseEvent<HTMLDivElement>) {
		const target = event.target
		if (!(target instanceof Element)) return
		if (target.closest(PREVIEW_BACKGROUND_CLOSE_BLOCK_SELECTOR)) return

		onClose()
	}

	return (
		<>
			<button
				type="button"
				aria-label={t("playbook.edit.presets.close")}
				className={cn("absolute inset-0 z-10", styles.backdrop)}
				data-slides-template-drag-block="true"
				data-testid="slides-template-inline-preview-backdrop"
				onClick={onClose}
			/>
			<div
				className={cn(
					"pointer-events-auto absolute bottom-5 left-1/2 top-5 z-20 flex min-h-0 w-[calc(100%-48px)] flex-col",
					styles.stage,
				)}
				data-slides-template-drag-block="true"
				data-testid="slides-template-inline-preview"
				onFocusCapture={resetAutoDismissTimer}
				onMouseEnter={resetAutoDismissTimer}
				onPointerDown={resetAutoDismissTimer}
			>
				<div
					className={styles.showcase}
					data-testid="slides-template-inline-preview-showcase"
					onClick={handlePreviewBackgroundClick}
				>
					<div
						className={cn(
							"mx-auto flex w-full min-w-0 shrink-0 items-center gap-4 px-4 py-3",
							styles.infoBar,
						)}
						data-slides-template-preview-close-block="true"
					>
						{primaryAmbientColor ? (
							<div
								aria-hidden="true"
								className="pointer-events-none absolute inset-0"
								style={{
									backgroundImage: `radial-gradient(circle at 20% 0%, ${primaryAmbientColor}, transparent 38%)`,
								}}
							/>
						) : null}
						<div
							className={cn(
								"relative aspect-video w-32 shrink-0 overflow-hidden rounded-2xl bg-zinc-900 sm:w-40",
								styles.cover,
							)}
							data-testid="slides-template-inline-preview-cover"
						>
							{previewImageUrl ? (
								<img
									crossOrigin="anonymous"
									src={previewImageUrl}
									alt={title}
									className="size-full object-cover"
									loading="eager"
									decoding="async"
									draggable={false}
								/>
							) : (
								<div className="flex size-full items-center justify-center text-white/55">
									<ImageIcon className="size-5" />
								</div>
							)}
						</div>
						<div className="min-w-0 flex-1">
							<div className="flex min-w-0 flex-col items-start gap-1.5">
								<div className="flex w-full min-w-0 items-center gap-2">
									<div
										className="min-w-0 truncate text-base font-semibold leading-6 text-white"
										data-testid="slides-template-inline-preview-title"
									>
										{title}
									</div>
									{featuredTagLabel || showUsageCount ? (
										<div className="flex shrink-0 items-center gap-2">
											{featuredTagLabel ? (
												<span
													className="inline-flex max-w-24 shrink-0 truncate rounded-full border border-amber-200/50 bg-amber-300/20 px-1.5 py-0.5 text-[10px] font-medium leading-3 text-amber-100 backdrop-blur-md"
													data-testid="slides-template-inline-preview-featured-tag"
												>
													{featuredTagLabel.label}
												</span>
											) : null}
											{showUsageCount ? (
												<div
													className="inline-flex items-center gap-1 text-xs font-medium text-white/[0.72]"
													data-testid="slides-template-inline-preview-usage-count"
												>
													<MousePointerClick
														className="size-3.5"
														aria-hidden="true"
													/>
													<span>{formattedUsageCount}</span>
												</div>
											) : null}
										</div>
									) : null}
								</div>
								{regularTagLabels.length > 0 ? (
									<div
										className="flex max-w-full flex-wrap items-center gap-1"
										data-testid="slides-template-inline-preview-tags"
									>
										{regularTagLabels.map((tag) => (
											<span
												key={tag.code}
												className="inline-flex max-w-24 shrink-0 truncate rounded-full border border-white/[0.16] bg-black/[0.18] px-1.5 py-0.5 text-[10px] font-medium leading-3 text-white/[0.82] backdrop-blur-md"
											>
												{tag.label}
											</span>
										))}
									</div>
								) : null}
							</div>
							{description ? (
								<div
									className="mt-1 line-clamp-2 text-sm leading-5 text-white/[0.68]"
									data-testid="slides-template-inline-preview-description"
								>
									{description}
								</div>
							) : null}
							<SlidesTemplateColorPalette className="mt-2" colors={colors} compact />
						</div>
						<div className="flex shrink-0 items-center gap-2">
							{onFindSimilarColors && colors.length > 0 ? (
								<Button
									type="button"
									size="sm"
									variant="ghost"
									className={cn(
										"h-9 rounded-full px-3 text-white/75 hover:text-white",
										styles.iconAction,
									)}
									onClick={handleFindSimilarColors}
									data-testid="slides-template-inline-preview-similar-colors"
								>
									<Palette className="mr-1.5 size-4" />
									{t("playbook.edit.presets.form.similarColors")}
								</Button>
							) : null}
							<Button
								type="button"
								size="sm"
								className={cn(
									"h-9 rounded-full px-4 font-semibold shadow-lg backdrop-blur-xl",
									styles.primaryAction,
									isSelected && styles.primaryActionSelected,
								)}
								onClick={handleUseTemplate}
								data-testid="slides-template-inline-preview-use-button"
							>
								<Check className="mr-1.5 size-4" />
								{t(
									isSelected
										? "playbook.edit.presets.form.selected"
										: "playbook.edit.presets.form.useTemplate",
								)}
							</Button>
							<Button
								type="button"
								size="icon"
								variant="ghost"
								className={cn(
									"size-9 rounded-full text-white/70 hover:text-white",
									styles.iconAction,
								)}
								aria-label={t("playbook.edit.presets.close")}
								onClick={onClose}
								data-testid="slides-template-inline-preview-close"
							>
								<X className="size-4" />
							</Button>
						</div>
					</div>
					<div
						className={cn(
							"mx-auto flex w-full flex-1 items-stretch justify-center",
							styles.viewerRow,
						)}
					>
						<SlidesTemplatePreviewStage
							activeIndex={safeActiveIndex}
							navigation={
								canSwitch ? (
									<>
										<Button
											type="button"
											variant="secondary"
											size="icon"
											className={cn(
												"size-12 rounded-full text-white",
												styles.sideButton,
												styles.sideButtonPrevious,
											)}
											aria-label={`${title} previous page`}
											onClick={handlePreviousPage}
											data-testid="slides-template-inline-preview-previous-button"
										>
											<ChevronLeft className="size-[22px]" />
										</Button>
										<Button
											type="button"
											variant="secondary"
											size="icon"
											className={cn(
												"size-12 rounded-full text-white",
												styles.sideButton,
												styles.sideButtonNext,
											)}
											aria-label={`${title} next page`}
											onClick={handleNextPage}
											data-testid="slides-template-inline-preview-next-button"
										>
											<ChevronRight className="size-[22px]" />
										</Button>
									</>
								) : null
							}
							pages={pages}
							previewUrl={template.preview_url}
							stageRef={previewStageRef}
							title={title}
						/>
					</div>
					{canSwitch ? (
						<div
							className="mx-auto h-[140px] w-full shrink-0"
							data-slides-template-preview-close-block="true"
						>
							<HeadlessHorizontalScroll
								className={cn("h-full rounded-2xl", styles.thumbnailRail)}
								controlBackground="transparent"
								hideScrollbar={false}
								renderLeftControl={({ scroll }) => (
									<SlidesTemplateThumbnailRailScrollControl
										direction="left"
										onClick={() => scroll("left")}
										title={title}
									/>
								)}
								renderRightControl={({ scroll }) => (
									<SlidesTemplateThumbnailRailScrollControl
										direction="right"
										onClick={() => scroll("right")}
										title={title}
									/>
								)}
								scrollContainerClassName="scrollbar-x-thin flex h-full items-center gap-2 overflow-x-auto overflow-y-hidden px-3 py-2"
								scrollContainerRef={scrollContainerRef}
								scrollStep={280}
								data-testid="slides-template-inline-preview-thumbnail-rail"
							>
								{pages.map((page, index) => (
									<div
										key={`${page}-${index}`}
										ref={(element) => setItemRef(String(index), element)}
										className="h-full shrink-0"
									>
										<button
											type="button"
											aria-label={`${title} ${index + 1}`}
											onClick={() => handleSelectPage(index)}
											className={cn(
												"relative aspect-video h-full overflow-hidden rounded-lg transition",
												styles.thumbnail,
												safeActiveIndex === index && styles.thumbnailActive,
											)}
											data-testid="slides-template-inline-preview-thumbnail"
										>
											<img
												crossOrigin="anonymous"
												src={page}
												alt=""
												className="size-full object-cover"
												loading={index <= 4 ? "eager" : "lazy"}
												decoding="async"
												draggable={false}
												aria-hidden="true"
											/>
											<span
												className={styles.thumbnailIndex}
												aria-hidden="true"
												data-testid="slides-template-inline-preview-thumbnail-index"
											>
												{index + 1}
											</span>
										</button>
									</div>
								))}
							</HeadlessHorizontalScroll>
						</div>
					) : null}
				</div>
			</div>
		</>
	)
}
