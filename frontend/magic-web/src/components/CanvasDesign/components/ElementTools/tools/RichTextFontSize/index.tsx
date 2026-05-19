import { ChevronDown } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import styles from "./index.module.css"
import { Input } from "../../../ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "../../../ui/popover"
import {
	formatTypographyMetricForInput,
	roundTypographyMetric,
	sanitizeTypographyDecimalInput,
	TYPOGRAPHY_DECIMAL_PLACES,
} from "../../../../canvas/text/typographyMetrics"
import { useTextToolController } from "../text/useTextToolController"

const FONT_SIZES = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64, 72, 96]

export default function RichTextFontSize() {
	const { state, isEditingText, resolvedDefaultStyle, restoreSelection, setFontSize } =
		useTextToolController()
	const [inputValue, setInputValue] = useState("")
	const [open, setOpen] = useState(false)
	const displayedFontSize =
		isEditingText && state.fontSize !== null ? state.fontSize : resolvedDefaultStyle.fontSize
	const richTextFontSize =
		displayedFontSize === null || displayedFontSize === undefined
			? ""
			: formatTypographyMetricForInput(displayedFontSize, TYPOGRAPHY_DECIMAL_PLACES)

	useEffect(() => {
		setInputValue(richTextFontSize)
	}, [richTextFontSize])

	const commitFontSize = useCallback(
		(value: string) => {
			const normalizedValue = value.trim().replace(/\.+$/, "")
			const parsedValue = Number.parseFloat(normalizedValue)
			if (normalizedValue === "" || Number.isNaN(parsedValue) || parsedValue <= 0) {
				setInputValue(richTextFontSize)
				return
			}
			const rounded = roundTypographyMetric(parsedValue, TYPOGRAPHY_DECIMAL_PLACES)
			setInputValue(formatTypographyMetricForInput(rounded, TYPOGRAPHY_DECIMAL_PLACES))
			setFontSize(rounded)
		},
		[richTextFontSize, setFontSize],
	)

	const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
		setInputValue(sanitizeTypographyDecimalInput(event.target.value, TYPOGRAPHY_DECIMAL_PLACES))
	}, [])

	const handleInputBlur = useCallback(() => {
		commitFontSize(inputValue)
	}, [commitFontSize, inputValue])

	const handleInputKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Enter") {
				event.preventDefault()
				commitFontSize(inputValue)
				event.currentTarget.blur()
				return
			}
			if (event.key === "Escape") {
				event.preventDefault()
				setInputValue(richTextFontSize)
				event.currentTarget.blur()
			}
		},
		[commitFontSize, inputValue, richTextFontSize],
	)

	const handleSelectFontSize = useCallback(
		(size: number) => {
			const rounded = roundTypographyMetric(size, TYPOGRAPHY_DECIMAL_PLACES)
			setInputValue(formatTypographyMetricForInput(rounded, TYPOGRAPHY_DECIMAL_PLACES))
			setFontSize(rounded)
			setOpen(false)
		},
		[setFontSize],
	)

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<div className={`${styles.fontSizeControl} border border-input`}>
				<Input
					className={`${styles.input} text-sm`}
					inputMode="decimal"
					value={inputValue}
					placeholder="字号"
					onChange={handleInputChange}
					onBlur={handleInputBlur}
					onKeyDown={handleInputKeyDown}
				/>
				<PopoverTrigger asChild>
					<button
						type="button"
						className={styles.triggerButton}
						aria-label="打开字号列表"
						title="打开字号列表"
					>
						<ChevronDown size={16} />
					</button>
				</PopoverTrigger>
			</div>
			<PopoverContent
				className={styles.popoverContent}
				align="end"
				sideOffset={4}
				onOpenAutoFocus={(event) => {
					event.preventDefault()
				}}
				onCloseAutoFocus={(event) => {
					event.preventDefault()
					restoreSelection()
				}}
			>
				<div className={styles.optionList}>
					{FONT_SIZES.map((size) => {
						const isSelected =
							displayedFontSize !== null &&
							displayedFontSize !== undefined &&
							roundTypographyMetric(displayedFontSize, TYPOGRAPHY_DECIMAL_PLACES) ===
								roundTypographyMetric(size, TYPOGRAPHY_DECIMAL_PLACES)
						return (
							<button
								key={size}
								type="button"
								className={`${styles.optionItem} hover:bg-accent ${
									isSelected ? "bg-accent" : ""
								}`}
								onClick={() => handleSelectFontSize(size)}
							>
								<span className={styles.label}>{size}</span>
							</button>
						)
					})}
				</div>
			</PopoverContent>
		</Popover>
	)
}
