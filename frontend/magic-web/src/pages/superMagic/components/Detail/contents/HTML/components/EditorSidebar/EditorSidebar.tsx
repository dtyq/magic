import type { CSSProperties, PointerEvent, ReactNode } from "react"
import { useLayoutEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown } from "lucide-react"
import { TooltipProvider } from "@/components/shadcn-ui/tooltip"
import { cn } from "@/utils/cn"
import {
	ResizeGrip,
	resizeHandleGlowClass,
} from "@/pages/superMagic/components/ResizeGrip/ResizeGrip"
import { EditorSidebarSlotsContext, type EditorSidebarSlots } from "./sidebarSlots"
import {
	DEFAULT_STRUCTURE_RATIO,
	SIDEBAR_DEFAULT_WIDTH,
	SIDEBAR_MAX_WIDTH,
	SIDEBAR_MIN_WIDTH,
	SPLITTER_HEIGHT,
	getSidebarSectionLayout,
	getStructureRatioFromPointer,
} from "./sidebarSplit"

export interface EditorSidebarProps {
	structureExpanded: boolean
	stylesExpanded: boolean
	onStructureExpandedChange: (expanded: boolean) => void
	onStylesExpandedChange: (expanded: boolean) => void
	structure: ReactNode
	styles: ReactNode
}

export function EditorSidebar({
	structureExpanded,
	stylesExpanded,
	onStructureExpandedChange,
	onStylesExpandedChange,
	structure,
	styles,
}: EditorSidebarProps) {
	const { t } = useTranslation("super")
	const [width, setWidth] = useState(SIDEBAR_DEFAULT_WIDTH)
	const [isResizing, setIsResizing] = useState(false)
	const [isSplitting, setIsSplitting] = useState(false)
	const [structureRatio, setStructureRatio] = useState(DEFAULT_STRUCTURE_RATIO)
	const [railHeight, setRailHeight] = useState(0)
	const [structureChrome, setStructureChrome] = useState<HTMLDivElement | null>(null)
	const bodyRef = useRef<HTMLDivElement>(null)
	const slots = useMemo<EditorSidebarSlots>(() => ({ structureChrome }), [structureChrome])
	const bothExpanded = structureExpanded && stylesExpanded
	const layout = getSidebarSectionLayout(
		Math.max(0, railHeight - (bothExpanded ? SPLITTER_HEIGHT : 0)),
		structureRatio,
		structureExpanded,
		stylesExpanded,
	)

	useLayoutEffect(() => {
		const node = bodyRef.current
		if (!node || typeof ResizeObserver === "undefined") return
		const observer = new ResizeObserver((entries) => {
			const entry = entries[0]
			if (!entry) return
			setRailHeight(entry.contentRect.height)
		})
		observer.observe(node)
		return () => observer.disconnect()
	}, [])

	function sectionStyle(expanded: boolean, height: number): CSSProperties | undefined {
		if (!expanded) return undefined
		if (bothExpanded && railHeight > 0) {
			return { height, flex: "none" }
		}
		return { flex: 1 }
	}

	function startResize(event: PointerEvent<HTMLDivElement>) {
		event.preventDefault()
		const handle = event.currentTarget
		handle.setPointerCapture?.(event.pointerId)
		setIsResizing(true)
		const startX = event.clientX
		const startWidth = width
		function move(moveEvent: PointerEvent) {
			setWidth(
				Math.min(
					SIDEBAR_MAX_WIDTH,
					Math.max(SIDEBAR_MIN_WIDTH, startWidth + startX - moveEvent.clientX),
				),
			)
		}
		function stop() {
			setIsResizing(false)
			if (handle.hasPointerCapture?.(event.pointerId)) {
				handle.releasePointerCapture?.(event.pointerId)
			}
			window.removeEventListener("pointermove", move)
			window.removeEventListener("pointerup", stop)
			window.removeEventListener("pointercancel", stop)
		}
		window.addEventListener("pointermove", move)
		window.addEventListener("pointerup", stop)
		window.addEventListener("pointercancel", stop)
	}

	function startSplit(event: PointerEvent<HTMLDivElement>) {
		event.preventDefault()
		const handle = event.currentTarget
		const rail = bodyRef.current
		if (!rail) return
		const railRect = rail.getBoundingClientRect()
		handle.setPointerCapture?.(event.pointerId)
		setIsSplitting(true)
		function move(moveEvent: PointerEvent) {
			setStructureRatio(
				getStructureRatioFromPointer(moveEvent.clientY, railRect.top, railRect.height),
			)
		}
		function stop() {
			setIsSplitting(false)
			if (handle.hasPointerCapture?.(event.pointerId)) {
				handle.releasePointerCapture?.(event.pointerId)
			}
			window.removeEventListener("pointermove", move)
			window.removeEventListener("pointerup", stop)
			window.removeEventListener("pointercancel", stop)
		}
		window.addEventListener("pointermove", move)
		window.addEventListener("pointerup", stop)
		window.addEventListener("pointercancel", stop)
	}

	return (
		<aside
			className="relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-l border-border/80 bg-background/95 shadow-[-10px_0_24px_-18px_rgba(15,23,42,0.2)] backdrop-blur supports-[backdrop-filter]:bg-background/85"
			style={{
				width,
				minWidth: `min(${SIDEBAR_MIN_WIDTH}px, 100%)`,
				maxWidth: `min(${SIDEBAR_MAX_WIDTH}px, 100%)`,
			}}
			data-testid="html-editor-sidebar"
			aria-label={t("stylePanel.sidebar.title")}
			data-resizing={isResizing ? "true" : undefined}
		>
			<div
				className={cn(
					"group absolute inset-y-0 left-0 z-30 flex w-2 -translate-x-px cursor-col-resize items-center justify-center",
					resizeHandleGlowClass("vertical"),
				)}
				onPointerDown={startResize}
				data-testid="html-editor-sidebar-resize-handle"
				data-resizing={isResizing ? "true" : undefined}
				role="separator"
				aria-label={t("stylePanel.sidebar.resize")}
				aria-orientation="vertical"
				aria-valuemin={SIDEBAR_MIN_WIDTH}
				aria-valuemax={SIDEBAR_MAX_WIDTH}
				aria-valuenow={width}
			>
				<ResizeGrip orientation="vertical" />
			</div>
			<TooltipProvider delayDuration={200}>
				<EditorSidebarSlotsContext.Provider value={slots}>
					<div
						ref={bodyRef}
						className="flex min-h-0 flex-1 flex-col pl-2"
						data-testid="html-editor-sidebar-rail"
					>
						{structureExpanded ? (
							<section
								className="flex min-h-0 flex-col overflow-hidden"
								style={sectionStyle(structureExpanded, layout.structureHeight)}
								data-testid="html-editor-sidebar-structure"
							>
								<SectionHeader
									title={t("stylePanel.domTree.title")}
									expanded
									onToggle={() => onStructureExpandedChange(false)}
									testId="html-editor-sidebar-structure-toggle"
									toggleLabel={t("stylePanel.sidebar.collapseSection")}
									chromeRef={setStructureChrome}
								/>
								<div className="min-h-0 flex-1 overflow-hidden">{structure}</div>
							</section>
						) : (
							<SectionHeader
								title={t("stylePanel.domTree.title")}
								expanded={false}
								onToggle={() => onStructureExpandedChange(true)}
								testId="html-editor-sidebar-structure-toggle"
								toggleLabel={t("stylePanel.sidebar.expandSection")}
							/>
						)}
						{bothExpanded ? (
							<div
								className="relative z-20 h-px shrink-0 bg-border/70"
								data-testid="html-editor-sidebar-splitter-line"
							>
								<div
									className={cn(
										"group absolute inset-x-0 top-0.5 flex h-2 cursor-row-resize items-center justify-center bg-transparent",
										resizeHandleGlowClass("horizontal"),
									)}
									onPointerDown={startSplit}
									data-testid="html-editor-sidebar-splitter"
									data-resizing={isSplitting ? "true" : undefined}
									role="separator"
									aria-label={t("stylePanel.sidebar.split")}
									aria-orientation="horizontal"
								>
									<ResizeGrip orientation="horizontal" />
								</div>
							</div>
						) : null}
						{stylesExpanded ? (
							<section
								className="flex min-h-0 flex-col overflow-hidden pt-2"
								style={sectionStyle(stylesExpanded, layout.stylesHeight)}
								data-testid="html-editor-sidebar-styles"
							>
								<SectionHeader
									title={t("stylePanel.moreStyles")}
									expanded
									onToggle={() => onStylesExpandedChange(false)}
									testId="html-editor-sidebar-styles-toggle"
									toggleLabel={t("stylePanel.sidebar.collapseSection")}
								/>
								<div className="min-h-0 flex-1 overflow-hidden">{styles}</div>
							</section>
						) : (
							<SectionHeader
								title={t("stylePanel.moreStyles")}
								expanded={false}
								onToggle={() => onStylesExpandedChange(true)}
								testId="html-editor-sidebar-styles-toggle"
								toggleLabel={t("stylePanel.sidebar.expandSection")}
							/>
						)}
					</div>
				</EditorSidebarSlotsContext.Provider>
			</TooltipProvider>
		</aside>
	)
}

