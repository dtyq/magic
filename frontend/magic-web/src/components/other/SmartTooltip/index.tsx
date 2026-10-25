import { memo, ReactNode, useCallback, useEffect, useRef, useState } from "react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/shadcn-ui/tooltip"
import { cn } from "@/utils/cn"

type ActionType = "click" | "hover" | "focus" | "contextMenu"

interface SmartTooltipProps {
	/** Name-only hints never capture clicks and remeasure the actual text box. */
	fileName?: boolean
	getPopupContainer?: () => HTMLElement | null
	children?: ReactNode
	className?: string
	style?: React.CSSProperties
	placement?: "top" | "bottom" | "left" | "right"
	align?: "start" | "center" | "end"
	disabled?: boolean
	maxWidth?: number | string
	/**
	 * Line limit: 1 = single-line ellipsis (default); >1 = line clamp;
	 * 0 = wrap naturally (no clamp), use with width constraints
	 */
	maxLines?: number
	content?: ReactNode
	forceShowTooltip?: boolean
	tooltipContentClassName?: string
	tooltipContentStyle?: React.CSSProperties
	trigger?: ActionType[]
	onOpenChange?: (open: boolean) => void
	onClick?: (e: React.MouseEvent<HTMLElement>) => void
	onPointerEnter?: React.PointerEventHandler<HTMLElement>
	onFocus?: React.FocusEventHandler<HTMLElement>
	onDoubleClick?: (e: React.MouseEvent<HTMLElement>) => void
	sideOffset?: number
	elementType?: "div" | "span"
}

/**
 * Smart Tooltip component that only shows tooltip when text overflows the container
 * Supports single-line and multi-line text overflow detection
 */
