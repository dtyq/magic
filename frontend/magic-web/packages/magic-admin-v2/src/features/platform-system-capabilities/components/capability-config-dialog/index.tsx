import { AlertCircle, Loader2, Save } from "lucide-react"
import { useTranslation } from "react-i18next"
import { EmptyState } from "@magic-admin-v2/components/empty-state"
import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@magic-admin-v2/components/ui/dialog"
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormMessage,
} from "@magic-admin-v2/components/ui/form"
import { Skeleton } from "@magic-admin-v2/components/ui/skeleton"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import { ProviderConfigSection } from "@magic-admin-v2/features/platform-system-capabilities/components/capability-config-dialog/provider-config-section"
import { ModelConfigSection } from "@magic-admin-v2/features/platform-system-capabilities/components/capability-config-dialog/model-config-section"
import { useCapabilityConfig } from "@magic-admin-v2/features/platform-system-capabilities/hooks/use-capability-config"
import type { AiPower } from "@magic-admin-v2/features/platform-system-capabilities/types"
import {
	getApiErrorMessage,
	getCapabilityDisplayText,
} from "@magic-admin-v2/features/platform-system-capabilities/utils"

export function CapabilityConfigDialog({
	canEdit,
	onOpenChange,
	open,
	target,
}: {
	canEdit: boolean
	onOpenChange: (open: boolean) => void
	open: boolean
	target: AiPower | null
}) {
	const { t } = useTranslation()
	const config = useCapabilityConfig({ canEdit, onOpenChange, open, target })
	const isLoading = config.detailQuery.isLoading
	const detailError = config.detailQuery.error
	const displayName = getCapabilityDisplayText(target?.name)
	const displayDescription = getCapabilityDisplayText(target?.description)

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="flex max-h-[calc(100vh-2rem)] flex-col overflow-visible sm:max-w-2xl" data-testid="platform-system-capabilities-dialog-content" closeButtonTestId="index-close-button">
				<DialogHeader className="shrink-0">
					<DialogTitle>
						{displayName || t("systemCapabilities.action.config")}
					</DialogTitle>
					<DialogDescription>
						{displayDescription || t("systemCapabilities.dialog.description")}
					</DialogDescription>
				</DialogHeader>

				<div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1 py-1">
					{isLoading || (config.detail && !config.isInitialized) ? (
						<div className="grid gap-4 py-1">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-28 w-full" />
						</div>
					) : detailError ? (
						<EmptyState
							description={getApiErrorMessage(detailError, t("common.requestFailed"))}
							icon={AlertCircle}
							title={t("systemCapabilities.error.detailTitle")}
						 testId="platform-system-capabilities-error"/>
					) : !config.detail ? (
						<EmptyState
							description={t("systemCapabilities.error.detailEmpty")}
							icon={AlertCircle}
							title={t("systemCapabilities.error.detailTitle")}
						 testId="platform-system-capabilities-empty"/>
					) : (
						<Form {...config.form}>
							<form
								className="grid gap-4 py-1"
								onSubmit={config.form.handleSubmit(config.handleSubmit)}
							>
								<div className="flex items-center gap-3">
									<FormStatusField config={config} />
								</div>

								{config.isProviderConfig ? (
									<ProviderConfigSection
										canEdit={canEdit}
										connectivityResult={config.connectivityResult}
										fields={config.providerFields}
										form={config.form}
										onProviderChange={config.handleProviderChange}
										onTestConnection={config.handleTestConnection}
										providerList={config.providerList}
										selectedProvider={config.selectedProvider}
										supportsConnectivityTest={config.supportsConnectivityTest}
										testPending={config.testPending}
									/>
								) : (
									<ModelConfigSection
										canEdit={canEdit}
										form={config.form}
										imagePrompt={config.imagePrompt}
										loading={config.isModelLoading}
										models={config.models}
									/>
								)}

								<DialogFooter className="shrink-0 pt-2 sm:justify-end">
									<div className="flex flex-col-reverse gap-2 sm:flex-row">
										<Button
											onClick={() => onOpenChange(false)}
											type="button"
											variant="outline"
										 data-testid="platform-system-capabilities-cancel-button">
											{t("common.cancel")}
										</Button>
										<Button
											disabled={
												!canEdit ||
												config.updatePending ||
												config.detailQuery.isFetching
											}
											type="submit"
										 data-testid="platform-system-capabilities-save-button">
											{config.updatePending ? (
												<Loader2
													className="size-4 animate-spin"
													aria-hidden="true"
												/>
											) : (
												<Save className="size-4" aria-hidden="true" />
											)}
											{config.updatePending
												? t("common.saving")
												: t("common.save")}
										</Button>
									</div>
								</DialogFooter>
							</form>
						</Form>
					)}
				</div>
			</DialogContent>
		</Dialog>
	)
}

function FormStatusField({ config }: { config: ReturnType<typeof useCapabilityConfig> }) {
	const { t } = useTranslation()

	return (
		<FormField
			control={config.form.control}
			name="status"
			render={({ field }) => (
				<FormItem className="w-full">
					<DialogFormField
						description={t("systemCapabilities.fieldDesc.status")}
						fieldId="capability-status"
						label={t("systemCapabilities.field.status")}
					>
						<div className="flex h-10 items-center gap-2">
							<FormControl>
								<Switch
									checked={field.value}
									disabled={!config.canEdit}
									id="capability-status"
									onCheckedChange={field.onChange}
								 data-testid="platform-system-capabilities-capability-status-switch"/>
							</FormControl>
							<span className="text-sm text-muted-foreground">
								{field.value ? t("common.enabled") : t("common.disabled")}
							</span>
						</div>
					</DialogFormField>
					<FormMessage />
				</FormItem>
			)}
		/>
	)
}
