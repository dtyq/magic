import { useCallback, useEffect, useRef, useState } from "react"
import { useDebounceFn } from "ahooks"
import { NumericDragInput } from "./NumericDragInput"
import { Label } from "@/components/shadcn-ui/label"
import { STYLE_PANEL_STYLES } from "../styles"
import { resolveScrubStartValue, shouldKeepAuthoredDimension } from "../utils/dimensionValue"

interface DimensionInputProps {
	label: string
	value: string
	onChange: (value: string) => void
	placeholder?: string
	id?: string
	allowedUnits?: string[]
	fixedUnit?: string
	testIdPrefix?: string
	compact?: boolean
	/** Used-pixel size from computed style, for converting units before scrubbing. */
	pixelValue?: string
	/** True when value comes from inline CSS, including later px writes. */
	valueFromInline?: boolean
}

const DEFAULT_UNITS = ["px", "%", "em", "rem", "vw", "vh", "auto"]
const UNIT_PATTERN = "px|%|em|rem|vw|vh|auto"
const COMPLETE_DIMENSION_PATTERN = new RegExp(`^(-?\\d*\\.?\\d+)\\s*(${UNIT_PATTERN})?$`, "i")
const DRAFT_DIMENSION_PATTERN = new RegExp(`^-?\\d*\\.?\\d*[a-z%]*$`, "i")

interface ParsedDimension {
	num: string
	unit: string
}

/**
 * Parse value into number and unit. Bare numbers default to px.
 */
function parseValue(value: string): ParsedDimension {
	if (!value || value === "auto") {
		return { num: "", unit: "auto" }
	}

	const match = value.match(/^(-?[\d.]+)(.*)$/)
	if (match) {
		return { num: match[1], unit: match[2] || "px" }
	}

	return { num: "", unit: "px" }
}

function isAllowedUnit(unit: string, allowedUnits: string[]): boolean {
	return allowedUnits.some((item) => item.toLowerCase() === unit.toLowerCase())
}

/**
 * Show the unit in the field, except implicit px.
 */
function formatDisplayValue(num: string, unit: string, fixedUnit?: string): string {
	if (!num || unit === "auto") return ""
	if (fixedUnit || unit === "px") return num
	return `${num}${unit}`
}

/**
 * Dimension input with implicit px and units typed in the same field.
 */
export function DimensionInput({
	label,
	value,
	onChange,
	placeholder = "auto",
	id,
	allowedUnits = DEFAULT_UNITS,
	fixedUnit,
	testIdPrefix,
	compact = false,
	pixelValue,
	valueFromInline = false,
}: DimensionInputProps) {
	const parsed = parseValue(value)
	const initialUnit = fixedUnit || parsed.unit
	const authoredUnitRef = useRef(initialUnit)
	const [inputValue, setInputValue] = useState(() =>
		formatDisplayValue(parsed.num, initialUnit, fixedUnit),
	)
	const scrubStartValue = resolveScrubStartValue(inputValue, pixelValue)

	useEffect(() => {
		if (
			!fixedUnit &&
			shouldKeepAuthoredDimension(authoredUnitRef.current, value, valueFromInline)
		) {
			return
		}

		const next = parseValue(value)
		const nextUnit = fixedUnit || next.unit
		authoredUnitRef.current = nextUnit
		setInputValue(formatDisplayValue(next.num, nextUnit, fixedUnit))
	}, [fixedUnit, value, valueFromInline])

	const { run: onChangeDebounced } = useDebounceFn(
		(newValue: string) => {
			onChange(newValue)
		},
		{ wait: 300 },
	)

	const commitDimension = useCallback(
		(nextNum: string, nextUnit: string) => {
			authoredUnitRef.current = nextUnit
			setInputValue(formatDisplayValue(nextNum, nextUnit, fixedUnit))
			if (!nextNum || nextUnit === "auto") {
				onChangeDebounced("auto")
				return
			}
			onChangeDebounced(`${nextNum}${nextUnit}`)
		},
		[fixedUnit, onChangeDebounced],
	)

	/**
	 * Bare numbers and vertical drags become px. Typed units stay in the field.
	 */
	const handleNumChange = useCallback(
		(rawValue: string) => {
			if (fixedUnit) {
				if (rawValue === "" || /^-?[\d.]*$/.test(rawValue)) {
					commitDimension(rawValue, fixedUnit)
				}
				return
			}

			const trimmedValue = rawValue.trim()
			if (trimmedValue === "" || /^auto$/i.test(trimmedValue)) {
				commitDimension("", "auto")
				return
			}

			const match = trimmedValue.match(COMPLETE_DIMENSION_PATTERN)
			if (match) {
				const nextNum = match[1]
				const typedUnit = match[2]?.toLowerCase()
				const nextUnit =
					typedUnit && isAllowedUnit(typedUnit, allowedUnits) ? typedUnit : "px"
				commitDimension(nextNum, nextUnit)
				return
			}

			if (DRAFT_DIMENSION_PATTERN.test(trimmedValue)) setInputValue(trimmedValue)
		},
		[allowedUnits, commitDimension, fixedUnit],
	)

	return (
		<div
			className={compact ? "min-w-0 space-y-1" : "min-w-0 space-y-2"}
			data-testid={testIdPrefix ? `${testIdPrefix}-root` : undefined}
		>
			<Label htmlFor={id} className={STYLE_PANEL_STYLES.label}>
				{label}
			</Label>
			<NumericDragInput
				id={id}
				value={inputValue}
				onChange={handleNumChange}
				scrubStartValue={scrubStartValue}
				placeholder={placeholder}
				className={
					compact
						? "h-7 w-full min-w-0 rounded-md border-border/70 bg-background/70 px-2 font-mono text-xs transition-[background-color,border-color,box-shadow] duration-150 hover:border-primary/45 hover:bg-primary/5 focus-visible:border-primary/70 focus-visible:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-default disabled:bg-muted/40"
						: `${STYLE_PANEL_STYLES.control} w-full min-w-0 font-mono disabled:cursor-default`
				}
				data-testid={testIdPrefix ? `${testIdPrefix}-input` : undefined}
			/>
		</div>
	)
}
