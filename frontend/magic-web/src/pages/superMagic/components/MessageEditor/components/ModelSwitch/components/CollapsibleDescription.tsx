import { ChevronDown, ChevronUp } from "lucide-react"
import React, { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface CollapsibleDescriptionProps {
	description?: string
	isDisabled?: boolean
	isExpanded: boolean
	expandLabel: string
	collapseLabel: string
	onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void
}

export function CollapsibleDescription({
	description,
	isDisabled,
	isExpanded,
	expandLabel,
	collapseLabel,
	onToggle,
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
				"relative text-xs font-normal leading-4 text-muted-foreground",
				isDisabled && "opacity-50",
			)}
		>
			<div
				ref={descriptionRef}
				className={cn(canToggle && "pr-6", !isExpanded && "line-clamp-2")}
			>
				{description}
			</div>
			{canToggle ? (
				<button
					type="button"
					className={cn(
						"absolute bottom-0 right-0 flex size-4 items-center justify-center",
						"rounded-sm bg-background text-muted-foreground transition-colors",
						"hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
					)}
					aria-label={toggleLabel}
					title={toggleLabel}
					aria-expanded={isExpanded}
					onPointerDown={handleTogglePointerDown}
					onClick={handleToggleClick}
					onKeyDown={(event) => event.stopPropagation()}
					data-testid="collapsible-description-toggle"
				>
					<ToggleIcon className="size-3" strokeWidth={2} />
				</button>
			) : null}
		</div>
	)
}
