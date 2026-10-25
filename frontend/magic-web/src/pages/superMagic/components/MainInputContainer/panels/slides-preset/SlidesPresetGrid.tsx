import { useCallback, useEffect, useRef, useState, type UIEvent } from "react"
import { observer } from "mobx-react-lite"
import { motion } from "framer-motion"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import type { OptionItem } from "../types"
import { localeTextToDisplayString } from "../utils"
import SlidesPresetCard from "./SlidesPresetCard"
import SlidesPresetPreviewDialog from "./SlidesPresetPreviewDialog"
import { useFinePointerHover } from "./useFinePointerHover"

interface SlidesPresetGridProps {
	selectedTemplate?: OptionItem
	templates: OptionItem[]
	onTemplateClick?: (template: OptionItem) => void
	onFavoriteToggle?: (template: OptionItem) => void
	favoritePendingCodes?: Set<string>
	className?: string
	isLoading?: boolean
	isRefreshing?: boolean
	isLoadingMore?: boolean
	isLoadMoreFailed?: boolean
	hasMore?: boolean
	onLoadMore?: () => void
	onRetryLoadMore?: () => void
	onPreviewOpenChange?: (open: boolean) => void
	onPreviewDetailLoad?: (template: OptionItem) => Promise<OptionItem | null>
	onOpenProject?: (template: OptionItem) => void
	onRemove?: (template: OptionItem) => void
	removePendingCodes?: ReadonlySet<string>
	showHoverDetails?: boolean
	hoverDetailsContainer?: HTMLElement | null
	disableEntryAnimation?: boolean
	disableContentVisibility?: boolean
}

const containerVariants = {
	hidden: { opacity: 0 },
	visible: {
		opacity: 1,
		transition: {
			staggerChildren: 0.08,
			delayChildren: 0.1,
		},
	},
}

const itemVariants = {
	hidden: {
		opacity: 0,
		y: 40,
		scale: 0.85,
		rotateX: 10,
	},
	visible: {
		opacity: 1,
		y: 0,
		scale: 1,
		rotateX: 0,
		transition: {
			type: "spring" as const,
			stiffness: 280,
			damping: 20,
			mass: 0.8,
			duration: 0.5,
		},
	},
}

const hoverAnimation = { scale: 1.03, y: -4, zIndex: 40 }

