import {
	memo,
	useCallback,
	useEffect,
	useState,
	type PointerEvent as ReactPointerEvent,
} from "react"
import ReactDOM from "react-dom"
import { cn } from "@/utils/cn"
import { ResizableDividerProps } from "./types"

function ResizableDivider({
	onResizeStart,
	position = "left",
	onHoverChange,
	offsetLeft,
}: ResizableDividerProps) {
	const [isDragging, setIsDragging] = useState(false)
	const [isHovering, setIsHovering] = useState(false)

	const handleMouseEnter = () => {
		setIsHovering(true)
		onHoverChange?.(true)
	}

	const handleMouseLeave = () => {
		setIsHovering(false)
		onHoverChange?.(false)
	}

	const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
		if (e.button !== 0) return
		e.preventDefault()
		setIsDragging(true)
		onResizeStart(e.clientX)
	}

	const handlePointerEnd = useCallback(() => {
		setIsDragging(false)
		setIsHovering(false)
		onHoverChange?.(false)
	}, [onHoverChange])

	useEffect(() => {
		if (!isDragging) return

		// The panel hook owns the resize listeners on document. Mirror its end events here
		// so the visual divider is cleared even when the pointer is released outside the overlay.
		document.addEventListener("pointerup", handlePointerEnd)
		document.addEventListener("pointercancel", handlePointerEnd)

		return () => {
			document.removeEventListener("pointerup", handlePointerEnd)
			document.removeEventListener("pointercancel", handlePointerEnd)
		}
	}, [isDragging, handlePointerEnd])

	// Calculate inline style for dynamic positioning
	const dividerStyle =
		position === "right" && offsetLeft !== undefined
			? { left: `${offsetLeft + 2}px`, right: "auto" }
			: position === "left" && offsetLeft !== undefined
				? { right: `${offsetLeft}px`, left: "auto" }
				: undefined

	const shouldShowActive = isDragging || isHovering

	return (
		<>
			<div
				className={cn(
					// Base styles
					"absolute top-0 z-20 flex h-full w-3 cursor-ew-resize items-center justify-center transition-opacity duration-200",
					// Position-specific styles
					position === "left" ? "-left-1.5" : position === "right" ? "-right-1.5" : "",
					// Keep the visible divider on the hit area's axis instead of relying on flex-item sizing.
					"before:pointer-events-none before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:transition-colors before:duration-200 before:content-['']",
					// Active state - show primary color
					shouldShowActive
						? "before:bg-neutral-400"
						: "before:bg-transparent hover:before:bg-primary",
				)}
				style={dividerStyle}
				onPointerDown={handlePointerDown}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				data-testid="handle-mouse-down"
			/>
			{/* 拖拽时的全局遮罩层，通过 Portal 渲染到 body */}
			{isDragging &&
				ReactDOM.createPortal(
					<div
						className="fixed inset-0 z-[9999] cursor-ew-resize touch-none select-none bg-transparent"
						onPointerUp={handlePointerEnd}
						onPointerCancel={handlePointerEnd}
						data-testid="handle-overlay-mouse-move"
					/>,
					document.body,
				)}
		</>
	)
}

export default memo(ResizableDivider)
