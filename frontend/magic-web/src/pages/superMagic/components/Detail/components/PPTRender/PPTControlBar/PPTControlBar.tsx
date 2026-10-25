import { useState, useRef } from "react"
import { useSize } from "ahooks"
import { useTranslation } from "react-i18next"
import {
	ChevronLeft,
	ChevronRight,
	Home,
	Maximize,
	Minimize,
	Ellipsis,
	RefreshCw,
	RotateCw,
	PanelsTopLeft,
	NotebookPen,
	Monitor,
	Check,
} from "lucide-react"
import type { PPTControlBarProps } from "./types"
import { PPTZoomControl } from "./PPTZoomControl"
import { cn } from "@/utils/cn"
import { Button } from "@/components/shadcn-ui/button"
import { MagicDropdown, MagicTooltip } from "@/components/base"
import { PPTAnimationControls } from "./PPTAnimationControls"
import { FileSaveSyncBadge } from "../../FileSaveSyncBadge"

export function PPTControlBar({
	activeIndex,
	totalSlides,
	buildProgress,
	canGoPrevious = activeIndex > 0,
	canGoNext = activeIndex < totalSlides - 1,
	isTransitioning,
	isMobile,
	isFullscreen,
	isStarting = false,
	onPrevSlide,
	onNextSlide,
	onGoToFirstSlide,
	onRefreshSlides,
	refreshAllProgress,
	onRefreshCurrentSlide,
	isRefreshingCurrentSlide,
	onJumpToPage,
	onToggleFullscreen,
	presenterScreens,
	selectedPresenterScreen,
	onSelectPresenterScreen,
	onReplaceTemplate,
	notesVisible,
	onToggleNotes,
	onOpenTransitions,
	onToggleBuildPanel,
	buildPanelOpen,
	animationOnly,
	scaleRatio,
	isAutoScale,
	portalContainer,
	onScaleChange,
	onResetScale,
	className,
	rightInset,
	currentFileId,
}: PPTControlBarProps) {
	const { t } = useTranslation("super")
	const fullscreenLabel = isStarting
		? t("ppt.presenter.cancelStart")
		: isFullscreen
			? t("fileViewer.exitFullscreen")
			: t("ppt.startSlideshow")
	const isRefreshingAll = Boolean(refreshAllProgress)
	const [jumpPageInput, setJumpPageInput] = useState<string>("")
	const [isPageInputVisible, setIsPageInputVisible] = useState(false)
	const pageInputRef = useRef<HTMLInputElement>(null)
	const containerRef = useRef<HTMLDivElement>(null)
	const containerSize = useSize(containerRef)
	const barClassName =
		"pointer-events-auto flex w-max max-w-full items-center gap-1 rounded-[9px] border border-[#dfe2e7]/50 bg-white p-[5px] text-[#252830] shadow-[0_1px_2px_#17213b08,0_3px_8px_#17213b08] dark:border-[#4b515b]/55 dark:bg-[#292c33] dark:text-[#eef0f4] dark:shadow-[0_1px_2px_#00000020,0_3px_8px_#00000015] [&_button]:rounded-[5px] [&_button]:text-[13px] [&_button]:font-normal [&_button]:leading-[1.5] [&_button]:text-inherit [&_button:hover]:bg-[#f0f2f6] dark:[&_button:hover]:bg-[#3a3f49] [&_svg]:stroke-[1.7]"
	// Keep the bar clear of a side panel that is docked inside the stage.
	const containerStyle = { left: 8, right: rightInset ?? 8 }

	// Handle page jump
	function handleJumpToPage(pageNum: string) {
		if (!pageNum.trim()) {
			setJumpPageInput("")
			return
		}

		const num = parseInt(pageNum, 10)

		// Validate input
		if (isNaN(num)) {
			console.warn("Invalid page number:", pageNum)
			setJumpPageInput("")
			return
		}

		// Range check
		if (num < 1 || num > totalSlides) {
			console.warn(`Page number out of range: ${num}, valid range: 1-${totalSlides}`)
			setJumpPageInput("")
			return
		}

		// Check if transitioning
		if (isTransitioning) {
			setJumpPageInput("")
			return
		}

		// Jump to the specified page (page numbers start from 1, indices from 0)
		onJumpToPage(num - 1)
		setJumpPageInput("")
	}

	// Editing keeps the animation entry available while page navigation stays hidden.
	if (animationOnly)
		return (
			<div
				ref={containerRef}
				data-testid="ppt-control-bar"
				style={containerStyle}
				className={cn(
					"pointer-events-none absolute bottom-[18px] z-50 flex justify-center",
					className,
				)}
			>
				<div className={barClassName}>
					<PPTAnimationControls
						onOpenTransitions={onOpenTransitions}
						onToggleBuildPanel={onToggleBuildPanel}
						buildPanelOpen={buildPanelOpen}
					/>
				</div>
			</div>
		)

	return (
		<div
			ref={containerRef}
			data-testid="ppt-control-bar"
			style={containerStyle}
			className={cn(
				"pointer-events-none absolute z-50 flex flex-wrap items-center justify-center gap-2",
				isMobile ? "bottom-[20px]" : "bottom-[18px]",
				className,
			)}
		>
			<div
				// 显式约束主块宽度，防止按钮被英文文案撑出预览区。
				style={{ maxWidth: containerSize?.width }}
				className={cn(barClassName, "flex-wrap justify-center")}
			>
				{buildProgress && buildProgress.total > 0 && (
					<span className="px-1 text-xs tabular-nums" aria-live="polite">
						{t("ppt.build.progress", buildProgress)}
					</span>
				)}
				<div className="flex items-center gap-1">
					{/* Previous button */}
					<MagicTooltip
						title={
							isMobile
								? undefined
								: buildProgress && buildProgress.step > 0
									? t("ppt.build.previous")
									: t("fileViewer.previousPage")
						}
					>
						<span>
							<Button
								variant="ghost"
								size="sm"
								data-testid="ppt-control-bar-prev-button"
								className="h-7 w-7 p-0"
								onClick={(e) => {
									e.stopPropagation()
									e.currentTarget.blur()
									onPrevSlide()
								}}
								aria-label={
									buildProgress && buildProgress.step > 0
										? t("ppt.build.previous")
										: t("fileViewer.previousPage")
								}
								disabled={!canGoPrevious || isTransitioning}
							>
								<ChevronLeft className="h-4 w-4" />
							</Button>
						</span>
					</MagicTooltip>

					{/* Page indicator and jump input */}
					<div className="flex shrink-0 items-center gap-1">
						{isPageInputVisible ? (
							<input
								ref={pageInputRef}
								type="number"
								data-testid="ppt-control-bar-jump-input"
								className="h-7 w-12 rounded-md border border-input bg-background text-center text-sm text-foreground transition-all [appearance:textfield] placeholder:text-xs placeholder:text-muted-foreground hover:border-border focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 max-md:h-7 max-md:w-14 max-md:px-1.5 max-md:py-0.5 max-md:text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
								value={jumpPageInput}
								onChange={(e) => setJumpPageInput(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleJumpToPage(jumpPageInput)
										e.currentTarget.blur()
									}
									if (e.key === "Escape") {
										setJumpPageInput("")
										setIsPageInputVisible(false)
									}
								}}
								onBlur={() => {
									if (jumpPageInput) {
										handleJumpToPage(jumpPageInput)
									}
									setIsPageInputVisible(false)
								}}
								onFocus={(e) => e.target.select()}
								min={1}
								max={totalSlides}
								disabled={isTransitioning}
								placeholder={`${activeIndex + 1}`}
							/>
						) : (
							<MagicTooltip
								title={isMobile ? undefined : t("detail.clickToJumpPage")}
							>
								<span
									data-testid="ppt-control-bar-page-indicator"
									className="flex h-7 min-w-[46px] shrink-0 cursor-pointer items-center justify-center whitespace-nowrap rounded-[5px] px-[5px] text-[13px] font-normal tabular-nums leading-[1.5] transition-colors hover:bg-accent"
									onClick={() => {
										setIsPageInputVisible(true)
										setJumpPageInput("")
										// Use setTimeout to ensure input is rendered before focusing
										setTimeout(() => {
											pageInputRef.current?.focus()
										}, 0)
									}}
								>
									{activeIndex + 1}
									<span className="whitespace-pre text-muted-foreground">
										{" "}
										/ {totalSlides}
									</span>
									<FileSaveSyncBadge fileId={currentFileId} className="ml-1" />
								</span>
							</MagicTooltip>
						)}
					</div>

					{/* Next button */}
					<MagicTooltip
						title={
							isMobile
								? undefined
								: buildProgress && buildProgress.step < buildProgress.total
									? t("ppt.build.next")
									: t("fileViewer.nextPage")
						}
					>
						<span>
							<Button
								variant="ghost"
								size="sm"
								data-testid="ppt-control-bar-next-button"
								className="h-7 w-7 p-0 text-foreground"
								onClick={(e) => {
									e.stopPropagation()
									e.currentTarget.blur()
									onNextSlide()
								}}
								aria-label={
									buildProgress && buildProgress.step < buildProgress.total
										? t("ppt.build.next")
										: t("fileViewer.nextPage")
								}
								disabled={!canGoNext || isTransitioning}
							>
								<ChevronRight className="h-4 w-4" />
							</Button>
						</span>
					</MagicTooltip>

					{/* Mobile keeps a direct shortcut; desktop has it in the more menu. */}
					{isMobile && (
						<>
							<MagicTooltip title={isMobile ? undefined : t("detail.goToFirstPage")}>
								<span>
									<Button
										variant="ghost"
										size="sm"
										data-testid="ppt-control-bar-first-button"
										className="h-7 w-7 p-0 text-foreground"
										onClick={(e) => {
											e.stopPropagation()
											e.currentTarget.blur()
											onGoToFirstSlide()
										}}
										aria-label={t("detail.goToFirstPage")}
										disabled={!canGoPrevious || isTransitioning}
									>
										<Home className="h-4 w-4" />
									</Button>
								</span>
							</MagicTooltip>
						</>
					)}
				</div>
				{/* Reuse the same fullscreen action on phones; icon labels stay accessible. */}
				<MagicTooltip title={fullscreenLabel}>
					<span>
						<Button
							variant="ghost"
							size="sm"
							data-testid="ppt-control-bar-fullscreen-button"
							className="h-7 gap-[5px] px-[7px] text-[13px] font-normal text-foreground"
							onClick={(e) => {
								e.stopPropagation()
								e.currentTarget.blur()
								onToggleFullscreen()
							}}
							aria-label={fullscreenLabel}
						>
							{isFullscreen || isStarting ? (
								<Minimize className="h-4 w-4" />
							) : (
								<Maximize className="h-4 w-4" />
							)}
							<span className={isMobile ? "sr-only" : undefined}>
								{fullscreenLabel}
							</span>
						</Button>
					</span>
				</MagicTooltip>
				{!isMobile && presenterScreens?.length && onSelectPresenterScreen ? (
					<MagicDropdown
						placement="topRight"
						getPopupContainer={() => portalContainer || document.body}
						menu={{
							items: presenterScreens.map((screen, index) => ({
								key: String(index),
								label: (
									<div className="flex min-w-40 items-center justify-between gap-3">
										<span>
											{screen.label ||
												t("ppt.presenter.screenOption", {
													index: index + 1,
												})}
											{screen.isPrimary
												? t("ppt.presenter.primarySuffix")
												: ""}
										</span>
										{selectedPresenterScreen === index && (
											<Check className="size-4" />
										)}
									</div>
								),
							})),
							onClick: ({ key }) => onSelectPresenterScreen(Number(key)),
						}}
					>
						<Button
							variant="ghost"
							size="sm"
							data-testid="ppt-control-bar-presenter-screen-button"
							className="h-7 gap-[5px] px-[7px] text-[13px] font-normal"
							aria-label={t("ppt.presenter.selectScreen")}
						>
							<Monitor className="size-4" />
							{t("ppt.presenter.screen")}
						</Button>
					</MagicDropdown>
				) : null}
			</div>
			{(!isMobile || onToggleNotes || onOpenTransitions || onToggleBuildPanel) && (
				<div className={cn(barClassName, "flex-wrap justify-center")}>
					<PPTAnimationControls
						onOpenTransitions={onOpenTransitions}
						onToggleBuildPanel={onToggleBuildPanel}
						buildPanelOpen={buildPanelOpen}
					/>
					{onToggleNotes && (
						<Button
							variant="ghost"
							size="sm"
							data-testid="ppt-control-bar-notes-button"
							className="h-7 gap-[5px] px-[7px] text-[13px] font-normal aria-pressed:bg-accent"
							aria-pressed={Boolean(notesVisible)}
							aria-expanded={Boolean(notesVisible)}
							onClick={(event) => {
								event.stopPropagation()
								onToggleNotes()
							}}
						>
							<NotebookPen className="size-4" />
							{t("ppt.speakerNotes.title")}
						</Button>
					)}
					{!isMobile && (
						<div className="flex items-center gap-1 before:mx-[3px] before:h-4 before:w-px before:shrink-0 before:bg-[#e8ebf0] dark:before:bg-[#424650]">
							<PPTZoomControl
								scaleRatio={scaleRatio}
								isAutoScale={isAutoScale}
								portalContainer={portalContainer}
								onScaleChange={onScaleChange}
								onResetScale={onResetScale}
							/>
							<MagicDropdown
								placement="topRight"
								getPopupContainer={() => portalContainer || document.body}
								menu={{
									items: [
										...(onReplaceTemplate
											? [
													{
														key: "template",
														icon: <PanelsTopLeft className="size-4" />,
														label: t("ppt.templateReplacement.button"),
														onClick: onReplaceTemplate,
													},
												]
											: []),
										{
											key: "refresh-current",
											icon: (
												<RotateCw
													className={cn(
														"size-4",
														isRefreshingCurrentSlide && "animate-spin",
													)}
												/>
											),
											label: t("ppt.reloadCurrentSlide"),
											disabled:
												isTransitioning ||
												isRefreshingCurrentSlide ||
												!onRefreshCurrentSlide,
											onClick: () => onRefreshCurrentSlide?.(),
										},
										{
											key: "refresh-all",
											icon: (
												<RefreshCw
													className={cn(
														"size-4",
														isRefreshingAll && "animate-spin",
													)}
												/>
											),
											label: `${t("ppt.reloadAllSlides")}${
												refreshAllProgress
													? ` (${refreshAllProgress.done}/${refreshAllProgress.total})`
													: ""
											}`,
											disabled: isTransitioning || isRefreshingAll,
											onClick: onRefreshSlides,
										},
										{
											key: "first-page",
											icon: <Home className="size-4" />,
											label: t("detail.goToFirstPage"),
											disabled: !canGoPrevious || isTransitioning,
											onClick: onGoToFirstSlide,
										},
									],
								}}
							>
								<Button
									variant="ghost"
									size="sm"
									data-testid="ppt-control-bar-more-button"
									className="h-7 w-7 p-0"
									aria-label={t("ppt.moreActions")}
								>
									<Ellipsis className="size-4" />
								</Button>
							</MagicDropdown>
						</div>
					)}
				</div>
			)}
		</div>
	)
}
