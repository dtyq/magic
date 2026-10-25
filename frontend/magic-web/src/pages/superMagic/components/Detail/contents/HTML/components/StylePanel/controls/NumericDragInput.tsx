import { useCallback, useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Input } from "@/components/shadcn-ui/input"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import { cn } from "@/utils/cn"
import { HTML_EDITOR_Z_INDEX } from "../../../constants/z-index"
import { claimNumericDragHint, markNumericDragHintSeen } from "./numericDragHint"

interface NumericDragInputProps extends Omit<
	React.ComponentProps<typeof Input>,
	"value" | "onChange" | "type"
> {
	value: string | number
	onChange: (value: string) => void
	onCommit?: (value: string) => void
	step?: number
	min?: number
	max?: number
	precision?: number
	dragSensitivity?: number
	formatDisplayValue?: (value: string | number) => string
	/** Shown while focused; keywords can become an empty field. */
	formatEditValue?: (value: string | number) => string
	/** Used as the drag/nudge origin when the field shows a non-px unit. */
	scrubStartValue?: number | null
	stepperClassName?: string
	/** Hide steppers in compact diagrams such as the box model. */
	hideStepper?: boolean
}

function clamp(value: number, min?: number, max?: number): number {
	if (min !== undefined) value = Math.max(min, value)
	if (max !== undefined) value = Math.min(max, value)
	return value
}

function formatValue(value: number, precision?: number): string {
	if (precision !== undefined) return value.toFixed(precision)
	return String(Number(value.toFixed(6)))
}

function hasExplicitFixedWidth(className?: string): boolean {
	return Boolean(className && /(?:^|\s)w-\d/.test(className))
}

function isTooCompactForStepper(className?: string): boolean {
	const match = className?.match(/(?:^|\s)w-(\d+)(?:\s|$)/)
	return Boolean(match && Number(match[1]) < 12)
}

function isFlexChild(className?: string): boolean {
	return Boolean(className && /(?:^|\s)flex-1(?:\s|$)/.test(className))
}

/**
 * Numeric field with the interaction used by design tools: drag vertically,
 * click the stepper, or use ArrowUp/ArrowDown to nudge the value. Mouse-wheel
 * changes are disabled so scrolling the panel never edits a value accidentally.
 */
