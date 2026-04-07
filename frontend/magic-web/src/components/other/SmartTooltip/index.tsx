import { memo, ReactNode, useEffect, useRef, useState } from "react"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/shadcn-ui/tooltip"
import { cn } from "@/lib/utils"

type ActionType = "click" | "hover" | "focus" | "contextMenu"

interface SmartTooltipProps {
	children?: ReactNode
	className?: string
	style?: React.CSSProperties
	placement?: "top" | "bottom" | "left" | "right"
	maxWidth?: number
	/**
	 * Line limit: 1 = single-line ellipsis (default); >1 = line clamp;
	 * 0 = wrap naturally (no clamp), use with width constraints
	 */
	maxLines?: number
	content?: ReactNode
	trigger?: ActionType[]
	onClick?: (e: React.MouseEvent<HTMLElement>) => void
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
	className,
	style,
	placement = "top",
	maxWidth,
	maxLines = 1,
	content,
	trigger = ["hover"],
	onClick,
	onDoubleClick,
	sideOffset = 0,
	elementType = "div",
	...props
}: SmartTooltipProps) {
	const textRef = useRef<HTMLDivElement | HTMLSpanElement>(null)
	const [showTooltip, setShowTooltip] = useState(false)

	// Convert trigger array to open state management for shadcn/ui
	const [open, setOpen] = useState(false)
	const shouldUseControlled = trigger.includes("click")

	useEffect(() => {
		const checkOverflow = () => {
			if (!textRef.current) return

			const element = textRef.current
			let isOverflowing = false

			if (maxLines > 1) {
				// Multi-line clamp: hidden lines increase scrollHeight
				isOverflowing = element.scrollHeight > element.clientHeight
			} else if (maxLines === 0) {
				// Wrapped text: overflow when height or width is constrained
				isOverflowing =
					element.scrollHeight > element.clientHeight ||
					element.scrollWidth > element.clientWidth
			} else {
				// Single-line: compare scrollWidth and clientWidth
				isOverflowing = element.scrollWidth > element.clientWidth
			}

			setShowTooltip(isOverflowing)
		}

		// Delayed detection to ensure DOM rendering is complete
		const timer = setTimeout(checkOverflow, 100)

		// Listen for window resize
		window.addEventListener("resize", checkOverflow)

		return () => {
			clearTimeout(timer)
			window.removeEventListener("resize", checkOverflow)
		}
	}, [children, maxLines])

	const handleTriggerClick = (e: React.MouseEvent<HTMLElement>) => {
		if (trigger.includes("click") && showTooltip) {
			setOpen(!open)
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
		...(maxWidth && { maxWidth: `${maxWidth}px` }),
		...(maxLines > 1 && { WebkitLineClamp: maxLines }),
	}

	const sharedProps = {
		className: textClasses,
		style: { ...textStyle, ...style },
		onClick: handleTriggerClick,
		onDoubleClick,
		...props,
	}

	return (
		<Tooltip
			open={shouldUseControlled ? (showTooltip ? open : false) : undefined}
			onOpenChange={shouldUseControlled ? setOpen : undefined}
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
			{showTooltip && (
				<TooltipContent
					className={cn(
						"z-tooltip max-w-[min(20rem,var(--radix-tooltip-content-available-width,100vw))] whitespace-normal break-words",
					)}
					sideOffset={sideOffset}
					side={placement}
				>
					{content || children}
				</TooltipContent>
			)}
		</Tooltip>
	)
})

export default SmartTooltip
