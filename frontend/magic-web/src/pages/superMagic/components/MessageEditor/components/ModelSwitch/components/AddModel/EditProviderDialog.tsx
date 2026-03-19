import { useState, useEffect } from "react"
import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogClose,
} from "@/components/shadcn-ui/dialog"
import { Button } from "@/components/shadcn-ui/button"
import { Input } from "@/components/shadcn-ui/input"
import { Textarea } from "@/components/shadcn-ui/textarea"
import { Spinner } from "@/components/shadcn-ui/spinner"
import { cn } from "@/lib/utils"
import { ProviderTypeIcon } from "../ProviderTypeIcon"
import { useAddModelStore } from "./context"
import { validateProviderFieldValue } from "./providerFieldConfigs"

function EditProviderDialog() {
	const { t } = useTranslation("super")
	const store = useAddModelStore()
	const [submitted, setSubmitted] = useState(false)

	useEffect(() => {
		if (store.isEditProviderOpen) {
			store.loadOrgAiModelProviderTemplates(store.category)
		}
	}, [store.isEditProviderOpen, store.category, store])

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			store.closeEditProvider()
			setSubmitted(false)
		}
	}

	const handleConfirm = async () => {
		setSubmitted(true)
		if (!store.isAddProviderFormValid) return
		await store.submitUpdateOrgAiModelProvider()
		setSubmitted(false)
	}

	const provider = store.editingProvider
	if (!provider) return null

	const template = store.providerTypeForValidation
	const providerTypeDisplayName = template?.name
		? template.name
		: provider.providerTypeId
			? t("messageEditor.addModel.unknownProviderTypeWithCode", {
				providerTypeId: provider.providerTypeId,
			})
			: t("messageEditor.addModel.unknownProviderType")
	const fieldConfigs = template?.fields ?? []

	return (
		<Dialog open={store.isEditProviderOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				className="max-h-[80vh] max-w-[700px] gap-0 overflow-hidden p-0"
				data-testid="edit-provider-dialog"
			>
				<DialogHeader className="border-b border-border p-3">
					<DialogTitle className="text-base font-semibold leading-6">
						{t("messageEditor.addModel.editProvider")}
					</DialogTitle>
					<DialogClose />
				</DialogHeader>

				<div className="scrollbar-y-thin flex max-h-[60vh] flex-col gap-2.5 overflow-y-auto p-4">
					{/* Read-only provider icon + name */}
					<div className="flex items-center gap-3 rounded-lg">
						<div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded">
							<ProviderTypeIcon
								providerTypeId={provider.providerTypeId}
								className="size-full"
								size={32}
							/>
						</div>
						<span className="text-sm font-medium text-foreground">
							{providerTypeDisplayName}
						</span>
					</div>

					{/* Form fields */}
					{store.isLoadingTemplates ? (
						<div
							className="flex items-center justify-center py-8"
							data-testid="edit-provider-loading"
						>
							<Spinner size={24} className="animate-spin" />
						</div>
					) : (
						<div className="flex flex-col gap-2.5">
							{fieldConfigs.map((field) => {
								const error = submitted
									? validateProviderFieldValue(
										field,
										store.providerFields[field.key],
									)
									: null
								const hasError = !!error
								const fieldErrorMessage =
									error === "required"
										? t("messageEditor.addModel.fieldRequired")
										: error === "invalid_url"
											? t("messageEditor.addModel.fieldInvalidUrl")
											: error === "invalid_email"
												? t("messageEditor.addModel.fieldInvalidEmail")
												: null
								const fieldLabel = field.labelKey
									? t(`messageEditor.addModel.${field.labelKey}`)
									: field.label
								const isTextarea = field.inputType === "textarea"
								return (
									<div
										key={field.key}
										className="flex items-start gap-2"
										data-testid={`edit-provider-field-${field.key}`}
									>
										<div className="flex h-9 flex-1 items-center gap-1 whitespace-nowrap text-base font-medium leading-6 text-foreground">
											{fieldLabel}
											{field.required && (
												<span className="text-destructive">*</span>
											)}
										</div>
										<div className="flex w-80 flex-col gap-1">
											{isTextarea ? (
												<Textarea
													className={cn(
														"min-h-20 text-sm",
														hasError &&
														"border-destructive focus-visible:ring-destructive/20",
													)}
													placeholder={field.placeholder}
													value={store.providerFields[field.key] ?? ""}
													onChange={(e) =>
														store.setProviderField(
															field.key,
															e.target.value,
														)
													}
												/>
											) : (
												<Input
													className={cn(
														"h-9 text-sm",
														hasError &&
														"border-destructive focus-visible:ring-destructive/20",
													)}
													type={
														field.inputType === "password"
															? "password"
															: "text"
													}
													placeholder={field.placeholder}
													value={store.providerFields[field.key] ?? ""}
													onChange={(e) =>
														store.setProviderField(
															field.key,
															e.target.value,
														)
													}
												/>
											)}
											{field.description && (
												<p className="text-xs text-muted-foreground">
													{field.description}
												</p>
											)}
											{hasError && (
												<p
													className="text-xs text-destructive"
													role="alert"
												>
													{fieldErrorMessage}
												</p>
											)}
										</div>
									</div>
								)
							})}
						</div>
					)}
				</div>

				<DialogFooter className="border-t border-border p-3">
					<Button
						variant="outline"
						onClick={() => store.closeEditProvider()}
						disabled={store.isSubmitting}
						data-testid="edit-provider-cancel-button"
					>
						{t("messageEditor.addModel.cancel")}
					</Button>
					<Button
						onClick={handleConfirm}
						disabled={store.isSubmitting}
						data-testid="edit-provider-confirm-button"
					>
						{store.isSubmitting ? (
							<>
								<Spinner size={16} className="animate-spin" />
								{t("messageEditor.addModel.confirm")}
							</>
						) : (
							t("messageEditor.addModel.confirm")
						)}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	)
}

export default observer(EditProviderDialog)