const SmartTooltip = memo(function SmartTooltip({
	children = "",
	fileName = false,
	getPopupContainer,
	className,
	style,
	placement = "top",
	align = "center",
	disabled = false,
	maxWidth,
	maxLines = 1,
	content,
	forceShowTooltip = false,
	tooltipContentClassName,
	tooltipContentStyle,
	trigger = ["hover"],
	onOpenChange,
	onClick,
	onDoubleClick,
	onPointerEnter,
	onFocus,
	sideOffset = 4,
	elementType = "div",
	...props
}: SmartTooltipProps) {
	const textRef = useRef<HTMLDivElement | HTMLSpanElement>(null)
	const [showTooltip, setShowTooltip] = useState(false)
	const [tooltipTextContent, setTooltipTextContent] = useState("")

	// Convert trigger array to open state management for shadcn/ui
	const [open, setOpen] = useState(false)
	const canOpenRef = useRef(false)
	const effectiveShowTooltip = forceShowTooltip || showTooltip

	const checkOverflow = useCallback(() => {
		if (!textRef.current) return false

		const element = textRef.current
		let isOverflowing = false
		const nextTooltipTextContent = element.textContent?.trim() ?? ""
		const descendantOverflow = Array.from(element.querySelectorAll<HTMLElement>("*")).some(
			(descendant) => {
				const computedStyle = window.getComputedStyle(descendant)
				const clipsVertically = ["hidden", "clip", "scroll", "auto"].includes(
					computedStyle.overflowY,
				)
				const clipsHorizontally = ["hidden", "clip", "scroll", "auto"].includes(
					computedStyle.overflowX,
				)

				return (
					(clipsVertically && descendant.scrollHeight > descendant.clientHeight) ||
					(clipsHorizontally && descendant.scrollWidth > descendant.clientWidth)
				)
			},
		)

		if (maxLines > 1) {
			// Multi-line clamp: hidden lines increase scrollHeight
			isOverflowing = element.scrollHeight > element.clientHeight || descendantOverflow
		} else if (maxLines === 0) {
			// Wrapped text: overflow when height or width is constrained
			isOverflowing =
				element.scrollHeight > element.clientHeight ||
				element.scrollWidth > element.clientWidth ||
				descendantOverflow
		} else {
			// Single-line: compare scrollWidth and clientWidth
			isOverflowing = element.scrollWidth > element.clientWidth || descendantOverflow
		}

		setTooltipTextContent((previousContent) =>
			previousContent === nextTooltipTextContent ? previousContent : nextTooltipTextContent,
		)
		setShowTooltip(isOverflowing)
		return isOverflowing
	}, [maxLines])

	useEffect(() => {
		// Delayed detection to ensure DOM rendering is complete
		const timer = fileName ? undefined : setTimeout(checkOverflow, 100)

		if (fileName) {
			setOpen(false)
		}

		// Listen for window resize
		// 文件名在进入、聚焦和打开前读取当前尺寸；未交互行不随挂载或窗口变化批量测量。
		if (!fileName) window.addEventListener("resize", checkOverflow)

		return () => {
			if (timer !== undefined) clearTimeout(timer)
			window.removeEventListener("resize", checkOverflow)
		}
	}, [children, fileName, checkOverflow])

	// 只在名称提示打开时观察尺寸；虚拟列表里的其它文件不安装持续尺寸监听。
	useEffect(() => {
		if (!fileName || !open || !textRef.current) return
		const observer = new ResizeObserver(() => {
			if (!checkOverflow()) setOpen(false)
		})
		observer.observe(textRef.current)
		return () => observer.disconnect()
	}, [fileName, open, checkOverflow])

	useEffect(() => {
		if (disabled) {
			canOpenRef.current = false
			if (open) {
				setOpen(false)
				onOpenChange?.(false)
			}
		}
	}, [disabled, open, onOpenChange])

	const handleOpenChange = (nextOpen: boolean) => {
		const nextVisible =
			nextOpen && !disabled && canOpenRef.current && (forceShowTooltip || checkOverflow())
		setOpen(nextVisible)
		onOpenChange?.(nextVisible)
	}

	// 使用当前文字区域的尺寸；菜单或拖拽使旧悬停失效，恢复后等待新的进入／聚焦。
	const handlePointerEnter: React.PointerEventHandler<HTMLElement> = (event) => {
		onPointerEnter?.(event)
		if (event.defaultPrevented) return
		checkOverflow()
		canOpenRef.current = !disabled
	}
	const handleFocus: React.FocusEventHandler<HTMLElement> = (event) => {
		onFocus?.(event)
		if (event.defaultPrevented) return
		checkOverflow()
		canOpenRef.current = !disabled
	}

	const handleTriggerClick = (e: React.MouseEvent<HTMLElement>) => {
		if (trigger.includes("click") && !disabled) {
			// fileName 不预先测量，点击触发也必须使用当前尺寸；其它模式保持原显示资格。
			const canShowTooltip = fileName
				? forceShowTooltip || checkOverflow()
				: effectiveShowTooltip
			if (canShowTooltip) setOpen(!open)
		}
		onClick?.(e)
	}

	const textClasses = cn(
		"text-sm font-normal leading-5",
		maxLines > 1
			? "overflow-hidden text-ellipsis [-webkit-box-orient:vertical] [display:-webkit-box]"
			: maxLines === 0
				? "min-w-0 whitespace-normal break-words"
				: "overflow-hidden text-ellipsis whitespace-nowrap",
		className,
	)

	const textStyle: React.CSSProperties = {
		...(maxWidth !== undefined && {
			maxWidth: typeof maxWidth === "number" ? `${maxWidth}px` : maxWidth,
		}),
		...(maxLines > 1 && { WebkitLineClamp: maxLines }),
	}

	const sharedProps = {
		className: textClasses,
		style: { ...textStyle, ...style },
		onClick: handleTriggerClick,
		onDoubleClick,
		onPointerEnter: handlePointerEnter,
		onFocus: handleFocus,
		...(fileName && {
			onPointerDown: () => {
				canOpenRef.current = false
				setOpen(false)
			},
			onDragStart: () => {
				canOpenRef.current = false
				setOpen(false)
			},
			onPointerLeave: () => {
				canOpenRef.current = false
				setOpen(false)
			},
		}),
		...props,
	}
	// Avoid inheriting trigger layout styles into the tooltip body.
	const tooltipBodyContent = resolveTooltipBodyContent({
		children,
		content,
		tooltipTextContent,
	})

	return (
		<Tooltip
			delayDuration={fileName ? 400 : undefined}
			disableHoverableContent={fileName || undefined}
			open={open && effectiveShowTooltip && !disabled}
			onOpenChange={handleOpenChange}
		>
			<TooltipTrigger asChild>
				{elementType === "div" ? (
					<div ref={textRef as React.RefObject<HTMLDivElement>} {...sharedProps}>
						{children}
					</div>
				) : (
					<span ref={textRef as React.RefObject<HTMLSpanElement>} {...sharedProps}>
						{children}
					</span>
				)}
			</TooltipTrigger>
			{effectiveShowTooltip && (
				<TooltipContent
					className={cn(
						"z-tooltip max-w-[min(20rem,var(--radix-tooltip-content-available-width,100vw))] whitespace-normal text-wrap break-words",
						tooltipContentClassName,
						fileName && "pointer-events-none",
					)}
					container={getPopupContainer?.() ?? undefined}
					style={
						fileName
							? { ...tooltipContentStyle, pointerEvents: "none" }
							: tooltipContentStyle
					}
					sideOffset={sideOffset}
					side={placement}
					align={align}
				>
					{tooltipBodyContent}
				</TooltipContent>
			)}
		</Tooltip>
	)
})

export default SmartTooltip

function resolveTooltipBodyContent({
	children,
	content,
	tooltipTextContent,
}: {
	children: ReactNode
	content?: ReactNode
	tooltipTextContent: string
}) {
	if (content !== undefined && content !== null) return content
	if (isPrimitiveTooltipContent(children)) return children

	return tooltipTextContent
}

function isPrimitiveTooltipContent(children: ReactNode): children is string | number {
	return typeof children === "string" || typeof children === "number"
}
