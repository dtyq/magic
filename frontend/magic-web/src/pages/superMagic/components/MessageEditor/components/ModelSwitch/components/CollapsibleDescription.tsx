import { ChevronDown, ChevronUp } from "lucide-react"
import React, { useEffect, useRef, useState } from "react"
import { cn } from "@/utils/cn"

interface CollapsibleDescriptionProps {
	description?: string
	isDisabled?: boolean
	isExpanded: boolean
	expandLabel: string
	collapseLabel: string
	onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void
	className?: string
	variant?: "compact" | "mobile"
}

export function CollapsibleDescription({
	description,
	isDisabled,
	isExpanded,
	expandLabel,
	collapseLabel,
	onToggle,
	className,
	variant = "compact",
}: CollapsibleDescriptionProps) {
	const descriptionRef = useRef<HTMLDivElement>(null)
	const [canToggle, setCanToggle] = useState(false)

	useEffect(() => {
		const descriptionElement = descriptionRef.current
		if (!descriptionElement) return
		const element = descriptionElement

		function updateCanToggle() {
			setCanToggle(isExpanded || element.scrollHeight > element.clientHeight + 1)
		}

		updateCanToggle()

		if (typeof ResizeObserver === "undefined") return

		const resizeObserver = new ResizeObserver(updateCanToggle)
		resizeObserver.observe(element)

		return () => resizeObserver.disconnect()
	}, [description, isExpanded])

	if (!description) return null

	const ToggleIcon = isExpanded ? ChevronUp : ChevronDown
	const toggleLabel = isExpanded ? collapseLabel : expandLabel

	function handleToggleClick(event: React.MouseEvent<HTMLButtonElement>) {
		event.preventDefault()
		event.stopPropagation()
		onToggle(event)
	}

	function handleTogglePointerDown(event: React.PointerEvent<HTMLButtonElement>) {
		event.preventDefault()
		event.stopPropagation()
	}

	return (
		<div
			className={cn(
				"relative font-normal text-muted-foreground",
				variant === "mobile" ? "text-sm leading-6" : "text-xs leading-4",
				className,
				isDisabled && "opacity-50",
			)}
		>
			<div
				ref={descriptionRef}
				className={cn(
					canToggle && variant === "compact" && "pr-6",
					!isExpanded && "line-clamp-2",
					variant === "mobile" && "break-words",
				)}
			>
				{description}
			</div>
			{canToggle ? (
				<button
					type="button"
					className={cn(
						"flex items-center justify-center rounded-sm transition-colors",
						variant === "mobile"
							? "mt-1 min-h-11 gap-1 text-primary"
							: "absolute bottom-0 right-0 size-4 bg-background text-muted-foreground",
						"hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
					)}
					aria-label={toggleLabel}
					title={toggleLabel}
					aria-expanded={isExpanded}
					data-collapsible-description-toggle="true"
					onPointerDown={handleTogglePointerDown}
					onClick={handleToggleClick}
					onKeyDown={(event) => event.stopPropagation()}
					data-testid="collapsible-description-toggle"
				>
					{variant === "mobile" && <span>{toggleLabel}</span>}
					<ToggleIcon className="size-3" strokeWidth={2} />
				</button>
			) : null}
		</div>
	)
}