function SectionHeader({
	title,
	expanded,
	onToggle,
	testId,
	toggleLabel,
	chromeRef,
}: {
	title: string
	expanded: boolean
	onToggle: () => void
	testId: string
	toggleLabel: string
	chromeRef?: (node: HTMLDivElement | null) => void
}) {
	return (
		<div
			className={cn(
				"flex h-8 w-full shrink-0 items-center gap-1 px-2",
				expanded ? "border-b border-border/70 bg-card/90" : "border-t border-border/70",
			)}
		>
			<button
				type="button"
				className="flex min-w-0 flex-1 items-center gap-1 px-1 text-left text-[13px] font-semibold tracking-tight"
				onClick={onToggle}
				aria-expanded={expanded}
				aria-label={toggleLabel}
				data-testid={testId}
			>
				<ChevronDown
					className={cn(
						"h-3.5 w-3.5 shrink-0 text-muted-foreground",
						!expanded && "-rotate-90",
					)}
				/>
				<span className="min-w-0 truncate">{title}</span>
			</button>
			{chromeRef ? (
				<div
					ref={chromeRef}
					className="flex shrink-0 items-center gap-0.5"
					data-testid="html-editor-sidebar-structure-chrome"
					onPointerDown={(event) => event.stopPropagation()}
				/>
			) : null}
		</div>
	)
}
