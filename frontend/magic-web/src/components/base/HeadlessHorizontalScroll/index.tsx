import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/utils/cn"
import type { HTMLAttributes, MouseEventHandler, ReactNode, RefObject } from "react"

type ScrollDirection = "left" | "right"
const DRAG_START_DISTANCE = 4
const CONTROL_OVERLAY_WIDTH_CLASS = "w-20"
const LEFT_CONTROL_GRADIENT_CLASS =
	"bg-[linear-gradient(to_left,_transparent_0%,_var(--control-background)_50%,_var(--control-background)_100%)]"
const RIGHT_CONTROL_GRADIENT_CLASS =
	"bg-[linear-gradient(to_right,_transparent_0%,_var(--control-background)_50%,_var(--control-background)_100%)]"

interface DragState {
	pointerId: number
	startX: number
	startY: number
	startScrollLeft: number
	isDragging: boolean
	originalScrollBehavior: string
}

interface HeadlessHorizontalScrollRenderProps {
	scroll: (direction: ScrollDirection) => void
	showLeftArrow: boolean
	showRightArrow: boolean
	scrollContainerRef: RefObject<HTMLDivElement>
}

interface HeadlessHorizontalScrollProps {
	className?: string
	style?: React.CSSProperties
	controlBackground?: string
	/** Allow descendants to render outside the rounded horizontal-scroll surface vertically. */
	allowVerticalOverflow?: boolean
	"data-testid"?: string
	scrollContainerClassName?: string
	scrollContainerProps?: Omit<
		HTMLAttributes<HTMLDivElement>,
		"children" | "className" | "ref" | "onContextMenu"
	>
	scrollContainerRef?: RefObject<HTMLDivElement>
	onScrollContainerContextMenu?: MouseEventHandler<HTMLDivElement>
	children: ReactNode
	scrollStep?: number
	/** 拖动交由后代自身处理；空白区域仍可拖动滚动。 */
	dragIgnoreSelector?: string
	hideScrollbar?: boolean
	renderLeftControl?: (props: HeadlessHorizontalScrollRenderProps) => ReactNode
	renderRightControl?: (props: HeadlessHorizontalScrollRenderProps) => ReactNode
}

function defaultRenderLeftControl({ scroll }: HeadlessHorizontalScrollRenderProps) {
	return (
		<div
			className={cn(
				"pointer-events-none absolute left-0 top-0 z-10 h-full overflow-hidden rounded-l-full ",
				CONTROL_OVERLAY_WIDTH_CLASS,
			)}
		>
			<div className={cn("absolute inset-0 rounded-l-full", LEFT_CONTROL_GRADIENT_CLASS)} />
			<div className="relative flex h-full items-center justify-start pl-2">
				<Button
					variant="outline"
					size="icon"
					className="pointer-events-auto !size-4 shrink-0 rounded-full border-muted-foreground/50 text-muted-foreground/50 shadow-xs [&_svg]:size-3"
					onClick={() => scroll("left")}
				>
					<ChevronLeft />
				</Button>
			</div>
		</div>
	)
}

function defaultRenderRightControl({ scroll }: HeadlessHorizontalScrollRenderProps) {
	return (
		<div
			className={cn(
				"pointer-events-none absolute right-0 top-0 z-10 h-full overflow-hidden rounded-r-full ",
				CONTROL_OVERLAY_WIDTH_CLASS,
			)}
		>
			<div className={cn("absolute inset-0 rounded-r-full", RIGHT_CONTROL_GRADIENT_CLASS)} />
			<div className="relative flex h-full items-center justify-end pr-2">
				<Button
					variant="outline"
					size="icon"
					className="pointer-events-auto !size-4 shrink-0 rounded-full border-muted-foreground/50 text-muted-foreground/50 shadow-xs [&_svg]:size-3"
					onClick={() => scroll("right")}
				>
					<ChevronRight />
				</Button>
			</div>
		</div>
	)
}

