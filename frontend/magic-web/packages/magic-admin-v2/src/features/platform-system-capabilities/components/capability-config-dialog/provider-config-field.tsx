import { useTranslation } from "react-i18next"
import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field"
import { FormControl, FormField, FormItem, FormMessage } from "@magic-admin-v2/components/ui/form"
import { Input } from "@magic-admin-v2/components/ui/input"
import { Textarea } from "@magic-admin-v2/components/ui/textarea"
import type { CapabilityFormValues } from "@magic-admin-v2/features/platform-system-capabilities/schemas"
import type { ProviderFieldConfig } from "@magic-admin-v2/features/platform-system-capabilities/types"
import type { UseFormReturn } from "react-hook-form"

export function ProviderConfigField({
	disabled,
	field,
	form,
}: {
	disabled: boolean
	field: ProviderFieldConfig
	form: UseFormReturn<CapabilityFormValues>
}) {
	const { t } = useTranslation()
	const fieldName = `provider.${field.name}` as `provider.${string}`
	const label = field.labelKey ? t(field.labelKey) : (field.label ?? field.name)
	const description = field.descriptionKey ? t(field.descriptionKey) : undefined

	return (
		<FormField
			control={form.control}
			name={fieldName as never}
			render={({ field: formField }) => (
				<FormItem>
					<DialogFormField
						description={description}
						fieldId={`capability-provider-${field.name}`}
						label={label}
						required={field.required}
					>
						<FormControl>
							{field.type === "textarea" ? (
								<Textarea
									disabled={disabled}
									id={`capability-provider-${field.name}`}
									onChange={formField.onChange}
									placeholder={description}
									rows={4}
									value={String(formField.value ?? "")}
								 data-testid="platform-system-capabilities-textarea-input"/>
							) : (
								<Input
									disabled={disabled}
									id={`capability-provider-${field.name}`}
									inputMode={field.inputMode}
									onChange={formField.onChange}
									placeholder={description}
									type={field.type === "password" ? "password" : "text"}
									value={String(formField.value ?? "")}
								 data-testid="platform-system-capabilities-input"/>
							)}
						</FormControl>
						<FormMessage />
					</DialogFormField>
				</FormItem>
			)}
		/>
	)
}
