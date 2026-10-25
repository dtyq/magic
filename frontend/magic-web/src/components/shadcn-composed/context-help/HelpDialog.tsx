import { BookOpen, PanelLeft, X } from "lucide-react"
import { Suspense, useLayoutEffect, useRef, useState } from "react"
import type { ReactNode } from "react"
import type { ImperativePanelHandle } from "react-resizable-panels"
import { ErrorBoundary } from "react-error-boundary"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/shadcn-ui/resizable"
import {
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/shadcn-ui/dialog"
import { cn } from "@/utils/cn"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import type {
	HelpDefinition,
	HelpDialogProps,
	HelpDialogContentProps,
	HelpReadingLinks,
	HelpTone,
} from "./types"
import { HelpLocation } from "./HelpLocation"

const NAVIGATION_DEFAULT_WIDTH = 280
const NAVIGATION_MIN_WIDTH = 240
const NAVIGATION_MAX_WIDTH = 420
const CONTENT_MIN_WIDTH = 400

const TONE_CLASSES: Record<HelpTone, string> = {
	neutral: "[--help-accent:rgb(var(--foreground-rgb))] [--help-soft:rgb(var(--muted-rgb))]",
	indigo: "[--help-accent:#6366f1] [--help-soft:#f3f2ff] dark:[--help-accent:#a5a7ff] dark:[--help-soft:#303044]",
	red: "[--help-accent:#f0443a] [--help-soft:#fff2ef] dark:[--help-accent:#ff9b91] dark:[--help-soft:#412d2e]",
	amber: "[--help-accent:#cb7b1b] [--help-soft:#fff8eb] dark:[--help-accent:#e4b477] dark:[--help-soft:#393126]",
	teal: "[--help-accent:#268d7a] [--help-soft:#edf9f5] dark:[--help-accent:#85d4c1] dark:[--help-soft:#263b35]",
}

/** 在局部错误边界内部求值正文，正文加载失败时仍能关闭说明。 */
function HelpBody({ help, reading }: { help: HelpDefinition; reading?: HelpReadingLinks }) {
	return <>{help.renderBody(reading, help.identity)}</>
}

/** 外层模态容器不参与懒加载切换，加载和失败只替换容器内部。 */
export function HelpDialogFrame({
	id,
	help,
	onCloseAutoFocus,
	header,
	hasNavigation,
	children,
}: Pick<HelpDialogProps, "id" | "help" | "onCloseAutoFocus" | "header"> & {
	hasNavigation: boolean
	children: ReactNode
}) {
	const { t } = useTranslation("interface")
	return (
		<DialogContent
			id={id}
			showCloseButton={false}
			className={cn(
				"flex h-[82dvh] max-h-[900px] flex-col gap-0 overflow-hidden rounded-[18px] p-0",
				hasNavigation
					? "sm:max-w-[min(1120px,calc(100%-3rem))]"
					: "sm:max-w-[min(960px,calc(100%-3rem))]",
				TONE_CLASSES[help.tone ?? "neutral"],
			)}
			onCloseAutoFocus={onCloseAutoFocus}
			onPointerDown={(event) => event.stopPropagation()}
			onClick={(event) => event.stopPropagation()}
			onDoubleClick={(event) => event.stopPropagation()}
			onKeyDown={(event) => event.stopPropagation()}
		>
			{/* 大标题在窄屏或长译文中可以换行；两项关闭／目录操作固定在右上方，不挤占正文。 */}
			<DialogHeader className="flex min-h-16 shrink-0 flex-row items-start gap-3 space-y-0 border-b px-5 py-3 text-left sm:min-h-[68px] sm:px-6">
				<span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-[var(--help-soft)] text-[var(--help-accent)]">
					<BookOpen size={18} aria-hidden />
				</span>
				<div
					className={cn("min-w-0 flex-1 space-y-0.5", hasNavigation ? "pr-24" : "pr-12")}
				>
					<DialogTitle className="text-[22px] font-semibold leading-7 text-foreground">
						{header?.title ?? t("contextHelp.title")}
					</DialogTitle>
					<DialogDescription
						className={header && !header.description ? "sr-only" : "text-xs"}
					>
						{header
							? (header.description ?? header.title)
							: t("contextHelp.description")}
					</DialogDescription>
				</div>
				<DialogClose asChild>
					<Button
						variant="ghost"
						size="icon-lg"
						aria-label={
							header
								? t("contextHelp.dismissWithTitle", { title: header.title })
								: t("contextHelp.dismiss")
						}
						className="group absolute right-5 top-3 size-10 shrink-0 cursor-pointer rounded-lg bg-muted/40 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:bg-accent motion-reduce:transition-none sm:right-6 sm:top-3.5 [@media(pointer:coarse)]:size-11"
					>
						<X
							className="size-5 transition-transform duration-150 group-active:scale-90 motion-reduce:transition-none"
							aria-hidden
						/>
					</Button>
				</DialogClose>
			</DialogHeader>
			{children}
			<DialogFooter className="shrink-0 border-t px-5 py-3">
				<DialogClose asChild>
					<Button>{t("contextHelp.close")}</Button>
				</DialogClose>
			</DialogFooter>
		</DialogContent>
	)
}

export function HelpDialogContent({
	id,
	help,
	navigation,
	articleKey,
	reading,
	contentRef,
}: HelpDialogContentProps) {
	const { t, i18n } = useTranslation("interface")
	const [layoutElement, setLayoutElement] = useState<HTMLDivElement | null>(null)
	const [layoutWidth, setLayoutWidth] = useState(0)
	const narrow = layoutWidth < 880
	const navigationPanel = useRef<ImperativePanelHandle>(null)
	const navigationWidth = useRef(NAVIGATION_DEFAULT_WIDTH)
	const [desktopNavigation, setDesktopNavigation] = useState(true)
	const [mobileNavigation, setMobileNavigation] = useState(false)
	const hasNavigation = Boolean(navigation)
	const showNavigation = hasNavigation && (narrow ? mobileNavigation : desktopNavigation)
	// 分隔线占 1px；面板组件使用百分比，产品宽度边界按可读的像素尺寸计算。
	const availableWidth = Math.max(layoutWidth - 1, 1)
	const maxNavigationWidth = Math.min(NAVIGATION_MAX_WIDTH, availableWidth - CONTENT_MIN_WIDTH)
	const minNavigationSize = showNavigation
		? narrow
			? 100
			: (NAVIGATION_MIN_WIDTH / availableWidth) * 100
		: 0
	const maxNavigationSize = showNavigation
		? narrow
			? 100
			: (maxNavigationWidth / availableWidth) * 100
		: 0
	useLayoutEffect(() => {
		const element = layoutElement
		if (!element || !hasNavigation) return
		// Portal 会晚于父组件挂载内容；由实际节点驱动监听，避免首次 ref 为空后一直按窄屏显示。
		// 按弹窗实际宽度切换，避免拖动目录时误用正文宽度，或误用整页桌面状态。
		const resize = new ResizeObserver(([entry]) => setLayoutWidth(entry.contentRect.width))
		setLayoutWidth(element.clientWidth)
		resize.observe(element)
		return () => resize.disconnect()
	}, [hasNavigation, layoutElement])
	useLayoutEffect(() => {
		const width = Math.max(
			NAVIGATION_MIN_WIDTH,
			Math.min(navigationWidth.current, maxNavigationWidth),
		)
		navigationPanel.current?.resize(
			showNavigation ? (narrow ? 100 : (width / availableWidth) * 100) : 0,
		)
	}, [availableWidth, maxNavigationWidth, narrow, showNavigation])
	// 只记录用户拖动或按键后的宽度；窄屏切换、收起和自动尺寸约束不覆盖桌面选择。
	function rememberNavigationWidth() {
		if (narrow || !showNavigation) return
		const size = navigationPanel.current?.getSize()
		if (size !== undefined) navigationWidth.current = (size / 100) * availableWidth
	}
	// 先让窄屏正文可见，再执行文章切换后的滚动和聚焦。
	useLayoutEffect(() => setMobileNavigation(false), [articleKey])
	return (
		<div className={cn("flex min-h-0 flex-1 flex-col", TONE_CLASSES[help.tone ?? "neutral"])}>
			{/* 目录控制与阅读布局共用状态；定位到固定标题栏，为外层关闭按钮保留空间。 */}
			{navigation && (
				<Button
					variant="ghost"
					size="icon-lg"
					className="absolute right-[72px] top-3 size-10 shrink-0 sm:top-3.5 [@media(pointer:coarse)]:size-11"
					aria-label={t("contextHelp.contents")}
					aria-controls={`${id}-contents`}
					aria-expanded={showNavigation}
					onClick={() =>
						narrow
							? setMobileNavigation((value) => !value)
							: setDesktopNavigation((value) => !value)
					}
				>
					<PanelLeft size={20} aria-hidden />
				</Button>
			)}
			{/* 标题和关闭操作始终可见，长说明只在正文区域滚动。 */}
			<div ref={setLayoutElement} className="flex min-h-0 flex-1">
				<ResizablePanelGroup direction="horizontal">
					{navigation && (
						<ResizablePanel
							ref={navigationPanel}
							id={`${id}-navigation-panel`}
							order={1}
							defaultSize={0}
							minSize={minNavigationSize}
							maxSize={maxNavigationSize}
							className={cn("min-h-0", !showNavigation && "hidden")}
						>
							<aside
								id={`${id}-contents`}
								className="h-full min-h-0 overflow-y-auto overscroll-contain bg-muted/20"
							>
								{navigation}
							</aside>
						</ResizablePanel>
					)}
					{navigation && (
						<ResizableHandle
							withHandle
							aria-label={t("contextHelp.resizeContents")}
							disabled={narrow || !showNavigation}
							onDragging={(dragging) => {
								if (!dragging) rememberNavigationWidth()
							}}
							onKeyUp={rememberNavigationWidth}
							className={cn(
								"hover:bg-primary/40",
								(narrow || !showNavigation) && "hidden",
							)}
						/>
					)}
					<ResizablePanel
						id={`${id}-article-panel`}
						order={2}
						defaultSize={100}
						minSize={0}
						className={cn(
							"flex min-w-0 flex-1 flex-col",
							narrow && showNavigation && "hidden",
						)}
					>
						<ScrollArea
							viewportRef={contentRef}
							className="min-h-0 flex-1"
							viewportClassName="overscroll-contain"
						>
							{/* 外框提供留白，正文保持适中行长；窄屏按可用宽度排版。 */}
							<div className="mx-auto max-w-[790px] space-y-8 break-words px-5 py-8 text-[15px] leading-[1.75] [container-name:help-article] [container-type:inline-size] sm:px-[38px] sm:py-9">
								<ErrorBoundary
									resetKeys={[articleKey, i18n.resolvedLanguage]}
									fallback={<p role="alert">{t("contextHelp.loadFailed")}</p>}
								>
									<Suspense
										fallback={<p role="status">{t("contextHelp.loading")}</p>}
									>
										{help.identity ? (
											<div className="mb-7 flex items-center gap-4">
												<span className="inline-flex size-[52px] shrink-0 items-center justify-center rounded-[13px] bg-[var(--help-soft)] sm:size-16 sm:rounded-2xl">
													<span className="inline-flex scale-[.85] sm:scale-100">
														{help.identity.renderIcon(40)}
													</span>
												</span>
												<div className="min-w-0">
													<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
														<h2
															data-help-heading
															tabIndex={-1}
															className="break-all text-[21px] font-semibold leading-8 outline-none sm:text-2xl"
														>
															{help.identity.name}
														</h2>
														<span className="rounded-md bg-[var(--help-soft)] px-2 py-0.5 text-[11px] text-[var(--help-accent)]">
															{help.title}
														</span>
													</div>
													{help.identity.location && (
														<div className="mt-1">
															<HelpLocation
																{...help.identity.location}
															/>
														</div>
													)}
													{help.identity.scope && (
														<p className="mt-1 text-xs text-muted-foreground">
															{help.identity.scope}
														</p>
													)}
												</div>
											</div>
										) : (
											<h2
												data-help-heading
												tabIndex={-1}
												className="mb-6 text-xl font-semibold text-foreground outline-none"
											>
												{help.title}
											</h2>
										)}
										<HelpBody help={help} reading={reading} />
									</Suspense>
								</ErrorBoundary>
							</div>
						</ScrollArea>
					</ResizablePanel>
				</ResizablePanelGroup>
			</div>
		</div>
	)
}
