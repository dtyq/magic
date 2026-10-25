import PPTPresenterTimer from "./PPTPresenterTimer"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronLeft, ChevronRight, Check, LogOut, Monitor } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/shadcn-ui/dropdown-menu"
import { cn } from "@/utils/cn"

interface PresenterScreenOption {
	label?: string
	isPrimary?: boolean
}

interface PPTPresenterConsoleControlsProps {
	activeIndex: number
	buildProgress?: { step: number; total: number }
	totalSlides: number
	canGoPrevious?: boolean
	canGoNext?: boolean
	isTransitioning: boolean
	isStarting?: boolean
	screens: ReadonlyArray<PresenterScreenOption>
	selectedScreen: number | null
	onPrevSlide: () => void
	onNextSlide: () => void
	onJumpToPage: (index: number) => void
	onSelectScreen: (index: number) => void
	onExit: () => void
}

/** Operator controls share React state with the fullscreen slide through a companion portal. */
export default function PPTPresenterConsoleControls({
	activeIndex,
	totalSlides,
	buildProgress,
	canGoPrevious = activeIndex > 0,
	canGoNext = activeIndex < totalSlides - 1,
	isTransitioning,
	isStarting = false,
	screens,
	selectedScreen,
	onPrevSlide,
	onNextSlide,
	onJumpToPage,
	onSelectScreen,
	onExit,
}: PPTPresenterConsoleControlsProps) {
	const { t } = useTranslation("super")
	const exitLabel = isStarting ? t("ppt.presenter.cancelStart") : t("ppt.presenter.endSlideShow")
	const controlsRef = useRef<HTMLDivElement>(null)
	const screenTriggerRef = useRef<HTMLButtonElement>(null)
	const [isScreenMenuOpen, setIsScreenMenuOpen] = useState(false)
	useEffect(() => {
		if (!isScreenMenuOpen) return
		const ownerDocument = controlsRef.current?.ownerDocument
		const ownerWindow = ownerDocument?.defaultView
		if (!ownerDocument || !ownerWindow) return

		// The console lives in a companion window; global document listeners miss its events.
		const dismissOutside = (event: Event) => {
			const target = event.target as Node | null
			const menu = ownerDocument.getElementById(
				screenTriggerRef.current?.getAttribute("aria-controls") || "",
			)
			if (target && !screenTriggerRef.current?.contains(target) && !menu?.contains(target))
				setIsScreenMenuOpen(false)
		}
		const dismissOnEscape = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation()
				setIsScreenMenuOpen(false)
				screenTriggerRef.current?.focus()
			}
		}
		// Clicks inside a slide iframe do not bubble to the console document.
		const dismissOnBlur = () => setIsScreenMenuOpen(false)
		ownerDocument.addEventListener("pointerdown", dismissOutside, true)
		ownerDocument.addEventListener("focusin", dismissOutside)
		ownerDocument.addEventListener("keydown", dismissOnEscape, true)
		ownerWindow.addEventListener("blur", dismissOnBlur)
		return () => {
			ownerDocument.removeEventListener("pointerdown", dismissOutside, true)
			ownerDocument.removeEventListener("focusin", dismissOutside)
			ownerDocument.removeEventListener("keydown", dismissOnEscape, true)
			ownerWindow.removeEventListener("blur", dismissOnBlur)
		}
	}, [isScreenMenuOpen])
	const [isPageInputVisible, setIsPageInputVisible] = useState(false)
	const [pageInput, setPageInput] = useState("")

	const submitPage = () => {
		const page = Number(pageInput)
		if (Number.isInteger(page) && page >= 1 && page <= totalSlides) onJumpToPage(page - 1)
		setPageInput("")
		setIsPageInputVisible(false)
	}

	return (
		<div
			ref={controlsRef}
			data-testid="ppt-presenter-console-controls"
			className="flex min-w-0 shrink-0 flex-wrap items-center justify-center gap-1 rounded-xl border border-white/15 bg-black/75 p-1.5 text-white"
		>
			{isStarting ? (
				<span role="status" className="px-2 text-sm">
					{t("ppt.presenter.starting")}
				</span>
			) : (
				<PPTPresenterTimer />
			)}
			<Button
				variant="ghost"
				size="icon"
				data-testid="ppt-presenter-console-prev-button"
				className="size-8 text-white hover:bg-white/15 hover:text-white"
				disabled={isStarting || !canGoPrevious || isTransitioning}
				onClick={onPrevSlide}
				aria-label={
					buildProgress && buildProgress.step > 0
						? t("ppt.build.previous")
						: t("fileViewer.previousPage")
				}
			>
				<ChevronLeft className="size-4" />
			</Button>
			{buildProgress && buildProgress.total > 0 && (
				<span className="text-xs tabular-nums" aria-live="polite">
					{t("ppt.build.progress", buildProgress)}
				</span>
			)}
			{isPageInputVisible ? (
				<input
					autoFocus
					value={pageInput}
					data-testid="ppt-presenter-console-page-input"
					aria-label={t("detail.clickToJumpPage")}
					className="h-8 w-16 rounded-md border border-white/30 bg-white/10 text-center text-sm text-white outline-none focus:ring-2 focus:ring-white/50"
					type="number"
					min={1}
					max={totalSlides}
					placeholder={`${activeIndex + 1}`}
					onChange={(event) => setPageInput(event.target.value)}
					onBlur={submitPage}
					onKeyDown={(event) => {
						event.stopPropagation()
						if (event.key === "Enter") submitPage()
						if (event.key === "Escape") {
							setPageInput("")
							setIsPageInputVisible(false)
						}
					}}
				/>
			) : (
				<button
					type="button"
					disabled={isStarting}
					data-testid="ppt-presenter-console-page-indicator"
					className="h-8 min-w-16 rounded-md px-2 text-sm tabular-nums hover:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
					onClick={() => setIsPageInputVisible(true)}
					aria-label={t("detail.clickToJumpPage")}
				>
					{activeIndex + 1} <span className="text-white/60">/ {totalSlides}</span>
				</button>
			)}
			<Button
				variant="ghost"
				size="icon"
				data-testid="ppt-presenter-console-next-button"
				className="size-8 text-white hover:bg-white/15 hover:text-white"
				disabled={isStarting || !canGoNext || isTransitioning}
				onClick={onNextSlide}
				aria-label={
					buildProgress && buildProgress.step < buildProgress.total
						? t("ppt.build.next")
						: t("fileViewer.nextPage")
				}
			>
				<ChevronRight className="size-4" />
			</Button>
			{screens.length > 0 && (
				<DropdownMenu
					modal={false}
					open={isScreenMenuOpen}
					onOpenChange={setIsScreenMenuOpen}
				>
					<DropdownMenuTrigger asChild>
						<Button
							variant="ghost"
							size="sm"
							data-testid="ppt-presenter-console-screen-button"
							ref={screenTriggerRef}
							disabled={isStarting}
							className="h-8 gap-1.5 text-white hover:bg-white/15 hover:text-white"
							aria-label={t("ppt.presenter.selectScreen")}
						>
							<Monitor className="size-4" />
							<span className="hidden sm:inline">{t("ppt.presenter.screen")}</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						container={controlsRef.current?.ownerDocument.body}
					>
						{screens.map((screen, index) => (
							<DropdownMenuItem
								key={index}
								data-ppt-screen-index={index}
								onSelect={() => onSelectScreen(index)}
								className={cn("min-w-48", selectedScreen === index && "bg-accent")}
							>
								<span className="flex-1">
									{screen.label ||
										t("ppt.presenter.screenOption", { index: index + 1 })}
									{screen.isPrimary ? t("ppt.presenter.primarySuffix") : ""}
								</span>
								{selectedScreen === index && <Check className="size-4" />}
							</DropdownMenuItem>
						))}
					</DropdownMenuContent>
				</DropdownMenu>
			)}
			<Button
				variant="ghost"
				size="sm"
				data-testid="ppt-presenter-console-exit-button"
				className="h-8 gap-1.5 text-white hover:bg-white/15 hover:text-white"
				onClick={onExit}
				aria-label={exitLabel}
			>
				<LogOut className="size-4" />
				<span className={isStarting ? undefined : "hidden sm:inline"}>{exitLabel}</span>
			</Button>
		</div>
	)
}
