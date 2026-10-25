import * as React from "react"
import { createPortal } from "react-dom"
import { ArrowLeft, ArrowRight, GripVerticalIcon } from "lucide-react"
import * as ResizablePrimitive from "react-resizable-panels"
import { useReducedMotion } from "framer-motion"

import { cn } from "@/utils/cn"

// 保留文件／话题把手原来的淡蓝渐变，宽度把手共用同一色值和显示条件。
const resizeGlowClassName =
	"[--resize-glow-rgb:210,230,255] overflow-visible before:pointer-events-none before:absolute before:inset-0 before:z-0 before:bg-gradient-to-b before:from-[rgba(239,246,255,0)] before:via-[rgba(var(--resize-glow-rgb),1)] before:to-[rgba(239,246,255,0)] before:opacity-0 before:transition-opacity before:duration-200 hover:before:opacity-100"

function ResizeGrip({
	orientation,
	className,
}: {
	orientation: "horizontal" | "vertical"
	className?: string
}) {
	return (
		<span
			aria-hidden="true"
			data-testid="resize-grip"
			data-orientation={orientation}
			className={cn(
				"pointer-events-none relative z-10 flex shrink-0 gap-0.5 text-muted-foreground/[0.45] transition-colors group-hover/resize:text-muted-foreground group-focus-visible/resize:text-muted-foreground group-data-[resize-handle-active]/resize:text-muted-foreground motion-reduce:transition-none",
				orientation === "vertical" &&
					"flex-col rounded-md border border-gray-200 bg-white px-0.5 py-1 group-hover/resize:text-blue-400 group-focus-visible/resize:text-blue-400 group-data-[dragging=true]/resize:text-blue-400 group-data-[resize-handle-active]/resize:text-blue-400",
				className,
			)}
		>
			<span className="size-0.5 rounded-full bg-current" />
			<span className="size-0.5 rounded-full bg-current" />
			<span className="size-0.5 rounded-full bg-current" />
		</span>
	)
}

function ResizablePanelGroup({
	className,
	...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) {
	return (
		<ResizablePrimitive.PanelGroup
			data-slot="resizable-panel-group"
			className={cn(
				"flex h-full w-full data-[panel-group-direction=vertical]:flex-col",
				className,
			)}
			{...props}
		/>
	)
}

const ResizablePanel = React.forwardRef<
	React.ElementRef<typeof ResizablePrimitive.Panel>,
	React.ComponentProps<typeof ResizablePrimitive.Panel>
>(({ ...props }, ref) => {
	return <ResizablePrimitive.Panel ref={ref} data-slot="resizable-panel" {...props} />
})

function ResizableHandle({
	withHandle,
	className,
	children,
	...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
	withHandle?: boolean
}) {
	return (
		<ResizablePrimitive.PanelResizeHandle
			data-slot="resizable-handle"
			className={cn(
				"relative flex w-px items-center justify-center bg-border after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:-translate-y-1/2 data-[panel-group-direction=vertical]:after:translate-x-0 [&[data-panel-group-direction=vertical]>div]:rotate-90",
				className,
			)}
			{...props}
		>
			{children}
			{withHandle && (
				<div className="z-10 flex h-4 w-3 items-center justify-center rounded-xs border bg-border">
					<GripVerticalIcon className="size-2.5" />
				</div>
			)}
		</ResizablePrimitive.PanelResizeHandle>
	)
}

interface ResizableCollapseFeedbackProps {
	dragging: boolean
	collapseProgress: number
	collapseArmed: boolean
	collapseDirection: -1 | 1
	pullLabel: string
	releaseLabel: string
	description: string
}

/** 只展示收起意图；宽度、阈值和最终收起仍由各面板的拖动生命周期负责。 */
function ResizableCollapseFeedback({
	dragging,
	collapseProgress,
	collapseArmed,
	collapseDirection,
	pullLabel,
	releaseLabel,
	description,
}: ResizableCollapseFeedbackProps) {
	const reducedMotion = useReducedMotion()
	const anchorRef = React.useRef<HTMLSpanElement>(null)
	const tooltipRef = React.useRef<HTMLSpanElement>(null)
	const visible = dragging && (collapseProgress > 0 || collapseArmed)
	const DirectionIcon = collapseDirection < 0 ? ArrowLeft : ArrowRight
	React.useLayoutEffect(() => {
		if (!visible) return
		const place = () => {
			const anchor = anchorRef.current?.parentElement
			const tooltip = tooltipRef.current
			if (!anchor || !tooltip) return
			const rect = anchor.getBoundingClientRect()
			const { width, height } = tooltip.getBoundingClientRect()
			const left = collapseDirection < 0 ? rect.right + 16 : rect.left - width - 16
			tooltip.style.left = `${Math.max(8, Math.min(left, window.innerWidth - width - 8))}px`
			tooltip.style.top = `${Math.max(8, Math.min(rect.top + rect.height / 2 - height - 24, window.innerHeight - height - 8))}px`
		}
		place()
		const observer = new ResizeObserver(place)
		if (tooltipRef.current) observer.observe(tooltipRef.current)
		window.addEventListener("resize", place)
		return () => {
			observer.disconnect()
			window.removeEventListener("resize", place)
		}
	}, [visible, collapseDirection, collapseProgress])
	return (
		<>
			<span ref={anchorRef} aria-hidden="true" className="pointer-events-none" />
			<div
				aria-hidden="true"
				className={cn(
					"pointer-events-none absolute inset-y-0 left-1/2 blur-[3px] [mask-image:linear-gradient(to_bottom,transparent,black_28%,black_72%,transparent)]",
					collapseDirection < 0 ? "bg-gradient-to-l" : "bg-gradient-to-r",
					"from-[rgba(var(--resize-glow-rgb,210,230,255),1)] to-transparent",
				)}
				style={{
					// 扩散层始终贴着真实边界；拉得越远，范围越宽、整体越淡，原窄光效仍留在边界。
					width: `${collapseProgress * 7}rem`,
					opacity: visible && collapseProgress > 0 ? 0.65 - collapseProgress * 0.35 : 0,
					transform: collapseDirection < 0 ? "translateX(-100%)" : undefined,
					transition:
						reducedMotion || dragging ? "none" : "width 220ms ease, opacity 220ms ease",
				}}
			/>
			{visible &&
				createPortal(
					<span
						ref={tooltipRef}
						role="status"
						className="pointer-events-none fixed z-[10000] w-max max-w-[calc(100vw-16px)] rounded-[10px] border border-border bg-popover px-3 py-2.5 text-xs text-popover-foreground shadow-sm"
					>
						<span className="flex items-center gap-2 font-medium">
							<DirectionIcon className="size-4 shrink-0 text-muted-foreground" />
							{collapseArmed ? releaseLabel : pullLabel}
						</span>
						<span className="mt-1 block text-muted-foreground">{description}</span>
						<span
							aria-hidden="true"
							className="mt-2 block h-[3px] overflow-hidden rounded-full bg-blue-100 dark:bg-blue-950"
						>
							<span
								className="block h-full rounded-full bg-gradient-to-r from-blue-200 to-blue-400 dark:from-blue-700 dark:to-blue-400"
								style={{ width: `${collapseProgress * 100}%` }}
							/>
						</span>
					</span>,
					document.body,
				)}
		</>
	)
}

export {
	ResizeGrip,
	resizeGlowClassName,
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
	ResizableCollapseFeedback,
}
