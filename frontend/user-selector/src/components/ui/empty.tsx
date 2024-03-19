import { forwardRef } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"

export interface EmptyProps extends HTMLAttributes<HTMLDivElement> {
	description?: ReactNode
	image?: ReactNode
}

const Empty = forwardRef<HTMLDivElement, EmptyProps>(
	({ className, description, image, ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={cn(
					"flex flex-col items-center justify-center py-8 text-center",
					className,
				)}
				{...props}
			>
				{image && <div className="mb-6 rounded-lg border p-2 text-foreground">{image}</div>}
				{description && <div className="text-sm text-muted-foreground">{description}</div>}
			</div>
		)
	},
)
Empty.displayName = "Empty"

export { Empty }
