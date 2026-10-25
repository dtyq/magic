import { useTranslation } from "react-i18next"
import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field"
import { FormControl, FormField, FormItem, FormMessage } from "@magic-admin-v2/components/ui/form"
import { Textarea } from "@magic-admin-v2/components/ui/textarea"
import { CapabilityModelSelect } from "@magic-admin-v2/features/platform-system-capabilities/components/capability-config-dialog/capability-model-select"
import type { CapabilityFormValues } from "@magic-admin-v2/features/platform-system-capabilities/schemas"
import type { CapabilityModel } from "@magic-admin-v2/features/platform-system-capabilities/types"
import type { UseFormReturn } from "react-hook-form"

export function ModelConfigSection({
	canEdit,
	form,
	imagePrompt,
	loading,
	models,
}: {
	canEdit: boolean
	form: UseFormReturn<CapabilityFormValues>
	imagePrompt: boolean
	loading: boolean
	models: CapabilityModel[]
}) {
	const { t } = useTranslation()

	return (
		<div className="grid gap-6">
			<section className="grid gap-3">
				<div>
					<h3 className="text-sm font-semibold">
						{t("systemCapabilities.section.modelConfig")}
					</h3>
					<p className="text-xs text-muted-foreground">
						{t("systemCapabilities.section.modelConfigDesc")}
					</p>
				</div>
				<FormField
					control={form.control}
					name="model_id"
					render={({ field }) => (
						<FormItem>
							<DialogFormField
								description={t("systemCapabilities.fieldDesc.aiModel")}
								fieldId="capability-model-id"
								label={t("systemCapabilities.field.aiModel")}
								required={false}
							>
								<FormControl>
									<CapabilityModelSelect
										disabled={!canEdit}
										id="capability-model-id"
										loading={loading}
										models={models}
										onChange={field.onChange}
										value={field.value ?? ""}
									/>
								</FormControl>
							</DialogFormField>
							<FormMessage />
						</FormItem>
					)}
				/>
			</section>

			{imagePrompt ? (
				<FormField
					control={form.control}
					name="prompt"
					render={({ field }) => (
						<FormItem>
							<DialogFormField
								description={t("systemCapabilities.fieldDesc.prompt")}
								fieldId="capability-prompt"
								label={t("systemCapabilities.field.prompt")}
							>
								<Textarea
									disabled={!canEdit}
									id="capability-prompt"
									onChange={field.onChange}
									placeholder={t("systemCapabilities.placeholder.prompt")}
									rows={4}
									value={field.value ?? ""}
								 data-testid="platform-system-capabilities-capability-prompt-input"/>
							</DialogFormField>
							<FormMessage />
						</FormItem>
					)}
				/>
			) : null}
		</div>
	)
}
