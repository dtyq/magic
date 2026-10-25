import {
	Camera,
	ChevronDown,
	ChevronUp,
	Edit3,
	ListChecks,
	Loader2,
	MousePointer,
	Send,
	Trash2,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import {
	useCallback,
	useEffect,
	useRef,
	useState,
	type CSSProperties,
	type PointerEvent,
} from "react"
import { Button } from "@/components/shadcn-ui/button"
import { ScrollArea } from "@/components/shadcn-ui/scroll-area"
import MagicTooltip from "@/components/base/MagicTooltip"
import { cn } from "@/utils/cn"
import type { HtmlMultiSelectionSubmitState, HtmlSelectionTarget } from "./types"
import { getShortSelector } from "./format"

interface PendingTargetsPanelProps {
	targets: HtmlSelectionTarget[]
	submitState: HtmlMultiSelectionSubmitState
	submitError?: string | null
	onEdit: (target: HtmlSelectionTarget) => void
	onRemove: (targetId: string) => void
	onSubmit: () => void
	selectionMode?: "element" | "screenshot"
	onSelectionModeChange?: (mode: "element" | "screenshot") => void
	screenshotSupported?: boolean
	onExit?: () => void
	/** Top distance from the containing canvas. */
	topOffset?: number
}

interface PanelPosition {
	left: number | null
	right: number | null
	top: number
}

interface DragState {
	pointerId: number
	startX: number
	startY: number
	startLeft: number
	startTop: number
}

type ListPlacement = "top" | "bottom"

const PANEL_EDGE_GAP = 8
const TARGET_LIST_ESTIMATED_HEIGHT = 208

/** Compact floating collection control; target details open on hover or focus. */
export function PendingTargetsPanel({
	targets,
	submitState,
	submitError,
	onEdit,
	onRemove,
	onSubmit,
	selectionMode = "element",
	onSelectionModeChange,
	screenshotSupported = true,
	onExit,
	topOffset = 16,
}: PendingTargetsPanelProps) {
	const { t } = useTranslation("super")
	const [isExpanded, setIsExpanded] = useState(false)
	const [isPanelOpen, setIsPanelOpen] = useState(false)
	const [isDragging, setIsDragging] = useState(false)
	const [position, setPosition] = useState<PanelPosition>({
		left: null,
		right: 16,
		top: topOffset,
	})
	const [listPlacement, setListPlacement] = useState<ListPlacement>("bottom")
	const panelRef = useRef<HTMLDivElement>(null)
	const dragStateRef = useRef<DragState | null>(null)
	const isSubmitting = submitState === "submitting"
	const hasEmptyInstruction = targets.some((target) => !target.instruction.trim())
	const canSubmit = targets.length > 0 && !hasEmptyInstruction && !isSubmitting

	useEffect(() => {
		// Start closed for one paint, then let t-panel-slide reveal the bar from the
		// canvas edge. This preserves the existing mount lifecycle and avoids layout shifts.
		if (typeof window === "undefined") {
			setIsPanelOpen(true)
			return
		}

		const frame = window.requestAnimationFrame(() => setIsPanelOpen(true))
		return () => window.cancelAnimationFrame(frame)
	}, [])

	const resolveListPlacement = useCallback(
		(panelTop?: number) => {
			const panel = panelRef.current
			if (!panel) return
			const parent = panel.offsetParent as HTMLElement | null
			const parentHeight = parent?.clientHeight || window.innerHeight
			const top = panelTop ?? position.top
			const panelHeight = panel.offsetHeight
			const spaceAbove = top - PANEL_EDGE_GAP
			const spaceBelow = parentHeight - top - panelHeight - PANEL_EDGE_GAP

			const nextPlacement =
				spaceBelow >= TARGET_LIST_ESTIMATED_HEIGHT
					? "bottom"
					: spaceAbove >= TARGET_LIST_ESTIMATED_HEIGHT
						? "top"
						: spaceBelow >= spaceAbove
							? "bottom"
							: "top"

			setListPlacement((currentPlacement) =>
				currentPlacement === nextPlacement ? currentPlacement : nextPlacement,
			)
		},
		[position.top],
	)

	useEffect(() => {
		resolveListPlacement()
		window.addEventListener("resize", resolveListPlacement)
		return () => window.removeEventListener("resize", resolveListPlacement)
	}, [resolveListPlacement])

	const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
		if (event.button > 0) return
		const target = event.target as HTMLElement
		if (target.closest("button, a, input, textarea, select, [data-panel-drag-ignore='true']")) {
			return
		}
		const panel = panelRef.current
		if (!panel) return
		const parent = panel.offsetParent as HTMLElement | null
		const panelRect = panel.getBoundingClientRect()
		const parentRect = parent?.getBoundingClientRect()
		const startLeft = panelRect.left - (parentRect?.left ?? 0)
		const startTop =
			position.left === null ? panelRect.top - (parentRect?.top ?? 0) : position.top
		dragStateRef.current = {
			pointerId: event.pointerId,
			startX: event.clientX ?? 0,
			startY: event.clientY ?? 0,
			startLeft,
			startTop,
		}
		setPosition({ left: startLeft, right: null, top: startTop })
		setIsDragging(true)
		panel.setPointerCapture?.(event.pointerId)
		event.preventDefault()
	}

	const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
		const dragState = dragStateRef.current
		const panel = panelRef.current
		if (!dragState || !panel || dragState.pointerId !== event.pointerId) return
		const parent = panel.offsetParent as HTMLElement | null
		const parentWidth = parent?.clientWidth ?? window.innerWidth
		const parentHeight = parent?.clientHeight ?? window.innerHeight
		const maxLeft = Math.max(8, parentWidth - panel.offsetWidth - 8)
		const maxTop = Math.max(8, parentHeight - panel.offsetHeight - 8)
		const nextLeft = Math.min(
			maxLeft,
			Math.max(8, dragState.startLeft + (event.clientX ?? 0) - dragState.startX),
		)
		const nextTop = Math.min(
			maxTop,
			Math.max(8, dragState.startTop + (event.clientY ?? 0) - dragState.startY),
		)
		setPosition({ left: nextLeft, right: null, top: nextTop })
		resolveListPlacement(nextTop)
	}

	const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
		if (dragStateRef.current?.pointerId !== event.pointerId) return
		panelRef.current?.releasePointerCapture?.(event.pointerId)
		dragStateRef.current = null
		setIsDragging(false)
		resolveListPlacement()
	}

	const panelStyle = {
		top: position.top,
		left: position.left === null ? "auto" : position.left,
		right: position.left === null ? (position.right ?? 16) : "auto",
		bottom: "auto",
		"--panel-translate-y": "-24px",
	} as CSSProperties

	const targetList =
		targets.length > 0 && isExpanded ? (
			<ScrollArea
				id="element-inspector-pending-target-list"
				// Override Radix's inline relative position to keep expansion outside the bar layout.
				style={{ position: "absolute" }}
				className={cn(
					"inspector-pending-target-list grid min-h-0 rounded-[16px] border border-border/70 bg-background/95 shadow-[0_14px_36px_hsl(var(--foreground)/0.16)] backdrop-blur-xl",
					listPlacement === "bottom" ? "origin-top" : "origin-bottom",
				)}
				viewportClassName="h-auto max-h-[190px] p-2 [&>div]:!block [&>div]:space-y-1"
				data-placement={listPlacement}
				data-testid="element-inspector-pending-target-list"
				// Scrollbar input must not start dragging the floating collection bar.
				data-panel-drag-ignore="true"
				onPointerDown={(event) => {
					// Preserve focus after Radix starts the drag; capture would cancel its handler.
					if (
						(event.target as HTMLElement).closest("[data-slot='scroll-area-scrollbar']")
					) {
						event.preventDefault()
					}
				}}
			>
				{targets.map((target) => (
					<div
						key={target.id}
						className="flex items-start gap-2 rounded-xl border border-border/50 bg-muted/45 px-2.5 py-2"
						data-testid="element-inspector-pending-target-item"
						data-target-id={target.id}
						data-target-kind={target.kind}
					>
						{target.screenshot?.dataUrl && (
							<img
								src={target.screenshot.dataUrl}
								alt=""
								className="h-9 w-12 shrink-0 rounded-lg border border-border/60 object-cover"
							/>
						)}
						<div className="min-w-0 flex-1">
							<div className="truncate font-mono text-[10px] font-semibold">
								{target.kind === "screenshot"
									? t("stylePanel.inspector.screenshot")
									: getShortSelector(target.info)}
							</div>
							<div className="line-clamp-2 text-[11px] text-muted-foreground">
								{target.instruction || t("stylePanel.inspector.emptyDescription")}
							</div>
						</div>
						<div className="flex shrink-0 items-center gap-0.5">
							<MagicTooltip
								title={t("stylePanel.inspector.editTarget")}
								placement="top"
								contentZIndex={10060}
							>
								<Button
									data-testid="element-inspector-pending-target-edit-button"
									data-target-id={target.id}
									variant="ghost"
									size="icon-sm"
									className="h-7 w-7 text-muted-foreground hover:bg-background hover:text-foreground"
									onClick={() => onEdit(target)}
									aria-label={t("stylePanel.inspector.editTarget")}
								>
									<Edit3 size={13} />
								</Button>
							</MagicTooltip>
							<MagicTooltip
								title={t("stylePanel.inspector.removeTarget")}
								placement="top"
								contentZIndex={10060}
							>
								<Button
									data-testid="element-inspector-pending-target-remove-button"
									data-target-id={target.id}
									variant="ghost"
									size="icon-sm"
									className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
									onClick={() => onRemove(target.id)}
									aria-label={t("stylePanel.inspector.removeTarget")}
								>
									<Trash2 size={13} />
								</Button>
							</MagicTooltip>
						</div>
					</div>
				))}
			</ScrollArea>
		) : null

	return (
		<div
			ref={panelRef}
			className="t-panel-slide inspector-theme-beam absolute z-30 w-[min(360px,calc(100%-24px))] cursor-grab overflow-visible rounded-[18px] border border-border/70 bg-background/90 shadow-[0_20px_55px_hsl(var(--foreground)/0.18),0_2px_8px_hsl(var(--foreground)/0.08)] ring-1 ring-white/70 backdrop-blur-xl dark:ring-white/10"
			style={panelStyle}
			data-open={isPanelOpen ? "true" : "false"}
			data-dragging={isDragging ? "true" : "false"}
			onPointerDown={handlePointerDown}
			onPointerMove={handlePointerMove}
			onPointerUp={handlePointerUp}
			onPointerCancel={handlePointerUp}
			onMouseEnter={() => targets.length > 0 && setIsExpanded(true)}
			onMouseLeave={() => setIsExpanded(false)}
			onFocusCapture={() => targets.length > 0 && setIsExpanded(true)}
			onBlurCapture={(event) => {
				if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
					setIsExpanded(false)
				}
			}}
			data-testid="element-inspector-pending-panel"
		>
			{listPlacement === "top" && targetList}

			<div className="flex min-h-14 items-center gap-1.5 border-b border-border/50 px-2.5 py-2.5">
				<div
					className="flex items-center gap-0.5 rounded-xl border border-border/60 bg-muted/65 p-0.5 shadow-inner"
					role="group"
					aria-label={t("stylePanel.inspector.selectionMode")}
					data-testid="element-inspector-selection-mode"
				>
					<MagicTooltip
						title={t("stylePanel.inspector.elementMode")}
						placement="top"
						sideOffset={6}
						contentZIndex={10060}
					>
						<Button
							data-testid="element-inspector-selection-mode-element-button"
							variant={selectionMode === "element" ? "default" : "ghost"}
							size="icon-sm"
							className={cn(
								"h-8 w-8 rounded-[10px] transition-[background-color,color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0 active:scale-[0.96]",
								selectionMode === "element"
									? "shadow-sm"
									: "text-muted-foreground hover:bg-background/80 hover:text-foreground",
							)}
							onClick={() => onSelectionModeChange?.("element")}
							aria-label={t("stylePanel.inspector.elementMode")}
							aria-pressed={selectionMode === "element"}
						>
							<MousePointer size={15} />
						</Button>
					</MagicTooltip>
					{screenshotSupported && (
						<MagicTooltip
							title={t("stylePanel.inspector.screenshotMode")}
							placement="top"
							sideOffset={6}
							contentZIndex={10060}
						>
							<Button
								data-testid="element-inspector-selection-mode-screenshot-button"
								variant={selectionMode === "screenshot" ? "default" : "ghost"}
								size="icon-sm"
								className={cn(
									"h-8 w-8 rounded-[10px] transition-[background-color,color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-primary/35 focus-visible:ring-offset-0 active:scale-[0.96]",
									selectionMode === "screenshot"
										? "shadow-sm"
										: "text-muted-foreground hover:bg-background/80 hover:text-foreground",
								)}
								onClick={() => onSelectionModeChange?.("screenshot")}
								aria-label={t("stylePanel.inspector.screenshotMode")}
								aria-pressed={selectionMode === "screenshot"}
							>
								<Camera size={15} />
							</Button>
						</MagicTooltip>
					)}
				</div>

				<button
					type="button"
					className={cn(
						"flex min-w-0 flex-1 items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-muted-foreground",
						"hover:bg-muted/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
						"disabled:pointer-events-none disabled:opacity-50",
					)}
					onClick={() => setIsExpanded((expanded) => !expanded)}
					disabled={targets.length === 0}
					aria-expanded={targets.length > 0 ? isExpanded : false}
					aria-controls="element-inspector-pending-target-list"
					data-testid="element-inspector-pending-target-toggle"
					aria-label={t(
						isExpanded
							? "stylePanel.inspector.collapsePendingTargets"
							: "stylePanel.inspector.expandPendingTargets",
					)}
				>
					<ListChecks size={16} className="shrink-0" />
					<span className="truncate tabular-nums">
						{(() => {
							const label = t("stylePanel.inspector.pendingTargetCount", {
								count: "__COUNT__",
							})
							const [before, after = ""] = label.split("__COUNT__")
							return (
								<>
									{before}
									<span
										key={targets.length}
										className="t-digit-group is-animating"
										data-testid="element-inspector-pending-count"
									>
										<span className="t-digit">{targets.length}</span>
									</span>
									{after}
								</>
							)
						})()}
					</span>
					{targets.length > 0 &&
						(isExpanded ? (
							<ChevronUp size={14} className="shrink-0" aria-hidden="true" />
						) : (
							<ChevronDown size={14} className="shrink-0" aria-hidden="true" />
						))}
				</button>

				<div className="ml-auto flex shrink-0 items-center gap-1.5">
					{onExit && (
						<Button
							data-testid="element-inspector-exit-button"
							variant="ghost"
							size="sm"
							className="h-8 rounded-lg px-2.5 text-xs transition-transform active:scale-[0.96]"
							onClick={onExit}
						>
							{t("stylePanel.inspector.exit")}
						</Button>
					)}
					<Button
						variant="default"
						size="sm"
						className="h-8 gap-1 rounded-lg bg-primary px-3 text-xs text-primary-foreground shadow-[0_4px_12px_rgb(var(--primary-rgb)/0.25)] transition-[background-color,box-shadow,transform,filter] hover:bg-primary/90 hover:shadow-[0_6px_16px_rgb(var(--primary-rgb)/0.32)] active:scale-[0.96] disabled:bg-muted disabled:bg-none disabled:text-muted-foreground disabled:shadow-none"
						disabled={!canSubmit}
						onClick={onSubmit}
						data-testid="element-inspector-submit-button"
					>
						{isSubmitting ? (
							<Loader2 size={15} className="animate-spin" />
						) : (
							<Send size={15} />
						)}
						{t("stylePanel.inspector.submit")}
					</Button>
				</div>
			</div>

			{listPlacement === "bottom" && targetList}

			{(submitError || hasEmptyInstruction || submitState === "succeeded") && (
				<div
					data-testid="element-inspector-submit-status"
					data-state={
						submitError ? "error" : hasEmptyInstruction ? "invalid" : "succeeded"
					}
					className={`border-t bg-muted/20 px-3 py-2 text-xs ${
						submitState === "succeeded" && !submitError && !hasEmptyInstruction
							? "text-emerald-600"
							: "text-destructive"
					}`}
				>
					{submitError ||
						(hasEmptyInstruction
							? t("stylePanel.inspector.descriptionRequired")
							: t("stylePanel.inspector.submitSuccess"))}
				</div>
			)}
		</div>
	)
}
