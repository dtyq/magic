import { useCallback, memo } from "react"
import { Flex } from "antd"
import { MagicInputNumber } from "components"
import { debounce } from "lodash-es"
import type { valueType } from "antd/es/statistic/utils"

export const PriceRangeSelectName = "priceRangeSelect"

interface PriceRangeProps {
	value: [number | null, number | null]
	onChange?: (type: "min" | "max", val: valueType | null) => void
	placeholder?: [string, string]
	min?: number
	max?: number
	precision?: number
	disabled?: boolean
}

/* 价格范围选择器 */
export const PriceRange = memo(
	({
		value,
		onChange,
		placeholder = ["最小金额", "最大金额"],
		min = 0,
		max = 999999999,
		precision = 2,
		disabled = false,
		...props
	}: PriceRangeProps) => {
		const handleMinChange = useCallback(
			(val: valueType | null) => {
				onChange?.("min", val)
			},
			[onChange],
		)

		const handleMaxChange = useCallback(
			(val: valueType | null) => {
				onChange?.("max", val)
			},
			[onChange],
		)

		return (
			<Flex gap={8} align="center">
				<MagicInputNumber
					onChange={debounce(handleMinChange, 500)}
					placeholder={placeholder[0]}
					min={min}
					max={max}
					precision={precision}
					disabled={disabled}
					style={{ flex: 1 }}
					{...props}
				/>
				<span style={{ color: "#8c8c8c", fontSize: "14px" }}>～</span>
				<MagicInputNumber
					onChange={debounce(handleMaxChange, 500)}
					placeholder={placeholder[1]}
					min={min}
					max={max}
					precision={precision}
					disabled={disabled}
					style={{ flex: 1 }}
					{...props}
				/>
			</Flex>
		)
	},
)