export function NumericDragInput({
	value,
	onChange,
	onCommit,
	step = 1,
	min,
	max,
	precision,
	dragSensitivity = 4,
	formatDisplayValue,
	formatEditValue,
	scrubStartValue,
	stepperClassName,
	hideStepper = false,
	className,
	onFocus,
	onBlur,
	onPointerDown,
	onPointerMove,
	onPointerUp,
	onWheel,
	onKeyDown,
	...props
}: NumericDragInputProps) {
	const { t } = useTranslation("super")
	const dragRef = useRef<{
		startY: number
		startValue: number
		target: HTMLInputElement | null
		pointerId: number | null
		pendingValue: string | null
	} | null>(null)
	const [isDragging, setIsDragging] = useState(false)
	const [isFocused, setIsFocused] = useState(false)
	const [showHint, setShowHint] = useState(false)
	const inputValue = isFocused
		? formatEditValue
			? formatEditValue(value)
			: value
		: formatDisplayValue
			? formatDisplayValue(value)
			: value

	const getNumber = useCallback(() => {
		if (
			scrubStartValue !== undefined &&
			scrubStartValue !== null &&
			Number.isFinite(scrubStartValue)
		) {
			return scrubStartValue
		}
		const parsed = typeof value === "number" ? value : Number.parseFloat(value)
		return Number.isFinite(parsed) ? parsed : null
	}, [scrubStartValue, value])
	// Keywords like "normal" have no numeric origin to scrub from.
	const currentValue = getNumber()
	const canDrag = currentValue !== null
	const isEmbeddedStepper = Boolean(stepperClassName?.includes("border-l-0"))
	const isFixedWidth = hasExplicitFixedWidth(className)
	const canShowStepper =
		canDrag && !props.disabled && !hideStepper && !isTooCompactForStepper(className)
	const overlayStepper = canShowStepper && !isEmbeddedStepper
	const isIncrementDisabled =
		Boolean(props.disabled) ||
		currentValue === null ||
		(max !== undefined && currentValue >= max)
	const isDecrementDisabled =
		Boolean(props.disabled) ||
		currentValue === null ||
		(min !== undefined && currentValue <= min)

	const updateValue = useCallback(
		(nextValue: number) => {
			const formattedValue = formatValue(clamp(nextValue, min, max), precision)
			onChange(formattedValue)
			return formattedValue
		},
		[max, min, onChange, precision],
	)

	const commit = useCallback(
		(nextValue: number) => {
			const formattedValue = updateValue(nextValue)
			onCommit?.(formattedValue)
		},
		[onCommit, updateValue],
	)

	const nudge = useCallback(
		(direction: 1 | -1) => {
			const current = getNumber()
			if (current === null) return
			commit(current + direction * step)
		},
		[commit, getNumber, step],
	)

	const dismissHint = useCallback(() => {
		setShowHint(false)
		markNumericDragHintSeen()
	}, [])

	const revealHint = useCallback(() => {
		if (!claimNumericDragHint()) return
		setShowHint(true)
		markNumericDragHintSeen()
	}, [])

	useEffect(() => {
		if (!isDragging) return
		const handleWindowPointerMove = (event: PointerEvent) => {
			const drag = dragRef.current
			if (!drag) return
			const delta = drag.startY - event.clientY
			if (Math.abs(delta) < 2) return
			event.preventDefault()
			drag.pendingValue = updateValue(
				drag.startValue + Math.round(delta / dragSensitivity) * step,
			)
		}
		const finishDrag = (shouldCommit: boolean) => {
			const drag = dragRef.current
			if (shouldCommit && drag?.pendingValue !== null && drag?.pendingValue !== undefined) {
				onCommit?.(drag.pendingValue)
			}
			if (
				drag?.target &&
				drag.pointerId !== null &&
				drag.target.hasPointerCapture?.(drag.pointerId)
			) {
				drag.target.releasePointerCapture?.(drag.pointerId)
			}
			dragRef.current = null
			setIsDragging(false)
		}
		const captureOptions = { capture: true, passive: false }
		window.addEventListener("pointermove", handleWindowPointerMove, captureOptions)
		const handlePointerUp = () => finishDrag(true)
		const handlePointerCancel = () => finishDrag(false)
		window.addEventListener("pointerup", handlePointerUp)
		window.addEventListener("pointercancel", handlePointerCancel)
		return () => {
			window.removeEventListener("pointermove", handleWindowPointerMove, captureOptions)
			window.removeEventListener("pointerup", handlePointerUp)
			window.removeEventListener("pointercancel", handlePointerCancel)
		}
	}, [dragSensitivity, isDragging, onCommit, step, updateValue])

	function handleStepperPointerDown(event: React.PointerEvent<HTMLButtonElement>) {
		event.preventDefault()
		event.stopPropagation()
	}

	const stepper = (
		<div
			data-testid="numeric-drag-stepper"
			className={cn(
				"pointer-events-none flex w-3.5 shrink-0 flex-col opacity-0 transition-opacity duration-150",
				"group-hover/numeric:pointer-events-auto group-hover/numeric:opacity-100",
				"group-focus-within/numeric:pointer-events-auto group-focus-within/numeric:opacity-100",
				(isDragging || showHint) && "pointer-events-auto opacity-100",
				overlayStepper
					? "absolute inset-y-px right-px z-10 overflow-hidden rounded-r-md border-l border-border/60"
					: "self-stretch border-l-0",
				stepperClassName,
			)}
			onMouseEnter={revealHint}
		>
			<button
				type="button"
				tabIndex={-1}
				disabled={isIncrementDisabled}
				aria-label={t("stylePanel.increaseValue")}
				data-testid="numeric-drag-increment-button"
				className="flex flex-1 items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-30"
				onPointerDown={handleStepperPointerDown}
				onClick={() => {
					dismissHint()
					nudge(1)
				}}
			>
				<ChevronUp className="h-2.5 w-2.5" />
			</button>
			<button
				type="button"
				tabIndex={-1}
				disabled={isDecrementDisabled}
				aria-label={t("stylePanel.decreaseValue")}
				data-testid="numeric-drag-decrement-button"
				className="flex flex-1 items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary disabled:pointer-events-none disabled:opacity-30"
				onPointerDown={handleStepperPointerDown}
				onClick={() => {
					dismissHint()
					nudge(-1)
				}}
			>
				<ChevronDown className="h-2.5 w-2.5" />
			</button>
		</div>
	)

	return (
		<div
			className={cn(
				canShowStepper
					? [
							"group/numeric relative min-w-0 items-stretch",
							isFixedWidth ? "inline-flex" : "flex",
							!isFixedWidth && (isFlexChild(className) ? "flex-1" : "w-full"),
						]
					: "contents",
			)}
			data-testid="numeric-drag-input"
			onMouseEnter={canShowStepper ? revealHint : undefined}
			onMouseLeave={canShowStepper ? dismissHint : undefined}
		>
			<Input
				type="text"
				value={inputValue}
				inputMode="decimal"
				{...props}
				className={cn(
					canDrag && "cursor-ns-resize touch-none select-none",
					isDragging && "cursor-ns-resize bg-primary/10 text-primary",
					"min-w-0",
					className,
					hideStepper && "!bg-transparent !shadow-none ring-0 focus-visible:ring-0",
					overlayStepper && "!pr-4",
				)}
				data-can-drag={canDrag ? "true" : undefined}
				onPointerDown={(event) => {
					if (event.button === 0 && !props.disabled) {
						const current = getNumber()
						if (current !== null) {
							dragRef.current = {
								startY: event.clientY,
								startValue: current,
								target: event.currentTarget,
								pointerId: event.pointerId ?? null,
								pendingValue: null,
							}
							event.currentTarget.setPointerCapture?.(event.pointerId)
							setIsDragging(true)
							dismissHint()
						}
					}
					onPointerDown?.(event)
				}}
				onPointerMove={onPointerMove}
				onPointerUp={onPointerUp}
				onWheel={onWheel}
				onFocus={(event) => {
					setIsFocused(true)
					onFocus?.(event)
				}}
				onBlur={(event) => {
					setIsFocused(false)
					onBlur?.(event)
				}}
				onKeyDown={(event) => {
					if (event.key === "ArrowUp" || event.key === "ArrowDown") {
						event.preventDefault()
						nudge(event.key === "ArrowUp" ? 1 : -1)
					}
					onKeyDown?.(event)
				}}
				onChange={(event) => onChange(event.target.value)}
				aria-description={t("stylePanel.numericDragHint")}
				data-dragging={isDragging ? "true" : undefined}
			/>
			{canShowStepper ? (
				<Tooltip open={showHint} delayDuration={0}>
					<TooltipTrigger asChild>{stepper}</TooltipTrigger>
					{showHint ? (
						<TooltipContent
							side="top"
							sideOffset={6}
							className="max-w-48 px-2 py-1 text-[11px] leading-snug"
							zIndex={HTML_EDITOR_Z_INDEX.EDITOR_FLOATING.TOOLTIP}
							data-testid="numeric-drag-hint"
						>
							{t("stylePanel.numericDragHint")}
						</TooltipContent>
					) : null}
				</Tooltip>
			) : null}
		</div>
	)
}