function HeadlessHorizontalScroll({
	className,
	style,
	controlBackground = "rgb(var(--background-rgb))",
	allowVerticalOverflow = false,
	"data-testid": dataTestId,
	scrollContainerClassName,
	scrollContainerProps,
	scrollContainerRef: externalScrollContainerRef,
	onScrollContainerContextMenu,
	children,
	scrollStep = 200,
	dragIgnoreSelector,
	hideScrollbar = true,
	renderLeftControl = defaultRenderLeftControl,
	renderRightControl = defaultRenderRightControl,
}: HeadlessHorizontalScrollProps) {
	const internalScrollContainerRef = useRef<HTMLDivElement>(null)
	const scrollContainerRef = externalScrollContainerRef ?? internalScrollContainerRef
	const [showLeftArrow, setShowLeftArrow] = useState(false)
	const [showRightArrow, setShowRightArrow] = useState(false)
	const [isDragging, setIsDragging] = useState(false)

	const checkScrollPosition = useCallback(() => {
		const container = scrollContainerRef.current
		if (!container) return

		const { scrollLeft, scrollWidth, clientWidth } = container
		setShowLeftArrow(scrollLeft > 0)
		setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 1)
	}, [scrollContainerRef])

	const scroll = useCallback(
		(direction: ScrollDirection) => {
			const container = scrollContainerRef.current
			if (!container) return

			const targetScroll =
				direction === "left"
					? container.scrollLeft - scrollStep
					: container.scrollLeft + scrollStep

			container.scrollTo({
				left: targetScroll,
				behavior: "smooth",
			})
		},
		[scrollContainerRef, scrollStep],
	)

	useEffect(() => {
		checkScrollPosition()
		const container = scrollContainerRef.current
		if (!container) return
		let dragState: DragState | null = null
		let suppressClick = false
		let clearClickSuppressionTimer: ReturnType<typeof setTimeout> | null = null

		container.addEventListener("scroll", checkScrollPosition, { passive: true })
		const resizeObserver =
			typeof ResizeObserver !== "undefined" ? new ResizeObserver(checkScrollPosition) : null
		resizeObserver?.observe(container)

		window.addEventListener("resize", checkScrollPosition)

		function handlePointerDown(event: PointerEvent) {
			if (event.pointerType === "touch") return
			if (event.isPrimary === false || event.button !== 0) return
			if (
				dragIgnoreSelector &&
				event.target instanceof Element &&
				event.target.closest(dragIgnoreSelector)
			)
				return
			if (container.scrollWidth <= container.clientWidth) return

			dragState = {
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				startScrollLeft: container.scrollLeft,
				isDragging: false,
				originalScrollBehavior: container.style.scrollBehavior,
			}
		}

		function isHorizontalDrag(event: PointerEvent) {
			if (!dragState) return false

			const deltaX = event.clientX - dragState.startX
			const deltaY = event.clientY - dragState.startY
			return Math.abs(deltaX) >= DRAG_START_DISTANCE && Math.abs(deltaX) > Math.abs(deltaY)
		}

		function activateDrag(pointerId: number, capturePointer: boolean) {
			if (!dragState || dragState.isDragging) return

			dragState.isDragging = true
			container.style.scrollBehavior = "auto"
			if (capturePointer) {
				container.setPointerCapture?.(pointerId)
				setIsDragging(true)
			}
		}

		function handlePointerMove(event: PointerEvent) {
			if (!dragState || dragState.pointerId !== event.pointerId) return
			if ((event.buttons & 1) === 0) {
				resetDrag(false)
				return
			}

			const deltaX = event.clientX - dragState.startX

			if (!dragState.isDragging) {
				if (!isHorizontalDrag(event)) return
				activateDrag(event.pointerId, true)
			}

			event.preventDefault()
			container.scrollLeft = dragState.startScrollLeft - deltaX
		}

		function resetDrag(shouldSuppressClick: boolean) {
			if (!dragState) return

			const completedDrag = dragState
			dragState = null
			setIsDragging(false)

			if (completedDrag.isDragging) {
				container.style.scrollBehavior = completedDrag.originalScrollBehavior
			}

			if (container.hasPointerCapture?.(completedDrag.pointerId)) {
				container.releasePointerCapture(completedDrag.pointerId)
			}

			if (completedDrag.isDragging && shouldSuppressClick) {
				suppressClick = true
				clearClickSuppressionTimer = setTimeout(() => {
					suppressClick = false
					clearClickSuppressionTimer = null
				}, 0)
			}
		}

		function finishDrag(event: PointerEvent, shouldSuppressClick: boolean) {
			if (!dragState || dragState.pointerId !== event.pointerId) return

			if (shouldSuppressClick && !dragState.isDragging && isHorizontalDrag(event)) {
				activateDrag(event.pointerId, false)
				container.scrollLeft =
					dragState.startScrollLeft - (event.clientX - dragState.startX)
			}

			resetDrag(shouldSuppressClick)
		}

		function handlePointerUp(event: PointerEvent) {
			finishDrag(event, true)
		}

		function handlePointerCancel(event: PointerEvent) {
			finishDrag(event, false)
		}

		function handleWindowBlur() {
			resetDrag(false)
		}

		function handleClick(event: MouseEvent) {
			if (!suppressClick) return

			suppressClick = false
			if (clearClickSuppressionTimer) {
				clearTimeout(clearClickSuppressionTimer)
				clearClickSuppressionTimer = null
			}
			event.preventDefault()
			event.stopPropagation()
		}

		container.addEventListener("pointerdown", handlePointerDown)
		container.addEventListener("pointermove", handlePointerMove)
		container.addEventListener("lostpointercapture", handlePointerCancel)
		container.addEventListener("click", handleClick, true)
		window.addEventListener("pointerup", handlePointerUp, true)
		window.addEventListener("pointercancel", handlePointerCancel, true)
		window.addEventListener("blur", handleWindowBlur)

		return () => {
			resetDrag(false)
			container.removeEventListener("scroll", checkScrollPosition)
			container.removeEventListener("pointerdown", handlePointerDown)
			container.removeEventListener("pointermove", handlePointerMove)
			container.removeEventListener("lostpointercapture", handlePointerCancel)
			container.removeEventListener("click", handleClick, true)
			window.removeEventListener("pointerup", handlePointerUp, true)
			window.removeEventListener("pointercancel", handlePointerCancel, true)
			window.removeEventListener("blur", handleWindowBlur)
			if (clearClickSuppressionTimer) clearTimeout(clearClickSuppressionTimer)
			resizeObserver?.disconnect()
			window.removeEventListener("resize", checkScrollPosition)
		}
	}, [checkScrollPosition, scrollContainerRef, dragIgnoreSelector])

	useEffect(() => {
		const frameId = setTimeout(checkScrollPosition, 100)
		return () => clearTimeout(frameId)
	}, [children, checkScrollPosition])

	const renderProps: HeadlessHorizontalScrollRenderProps = {
		scroll,
		showLeftArrow,
		showRightArrow,
		scrollContainerRef,
	}

	return (
		<div
			className={cn(
				"relative rounded-full",
				allowVerticalOverflow ? "overflow-visible" : "overflow-hidden",
				className,
			)}
			style={
				{
					"--control-background": controlBackground,
					...style,
				} as React.CSSProperties
			}
			data-testid={dataTestId}
		>
			{showLeftArrow && renderLeftControl(renderProps)}
			<div
				{...scrollContainerProps}
				ref={scrollContainerRef}
				className={cn(
					hideScrollbar && "no-scrollbar",
					"min-w-0 overflow-x-auto",
					(showLeftArrow || showRightArrow) && "cursor-grab",
					isDragging && "cursor-grabbing select-none",
					scrollContainerClassName,
				)}
				onContextMenu={onScrollContainerContextMenu}
			>
				{children}
			</div>
			{showRightArrow && renderRightControl(renderProps)}
		</div>
	)
}

export default HeadlessHorizontalScroll
