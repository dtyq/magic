import * as React from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "../../../../lib/utils"
import { Input } from "../../input"
import styles from "./index.module.css"

interface NumberStepperInputProps extends Omit<
	React.ComponentProps<typeof Input>,
	"type" | "value" | "onChange"
> {
	value: string
	step?: number
	min?: number
	max?: number
	stepBaseValue?: number
	inputClassName?: string
	formatValue?: (value: number) => string
	onValueChange: (value: string) => void
	onStepValueChange?: (value: string) => void
}

const NumberStepperInput = React.forwardRef<HTMLInputElement, NumberStepperInputProps>(
	(
		{
			className,
			inputClassName,
			value,
			step = 1,
			min,
			max,
			stepBaseValue,
			formatValue = String,
			onValueChange,
			onStepValueChange,
			disabled,
			...props
		},
		ref,
	) => {
		const handleChange = React.useCallback(
			(event: React.ChangeEvent<HTMLInputElement>) => {
				const nextValue = event.target.value
				if (min !== undefined && min >= 0 && nextValue.startsWith("-")) {
					return
				}
				onValueChange(nextValue)
			},
			[min, onValueChange],
		)

		const handleStep = React.useCallback(
			(direction: 1 | -1) => {
				const parsedValue = Number.parseFloat(value)
				// 空值通常表示“自动”，stepper 仍要从外部提供的实际值开始增减。
				const baseValue = Number.isFinite(parsedValue)
					? parsedValue
					: (stepBaseValue ?? min ?? 0)
				const nextValue = clampNumber(baseValue + direction * step, min, max)
				const nextFormattedValue = formatValue(roundForStep(nextValue, step))
				if (onStepValueChange) {
					onStepValueChange(nextFormattedValue)
					return
				}
				onValueChange(nextFormattedValue)
			},
			[formatValue, max, min, onStepValueChange, onValueChange, step, stepBaseValue, value],
		)

		const preventFocusSteal = React.useCallback(
			(
				event: React.PointerEvent<HTMLButtonElement> | React.MouseEvent<HTMLButtonElement>,
			) => {
				event.preventDefault()
			},
			[],
		)

		return (
			<div className={cn(styles.root, className)}>
				<Input
					ref={ref}
					type="text"
					inputMode="decimal"
					value={value}
					disabled={disabled}
					className={`${inputClassName} text-sm`}
					onChange={handleChange}
					{...props}
				/>
				<div className={styles.stepper} aria-hidden={disabled}>
					<button
						type="button"
						tabIndex={-1}
						className={styles.stepButton}
						disabled={disabled}
						onPointerDown={preventFocusSteal}
						onMouseDown={preventFocusSteal}
						onClick={() => handleStep(1)}
					>
						<ChevronUp size={12} />
					</button>
					<button
						type="button"
						tabIndex={-1}
						className={styles.stepButton}
						disabled={disabled}
						onPointerDown={preventFocusSteal}
						onMouseDown={preventFocusSteal}
						onClick={() => handleStep(-1)}
					>
						<ChevronDown size={12} />
					</button>
				</div>
			</div>
		)
	},
)

NumberStepperInput.displayName = "NumberStepperInput"

function clampNumber(value: number, min?: number, max?: number): number {
	if (min !== undefined && value < min) {
		return min
	}
	if (max !== undefined && value > max) {
		return max
	}
	return value
}

function roundForStep(value: number, step: number): number {
	const decimalPlaces = getDecimalPlaces(step)
	return Number(value.toFixed(decimalPlaces))
}

function getDecimalPlaces(value: number): number {
	const [, decimal = ""] = String(value).split(".")
	return decimal.length
}

export { NumberStepperInput }
