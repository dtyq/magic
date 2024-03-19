import { memo } from "react"
import { cn } from "@/opensource/lib/utils"
import { Check } from "lucide-react"

interface Step {
	label: string
}

interface StepIndicatorProps {
	steps: Step[]
	currentStep: number
}

function StepIndicator({ steps, currentStep }: StepIndicatorProps) {
	return (
		<div className="relative flex w-full items-start justify-center py-3.5">
			{/* Connecting lines */}
			{/* <div className="absolute inset-x-6 top-[30px] flex items-center">
				{steps.slice(0, -1).map((_, i) => (
					<div
						key={i}
						className={cn(
							"h-px flex-1 transition-colors",
							i < currentStep ? "bg-primary" : "bg-border",
						)}
					/>
				))}
			</div> */}

			{steps.map((step, i) => {
				const isActive = i === currentStep
				const isDone = i < currentStep

				return (
					<div key={i} className="relative z-10 flex flex-1 flex-col items-center gap-3">
						<div
							className={cn(
								"flex size-8 items-center justify-center rounded-full text-sm font-semibold transition-colors",
								isActive
									? "bg-primary text-primary-foreground"
									: "border border-border bg-background text-muted-foreground",
								isDone ? "border-primary text-primary" : "",
							)}
						>
							{isDone ? <Check className="size-4" /> : i + 1}
						</div>
						<span
							className={cn(
								"whitespace-nowrap text-sm",
								isActive || isDone ? "text-foreground" : "text-muted-foreground",
							)}
						>
							{step.label}
						</span>
					</div>
				)
			})}
		</div>
	)
}

export default memo(StepIndicator)
