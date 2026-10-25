import { useRef, useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useDebounceFn } from "ahooks"
import { Button } from "@/components/shadcn-ui/button"
import { TooltipContent, TooltipTrigger } from "@/components/shadcn-ui/tooltip"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { TAILWIND_Z_INDEX_CLASSES } from "../../../constants/z-index"
import { STYLE_PANEL_STYLES } from "../styles"

interface ColorPickerProps {
	value: string
	onChange?: (value: string) => void
	onChangeComplete?: (value: string) => void
	disabled?: boolean
}

/**
 * Color picker component - applies color change when user stops dragging
 */
export function ColorPicker({ value, onChange, onChangeComplete, disabled }: ColorPickerProps) {
	const { t } = useTranslation("super")
	const inputRef = useRef<HTMLInputElement>(null)
	const [localValue, setLocalValue] = useState(value)
	const [isChanging, setIsChanging] = useState(false)

	// Sync local value with prop value when not actively changing
	useEffect(() => {
		if (!isChanging) {
			setLocalValue(value)
		}
	}, [value, isChanging])

	// Debounced apply - triggers when user stops dragging for 300ms
	const { run: debouncedApply } = useDebounceFn(
		(newValue: string) => {
			if (onChangeComplete) {
				onChangeComplete(newValue)
			} else if (onChange) {
				onChange(newValue)
			}
		},
		{ wait: 300 },
	)

	const handleClick = () => {
		if (!disabled) {
			inputRef.current?.click()
			setIsChanging(true)
		}
	}

	const handleChange = (newValue: string) => {
		setLocalValue(newValue)
		// Call onChange for immediate preview
		if (onChange) {
			onChange(newValue)
		}
		// Debounced apply when user stops dragging
		debouncedApply(newValue)
	}

	const handleBlur = () => {
		setIsChanging(false)
		// Apply the final color value immediately on blur
		const finalValue = inputRef.current?.value || localValue
		if (onChangeComplete) {
			onChangeComplete(finalValue)
		} else if (onChange) {
			onChange(finalValue)
		}
	}

	return (
		<TooltipPrimitive.Root>
			<TooltipTrigger asChild>
				<span>
					<Button
						data-testid="html-editor-text-color-button"
						variant="ghost"
						size="icon"
						className={`relative ${STYLE_PANEL_STYLES.iconButton}`}
						disabled={disabled}
						onClick={handleClick}
					>
						<div className="flex flex-col items-center gap-0.5">
							<span className="h-4 w-4 font-medium">A</span>
							<div
								className="h-1 w-4 rounded-sm"
								style={{ backgroundColor: localValue }}
							/>
						</div>
						<input
							ref={inputRef}
							type="color"
							value={localValue}
							onChange={(e) => handleChange(e.target.value)}
							onBlur={handleBlur}
							className="absolute inset-0 cursor-pointer opacity-0"
							disabled={disabled}
							data-testid="handle-change"
						/>
					</Button>
				</span>
			</TooltipTrigger>
			<TooltipContent className={TAILWIND_Z_INDEX_CLASSES.EDITOR_FLOATING.TOOLTIP}>
				{t("stylePanel.textColor")}
			</TooltipContent>
		</TooltipPrimitive.Root>
	)
}
