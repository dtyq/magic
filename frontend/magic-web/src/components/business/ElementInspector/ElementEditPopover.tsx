import { Check, Loader2, Trash2, X } from "lucide-react"
import { createPortal } from "react-dom"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/shadcn-ui/button"
import { Textarea } from "@/components/shadcn-ui/textarea"
import type { InspectedElementInfo } from "./types"
import { getInspectorElementDisplayText, getShortSelector } from "./format"
import { getElementEditPopoverPosition } from "./editPopoverPosition"

interface ElementEditPopoverProps {
	targetId?: string
	info?: InspectedElementInfo
	targetKind?: "element" | "screenshot"
	screenshotDataUrl?: string
	screenshotLoading?: boolean
	box: { left: number; top: number; width: number; height: number }
	containerWidth: number
	containerHeight: number
	instruction: string
	onInstructionChange: (instruction: string) => void
	onConfirm: () => void
	onCancel: () => void
	onDelete?: () => void
}

const CONFIRM_ANIMATION_DURATION = 520

export function ElementEditPopover({
	targetId,
	info,
	targetKind = "element",
	screenshotDataUrl,
	screenshotLoading = false,
	box,
	containerWidth,
	containerHeight,
	instruction,
	onInstructionChange,
	onConfirm,
	onCancel,
	onDelete,
}: ElementEditPopoverProps) {
	const { t } = useTranslation("super")
	const width = Math.min(300, Math.max(1, containerWidth - 16))
	const targetLabel =
		targetKind === "screenshot"
			? t("stylePanel.inspector.screenshot")
			: info
				? getShortSelector(info)
				: t("stylePanel.inspector.element")
	const hasDeleteAction = Boolean(onDelete)
	// The footer is part of the rendered popover, so the old fixed 204px estimate
	// understated the real height and made edge selections choose the wrong side.
	const [measuredHeight, setMeasuredHeight] = useState(260)
	const [isConfirming, setIsConfirming] = useState(false)
	const popoverRef = useRef<HTMLDivElement>(null)
	const contentRef = useRef<HTMLDivElement>(null)
	const footerRef = useRef<HTMLDivElement>(null)
	const confirmTimerRef = useRef<number | null>(null)
	const successCheckRef = useRef<HTMLSpanElement>(null)
	const [flightStyle, setFlightStyle] = useState<CSSProperties | null>(null)

	useLayoutEffect(() => {
		const path = successCheckRef.current?.querySelector("path")
		if (!path || typeof path.getTotalLength !== "function") return
		const length = Math.ceil(path.getTotalLength())
		path.style.strokeDasharray = String(length)
		path.style.strokeDashoffset = String(length)
	}, [])

	useEffect(() => {
		return () => {
			if (confirmTimerRef.current !== null) {
				window.clearTimeout(confirmTimerRef.current)
			}
		}
	}, [])

	const handleConfirm = () => {
		if (isConfirming || !instruction.trim()) return
		const sourceRect = popoverRef.current?.getBoundingClientRect()
		const targetRect = document
			.querySelector<HTMLElement>('[data-testid="element-inspector-pending-count"]')
			?.getBoundingClientRect()
		if (sourceRect) {
			const sourceX = sourceRect.left + (box.left - position.left) + box.width / 2
			const sourceY = sourceRect.top + (box.top - position.top) + box.height / 2
			const targetX = targetRect
				? targetRect.left + targetRect.width / 2
				: window.innerWidth - 180
			const targetY = targetRect
				? targetRect.top + targetRect.height / 2
				: window.innerHeight - 70
			setFlightStyle({
				left: sourceX,
				top: sourceY,
				"--flight-x": `${targetX - sourceX}px`,
				"--flight-y": `${targetY - sourceY}px`,
				"--flight-x-22": `${(targetX - sourceX) * 0.22}px`,
				"--flight-y-22": `${(targetY - sourceY) * 0.22}px`,
				"--flight-x-45": `${(targetX - sourceX) * 0.45}px`,
				"--flight-y-45": `${(targetY - sourceY) * 0.45}px`,
				"--flight-x-68": `${(targetX - sourceX) * 0.68}px`,
				"--flight-y-68": `${(targetY - sourceY) * 0.68}px`,
				"--flight-x-86": `${(targetX - sourceX) * 0.86}px`,
				"--flight-y-86": `${(targetY - sourceY) * 0.86}px`,
			} as CSSProperties)
		}
		setIsConfirming(true)
		const reduceMotion =
			window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
		confirmTimerRef.current = window.setTimeout(
			onConfirm,
			reduceMotion ? 0 : CONFIRM_ANIMATION_DURATION,
		)
	}
	useLayoutEffect(() => {
		const content = contentRef.current
		const footer = footerRef.current
		if (!content || !footer) return
		const updateSize = () => {
			// Measure the content and footer separately. Reading the outer popover
			// would feed its constrained height back into the next layout.
			const nextHeight = content.scrollHeight + footer.offsetHeight
			if (nextHeight > 0) {
				setMeasuredHeight((previous) => (previous === nextHeight ? previous : nextHeight))
			}
		}
		updateSize()
		if (typeof ResizeObserver === "undefined") return
		const observer = new ResizeObserver(updateSize)
		observer.observe(content)
		observer.observe(footer)
		return () => observer.disconnect()
	}, [hasDeleteAction, screenshotDataUrl, screenshotLoading, targetLabel])
	const position = getElementEditPopoverPosition(
		box,
		{ width: containerWidth, height: containerHeight },
		{ width, height: measuredHeight },
	)
	return (
		<>
			<div
				ref={popoverRef}
				className={`inspector-theme-beam absolute z-50 box-border flex flex-col rounded-2xl border border-border/70 bg-background/95 shadow-[0_20px_55px_hsl(var(--foreground)/0.2),0_2px_8px_hsl(var(--foreground)/0.08)] ring-1 ring-white/70 backdrop-blur-xl dark:ring-white/10 ${isConfirming ? "inspector-confirm-popover" : "pointer-events-auto"}`}
				data-confirming={isConfirming ? "true" : "false"}
				data-target-id={targetId}
				style={{
					left: position.left,
					top: position.top,
					width: position.width,
					height: position.height,
					// Keep the action bar fixed while only the content area scrolls. This
					// prevents the confirm/cancel buttons from being pushed below the viewport.
					maxHeight: position.height,
					overflow: "hidden",
				}}
				data-testid="element-inspector-edit-popover"
			>
				<Button
					data-testid="element-inspector-edit-close-button"
					variant="ghost"
					size="icon-sm"
					className="absolute right-2 top-2 z-10 h-7 w-7 rounded-md"
					onClick={onCancel}
					aria-label={t("stylePanel.inspector.cancel")}
				>
					<X size={15} />
				</Button>

				<div
					ref={contentRef}
					className="no-scrollbar min-h-0 flex-1 space-y-2.5 overflow-y-auto p-3.5"
					data-testid="element-inspector-edit-content"
				>
					<div className="flex min-w-0 items-center gap-2 pr-8">
						<span
							className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary shadow-[0_0_0_3px_rgb(var(--primary-rgb)/0.14)]"
							aria-hidden="true"
						/>
						<span className="truncate font-mono text-[11px] font-medium text-muted-foreground">
							{targetLabel}
						</span>
					</div>
					<div
						className="flex min-h-16 items-center justify-center rounded-xl border border-border/50 bg-gradient-to-br from-muted/80 via-muted/45 to-background px-2 py-1.5 text-[11px] text-muted-foreground"
						data-testid="element-inspector-screenshot-preview"
					>
						{screenshotLoading ? (
							<span
								className="flex items-center gap-1.5"
								role="status"
								aria-live="polite"
							>
								<Loader2 size={14} className="animate-spin" />
								{t("stylePanel.inspector.screenshotProcessing")}
							</span>
						) : screenshotDataUrl ? (
							<img
								src={screenshotDataUrl}
								alt=""
								className="max-h-16 max-w-full rounded object-contain"
							/>
						) : info ? (
							getInspectorElementDisplayText(info, t) || info.resource || info.tagName
						) : null}
					</div>
					<Textarea
						data-testid="element-inspector-instruction-input"
						value={instruction}
						onChange={(event) => onInstructionChange(event.target.value)}
						placeholder={t("stylePanel.inspector.multiSelectionPlaceholder")}
						className="h-20 min-h-20 resize-none rounded-xl border-border/70 bg-background/80 text-xs shadow-inner focus-visible:border-primary/70 focus-visible:ring-primary/20"
						maxLength={2000}
						autoFocus
					/>
				</div>

				<div
					ref={footerRef}
					className="flex shrink-0 items-center gap-2 border-t border-border/60 bg-muted/20 px-3.5 py-2.5"
					data-testid="element-inspector-edit-footer"
				>
					{onDelete && (
						<Button
							data-testid="element-inspector-remove-target-button"
							variant="ghost"
							size="sm"
							className="mr-auto rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
							onClick={onDelete}
							disabled={isConfirming}
							aria-label={t("stylePanel.inspector.removeTarget")}
						>
							<Trash2 size={14} />
							{t("stylePanel.inspector.removeTarget")}
						</Button>
					)}
					<div className="ml-auto flex items-center gap-2">
						<Button
							data-testid="element-inspector-edit-cancel-button"
							variant="ghost"
							size="sm"
							className="rounded-lg"
							onClick={onCancel}
							disabled={isConfirming}
						>
							{t("stylePanel.inspector.cancel")}
						</Button>
						<Button
							data-testid="element-inspector-edit-confirm-button"
							size="sm"
							className="inspector-confirm-button rounded-lg bg-primary text-primary-foreground shadow-[0_4px_12px_rgb(var(--primary-rgb)/0.25)] hover:bg-primary/90 disabled:bg-muted disabled:bg-none disabled:text-muted-foreground disabled:shadow-none"
							onClick={handleConfirm}
							disabled={isConfirming || !instruction.trim()}
							aria-busy={isConfirming}
						>
							<span
								className="relative inline-flex size-3.5 items-center justify-center"
								aria-hidden="true"
							>
								<Check
									size={14}
									className={`absolute transition-[opacity,transform] duration-150 ease-out ${isConfirming ? "scale-75 opacity-0" : "scale-100 opacity-100"}`}
								/>
								<span
									ref={successCheckRef}
									className="t-success-check inspector-confirm-success"
									data-state={isConfirming ? "in" : "out"}
									data-testid="element-inspector-confirm-success"
								>
									<Check size={14} />
								</span>
							</span>
							{t("stylePanel.inspector.confirm")}
						</Button>
					</div>
				</div>
			</div>
			{flightStyle &&
				typeof document !== "undefined" &&
				createPortal(
					<span
						className="inspector-target-flight"
						style={flightStyle}
						aria-hidden="true"
						data-testid="element-inspector-target-flight"
					>
						<span className="inspector-target-flight-dot" />
					</span>,
					document.body,
				)}
		</>
	)
}
