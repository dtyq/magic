import type { ReactNode } from "react"
import { cn } from "@magic-admin-v2/utils/cn"

type FilterControlFieldProps = {
	children: ReactNode
	className?: string
	label: ReactNode
	required?: boolean
}

export function FilterControlField({
	children,
	className,
	label,
	required = false,
}: FilterControlFieldProps) {
	return (
		<div className={cn("grid min-w-0 max-w-full gap-1.5", className)}>
			<div className="flex min-w-0 items-center gap-1 text-xs font-medium text-muted-foreground">
				<span className="truncate">{label}</span>
				{required ? (
					<span aria-hidden="true" className="shrink-0 text-destructive">
						*
					</span>
				) : null}
			</div>
			{children}
		</div>
	)
}
