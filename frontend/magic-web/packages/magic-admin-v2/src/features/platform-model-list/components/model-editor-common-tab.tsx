import type { UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field"
import { FieldError } from "@magic-admin-v2/components/form/field-error"
import { EntityAvatarRender } from "@magic-admin-v2/components/entity-avatar-render"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { DefaultModelIcon } from "@magic-admin-v2/features/platform-model-list/components/default-model-icon"
import { ModelContentLanguageFields } from "@magic-admin-v2/features/platform-model-list/components/model-content-language-fields"
import { ModelIconUploadField } from "@magic-admin-v2/features/platform-model-list/components/model-icon-upload-field"
import { ModelImportConfig } from "@magic-admin-v2/features/platform-model-list/components/model-import-config"
import { ModelIdentifierPicker } from "@magic-admin-v2/features/platform-model-list/components/model-identifier-picker"
import {
	type ProviderModelCategory,
	type ProviderModelType,
} from "@magic-admin-v2/features/platform-model-list/types"
import {
	getCategoryLabel,
	getErrorMessage,
} from "@magic-admin-v2/features/platform-model-list/utils/model-editor"
import type { ModelEditorValues } from "@magic-admin-v2/features/platform-model-list/utils/model-editor-schema"
import type { Language } from "@magic-admin-v2/i18n/resources"
import type { ProviderModelRecord } from "@magic-admin-v2/features/platform-model-list/types"

export function ModelEditorCommonTab({
	category,
	contentLocale,
	disabled,
	form,
	modelType,
	modelTypeOptions,
	onCategoryChange,
	onApplyImportedConfig,
	onIconUploadingChange,
	onLocaleChange,
	showImportConfig,
	selectableCategories,
}: {
	category: ProviderModelCategory
	contentLocale: Language
	disabled: boolean
	form: UseFormReturn<ModelEditorValues>
	modelType: ProviderModelType
	modelTypeOptions: Array<{ label: string; value: ProviderModelType }>
	onCategoryChange: (category: ProviderModelCategory) => void
	onApplyImportedConfig: (record: ProviderModelRecord) => void
	onIconUploadingChange?: (uploading: boolean) => void
	onLocaleChange: (locale: Language) => void
	showImportConfig: boolean
	selectableCategories: ProviderModelCategory[]
}) {
	const { t } = useTranslation()
	const name = form.watch("name")
	const icon = form.watch("icon")
	const displayName = name.trim() || t("modelList.editor.modelPreview")

	return (
		<section aria-labelledby="model-common-fields-title">
			<div className="flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h3 className="text-base font-semibold" id="model-common-fields-title">
						{t("modelList.editor.commonTitle")}
					</h3>
					<p className="mt-1 text-sm text-muted-foreground">
						{t("modelList.editor.commonDescription")}
					</p>
				</div>
				<div className="flex min-w-0 items-center gap-3 rounded-md border bg-muted/20 px-3 py-2">
					<EntityAvatarRender
						className="size-9"
						fallbackIcon={<DefaultModelIcon />}
						name={displayName}
						src={icon.trim() || undefined}
					/>
					<span className="max-w-48 truncate text-sm font-medium">{displayName}</span>
				</div>
			</div>

			<div className="mt-5 grid gap-5">
				<ModelContentLanguageFields
					activeLocale={contentLocale}
					disabled={disabled}
					form={form}
					onLocaleChange={onLocaleChange}
				/>

				<DialogFormField
					description={t("modelList.editor.fieldDesc.modelId")}
					descriptionMode="text"
					fieldId="model_id"
					label={t("modelList.editor.field.modelId")}
					required
				>
					<ModelIdentifierPicker
						disabled={disabled}
						fieldId="model_id"
						onChange={(value) =>
							form.setValue("model_id", value, {
								shouldDirty: true,
								shouldValidate: true,
							})
						}
						value={form.watch("model_id")}
					/>
					<FieldError
						className="text-sm"
						message={getErrorMessage(form.formState.errors.model_id?.message)}
					/>
					{showImportConfig ? (
						<ModelImportConfig
							category={category}
							disabled={disabled}
							excludeRecordIds={new Set(
								(form.getValues("providers") ?? [])
									.map((binding) => binding.record_id)
									.filter((id): id is string => Boolean(id)),
							)}
							modelId={form.watch("model_id")}
							onApply={onApplyImportedConfig}
						/>
					) : null}
				</DialogFormField>
				<DialogFormField
					description={t("modelList.editor.fieldDesc.icon")}
					descriptionMode="text"
					fieldId="model-icon"
					label={t("modelList.editor.field.icon")}
				>
					<ModelIconUploadField
						disabled={disabled}
						id="model-icon"
						onUploaded={(value) =>
							form.setValue("icon", value, {
								shouldDirty: true,
								shouldValidate: true,
							})
						}
						onUploadingChange={onIconUploadingChange}
						value={icon}
					/>
				</DialogFormField>
				<DialogFormField
					description={t("modelList.editor.fieldDesc.category")}
					descriptionMode="text"
					fieldId="category"
					label={t("modelList.editor.field.category")}
					required
				>
					<Select
						value={category}
						onValueChange={(value) => onCategoryChange(value as ProviderModelCategory)}
					>
						<SelectTrigger
							className="w-full"
							data-model-editor-field="category"
							disabled={disabled || selectableCategories.length <= 1}
							id="category"
						 data-testid="platform-model-list-category-trigger">
							<SelectValue />
						</SelectTrigger>
						<SelectContent data-testid="platform-model-list-category-content">
							{selectableCategories.map((value) => (
								<SelectItem key={value} value={value} data-testid="platform-model-list-option">
									{getCategoryLabel(value, t)}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</DialogFormField>
				<DialogFormField
					description={t("modelList.editor.fieldDesc.modelType")}
					descriptionMode="text"
					fieldId="model_type"
					label={t("modelList.editor.field.modelType")}
					required
				>
					<Select
						key={category}
						value={String(modelType)}
						onValueChange={(value) =>
							form.setValue("model_type", Number(value) as ProviderModelType, {
								shouldDirty: true,
								shouldValidate: true,
							})
						}
					>
						<SelectTrigger
							className="w-full"
							data-model-editor-field="model_type"
							disabled={disabled}
							id="model_type"
						 data-testid="platform-model-list-model-type-trigger">
							<SelectValue />
						</SelectTrigger>
						<SelectContent data-testid="platform-model-list-model-type-content">
							{modelTypeOptions.map((option) => (
								<SelectItem key={option.value} value={String(option.value)} data-testid="platform-model-list-option">
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</DialogFormField>
			</div>
		</section>
	)
}
