import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface Step {
	number: number
	label: string
}

interface StepIndicatorProps {
	steps: Step[]
	currentStep: number
	className?: string
}

export default function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
	return (
		<div className={cn("flex items-center justify-center gap-4", className)}>
			{steps.map((step, index) => {
				const isCompleted = step.number < currentStep
				const isActive = step.number === currentStep
				const isInactive = step.number > currentStep

				return (
					<div key={step.number} className="flex items-center gap-2">
						{/* Step Circle */}
						<div
							className={cn(
								"flex h-10 w-10 items-center justify-center rounded-full font-semibold transition-all",
								{
									"bg-foreground text-background": isActive,
									"bg-muted text-foreground": isCompleted,
									"bg-muted/50 text-muted-foreground": isInactive,
								},
							)}
						>
							{isCompleted ? <Check className="h-5 w-5" /> : step.number}
						</div>

						{/* Step Label */}
						<span
							className={cn("text-sm font-medium transition-colors", {
								"text-foreground": isActive || isCompleted,
								"text-muted-foreground": isInactive,
							})}
						>
							{step.label}
						</span>

						{/* Separator Line */}
						{index < steps.length - 1 && <div className="h-0.5 w-16 bg-muted" />}
					</div>
				)
			})}
		</div>
	)
}
