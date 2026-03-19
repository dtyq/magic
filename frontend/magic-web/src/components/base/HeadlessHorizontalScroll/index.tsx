import { useCallback, useEffect, useRef, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { cn } from "@/lib/utils"
import type { MouseEventHandler, ReactNode, RefObject } from "react"

type ScrollDirection = "left" | "right"
const SCROLLABLE_OVERFLOW_Y = new Set(["auto", "scroll", "overlay"])
const CONTROL_OVERLAY_WIDTH_CLASS = "w-20"
const LEFT_CONTROL_GRADIENT_CLASS =
	"bg-[linear-gradient(to_left,_transparent_0%,_var(--control-background)_50%,_var(--control-background)_100%)]"
const RIGHT_CONTROL_GRADIENT_CLASS =
	"bg-[linear-gradient(to_right,_transparent_0%,_var(--control-background)_50%,_var(--control-background)_100%)]"

function canConsumeVerticalScroll(element: HTMLElement, deltaY: number) {
	const computedStyle = window.getComputedStyle(element)
	if (!SCROLLABLE_OVERFLOW_Y.has(computedStyle.overflowY)) return false
	if (element.scrollHeight <= element.clientHeight) return false

	if (deltaY > 0) {
		return element.scrollTop + element.clientHeight < element.scrollHeight
	}
	if (deltaY < 0) {
		return element.scrollTop > 0
	}

	return false
}

function shouldSkipHorizontalScroll(
	target: HTMLElement,
	container: HTMLDivElement,
	deltaY: number,
) {
	let current: HTMLElement | null = target
	while (current && current !== container) {
		if (canConsumeVerticalScroll(current, deltaY)) return true
		current = current.parentElement
	}

	return false
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
	"data-testid"?: string
	scrollContainerClassName?: string
	scrollContainerRef?: RefObject<HTMLDivElement>
	onScrollContainerContextMenu?: MouseEventHandler<HTMLDivElement>
	children: ReactNode
	scrollStep?: number
	enableWheelScroll?: boolean
	renderLeftControl?: (props: HeadlessHorizontalScrollRenderProps) => ReactNode
	renderRightControl?: (props: HeadlessHorizontalScrollRenderProps) => ReactNode
}

function defaultRenderLeftControl({ scroll }: HeadlessHorizontalScrollRenderProps) {
	return (
		<div
			className={cn(
				"pointer-events-none absolute left-0 top-0 z-10 h-full overflow-hidden",
				CONTROL_OVERLAY_WIDTH_CLASS,
			)}
		>
			<div className={cn("absolute inset-0", LEFT_CONTROL_GRADIENT_CLASS)} />
			<div className="relative flex h-full items-center justify-start pl-2">
				<Button
					variant="outline"
					size="icon"
					className="pointer-events-auto !size-4 shrink-0 rounded-full border-muted-foreground text-muted-foreground shadow-xs [&_svg]:size-3"
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
				"pointer-events-none absolute right-0 top-0 z-10 h-full overflow-hidden",
				CONTROL_OVERLAY_WIDTH_CLASS,
			)}
		>
			<div className={cn("absolute inset-0", RIGHT_CONTROL_GRADIENT_CLASS)} />
			<div className="relative flex h-full items-center justify-end pr-2">
				<Button
					variant="outline"
					size="icon"
					className="pointer-events-auto !size-4 shrink-0 rounded-full border-muted-foreground text-muted-foreground shadow-xs [&_svg]:size-3"
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
	"data-testid": dataTestId,
	scrollContainerClassName,
	scrollContainerRef: externalScrollContainerRef,
	onScrollContainerContextMenu,
	children,
	scrollStep = 200,
	enableWheelScroll = true,
	renderLeftControl = defaultRenderLeftControl,
	renderRightControl = defaultRenderRightControl,
}: HeadlessHorizontalScrollProps) {
	const internalScrollContainerRef = useRef<HTMLDivElement>(null)
	const scrollContainerRef = externalScrollContainerRef ?? internalScrollContainerRef
	const [showLeftArrow, setShowLeftArrow] = useState(false)
	const [showRightArrow, setShowRightArrow] = useState(false)

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

	// Use a ref to avoid stale closure in the native wheel handler
	const enableWheelScrollRef = useRef(enableWheelScroll)
	useEffect(() => {
		enableWheelScrollRef.current = enableWheelScroll
	}, [enableWheelScroll])

	useEffect(() => {
		checkScrollPosition()
		const container = scrollContainerRef.current
		if (!container) return

		container.addEventListener("scroll", checkScrollPosition, { passive: true })
		const resizeObserver =
			typeof ResizeObserver !== "undefined" ? new ResizeObserver(checkScrollPosition) : null
		resizeObserver?.observe(container)

		window.addEventListener("resize", checkScrollPosition)

		// Native wheel handler registered with passive:false so preventDefault works
		function handleWheel(event: globalThis.WheelEvent) {
			if (!container) return
			if (!enableWheelScrollRef.current) return
			if (container.scrollWidth <= container.clientWidth) return

			// React portals bubble through React tree; ignore wheel events coming
			// from outside this scroll container in the actual DOM tree.
			const eventTarget = event.target
			if (!(eventTarget instanceof Node) || !container.contains(eventTarget)) return

			const targetElement =
				eventTarget instanceof HTMLElement ? eventTarget : eventTarget.parentElement
			if (!targetElement) return
			if (shouldSkipHorizontalScroll(targetElement, container, event.deltaY)) return

			const useVerticalDelta = Math.abs(event.deltaY) > Math.abs(event.deltaX)
			if (!useVerticalDelta || event.deltaY === 0) return

			const maxScrollLeft = container.scrollWidth - container.clientWidth
			const nextScrollLeft = Math.max(
				0,
				Math.min(maxScrollLeft, container.scrollLeft + event.deltaY),
			)
			if (nextScrollLeft === container.scrollLeft) return

			event.preventDefault()
			container.scrollLeft = nextScrollLeft
			checkScrollPosition()
		}

		container.addEventListener("wheel", handleWheel, { passive: false })

		return () => {
			container.removeEventListener("scroll", checkScrollPosition)
			container.removeEventListener("wheel", handleWheel)
			resizeObserver?.disconnect()
			window.removeEventListener("resize", checkScrollPosition)
		}
	}, [checkScrollPosition, scrollContainerRef])

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
			className={cn("relative", className)}
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
				ref={scrollContainerRef}
				className={cn("no-scrollbar min-w-0 overflow-x-auto", scrollContainerClassName)}
				onContextMenu={onScrollContainerContextMenu}
			>
				{children}
			</div>
			{showRightArrow && renderRightControl(renderProps)}
		</div>
	)
}

export default HeadlessHorizontalScroll
