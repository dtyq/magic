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
} from "@/opensource/components/shadcn-ui/dialog"
import { Button } from "@/opensource/components/shadcn-ui/button"
import { Input } from "@/opensource/components/shadcn-ui/input"
import { Textarea } from "@/opensource/components/shadcn-ui/textarea"
import { Checkbox } from "@/opensource/components/shadcn-ui/checkbox"
import { Spinner } from "@/opensource/components/shadcn-ui/spinner"
import { cn } from "@/opensource/lib/utils"
import { useAddModelStore } from "./context"
import type { ProviderFieldConfig } from "./types"
import { validateProviderFieldValue } from "./providerFieldConfigs"
import { ServiceIcon } from "@dtyq/magic-admin"

const ProviderItem = observer(function ProviderItem({
	provider,
	isSelected,
	onSelect,
	submitted,
}: {
	provider: {
		id: string
		name: string
		icon: string
		providerCode: string
		fields: ProviderFieldConfig[]
	}
	isSelected: boolean
	onSelect: () => void
	submitted: boolean
}) {
	const { t } = useTranslation("super")
	const store = useAddModelStore()
	const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set())

	useEffect(() => {
		if (!isSelected) setTouchedFields(new Set())
	}, [isSelected])

	const handleBlur = (key: string) => {
		setTouchedFields((prev) => {
			const newSet = new Set(prev)
			newSet.add(key)
			return newSet
		})
	}

	const getFieldErrorMessage = (field: ProviderFieldConfig): string | null => {
		const shouldShowError = submitted || touchedFields.has(field.key)
		if (!shouldShowError) return null

		const error = validateProviderFieldValue(field, store.providerFields[field.key])
		if (!error) return null
		if (error === "required") return t("messageEditor.addModel.fieldRequired")
		if (error === "invalid_url") return t("messageEditor.addModel.fieldInvalidUrl")
		if (error === "invalid_email") return t("messageEditor.addModel.fieldInvalidEmail")
		return null
	}

	return (
		<div
			className={cn(
				"flex cursor-pointer flex-col gap-3 rounded-lg border px-2 py-2",
				"transition-colors",
				isSelected ? "border-primary" : "border-border",
			)}
			onClick={onSelect}
			data-testid={`add-provider-item-${provider.id}`}
		>
			<div className="flex items-center gap-3">
				<div className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded">
					<ServiceIcon code={provider.providerCode} size={32} />
				</div>
				<div className="flex flex-1 items-center">
					<span className="text-sm font-medium leading-none text-foreground">
						{provider.name}
					</span>
				</div>
				<Checkbox
					checked={isSelected}
					onCheckedChange={onSelect}
					className={cn(!isSelected && "opacity-0")}
					data-testid={`add-provider-checkbox-${provider.id}`}
				/>
			</div>

			{isSelected && provider.fields.length > 0 && (
				<div
					className="flex flex-col gap-2.5 p-2"
					onClick={(e) => e.stopPropagation()}
					onPointerDown={(e) => e.stopPropagation()}
				>
					{provider.fields.map((field) => {
						const fieldErrorMessage = getFieldErrorMessage(field)
						const hasError = !!fieldErrorMessage
						const fieldLabel = field.labelKey
							? t(`messageEditor.addModel.${field.labelKey}`)
							: field.label
						const isTextarea = field.inputType === "textarea"
						return (
							<div key={field.key} className="flex items-start gap-2">
								<div className="flex h-9 flex-1 items-center gap-1 whitespace-nowrap text-base font-medium leading-6 text-foreground">
									{fieldLabel}
									{field.required && <span className="text-destructive">*</span>}
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
												store.setProviderField(field.key, e.target.value)
											}
											onBlur={() => handleBlur(field.key)}
											data-testid={`add-provider-field-${field.key}`}
										/>
									) : (
										<Input
											className={cn(
												"h-9 text-sm",
												hasError &&
													"border-destructive focus-visible:ring-destructive/20",
											)}
											type={
												field.inputType === "password" ? "password" : "text"
											}
											placeholder={field.placeholder}
											value={store.providerFields[field.key] ?? ""}
											onChange={(e) =>
												store.setProviderField(field.key, e.target.value)
											}
											onBlur={() => handleBlur(field.key)}
											data-testid={`add-provider-field-${field.key}`}
										/>
									)}
									{field.description && (
										<p className="text-xs text-muted-foreground">
											{field.description}
										</p>
									)}
									{hasError && (
										<p className="text-xs text-destructive" role="alert">
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
	)
})

function AddProviderDialog() {
	const { t } = useTranslation("super")
	const store = useAddModelStore()
	const [submitted, setSubmitted] = useState(false)

	useEffect(() => {
		if (store.isAddProviderOpen) {
			store.loadOrgAiModelProviderTemplates(store.category)
		}
	}, [store.isAddProviderOpen, store.category, store])

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			store.closeAddProvider()
			setSubmitted(false)
		}
	}

	const handleConfirm = async () => {
		setSubmitted(true)
		if (!store.isAddProviderFormValid) return
		await store.submitAddOrgAiModelProvider()
		setSubmitted(false)
	}

	return (
		<Dialog open={store.isAddProviderOpen} onOpenChange={handleOpenChange}>
			<DialogContent
				className="max-h-[80vh] max-w-[700px] gap-0 overflow-hidden p-0"
				data-testid="add-provider-dialog"
			>
				<DialogHeader className="border-b border-border p-3">
					<DialogTitle className="text-base font-semibold leading-6">
						{t("messageEditor.addModel.addProvider")}
					</DialogTitle>
					<DialogClose />
				</DialogHeader>

				<div className="scrollbar-y-thin flex max-h-[60vh] flex-col gap-2.5 overflow-y-auto p-4">
					{store.isLoadingTemplates ? (
						<div
							className="flex items-center justify-center py-8"
							data-testid="add-provider-loading"
						>
							<Spinner size={24} className="animate-spin" />
						</div>
					) : (
						store.providerTemplates.map((provider) => (
							<ProviderItem
								key={provider.id}
								provider={provider}
								isSelected={store.selectedProviderTypeId === provider.id}
								onSelect={() => store.setSelectedProviderTypeId(provider.id)}
								submitted={
									submitted && store.selectedProviderTypeId === provider.id
								}
							/>
						))
					)}
				</div>

				<DialogFooter className="border-t border-border p-3">
					<Button
						variant="outline"
						onClick={() => store.closeAddProvider()}
						disabled={store.isSubmitting}
						data-testid="add-provider-cancel-button"
					>
						{t("messageEditor.addModel.cancel")}
					</Button>
					<Button
						onClick={handleConfirm}
						disabled={store.isSubmitting}
						data-testid="add-provider-confirm-button"
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

export default observer(AddProviderDialog)
