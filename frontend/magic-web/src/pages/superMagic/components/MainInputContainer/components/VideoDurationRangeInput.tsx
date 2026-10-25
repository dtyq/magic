import type { KeyboardEvent } from "react"

interface VideoDurationRangeInputProps {
	value?: number
	min?: number
	max?: number
	step?: number
	onValueChange: (seconds: number) => void
	className?: string
	ariaLabel: string
	dataTestId?: string
}

/**
 * The native range input renders an empty value at min, so selecting min does
 * not emit a change event. Initialize that empty state on the first interaction
 * so min can be selected directly without a right-then-left drag.
 */
export function VideoDurationRangeInput({
	value,
	min,
	max,
	step,
	onValueChange,
	className,
	ariaLabel,
	dataTestId,
}: VideoDurationRangeInputProps) {
	const rangeMin = min ?? 0
	const rangeMax = max ?? rangeMin
	const rangeStep = step ?? 1

	const initializeEmptyValue = () => {
		if (value == null) onValueChange(rangeMin)
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (value != null) return
		if (event.key !== "Home" && event.key !== "ArrowLeft" && event.key !== "ArrowDown") {
			return
		}
		event.preventDefault()
		onValueChange(rangeMin)
	}

	return (
		<input
			type="range"
			min={rangeMin}
			max={rangeMax}
			step={rangeStep}
			value={value ?? rangeMin}
			onPointerDown={initializeEmptyValue}
			onKeyDown={handleKeyDown}
			onChange={(event) => onValueChange(Number(event.target.value))}
			className={className}
			aria-label={ariaLabel}
			data-testid={dataTestId}
		/>
	)
}
