import { forwardRef } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const segmentedVariants = cva("", {
	variants: {},
	defaultVariants: {},
})

export interface SegmentedOption {
	label: ReactNode
	value: string | number
	icon?: ReactNode
}

export interface SegmentedProps
	extends
		Omit<HTMLAttributes<HTMLDivElement>, "onChange">,
		VariantProps<typeof segmentedVariants> {
	options: SegmentedOption[]
	value?: string | number
	onChange?: (value: string | number) => void
	block?: boolean
}

const Segmented = forwardRef<HTMLDivElement, SegmentedProps>(
	({ className, options, value, onChange, block, ...props }, ref) => {
		return (
			<div
				ref={ref}
				className={cn(
					"inline-flex rounded-md p-0.5 bg-accent",
					block && "flex w-full",
					className,
				)}
				{...props}
			>
				{options.map((option) => {
					const isSelected = value === option.value
					return (
						<button
							key={String(option.value)}
							type="button"
							onClick={() => onChange?.(option.value)}
							className={cn(
								"flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-all duration-200",
								"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								isSelected
									? "bg-card text-primary font-semibold shadow-md border border-border/50"
									: "text-muted-foreground hover:text-foreground hover:bg-accent/50",
							)}
							aria-selected={isSelected}
						>
							{option.label}
						</button>
					)
				})}
			</div>
		)
	},
)
Segmented.displayName = "Segmented"

export { Segmented, segmentedVariants }
