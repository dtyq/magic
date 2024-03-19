import { forwardRef } from "react"
import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "@/lib/utils"
import { IconLoader } from "@tabler/icons-react"

export interface SpinProps extends HTMLAttributes<HTMLDivElement> {
	spinning?: boolean
	tip?: ReactNode
	size?: "small" | "default" | "large"
}

const Spin = forwardRef<HTMLDivElement, SpinProps>(
	({ className, spinning = true, tip, size = "default", children, ...props }, ref) => {
		const sizeMap = {
			small: 16,
			default: 20,
			large: 24,
		}

		if (children) {
			return (
				<div ref={ref} className={cn("relative", className)} {...props}>
					{children}
					{spinning && (
						<div className="absolute inset-0 flex items-center justify-center bg-background/50">
							<div className="flex flex-col items-center gap-2">
								<IconLoader
									size={sizeMap[size]}
									className="animate-spin text-primary"
								/>
								{tip && <div className="text-sm text-muted-foreground">{tip}</div>}
							</div>
						</div>
					)}
				</div>
			)
		}

		return (
			<div ref={ref} className={cn("flex items-center justify-center", className)} {...props}>
				<div className="flex flex-col items-center gap-2">
					<IconLoader size={sizeMap[size]} className="animate-spin text-primary" />
					{tip && <div className="text-sm text-muted-foreground">{tip}</div>}
				</div>
			</div>
		)
	},
)
Spin.displayName = "Spin"

export { Spin }
