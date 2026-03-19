import { RefreshCcw, Plus, Minus } from "lucide-react"
import { Button } from "@/components/shadcn-ui/button"
import { Slider } from "@/components/shadcn-ui/slider"
import { MagicTooltip } from "@/components/base"
import { useTranslation } from "react-i18next"
import { cn } from "@/lib/utils"

export interface ZoomControlsProps {
	currentScale: number
	onScaleChange: (scale: number) => void
	onResetZoom: () => void
	disabled?: boolean
	className?: string
	minScale?: number
	maxScale?: number
	step?: number
}

/**
 * Zoom controls with slider and stepper for preview scale adjustment
 * Displays label, stepper buttons, slider with reset button
 */
export function ZoomControls({
	currentScale,
	onScaleChange,
	onResetZoom,
	disabled = false,
	className,
	minScale = 0.1,
	maxScale = 1.5,
	step = 5,
}: ZoomControlsProps) {
	const { t } = useTranslation("super")

	// Convert scale to percentage for slider (10% - 150%)
	const scalePercentage = Math.round(currentScale * 100)
	const minPercentage = Math.round(minScale * 100)
	const maxPercentage = Math.round(maxScale * 100)

	// Handle slider change
	const handleSliderChange = (values: number[]) => {
		const percentage = values[0]
		const newScale = percentage / 100
		onScaleChange(newScale)
	}

	// Handle step decrease
	const handleDecrease = () => {
		const newPercentage = Math.max(minPercentage, scalePercentage - step)
		onScaleChange(newPercentage / 100)
	}

	// Handle step increase
	const handleIncrease = () => {
		const newPercentage = Math.min(maxPercentage, scalePercentage + step)
		onScaleChange(newPercentage / 100)
	}

	// Check if buttons should be disabled
	const isDecreaseDisabled = disabled || scalePercentage <= minPercentage
	const isIncreaseDisabled = disabled || scalePercentage >= maxPercentage

	return (
		<div className={cn("flex items-center gap-2", className)}>
			{/* Label */}
			<div className="shrink-0 text-xs font-medium text-foreground">
				{t("stylePanel.previewScale")}
			</div>

			{/* Decrease button */}
			<MagicTooltip title={t("stylePanel.decreaseZoom")}>
				<span>
					<Button
						variant="outline"
						size="sm"
						className="h-6 w-6 shrink-0 p-0"
						onClick={handleDecrease}
						disabled={isDecreaseDisabled}
					>
						<Minus className="h-3.5 w-3.5" />
					</Button>
				</span>
			</MagicTooltip>

			{/* Slider */}
			<div className="flex min-w-[100px] flex-1 items-center gap-1.5">
				<Slider
					value={[scalePercentage]}
					onValueChange={handleSliderChange}
					min={minPercentage}
					max={maxPercentage}
					step={step}
					disabled={disabled}
					className="flex-1"
				/>
			</div>

			{/* Increase button */}
			<MagicTooltip title={t("stylePanel.increaseZoom")}>
				<span>
					<Button
						variant="outline"
						size="sm"
						className="h-6 w-6 shrink-0 p-0"
						onClick={handleIncrease}
						disabled={isIncreaseDisabled}
					>
						<Plus className="h-3.5 w-3.5" />
					</Button>
				</span>
			</MagicTooltip>

			{/* Current scale display */}
			<div className="flex min-w-[44px] shrink-0 items-center justify-center text-xs font-medium text-muted-foreground">
				{scalePercentage}%
			</div>

			{/* Reset zoom button */}
			<MagicTooltip title={t("stylePanel.resetZoom")}>
				<span>
					<Button
						variant="ghost"
						size="sm"
						className="h-6 w-6 shrink-0 p-0"
						onClick={onResetZoom}
						disabled={disabled}
					>
						<RefreshCcw className="h-3.5 w-3.5" />
					</Button>
				</span>
			</MagicTooltip>
		</div>
	)
}
