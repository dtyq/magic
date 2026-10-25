import * as React from "react"
import * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area"

import { ChevronUp, ChevronDown } from "lucide-react"
import { useReducedMotion } from "framer-motion"

import { cn } from "@/utils/cn"

// Use a thinner top hint below fixed navigation while retaining the bottom click target.
export const SCROLL_HINT_HEIGHTS = { top: 16, bottom: 18 } as const

type ScrollAreaViewportProps = Omit<
	React.ComponentProps<typeof ScrollAreaPrimitive.Viewport>,
	"ref" | "className" | "style" | "id" | "children"
> & {
	[key: `data-${string}`]: string | number | boolean | undefined
}

type ScrollAreaProps = React.ComponentProps<typeof ScrollAreaPrimitive.Root> & {
	viewportClassName?: string
	viewportStyle?: React.CSSProperties
	viewportRef?: React.Ref<HTMLDivElement>
	viewportId?: string
	/** Keep scroll events and data attributes on the actual scrolling element. */
	viewportProps?: ScrollAreaViewportProps
	hideScrollbar?: boolean
	/** Show vertical edge shadows only where content remains outside the viewport. */
	scrollShadows?: boolean
	scrollHints?: {
		variant: "arrows" | "both"
		upLabel: string
		downLabel: string
	}
	scrollbarOrientation?: React.ComponentProps<
		typeof ScrollAreaPrimitive.ScrollAreaScrollbar
	>["orientation"]
}

const ScrollArea = React.forwardRef<
	React.ElementRef<typeof ScrollAreaPrimitive.Root>,
	ScrollAreaProps
