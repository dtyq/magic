import { cn } from "@/lib/utils"

interface ProgressBarProps {
	currentStep: number
	totalSteps: number
	className?: string
}

export default function ProgressBar({ currentStep, totalSteps, className }: ProgressBarProps) {
	const progress = (currentStep / totalSteps) * 100

	return (
		<div className={cn("h-1 w-full overflow-hidden rounded-full bg-muted", className)}>
			<div
				className="h-full bg-foreground transition-all duration-300 ease-in-out"
				style={{ width: `${progress}%` }}
			/>
		</div>
	)
}
