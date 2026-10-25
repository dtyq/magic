import {
	useEffect,
	useState,
	type CSSProperties,
	type PointerEvent as ReactPointerEvent,
} from "react"
import ReactDOM from "react-dom"
import { useTranslation } from "react-i18next"
import { cn } from "@/utils/cn"
import {
	ResizableCollapseFeedback,
	ResizeGrip,
	resizeGlowClassName,
} from "@/components/shadcn-ui/resizable"

interface TopicResizeHandleProps {
	className?: string
	withDivider?: boolean
	disabled?: boolean
	onResizeStart: (clientX: number) => void
	style?: CSSProperties
	dragging?: boolean
	collapseProgress?: number
	collapseArmed?: boolean
	collapseDirection?: -1 | 1
}

/** Keeps the layout divider narrow while exposing a wider pointer target for reliable resizing. */
function TopicResizeHandle({
	className,
	withDivider = false,
	disabled = false,
	onResizeStart,
	style,
	dragging,
	collapseProgress = 0,
	collapseArmed = false,
	collapseDirection = 1,
}: TopicResizeHandleProps) {
	const { t } = useTranslation("super")
	const [localDragging, setIsDragging] = useState(false)
	const isDragging = dragging ?? localDragging

	/** Starts resize from a unified pointer event so mouse, trackpad, and touch share one path. */
	const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (disabled || event.button !== 0) return
		event.preventDefault()
		setIsDragging(true)
		onResizeStart(event.clientX)
	}

	useEffect(() => {
		if (!isDragging) return

		/** Clears visual dragging state when the active pointer ends or is cancelled by the browser. */
		const handlePointerEnd = () => {
			setIsDragging(false)
		}

		document.addEventListener("pointerup", handlePointerEnd)
		document.addEventListener("pointercancel", handlePointerEnd)
		return () => {
			document.removeEventListener("pointerup", handlePointerEnd)
			document.removeEventListener("pointercancel", handlePointerEnd)
		}
	}, [isDragging])

	return (
		<>
			<div
				style={style}
				data-slot="resizable-handle"
				data-resizing={isDragging ? "true" : undefined}
				data-dragging={isDragging}
				onPointerDown={handlePointerDown}
				className={cn(
					"relative flex w-px items-center justify-center bg-border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full [&[data-panel-group-direction=vertical]>div]:rotate-90",
					"group relative flex !w-2 cursor-col-resize touch-none items-center justify-center !bg-transparent",
					resizeGlowClassName,
					"group/resize outline-none focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:before:opacity-100 dark:[--resize-glow-rgb:52,88,136]",
					isDragging && "before:opacity-100",
					"data-[panel-group-direction=vertical]:!h-2 data-[panel-group-direction=vertical]:!w-full",
					"data-[panel-group-direction=vertical]:before:bg-gradient-to-r",
					disabled && "pointer-events-none",
					disabled && "opacity-0",
					className,
				)}
				data-testid="handle-mouse-down"
				data-pointer-testid="handle-pointer-down"
			>
				{/* Keep the visible divider on the grip axis, independent of the wider drag target. */}
				{withDivider && (
					<span
						aria-hidden="true"
						data-slot="resize-divider"
						className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border"
					/>
				)}
				<div
					className="absolute inset-y-0 left-1/2 z-20 w-4 -translate-x-1/2 cursor-col-resize touch-none"
					data-testid="resize-handle-hit-area"
					aria-hidden="true"
				/>
				<ResizableCollapseFeedback
					dragging={isDragging}
					collapseProgress={collapseProgress}
					collapseArmed={collapseArmed}
					collapseDirection={collapseDirection}
					pullLabel={
						collapseDirection < 0
							? t("sidebarPanels.pullLeftToCollapse")
							: t("sidebarPanels.pullRightToCollapse")
					}
					description={
						collapseArmed
							? collapseDirection < 0
								? t("sidebarPanels.pullRightToCancel")
								: t("sidebarPanels.pullLeftToCancel")
							: t("sidebarPanels.releaseKeepsOpen")
					}
					releaseLabel={t("sidebarPanels.releaseToCollapse")}
				/>
				<ResizeGrip orientation="vertical" />
			</div>

			{isDragging &&
				ReactDOM.createPortal(
					<div
						className="fixed inset-0 z-[9999] cursor-col-resize touch-none select-none bg-transparent"
						onPointerUp={() => {
							setIsDragging(false)
						}}
						onPointerCancel={() => {
							setIsDragging(false)
						}}
						data-testid="set-is-dragging"
					/>,
					document.body,
				)}
		</>
	)
}

export default TopicResizeHandle
