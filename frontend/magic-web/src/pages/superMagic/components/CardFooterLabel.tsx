import SmartTooltip from "@/components/other/SmartTooltip"
import { cn } from "@/lib/utils"

interface CardFooterLabelProps {
	label: string
	className?: string
	dataTestId?: string
	truncate?: boolean
	withTooltip?: boolean
}

export function CardFooterLabel({
	label,
	className,
	dataTestId,
	truncate = true,
	withTooltip = false,
}: CardFooterLabelProps) {
	const mergedClassName = cn(
		"min-w-0 flex-1 text-xs leading-4 text-muted-foreground",
		truncate ? "truncate" : "whitespace-normal",
		className,
	)

	if (withTooltip)
		return (
			<SmartTooltip
				elementType="span"
				className={mergedClassName}
				content={label}
				sideOffset={4}
				data-testid={dataTestId}
			>
				{label}
			</SmartTooltip>
		)

	return (
		<span className={mergedClassName} data-testid={dataTestId}>
			{label}
		</span>
	)
}
