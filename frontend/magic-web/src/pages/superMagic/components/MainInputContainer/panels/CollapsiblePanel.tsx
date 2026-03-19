import { ReactNode, useState, useEffect } from "react"
import { observer } from "mobx-react-lite"
import {
	Collapsible,
	CollapsibleTrigger,
	CollapsibleContent,
} from "@/components/shadcn-ui/collapsible"
import { LucideLazyIcon } from "@/utils/lucideIconLoader"

interface CollapsiblePanelProps {
	// Panel title
	title?: string
	// Whether the panel is expandable
	expandable?: boolean
	// Default expanded state
	defaultExpanded?: boolean
	// Controlled expanded state
	expanded?: boolean
	// Callback when expanded state changes
	onExpandedChange?: (expanded: boolean) => void
	// Header content (replaces default title)
	header?: ReactNode
	// Main content
	children: ReactNode
	// Additional class name
	className?: string
	// Whether to show expand icon in header
	showExpandIcon?: boolean
}

function CollapsiblePanel({
	title,
	expandable = true,
	defaultExpanded = true,
	expanded: controlledExpanded,
	onExpandedChange,
	header,
	children,
	className = "",
	showExpandIcon = true,
}: CollapsiblePanelProps) {
	// Use controlled or uncontrolled state
	const [uncontrolledExpanded, setUncontrolledExpanded] = useState(defaultExpanded)
	const isExpanded = controlledExpanded !== undefined ? controlledExpanded : uncontrolledExpanded

	// Sync with defaultExpanded changes
	useEffect(() => {
		if (controlledExpanded === undefined) {
			setUncontrolledExpanded(defaultExpanded)
		}
	}, [defaultExpanded, controlledExpanded])

	const handleExpandedChange = (newExpanded: boolean) => {
		if (controlledExpanded === undefined) {
			setUncontrolledExpanded(newExpanded)
		}
		onExpandedChange?.(newExpanded)
	}

	// If not expandable, render children directly with optional header
	if (!expandable) {
		return (
			<div className={`flex w-full flex-col gap-2 ${className}`}>
				{(header || title) && (
					<div className="flex w-full items-center gap-2 [&:empty]:hidden">
						{header || <span className="font-medium">{title}</span>}
					</div>
				)}
				{children}
			</div>
		)
	}

	return (
		<Collapsible
			open={isExpanded}
			onOpenChange={handleExpandedChange}
			className={`w-full ${className}`}
		>
			<div className="flex w-full flex-col gap-3">
				<CollapsibleTrigger asChild className="cursor-pointer">
					<div className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-foreground hover:bg-accent">
						{showExpandIcon && (
							<LucideLazyIcon
								icon={isExpanded ? "ChevronDown" : "ChevronRight"}
								size={16}
								className="flex-shrink-0 text-muted-foreground transition-transform"
							/>
						)}
						{header || <span className="font-medium">{title}</span>}
					</div>
				</CollapsibleTrigger>
				<CollapsibleContent className="flex flex-col gap-2">{children}</CollapsibleContent>
			</div>
		</Collapsible>
	)
}

CollapsiblePanel.displayName = "CollapsiblePanel"

export default observer(CollapsiblePanel)
