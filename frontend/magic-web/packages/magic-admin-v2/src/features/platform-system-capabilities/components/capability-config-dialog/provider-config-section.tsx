import { useTranslation } from "react-i18next"
import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field"
import { Button } from "@magic-admin-v2/components/ui/button"
import { FormControl, FormField, FormItem, FormMessage } from "@magic-admin-v2/components/ui/form"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import {
	ConnectivityTestResult,
	type ConnectivityTestState,
} from "@magic-admin-v2/features/platform-system-capabilities/components/capability-config-dialog/connectivity-test-result"
import { ProviderConfigField } from "@magic-admin-v2/features/platform-system-capabilities/components/capability-config-dialog/provider-config-field"
import type { CapabilityFormValues } from "@magic-admin-v2/features/platform-system-capabilities/schemas"
import type {
	ProviderConfig,
	ProviderFieldConfig,
} from "@magic-admin-v2/features/platform-system-capabilities/types"
import { getProviderLabel } from "@magic-admin-v2/features/platform-system-capabilities/utils"
import type { UseFormReturn } from "react-hook-form"
import { CheckCircle2, Loader2 } from "lucide-react"

export function ProviderConfigSection({
	canEdit,
	connectivityResult,
	fields,
	form,
	onProviderChange,
	onTestConnection,
	providerList,
	selectedProvider,
	supportsConnectivityTest,
	testPending,
}: {
	canEdit: boolean
	connectivityResult: ConnectivityTestState
	fields: ProviderFieldConfig[]
	form: UseFormReturn<CapabilityFormValues>
	onProviderChange: (provider: string) => void
	onTestConnection: () => void
	providerList: ProviderConfig[]
	selectedProvider: string
	supportsConnectivityTest: boolean
	testPending: boolean
}) {
	const { t } = useTranslation()
	const providerField = fields.find((field) => field.name === "provider")
	const configFields = fields.filter((field) => field.name !== "provider")
	const selectedProviderConfig = form.watch("provider")
	const hasConnectivityResult =
		connectivityResult.status === "success" || connectivityResult.status === "error"

	return (
		<div className="grid gap-6">
			<section className="grid gap-3">
				<div>
					<h3 className="text-sm font-semibold">
						{t("systemCapabilities.section.serviceConfig")}
					</h3>
					<p className="text-xs text-muted-foreground">
						{t("systemCapabilities.section.serviceConfigDesc")}
					</p>
				</div>
				{providerField ? (
					<FormField
						control={form.control}
						name="selectedProvider"
						render={({ field }) => (
							<FormItem>
								<DialogFormField
									description={
										providerField.descriptionKey
											? t(providerField.descriptionKey)
											: undefined
									}
									label={
										providerField.labelKey
											? t(providerField.labelKey)
											: t("systemCapabilities.field.provider")
									}
									fieldId="capability-provider-select"
									required={providerField.required}
								>
									<Select
										disabled={!canEdit}
										value={field.value ?? selectedProvider}
										onValueChange={(value) => {
											field.onChange(value)
											onProviderChange(value)
										}}
									>
										<FormControl>
											<SelectTrigger
												className="w-full"
												id="capability-provider-select"
											 data-testid="platform-system-capabilities-capability-provider-select-trigger">
												<SelectValue
													placeholder={t(
														"systemCapabilities.placeholder.provider",
													)}
												/>
											</SelectTrigger>
										</FormControl>
										<SelectContent data-testid="platform-system-capabilities-capability-provider-select-content">
											{providerList.map((provider) => (
												<SelectItem
													key={provider.provider}
													textValue={getProviderLabel(provider)}
													value={provider.provider}
												 data-testid="platform-system-capabilities-option">
													{getProviderLabel(provider)}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</DialogFormField>
								<FormMessage />
							</FormItem>
						)}
					/>
				) : null}
			</section>

			<section className="grid gap-3">
				<div>
					<h3 className="text-sm font-semibold">
						{t("systemCapabilities.section.apiConfig")}
					</h3>
					<p className="text-xs text-muted-foreground">
						{t("systemCapabilities.section.apiConfigDesc")}
					</p>
				</div>
				<div className="grid gap-4">
					{configFields.map((field) => (
						<ProviderConfigField
							disabled={!canEdit}
							field={field}
							form={form}
							key={field.name}
						/>
					))}
				</div>
				{supportsConnectivityTest &&
				providerList.length &&
				selectedProviderConfig.provider ? (
					<div className="flex justify-end">
						<Button
							disabled={!canEdit || testPending}
							onClick={onTestConnection}
							type="button"
							variant="outline"
						 data-testid="platform-system-capabilities-edit-button">
							{testPending ? (
								<Loader2 className="size-4 animate-spin" aria-hidden="true" />
							) : (
								<CheckCircle2 className="size-4" aria-hidden="true" />
							)}
							{t("systemCapabilities.action.testConnection")}
						</Button>
					</div>
				) : null}
				{hasConnectivityResult ? (
					<ConnectivityTestResult
						labels={{
							normal: t("systemCapabilities.test.normal"),
							error: t("systemCapabilities.test.error"),
							failureDescription: t("systemCapabilities.test.failureDescription"),
							viewDetails: t("systemCapabilities.test.viewDetails"),
							hideDetails: t("systemCapabilities.test.hideDetails"),
							duration: (durationMs) =>
								t("systemCapabilities.test.duration", { duration: durationMs }),
						}}
						result={connectivityResult}
					/>
				) : null}
			</section>
		</div>
	)
}
