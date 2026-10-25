import { type ChangeEvent } from "react"
import { useTranslation } from "react-i18next"

import { Input } from "@magic-admin-v2/components/ui/input"
import type { PricingUnit } from "@magic-admin-v2/features/platform-model-list/utils/pricing"
import { cn } from "@magic-admin-v2/utils/cn"

export function TokenBoundaryInput({
	disabled,
	id,
	onChange,
	placeholder,
	value,
}: {
	disabled: boolean
	id?: string
	onChange?: (event: ChangeEvent<HTMLInputElement>) => void
	placeholder?: string
	value: string
}) {
	return (
		<div
			className={cn(
				"flex h-9 overflow-hidden rounded-md border border-input bg-card shadow-sm",
				disabled && "cursor-not-allowed opacity-50",
			)}
		>
			<Input
				className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 disabled:opacity-100"
				disabled={disabled}
				id={id}
				inputMode="numeric"
				min="0"
				onChange={onChange}
				onWheel={(event) => event.currentTarget.blur()}
				placeholder={placeholder}
				type="number"
				value={value}
			 data-testid="platform-model-list-input"/>
			<span className="flex shrink-0 items-center border-l bg-muted/40 px-2 text-xs text-muted-foreground">
				K
			</span>
		</div>
	)
}


export function PricingAmountInput({
	currency,
	disabled,
	fieldId,
	inputId,
	onChange,
	placeholder,
	value,
	unit,
}: {
	currency: "CNY" | "USD"
	disabled: boolean
	fieldId?: string
	inputId?: string
	onChange: (event: ChangeEvent<HTMLInputElement>) => void
	placeholder: string
	value: string
	unit: PricingUnit
}) {
	const { t } = useTranslation()

	return (
		<div
			className={cn(
				"flex h-9 overflow-hidden rounded-md border border-input bg-card shadow-sm transition-colors focus-within:ring-2 focus-within:ring-ring",
				disabled && "cursor-not-allowed opacity-50",
			)}
			data-model-editor-field={fieldId}
		>
			<span className="flex shrink-0 items-center border-r bg-muted/40 px-3 text-sm text-muted-foreground">
				{currency === "CNY" ? "¥" : "$"}
			</span>
			<Input
				className="h-full min-w-0 flex-1 rounded-none border-0 bg-transparent px-3 shadow-none focus-visible:ring-0 disabled:opacity-100"
				disabled={disabled}
				id={inputId ?? fieldId}
				inputMode="decimal"
				min="0"
				onChange={onChange}
				placeholder={placeholder}
				step="any"
				type="number"
				value={value}
			 data-testid="platform-model-list-input"/>
			<span className="flex shrink-0 items-center border-l bg-muted/40 px-3 text-xs text-muted-foreground">
				{t(`modelList.editor.pricingUnit.${unit}`)}
			</span>
		</div>
	)
}
