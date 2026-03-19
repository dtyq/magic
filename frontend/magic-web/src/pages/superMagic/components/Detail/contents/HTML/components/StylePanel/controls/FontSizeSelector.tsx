import { useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { Input } from "@/components/shadcn-ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/shadcn-ui/select"

const FONT_SIZES = ["12", "14", "16", "18", "20", "24", "28", "32", "36", "48", "64", "72"]

interface FontSizeSelectorProps {
	value: string
	onChange: (value: string) => void
	onApply: (value: string) => void
	disabled?: boolean
}

/**
 * Font size selector with manual input
 */
export function FontSizeSelector({ value, onChange, onApply, disabled }: FontSizeSelectorProps) {
	const { t } = useTranslation("super")

	const fontSizeOptions = useMemo(() => {
		if (!value || FONT_SIZES.includes(value)) return FONT_SIZES
		return [...FONT_SIZES, value].sort((a, b) => parseInt(a) - parseInt(b))
	}, [value])

	const handleInput = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const inputValue = e.target.value
			if (inputValue === "" || /^\d+$/.test(inputValue)) {
				onChange(inputValue)
			}
		},
		[onChange],
	)

	const handleBlur = useCallback(() => {
		if (value && /^\d+$/.test(value)) {
			onApply(value)
		}
	}, [value, onApply])

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "Enter") {
				e.preventDefault()
				if (value && /^\d+$/.test(value)) {
					onApply(value)
						; (e.target as HTMLInputElement).blur()
				}
			}
		},
		[value, onApply],
	)

	const handleSelectChange = useCallback(
		(selectedValue: string) => {
			onChange(selectedValue)
			onApply(selectedValue)
		},
		[onChange, onApply],
	)

	return (
		<div className="flex h-8 items-center gap-0.5 rounded-sm border-0 pl-2 shadow-none hover:bg-accent">
			<span className="text-xs font-medium text-muted-foreground">
				{t("stylePanel.fontSize")}
			</span>
			<div className="relative flex items-center">
				<Input
					type="text"
					value={value}
					onChange={handleInput}
					onBlur={handleBlur}
					onKeyDown={handleKeyDown}
					disabled={disabled}
					className="h-full w-[50px] border-0 bg-transparent pl-0 pr-6 text-center text-xs shadow-none hover:bg-transparent disabled:opacity-50"
					placeholder="16"
					title={t("stylePanel.fontSize")}
				/>
				<Select value={value} onValueChange={handleSelectChange} disabled={disabled}>
					<SelectTrigger className="absolute right-0 h-full w-5 border-0 bg-transparent p-0 shadow-none hover:bg-transparent disabled:opacity-50 [&>span]:hidden [&>svg]:h-3 [&>svg]:w-3">
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{fontSizeOptions.map((size) => (
							<SelectItem key={size} value={size} className="text-xs">
								{size}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
		</div>
	)
}
