import { useCallback, useEffect, useState } from "react"
import { useDebounceFn } from "ahooks"
import { Input } from "@/opensource/components/shadcn-ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/opensource/components/shadcn-ui/select"
import { Label } from "@/opensource/components/shadcn-ui/label"

interface DimensionInputProps {
	label: string
	value: string
	onChange: (value: string) => void
	placeholder?: string
	id?: string
	allowedUnits?: string[]
}

const DEFAULT_UNITS = ["px", "%", "em", "rem", "vw", "vh", "auto"]

/**
 * Parse value into number and unit
 */
function parseValue(value: string): { num: string; unit: string } {
	if (!value || value === "auto") {
		return { num: "", unit: "auto" }
	}

	const match = value.match(/^([\d.]+)(.*)$/)
	if (match) {
		return { num: match[1], unit: match[2] || "px" }
	}

	return { num: "", unit: "px" }
}

/**
 * Dimension input with number and unit selector
 */
export function DimensionInput({
	label,
	value,
	onChange,
	placeholder = "auto",
	id,
	allowedUnits = DEFAULT_UNITS,
}: DimensionInputProps) {
	const { num, unit } = parseValue(value)
	const [numValue, setNumValue] = useState(num)
	const [unitValue, setUnitValue] = useState(unit)

	// Sync with external value changes
	useEffect(() => {
		const parsed = parseValue(value)
		setNumValue(parsed.num)
		setUnitValue(parsed.unit)
	}, [value])

	// Debounce for input changes
	const { run: onChangeDebounced } = useDebounceFn(
		(newValue: string) => {
			onChange(newValue)
		},
		{ wait: 300 },
	)

	/**
	 * Handle number input change
	 */
	const handleNumChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newNum = e.target.value

			// Allow empty or valid number
			if (newNum === "" || /^[\d.]*$/.test(newNum)) {
				setNumValue(newNum)

				if (newNum === "") {
					onChangeDebounced("auto")
				} else {
					onChangeDebounced(`${newNum}${unitValue === "auto" ? "px" : unitValue}`)
				}
			}
		},
		[unitValue, onChangeDebounced],
	)

	/**
	 * Handle unit change
	 */
	const handleUnitChange = useCallback(
		(newUnit: string) => {
			setUnitValue(newUnit)

			if (newUnit === "auto") {
				setNumValue("")
				onChange("auto")
			} else if (numValue) {
				onChange(`${numValue}${newUnit}`)
			}
		},
		[numValue, onChange],
	)

	return (
		<div className="space-y-2">
			<Label htmlFor={id} className="text-xs">
				{label}
			</Label>
			<div className="flex gap-2">
				<Input
					id={id}
					type="text"
					value={numValue}
					onChange={handleNumChange}
					placeholder={placeholder}
					disabled={unitValue === "auto"}
					className="flex-1 font-mono text-xs"
				/>
				<Select value={unitValue} onValueChange={handleUnitChange}>
					<SelectTrigger className="w-20">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{allowedUnits.map((u) => (
							<SelectItem key={u} value={u}>
								{u}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	)
}
