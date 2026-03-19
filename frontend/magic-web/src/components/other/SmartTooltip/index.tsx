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
	/** Max lines, if not set, detect single line overflow */
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
	const textRef = useRef<HTMLElement>(null)
	const [showTooltip, setShowTooltip] = useState(false)

	// Convert trigger array to open state management for shadcn/ui
	const [open, setOpen] = useState(false)
	const shouldUseControlled = trigger.includes("click")

	useEffect(() => {
		const checkOverflow = () => {
			if (!textRef.current) return

			const element = textRef.current
			let isOverflowing = false

			if (maxLines && maxLines > 1) {
				// Multi-line text detection: compare scrollHeight and clientHeight
				// If scrollHeight > clientHeight, content is hidden by CSS
				isOverflowing = element.scrollHeight > element.clientHeight
			} else {
				// Single-line text detection: compare scrollWidth and clientWidth
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
		"overflow-hidden text-ellipsis text-sm font-normal leading-5",
		maxLines && maxLines > 1
			? "[-webkit-box-orient:vertical] [display:-webkit-box]"
			: "whitespace-nowrap",
		className,
	)

	const textStyle: React.CSSProperties = {
		...(maxWidth && { maxWidth: `${maxWidth}px` }),
		...(maxLines && maxLines > 1 && { WebkitLineClamp: maxLines }),
	}

	const ElementTag = elementType

	return (
		<Tooltip
			open={shouldUseControlled ? (showTooltip ? open : false) : undefined}
			onOpenChange={shouldUseControlled ? setOpen : undefined}
		>
			<TooltipTrigger asChild>
				<ElementTag
					ref={textRef}
					className={textClasses}
					style={{ ...textStyle, ...style }}
					onClick={handleTriggerClick}
					onDoubleClick={onDoubleClick}
					{...props}
				>
					{children}
				</ElementTag>
			</TooltipTrigger>
			{showTooltip && (
				<TooltipContent className="z-tooltip" sideOffset={sideOffset} side={placement}>
					{content || children}
				</TooltipContent>
			)}
		</Tooltip>
	)
})

export default SmartTooltip