>(
	(
		{
			className,
			style,
			children,
			viewportClassName,
			viewportStyle,
			viewportRef,
			viewportId,
			viewportProps,
			hideScrollbar = false,
			scrollShadows = false,
			scrollHints,
			scrollbarOrientation = "vertical",
			...props
		},
		ref,
	) => {
		const localViewportRef = React.useRef<HTMLDivElement | null>(null)
		const reducedMotion = useReducedMotion()
		const [edges, setEdges] = React.useState({ top: false, bottom: false })
		const edgesRef = React.useRef(edges)
		const scrollTargetRef = React.useRef<number | null>(null)
		const pendingScrollRef = React.useRef<{
			scrollTop: number
			topInset: number
			atBottom: boolean
		} | null>(null)
		const setViewportRef = React.useCallback(
			(node: HTMLDivElement | null) => {
				localViewportRef.current = node
				if (typeof viewportRef === "function") viewportRef(node)
				else if (viewportRef)
					(viewportRef as React.MutableRefObject<HTMLDivElement | null>).current = node
			},
			[viewportRef],
		)
		const showHints = !!scrollHints && scrollbarOrientation === "vertical"
		const showShadows =
			(scrollHints ? scrollHints.variant === "both" : scrollShadows) &&
			scrollbarOrientation === "vertical"
		const observeEdges = showHints || showShadows
		const scrollPage = (direction: -1 | 1) => {
			const viewport = localViewportRef.current
			if (!viewport) return
			const top = Math.max(
				0,
				Math.min(
					viewport.scrollHeight - viewport.clientHeight,
					viewport.scrollTop + direction * viewport.clientHeight * 0.75,
				),
			)
			scrollTargetRef.current = top
			viewport.scrollTo({
				top,
				behavior: reducedMotion ? "auto" : "smooth",
			})
		}
		React.useLayoutEffect(() => {
			const viewport = localViewportRef.current
			if (!observeEdges || !viewport) return
			const measure = () => {
				if (
					scrollTargetRef.current !== null &&
					Math.abs(viewport.scrollTop - scrollTargetRef.current) <= 1
				)
					scrollTargetRef.current = null
				// Measure before hint insets so the arrows cannot make an empty list overflow.
				const contentHeight =
					viewport.firstElementChild?.getBoundingClientRect().height ?? 0
				const overflows =
					!showHints || contentHeight > (viewport.parentElement?.clientHeight ?? 0) + 1
				// Fractional scroll offsets can leave a subpixel remainder at either edge.
				const remaining = viewport.scrollHeight - viewport.clientHeight - viewport.scrollTop
				const top = overflows && viewport.scrollTop > 1
				const bottom = overflows && remaining > 1
				if (edgesRef.current.top === top && edgesRef.current.bottom === bottom) return
				if (showHints)
					pendingScrollRef.current = {
						scrollTop: viewport.scrollTop,
						topInset: viewport.offsetTop,
						atBottom: remaining <= 1,
					}
				edgesRef.current = { top, bottom }
				setEdges(edgesRef.current)
			}
			measure()
			const observer = new ResizeObserver(measure)
			observer.observe(viewport)
			if (viewport.parentElement) observer.observe(viewport.parentElement)
			// Radix's content wrapper changes size when entries load, expand, or wrap.
			if (viewport.firstElementChild) observer.observe(viewport.firstElementChild)
			viewport.addEventListener("scroll", measure, { passive: true })
			const clearScrollTarget = () => {
				scrollTargetRef.current = null
			}
			// Manual input takes over from any pending arrow-triggered smooth scroll.
			viewport.addEventListener("wheel", clearScrollTarget, { passive: true })
			viewport.addEventListener("pointerdown", clearScrollTarget)
			viewport.addEventListener("keydown", clearScrollTarget)
			viewport.addEventListener("scrollend", clearScrollTarget)
			return () => {
				observer.disconnect()
				viewport.removeEventListener("scroll", measure)
				viewport.removeEventListener("wheel", clearScrollTarget)
				viewport.removeEventListener("pointerdown", clearScrollTarget)
				viewport.removeEventListener("keydown", clearScrollTarget)
				viewport.removeEventListener("scrollend", clearScrollTarget)
			}
		}, [observeEdges, showHints])
		React.useLayoutEffect(() => {
			if (edges !== edgesRef.current) return
			const viewport = localViewportRef.current
			const anchor = pendingScrollRef.current
			pendingScrollRef.current = null
			if (!showHints || !viewport || !anchor) return
			// A new bottom hint does not shift content; avoid interrupting native smooth scrolling.
			if (edges.top && !anchor.atBottom && viewport.offsetTop === anchor.topInset) return
			// Preserve the content anchor as the top hint changes, fully revealing boundary rows.
			viewport.scrollTop = !edges.top
				? 0
				: anchor.atBottom
					? viewport.scrollHeight - viewport.clientHeight
					: anchor.scrollTop + viewport.offsetTop - anchor.topInset
			// Anchor compensation interrupts smooth scrolling, so resume its remaining distance.
			if (scrollTargetRef.current !== null) {
				const top = Math.max(
					0,
					Math.min(
						viewport.scrollHeight - viewport.clientHeight,
						scrollTargetRef.current + viewport.offsetTop - anchor.topInset,
					),
				)
				scrollTargetRef.current = top
				viewport.scrollTo({ top, behavior: reducedMotion ? "auto" : "smooth" })
			}
		}, [edges, showHints, reducedMotion])
		return (
			<ScrollAreaPrimitive.Root
				ref={ref}
				data-slot="scroll-area"
				className={cn("relative", className, showHints && "grid")}
				style={{
					...style,
					...(showHints && {
						gridTemplateRows: `${edges.top ? SCROLL_HINT_HEIGHTS.top : 0}px minmax(0, 1fr) ${edges.bottom ? SCROLL_HINT_HEIGHTS.bottom : 0}px`,
					}),
				}}
				{...props}
			>
				<ScrollAreaPrimitive.Viewport
					// Explicit focusability preserves keyboard scrolling in older Chrome/WebView versions.
					tabIndex={0}
					{...viewportProps}
					id={viewportId}
					ref={setViewportRef}
					data-slot="scroll-area-viewport"
					className={cn(
						"size-full rounded-[inherit] outline-none transition-[color,box-shadow] focus-visible:outline-1 focus-visible:ring-[3px] focus-visible:ring-ring/50",
						viewportClassName,
						showHints && "row-start-2 min-h-0",
					)}
					style={viewportStyle}
				>
					{children}
				</ScrollAreaPrimitive.Viewport>
				{/* Radix enables scrolling on an axis only when its matching scrollbar is mounted. */}
				{/* Hide the control without unmounting it, so wheel and keyboard scrolling remain enabled. */}
				<ScrollBar
					orientation={scrollbarOrientation}
					className={hideScrollbar ? "invisible" : undefined}
				/>
				<ScrollAreaPrimitive.Corner />
				{showHints &&
					scrollHints &&
					([-1, 1] as const).map((direction) => {
						const visible = direction < 0 ? edges.top : edges.bottom
						if (!visible) return null
						const Icon = direction < 0 ? ChevronUp : ChevronDown
						return (
							<button
								key={direction}
								type="button"
								aria-label={
									direction < 0 ? scrollHints.upLabel : scrollHints.downLabel
								}
								onClick={() => scrollPage(direction)}
								style={{
									height:
										direction < 0
											? SCROLL_HINT_HEIGHTS.top
											: SCROLL_HINT_HEIGHTS.bottom,
								}}
								className={cn(
									"z-10 flex w-6 items-center justify-center justify-self-center rounded-sm text-muted-foreground opacity-[0.65] outline-none transition-opacity hover:opacity-100 focus-visible:ring-1 focus-visible:ring-ring motion-reduce:transition-none",
									// Put spacing below the upper arrow to separate it from sticky navigation.
									direction < 0 ? "row-start-1 pb-2" : "row-start-3",
								)}
							>
								<Icon className="size-3" strokeWidth={1.5} />
							</button>
						)
					})}
				{showShadows && (
					<>
						<div
							aria-hidden
							style={
								showHints && edges.top
									? { top: SCROLL_HINT_HEIGHTS.top }
									: undefined
							}
							className={cn(
								"pointer-events-none absolute inset-x-2 top-0 z-10 h-1 bg-gradient-to-b from-black/[0.04] to-transparent dark:from-black/[0.14]",
								showHints &&
									"h-3 from-black/[0.035] transition-opacity [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)] motion-reduce:transition-none",
								!edges.top && "invisible",
							)}
						/>
						<div
							aria-hidden
							style={
								showHints && edges.bottom
									? { bottom: SCROLL_HINT_HEIGHTS.bottom }
									: undefined
							}
							className={cn(
								"pointer-events-none absolute inset-x-2 bottom-0 z-10 h-1 bg-gradient-to-t from-black/[0.04] to-transparent dark:from-black/[0.14]",
								showHints &&
									"h-3 from-black/[0.035] transition-opacity [mask-image:linear-gradient(to_right,transparent,black_20%,black_80%,transparent)] motion-reduce:transition-none",
								!edges.bottom && "invisible",
							)}
						/>
					</>
				)}
			</ScrollAreaPrimitive.Root>
		)
	},
)

// Set through Object.assign so the file type-checks in the host app and in standalone admin builds.
Object.assign(ScrollArea, { displayName: "ScrollArea" })

function ScrollBar({
	className,
	orientation = "vertical",
	...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.ScrollAreaScrollbar>) {
	return (
		<ScrollAreaPrimitive.ScrollAreaScrollbar
			data-slot="scroll-area-scrollbar"
			orientation={orientation}
			className={cn(
				"flex touch-none select-none p-px transition-colors",
				orientation === "vertical" && "h-full w-2.5 border-l border-l-transparent",
				orientation === "horizontal" && "h-2.5 flex-col border-t border-t-transparent",
				className,
			)}
			{...props}
		>
			<ScrollAreaPrimitive.ScrollAreaThumb
				data-slot="scroll-area-thumb"
				className="relative flex-1 rounded-full bg-border"
			/>
		</ScrollAreaPrimitive.ScrollAreaScrollbar>
	)
}

export { ScrollArea, ScrollBar }