const SlidesPresetGrid = observer(
	({
		selectedTemplate,
		templates,
		onTemplateClick,
		onFavoriteToggle,
		favoritePendingCodes,
		className,
		isLoading = false,
		isRefreshing = false,
		isLoadingMore = false,
		isLoadMoreFailed = false,
		hasMore = false,
		onLoadMore,
		onRetryLoadMore,
		onPreviewOpenChange,
		onPreviewDetailLoad,
		onOpenProject,
		onRemove,
		removePendingCodes,
		showHoverDetails = true,
		hoverDetailsContainer,
		disableEntryAnimation = false,
		disableContentVisibility = false,
	}: SlidesPresetGridProps) => {
		const { t } = useTranslation("crew/create")
		const [previewTemplate, setPreviewTemplate] = useState<OptionItem | null>(null)
		const [preloadedPreviewTemplate, setPreloadedPreviewTemplate] = useState<OptionItem | null>(
			null,
		)
		// 列表接口只返回缩略图。鼠标停留后用详情结果替换对应卡片，供悬浮详情展示拼接图。
		const [hoverDetailTemplates, setHoverDetailTemplates] = useState(
			() => new Map<string, OptionItem>(),
		)
		const gridRef = useRef<HTMLDivElement>(null)
		const loadMoreSentinelRef = useRef<HTMLDivElement>(null)
		const scrollLoadRequestedRef = useRef(false)
		const canUseHoverPreview = useFinePointerHover()
		const shouldUseContentVisibility = canUseHoverPreview && !disableContentVisibility
		const isPreviewOpen = Boolean(previewTemplate)

		useEffect(() => {
			if (isLoadingMore) return
			scrollLoadRequestedRef.current = false
		}, [hasMore, isLoadingMore, templates.length])

		useEffect(() => {
			if (!isPreviewOpen) onPreviewOpenChange?.(false)
		}, [isPreviewOpen, onPreviewOpenChange])

		useEffect(() => {
			return () => {
				onPreviewOpenChange?.(false)
			}
		}, [onPreviewOpenChange])

		function handlePreviewOpenChange(open: boolean) {
			if (open) return
			setPreviewTemplate(null)
		}

		function loadPreviewDetail(template: OptionItem) {
			if (!onPreviewDetailLoad) return Promise.resolve(template)
			return Promise.resolve(onPreviewDetailLoad(template)).then(
				(detail) => detail ?? template,
			)
		}

		function handlePreviewClick(template: OptionItem) {
			// 预览 Dialog 挂载到 body。先同步通知外层选择器，避免它把 Dialog
			// 识别成外部交互并关闭，导致预览组件随选择器一起卸载。
			onPreviewOpenChange?.(true)
			setPreviewTemplate(template)
			void loadPreviewDetail(template)
				.then((detail) => {
					setPreviewTemplate((currentTemplate) =>
						currentTemplate?.value === template.value ? detail : currentTemplate,
					)
				})
				.catch((error) => {
					console.error("Failed to fetch slides template detail for preview", error)
				})
		}

		function handlePreviewPreload(template: OptionItem) {
			void loadPreviewDetail(template)
				.then((detail) => {
					const templateValue = localeTextToDisplayString(template.value)
					setHoverDetailTemplates((currentTemplates) => {
						if (currentTemplates.get(templateValue) === detail) return currentTemplates

						const nextTemplates = new Map(currentTemplates)
						nextTemplates.set(templateValue, detail)
						return nextTemplates
					})
					if (!detail.preview_url) return
					setPreloadedPreviewTemplate(detail)
				})
				.catch((error) => {
					console.error("Failed to preload slides template detail", error)
				})
		}

		const preloadedPreviewUrl = preloadedPreviewTemplate?.preview_url
		const openedPreviewUrl = previewTemplate?.preview_url
		const selectedTemplateValue = localeTextToDisplayString(selectedTemplate?.value)
		const showEmptyState = !isLoading && templates.length === 0

		const requestLoadMore = useCallback(() => {
			if (
				!hasMore ||
				isLoading ||
				isRefreshing ||
				isLoadingMore ||
				isLoadMoreFailed ||
				scrollLoadRequestedRef.current ||
				!onLoadMore
			) {
				return
			}

			scrollLoadRequestedRef.current = true
			onLoadMore()
		}, [hasMore, isLoading, isRefreshing, isLoadingMore, isLoadMoreFailed, onLoadMore])

		useEffect(() => {
			const sentinel = loadMoreSentinelRef.current
			if (
				!sentinel ||
				!hasMore ||
				isLoading ||
				isRefreshing ||
				isLoadingMore ||
				isLoadMoreFailed ||
				!onLoadMore
			) {
				return
			}

			const grid = gridRef.current
			const root = grid && grid.scrollHeight > grid.clientHeight + 1 ? grid : null
			const observer = new IntersectionObserver(
				(entries) => {
					if (entries.some((entry) => entry.isIntersecting)) {
						requestLoadMore()
					}
				},
				{
					root,
					rootMargin: "0px 0px 160px 0px",
				},
			)

			observer.observe(sentinel)

			return () => {
				observer.disconnect()
			}
		}, [
			hasMore,
			isLoading,
			isRefreshing,
			isLoadingMore,
			isLoadMoreFailed,
			onLoadMore,
			requestLoadMore,
			templates.length,
		])

		function handleScroll(event: UIEvent<HTMLDivElement>) {
			const target = event.currentTarget
			const distanceToBottom = target.scrollHeight - target.scrollTop - target.clientHeight
			if (distanceToBottom <= 96) {
				requestLoadMore()
			}
		}

		return (
			<>
				<motion.div
					ref={gridRef}
					data-testid="slides-preset-grid"
					className={cn(
						"scrollbar-hide relative grid w-full touch-pan-y grid-cols-2 content-start gap-4 overflow-y-auto overflow-x-hidden overscroll-y-contain p-4 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
						className,
					)}
					variants={disableEntryAnimation ? undefined : containerVariants}
					initial={disableEntryAnimation ? false : "hidden"}
					animate={disableEntryAnimation ? undefined : "visible"}
					onScroll={handleScroll}
				>
					{isRefreshing && templates.length > 0 ? (
						<div
							className="pointer-events-none absolute right-4 top-3 z-30 rounded-full border border-border/70 bg-background/90 px-2.5 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur"
							data-testid="slides-preset-grid-refreshing"
						>
							{t("playbook.edit.presets.form.refreshing")}
						</div>
					) : null}
					{isLoading && templates.length === 0 ? (
						<div
							className="col-span-full flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground"
							data-testid="slides-preset-grid-loading"
						>
							{t("playbook.edit.presets.form.loading")}
						</div>
					) : null}
					{showEmptyState ? (
						<div
							className="col-span-full flex min-h-32 items-center justify-center rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground"
							data-testid="slides-preset-grid-empty"
						>
							{t("playbook.edit.presets.form.emptySlidesTemplates")}
						</div>
					) : null}
					{templates.map((template) => {
						const value = localeTextToDisplayString(template.value)
						const hoverDetailTemplate = hoverDetailTemplates.get(value)
						// 详情接口只负责补充悬浮预览字段，收藏状态以当前列表数据为准。
						// 收藏操作可能先于详情请求返回，直接使用旧详情会把乐观状态覆盖掉。
						const cardTemplate = hoverDetailTemplate
							? {
									...hoverDetailTemplate,
									is_favorite: template.is_favorite,
									project: template.project ?? hoverDetailTemplate.project,
								}
							: template

						return (
							<motion.div
								key={value}
								variants={disableEntryAnimation ? undefined : itemVariants}
								whileInView={disableEntryAnimation ? undefined : "visible"}
								initial={disableEntryAnimation ? false : "hidden"}
								viewport={
									disableEntryAnimation ? undefined : { once: true, amount: 0.1 }
								}
								whileHover={canUseHoverPreview ? hoverAnimation : undefined}
								transition={
									disableEntryAnimation
										? undefined
										: { type: "spring", stiffness: 300, damping: 20 }
								}
								className={cn(
									"relative flex size-full",
									shouldUseContentVisibility &&
										"[contain-intrinsic-size:260px] [content-visibility:auto]",
									canUseHoverPreview && "will-change-transform",
								)}
							>
								<SlidesPresetCard
									template={cardTemplate}
									isSelected={selectedTemplateValue === value}
									onClick={onTemplateClick}
									onFavoriteToggle={onFavoriteToggle}
									onOpenProject={onOpenProject}
									onRemove={onRemove}
									removePending={removePendingCodes?.has(value)}
									favoritePending={favoritePendingCodes?.has(value)}
									onPreviewClick={handlePreviewClick}
									onPreviewPreload={handlePreviewPreload}
									canUseHoverPreview={canUseHoverPreview}
									showHoverDetails={showHoverDetails}
									hoverDetailsContainer={hoverDetailsContainer}
								/>
							</motion.div>
						)
					})}
					{hasMore ? (
						<div
							ref={loadMoreSentinelRef}
							className="col-span-full h-px"
							aria-hidden="true"
							data-testid="slides-preset-grid-load-more-sentinel"
						/>
					) : null}
					{templates.length > 0 && isLoadingMore ? (
						<div
							className="col-span-full flex items-center justify-center px-4 py-3 text-sm text-muted-foreground"
							data-testid="slides-preset-grid-loading-more"
						>
							{t("playbook.edit.presets.form.loadingMore")}
						</div>
					) : null}
					{templates.length > 0 && isLoadMoreFailed ? (
						<div className="col-span-full flex items-center justify-center py-3">
							<Button
								type="button"
								variant="link"
								size="sm"
								onClick={onRetryLoadMore}
								data-testid="slides-preset-grid-load-more-retry"
							>
								{t("playbook.edit.presets.form.loadMoreFailed")}
							</Button>
						</div>
					) : null}
				</motion.div>
				{preloadedPreviewUrl && preloadedPreviewUrl !== openedPreviewUrl ? (
					<iframe
						data-testid="slides-preset-preview-preload-iframe"
						title="Preload slide preset preview"
						src={preloadedPreviewUrl}
						className="pointer-events-none fixed size-px opacity-0"
						aria-hidden="true"
						tabIndex={-1}
						referrerPolicy="no-referrer"
						sandbox="allow-forms allow-popups allow-same-origin allow-scripts"
					/>
				) : null}
				<SlidesPresetPreviewDialog
					template={previewTemplate}
					open={isPreviewOpen}
					onOpenChange={handlePreviewOpenChange}
					onSelect={onTemplateClick}
				/>
			</>
		)
	},
)

SlidesPresetGrid.displayName = "SlidesPresetGrid"

export default SlidesPresetGrid
