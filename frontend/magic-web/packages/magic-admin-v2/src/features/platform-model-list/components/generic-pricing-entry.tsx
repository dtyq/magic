import { useTranslation } from "react-i18next"

import { Switch } from "@magic-admin-v2/components/ui/switch"
import type {
	ProviderModelCategory,
	ProviderModelPricingEntry,
	ProviderModelPricingTemplate,
} from "@magic-admin-v2/features/platform-model-list/types"
import { getPricingUnit } from "@magic-admin-v2/features/platform-model-list/utils/pricing"
import { PricingAmountInput } from "./pricing-inputs"

export function GenericPricingEntry({
	billingObject,
	billingType,
	category,
	currency,
	disabled,
	entry,
	fieldId,
	item,
	onChange,
}: {
	billingObject: string
	billingType: string
	category: ProviderModelCategory
	currency: "CNY" | "USD"
	disabled: boolean
	entry: ProviderModelPricingEntry
	fieldId: string
	item: ProviderModelPricingTemplate["items"][number]
	onChange: (patch: Partial<ProviderModelPricingEntry>) => void
}) {
	const { t } = useTranslation()

	return (
		<div className="grid gap-3 rounded-md bg-muted/40 p-4">
			<div className="flex items-center justify-between gap-4">
				<span className="min-w-0 text-sm font-medium">{item.label}</span>
				<div className="flex shrink-0 items-center gap-2">
					<span className="text-xs text-muted-foreground">
						{entry.enabled
							? t("modelList.editor.pricing.enabled")
							: t("modelList.editor.pricing.disabled")}
					</span>
					<Switch
						checked={entry.enabled}
						disabled={disabled}
						onCheckedChange={(enabled) => onChange({ enabled })}
					 data-testid="platform-model-list-switch"/>
				</div>
			</div>
			<PricingAmountInput
				currency={currency}
				unit={getPricingUnit(billingType, category, billingObject)}
				disabled={disabled || !entry.enabled}
				fieldId={fieldId}
				onChange={(event) => onChange({ value: event.target.value })}
				placeholder={t("modelList.editor.placeholder.price")}
				value={entry.value}
			/>
		</div>
	)
}
