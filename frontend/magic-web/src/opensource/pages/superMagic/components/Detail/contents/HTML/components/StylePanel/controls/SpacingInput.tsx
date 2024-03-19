import { useCallback, useEffect, useState } from "react"
import { useDebounceFn } from "ahooks"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { Label } from "@/opensource/components/shadcn-ui/label"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Link2, Unlink } from "lucide-react"

interface SpacingInputProps {
	label: string
	value: string
	onChange: (value: string) => void
	id?: string
}

/**
 * Parse spacing value into array [top, right, bottom, left]
 */
function parseSpacing(value: string): string[] {
	if (!value) return ["0", "0", "0", "0"]

	const parts = value.trim().split(/\s+/)
	const nums = parts.map((p) => {
		const match = p.match(/^([\d.]+)/)
		return match ? match[1] : "0"
	})

	// CSS shorthand: 1 value = all, 2 = top/bottom left/right, 3 = top left/right bottom, 4 = top right bottom left
	switch (nums.length) {
		case 1:
			return [nums[0], nums[0], nums[0], nums[0]]
		case 2:
			return [nums[0], nums[1], nums[0], nums[1]]
		case 3:
			return [nums[0], nums[1], nums[2], nums[1]]
		case 4:
			return nums
		default:
			return ["0", "0", "0", "0"]
	}
}

/**
 * Format spacing array to CSS value
 */
function formatSpacing(values: string[], unit = "px"): string {
	const [top, right, bottom, left] = values

	// Optimize output
	if (top === right && right === bottom && bottom === left) {
		return `${top}${unit}`
	}
	if (top === bottom && right === left) {
		return `${top}${unit} ${right}${unit}`
	}
	if (right === left) {
		return `${top}${unit} ${right}${unit} ${bottom}${unit}`
	}
	return `${top}${unit} ${right}${unit} ${bottom}${unit} ${left}${unit}`
}

/**
 * Spacing input for margin/padding with 4 directions
 */
export function SpacingInput({ label, value, onChange, id }: SpacingInputProps) {
	const [linked, setLinked] = useState(true)
	const [values, setValues] = useState<string[]>(parseSpacing(value))

	// Sync with external value changes
	useEffect(() => {
		setValues(parseSpacing(value))
	}, [value])

	// Debounce for input changes
	const { run: onChangeDebounced } = useDebounceFn(
		(formattedValue: string) => {
			onChange(formattedValue)
		},
		{ wait: 300 },
	)

	/**
	 * Handle individual direction change
	 */
	const handleChange = useCallback(
		(index: number, newValue: string) => {
			// Allow empty or valid number
			if (newValue === "" || /^[\d.]*$/.test(newValue)) {
				const newValues = [...values]

				if (linked) {
					// Update all values when linked
					newValues.fill(newValue)
				} else {
					// Update single value
					newValues[index] = newValue
				}

				setValues(newValues)

				// Convert empty to "0"
				const formatted = newValues.map((v) => (v === "" ? "0" : v))
				onChangeDebounced(formatSpacing(formatted))
			}
		},
		[values, linked, onChangeDebounced],
	)

	const directions = [
		{ label: "上", placeholder: "上" },
		{ label: "右", placeholder: "右" },
		{ label: "下", placeholder: "下" },
		{ label: "左", placeholder: "左" },
	]

	return (
		<div className="space-y-2">
			<div className="flex items-center justify-between">
				<Label className="text-xs">{label}</Label>
				<Button
					variant="ghost"
					size="sm"
					className="h-6 w-6 p-0"
					onClick={() => setLinked(!linked)}
					title={linked ? "解除关联" : "关联所有边"}
				>
					{linked ? <Link2 size={14} /> : <Unlink size={14} />}
				</Button>
			</div>

			<div className="grid grid-cols-2 gap-2">
				{directions.map((dir, index) => (
					<div key={index} className="flex items-center gap-2">
						<span className="w-6 text-xs text-muted-foreground">{dir.label}</span>
						<Input
							type="text"
							value={values[index]}
							onChange={(e) => handleChange(index, e.target.value)}
							placeholder={dir.placeholder}
							className="flex-1 font-mono text-xs"
						/>
					</div>
				))}
			</div>

			<div className="font-mono text-xs text-muted-foreground">
				{formatSpacing(values.map((v) => v || "0"))}
			</div>
		</div>
	)
}
