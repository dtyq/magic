export interface MobileBottomSearchBarProps {
	value: string
	placeholder: string
	clearAriaLabel: string
	onValueChange: (value: string) => void
	testIdPrefix: string
	clearButtonVisibility?: "focus-or-value" | "value-only"
	className?: string
	disabled?: boolean
}
