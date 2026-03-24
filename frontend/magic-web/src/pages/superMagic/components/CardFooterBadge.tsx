import type { ReactNode } from "react"
import SmartTooltip from "@/components/other/SmartTooltip"
import { Badge } from "@/components/shadcn-ui/badge"
import { cn } from "@/lib/utils"

interface CardFooterBadgeProps {
	label: string
	icon?: ReactNode
	className?: string
	labelClassName?: string
	dataTestId?: string
}

export function CardFooterBadge({
	label,
	icon,
	className,
	labelClassName,
	dataTestId,
}: CardFooterBadgeProps) {
	return (
		<Badge
			variant="outline"
			className={cn("max-w-full shrink-0 rounded-md", className)}
			data-testid={dataTestId}
		>
			{icon}
			<SmartTooltip
				elementType="span"
				className={cn(
					"block min-w-0 max-w-full text-xs font-semibold leading-4",
					labelClassName,
				)}
				content={label}
				sideOffset={4}
			>
				{label}
			</SmartTooltip>
		</Badge>
	)
}
