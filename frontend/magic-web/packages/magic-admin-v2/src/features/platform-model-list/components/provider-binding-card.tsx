import {
	AlertCircle,
	CheckCircle2,
	ChevronDown,
	CircleDollarSign,
	ServerCog,
	SlidersHorizontal,
	Trash2,
} from "lucide-react"
import { useEffect, useState } from "react"
import { Controller, useWatch, type Control, type UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field"
import { FieldError } from "@magic-admin-v2/components/form/field-error"
import { EntityAvatarRender } from "@magic-admin-v2/components/entity-avatar-render"
import { Badge } from "@magic-admin-v2/components/ui/badge"
import { Button } from "@magic-admin-v2/components/ui/button"
import { Input } from "@magic-admin-v2/components/ui/input"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import { Textarea } from "@magic-admin-v2/components/ui/textarea"
import { ModelConnectivityTest } from "@magic-admin-v2/features/platform-model-list/components/model-connectivity-test"
import { ModelPricingFields } from "@magic-admin-v2/features/platform-model-list/components/model-pricing-fields"
import {
	providerModelCategory,
	type ProviderModelCategory,
	type ProviderModelSaveResult,
	type ProviderModelType,
} from "@magic-admin-v2/features/platform-model-list/types"
import {
	getDefaultBillingType,
	getErrorMessage,
	getProviderCategory,
} from "@magic-admin-v2/features/platform-model-list/utils/model-editor"
import type {
	ModelEditorValues,
	ProviderBindingErrors,
	ProviderBindingValues,
} from "@magic-admin-v2/features/platform-model-list/utils/model-editor-schema"
import type { ModelEditorFocusRequest } from "@magic-admin-v2/features/platform-model-list/utils/model-editor-types"
import { useProviderModelDataSource } from "@magic-admin-v2/features/platform-model-list/utils/data-source"
import { useProviderListQuery } from "@magic-admin-v2/features/platform-provider-list/queries"
import {
	providerStatus,
	providerType,
	type ProviderListItem,
} from "@magic-admin-v2/features/platform-provider-list/types"
import {
	defaultProviderIcon,
	getProviderLogoSrc,
} from "@magic-admin-v2/features/platform-provider-list/utils/provider-icons"
import { isEmbeddingModelType } from "@magic-admin-v2/features/platform-model-list/utils/model-runtime-config"
import { cn } from "@magic-admin-v2/utils/cn"

export function ProviderBindingCard({
	canRemove,
	category,
	officialSyncedRecordIds,
	control,
	disabled,
	error,
	focusRequest,
	form,
	index,
	modelType,
	onRemove,
	result,
}: {
	canRemove: boolean
	category: ProviderModelCategory
	officialSyncedRecordIds: ReadonlySet<string>
	control: Control<ModelEditorValues>
	disabled: boolean
	error: ProviderBindingErrors | undefined
	focusRequest: ModelEditorFocusRequest | null
	form: UseFormReturn<ModelEditorValues>
	index: number
	modelType: ProviderModelType
	onRemove: () => void
	result?: ProviderModelSaveResult
}) {
	const { t } = useTranslation()
	const dataSource = useProviderModelDataSource()
	const providerQuery = useProviderListQuery(getProviderCategory(category), {
		endpoint: dataSource.endpoints.providerList,
		key: dataSource.key,
	})
	const fieldName = <T extends keyof ProviderBindingValues>(name: T) =>
		`providers.${index}.${name}` as const
	const providerId = useWatch({ control, name: fieldName("service_provider_config_id") })
	const recordId = useWatch({ control, name: fieldName("record_id") })
	const modelVersion = useWatch({ control, name: fieldName("model_version") })
	const selectedProvider = (providerQuery.data ?? []).find(
		(provider) => provider.id === providerId,
	)
	const isOfficialSynced = Boolean(recordId && officialSyncedRecordIds.has(recordId))
	const canTestConnectivity =
		selectedProvider && selectedProvider.provider_type !== providerType.official && !isOfficialSynced
	const fieldDisabled = disabled || isOfficialSynced
	const supportsExtraRequest =
		category === providerModelCategory.llm || isEmbeddingModelType(modelType)
	const [expanded, setExpanded] = useState(false)
	const [optionalOpen, setOptionalOpen] = useState(false)
	const [pricingOpen, setPricingOpen] = useState(false)

	useEffect(() => {
		if (error || result?.status === "failed") {
			setExpanded(true)
		}
	}, [error, result?.status])

	useEffect(() => {
		if (focusRequest?.providerIndex !== index) {
			return
		}

		setExpanded(true)
		if (focusRequest.providerSection === "optional") {
			setOptionalOpen(true)
		}
		if (focusRequest.providerSection === "pricing") {
			setPricingOpen(true)
		}
	}, [focusRequest, index])

	return (
		<div
			className={cn(
				"rounded-lg border bg-card",
				result?.status === "failed" && "border-destructive/60",
				result?.status === "success" && "border-emerald-500/40",
			)}
		>
			<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b px-4 py-3">
				<div className="flex min-w-0 items-center gap-2.5 overflow-hidden">
					<Controller
						control={control}
						name={fieldName("service_provider_config_id")}
						render={({ field }) => {
							return (
								<Select
									disabled={fieldDisabled || providerQuery.isLoading}
									onValueChange={(value) => {
										field.onChange(value)
										const nextProvider = providerQuery.data?.find(
											(provider) => provider.id === value,
										)
										form.setValue(
											fieldName("provider_code"),
											nextProvider?.provider_code ?? "",
											{
												shouldDirty: true,
											},
										)
										form.setValue(
											fieldName("billing_type"),
											getDefaultBillingType(category),
											{
												shouldDirty: true,
											},
										)
										form.setValue(fieldName("pricing_template"), null, {
											shouldDirty: true,
										})
										form.setValue(
											fieldName("pricing_entries"),
											{},
											{ shouldDirty: true },
										)
										form.setValue(fieldName("billing_tiers"), [], {
											shouldDirty: true,
										})
										form.setValue(
											fieldName("legacy_pricing"),
											{},
											{ shouldDirty: true },
										)
										form.clearErrors(fieldName("service_provider_config_id"))
									}}
									value={field.value}
								>
									<SelectTrigger
										aria-label={t("modelList.editor.field.provider")}
										className="h-12 min-w-0 w-full flex-1 [&>span]:min-w-0 [&>span]:line-clamp-none sm:max-w-sm"
										data-model-editor-field={fieldName(
											"service_provider_config_id",
										)}
									 data-testid="platform-model-list-select-trigger">
										<SelectValue
											placeholder={t("modelList.editor.placeholder.provider")}
										>
											<ProviderSelectValue
												provider={selectedProvider}
												providerId={field.value}
											/>
										</SelectValue>
									</SelectTrigger>
									<SelectContent className="min-w-72" data-testid="platform-model-list-select-content">
										{(providerQuery.data ?? []).map((provider) => (
											<SelectItem
												key={provider.id}
												textValue={getProviderOptionLabel(provider)}
												value={provider.id}
											 data-testid="platform-model-list-option">
												<ProviderOption provider={provider} />
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							)
						}}
					/>
					{result?.status === "success" ? (
						<Badge variant="success">
							<CheckCircle2 className="size-3.5" aria-hidden="true" />
							{t("modelList.editor.saveState.success")}
						</Badge>
					) : null}
					{result?.status === "failed" ? (
						<Badge variant="warning">
							<AlertCircle className="size-3.5" aria-hidden="true" />
							{t("modelList.editor.saveState.failed")}
						</Badge>
					) : null}
				</div>
				<div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
					{canTestConnectivity ? (
						<ModelConnectivityTest
							className="flex-nowrap gap-1.5"
							compact
							disabled={fieldDisabled || !modelVersion.trim()}
							key={`${providerId}:${modelVersion}:${category}:${modelType}`}
							request={{
								kind: "config",
								payload: {
									service_provider_config_id: providerId,
									model_version: modelVersion.trim(),
									category:
										category === providerModelCategory.embedding
											? providerModelCategory.llm
											: category,
									model_type: modelType,
								},
							}}
						/>
					) : null}
					<div className="flex shrink-0 items-center gap-1.5">
						<Controller
							control={control}
							name={fieldName("enabled")}
							render={({ field }) => (
								<>
									<span className="text-sm font-medium">
										{field.value
											? t("modelList.editor.bindingStatus.enabled")
											: t("modelList.editor.bindingStatus.disabled")}
									</span>
									<Switch
										checked={field.value}
										disabled={fieldDisabled}
										onCheckedChange={field.onChange}
									 data-testid="platform-model-list-switch"/>
								</>
							)}
						/>
						<Button
							aria-label={t("modelList.editor.action.removeProvider")}
							disabled={!canRemove || fieldDisabled}
							onClick={onRemove}
							size="icon"
							type="button"
							variant="ghost"
						 data-testid="platform-model-list-delete-button">
							<Trash2 className="size-4" aria-hidden="true" />
						</Button>
						<Button
							aria-label={
								expanded
									? t("modelList.editor.action.collapseProvider")
									: t("modelList.editor.action.expandProvider")
							}
							onClick={() => setExpanded((current) => !current)}
							size="icon"
							type="button"
							variant="ghost"
						 data-testid="platform-model-list-edit-button">
							<ChevronDown
								className={cn(
									"size-4 transition-transform",
									expanded && "rotate-180",
								)}
								aria-hidden="true"
							/>
						</Button>
					</div>
				</div>
			</div>

			{expanded ? (
				<>
					{error?.service_provider_config_id?.message ? (
						<div className="px-4 pt-3">
							<FieldError
								className="text-sm"
								message={getErrorMessage(error.service_provider_config_id.message)}
							/>
						</div>
					) : null}

					<div className="grid gap-5 p-4">
						{result?.status === "failed" && result.errorMessage ? (
							<div className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
								<AlertCircle
									className="mt-0.5 size-4 shrink-0"
									aria-hidden="true"
								/>
								<span>{result.errorMessage}</span>
							</div>
						) : null}

						<div className="grid gap-4">
							<DialogFormField
								description={t("modelList.editor.fieldDesc.modelVersion")}
								descriptionMode="text"
								fieldId={fieldName("model_version")}
								label={t("modelList.editor.field.modelVersion")}
								required
							>
								<Controller
									control={control}
									name={fieldName("model_version")}
									render={({ field }) => (
										<Input
											disabled={fieldDisabled}
											id={fieldName("model_version")}
											onChange={field.onChange}
											placeholder={t(
												"modelList.editor.placeholder.modelVersion",
											)}
											value={field.value}
										 data-testid="platform-model-list-input"/>
									)}
								/>
								<FieldError
									className="text-sm"
									message={getErrorMessage(error?.model_version?.message)}
								/>
							</DialogFormField>
						</div>

						<details
							className="group rounded-md border"
							onToggle={(event) => setOptionalOpen(event.currentTarget.open)}
							open={optionalOpen}
						>
							<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium marker:hidden">
								<span className="flex items-center gap-2">
									<SlidersHorizontal
										className="size-4 text-muted-foreground"
										aria-hidden="true"
									/>
									{t("modelList.editor.section.optional")}
								</span>
								<ChevronDown
									className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
									aria-hidden="true"
								/>
							</summary>
							<div className="grid gap-4 border-t p-3">
								{dataSource.supportsLoadBalancing !== false ? (
									<BindingNumberField
										control={control}
										disabled={disabled}
										description={t("modelList.editor.fieldDesc.loadWeight")}
										error={getErrorMessage(
											error?.load_balancing_weight?.message,
										)}
										label={t("modelList.editor.field.loadWeight")}
										name={fieldName("load_balancing_weight")}
										placeholder={t("modelList.editor.placeholder.loadWeight")}
									/>
								) : null}
								{supportsExtraRequest && !isOfficialSynced ? (
									<>
								<DialogFormField
									description={t("modelList.editor.fieldDesc.extraHeader")}
									descriptionMode="text"
									fieldId={`provider-${index}-extra-header`}
									label={t("modelList.editor.field.extraHeader")}
								>
									<Controller
										control={control}
										name={fieldName("extra_header")}
										render={({ field }) => (
											<Textarea
												disabled={disabled}
												id={`provider-${index}-extra-header`}
												onChange={field.onChange}
												placeholder={t(
													"modelList.editor.placeholder.extraHeader",
												)}
												rows={3}
												value={field.value}
											 data-testid="platform-model-list-textarea-input"/>
										)}
									/>
								</DialogFormField>
								<DialogFormField
									description={t("modelList.editor.fieldDesc.extraBody")}
									descriptionMode="text"
									fieldId={`provider-${index}-extra-body`}
									label={t("modelList.editor.field.extraBody")}
								>
									<Controller
										control={control}
										name={fieldName("extra_body")}
										render={({ field }) => (
											<Textarea
												disabled={disabled}
												id={`provider-${index}-extra-body`}
												onChange={field.onChange}
												placeholder={t(
													"modelList.editor.placeholder.extraBody",
												)}
												rows={3}
												value={field.value}
											 data-testid="platform-model-list-textarea-input"/>
										)}
									/>
								</DialogFormField>
									</>
								) : null}
							</div>
						</details>

						{dataSource.endpoints.modelPricingTemplates && !isOfficialSynced ? (
							<details
								className="group rounded-md border"
								data-model-editor-field={
									focusRequest?.providerIndex === index &&
									focusRequest.providerSection === "pricing"
										? `providers.${index}.pricing_entries`
										: undefined
								}
								onToggle={(event) => setPricingOpen(event.currentTarget.open)}
								open={pricingOpen}
								tabIndex={-1}
							>
								<summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5 text-sm font-medium marker:hidden">
									<span className="flex items-center gap-2">
										<CircleDollarSign
											className="size-4 text-muted-foreground"
											aria-hidden="true"
										/>
										{t("modelList.editor.section.advanced")}
									</span>
									<ChevronDown
										className="size-4 text-muted-foreground transition-transform group-open:rotate-180"
										aria-hidden="true"
									/>
								</summary>
								<div className="grid gap-4 border-t p-3">
									<ModelPricingFields
										category={category}
										control={control}
										disabled={disabled}
										form={form}
										focusBillingObject={
											focusRequest?.providerIndex === index &&
											focusRequest.providerSection === "pricing"
												? focusRequest.pricingBillingObject
												: undefined
										}
										index={index}
										providers={providerQuery.data ?? []}
									/>
								</div>
							</details>
						) : null}
					</div>
				</>
			) : null}
		</div>
	)
}

function ProviderSelectValue({
	provider,
	providerId,
}: {
	provider: ProviderListItem | undefined
	providerId: string
}) {
	if (provider) {
		return <ProviderOption provider={provider} />
	}

	return <span className="truncate text-muted-foreground">ID：{providerId}</span>
}

/** 下拉与已选项共用服务商状态展示，不与模型绑定开关混淆或过滤已有绑定。 */
function ProviderOption({ provider }: { provider: ProviderListItem }) {
	const { t } = useTranslation()
	return (
		<span className="flex w-full min-w-0 items-center gap-2">
			<EntityAvatarRender
				className="size-6"
				fallbackIcon={<ServerCog className="size-3.5" aria-hidden="true" />}
				fallbackImageSrc={defaultProviderIcon}
				name={getProviderAlias(provider)}
				src={getProviderLogoSrc({
					code: provider.provider_code,
					icon: provider.icon,
					type: provider.provider_type,
				})}
			/>
			<span className="flex min-w-0 flex-1 flex-col items-start text-left leading-none">
				<span className="flex w-full min-w-0 items-center gap-2 leading-5">
					<span className="truncate">{getProviderAlias(provider)}</span>
					{provider.status === providerStatus.disabled ? (
						<Badge variant="warning" className="h-5 px-1.5">
							{t("modelList.editor.providerDisabled")}
						</Badge>
					) : null}
				</span>
				<span className="block max-w-full truncate text-xs leading-4 text-muted-foreground">
					{getProviderOptionSecondaryText(provider)}
				</span>
			</span>
		</span>
	)
}

function getProviderAlias(provider: ProviderListItem) {
	return provider.alias || provider.name
}

function getProviderOptionLabel(provider: ProviderListItem) {
	return `${getProviderAlias(provider)} ${getProviderOptionSecondaryText(provider)}`
}

function getProviderOptionSecondaryText(provider: ProviderListItem) {
	return `${provider.name}（ID：${provider.id}）`
}

function BindingNumberField({
	control,
	disabled,
	description,
	error,
	label,
	name,
	placeholder,
	step = "1",
}: {
	control: Control<ModelEditorValues>
	disabled: boolean
	description?: string
	error?: string
	label: string
	name: `providers.${number}.load_balancing_weight`
	placeholder: string
	step?: string
}) {
	return (
		<DialogFormField
			description={description}
			descriptionMode="text"
			fieldId={name}
			label={label}
		>
			<Controller
				control={control}
				name={name}
				render={({ field }) => (
					<Input
						disabled={disabled}
						id={name}
						min="0"
						onChange={field.onChange}
						placeholder={placeholder}
						step={step}
						type="number"
						value={field.value}
					 data-testid="platform-model-list-input"/>
				)}
			/>
			<FieldError className="text-sm" message={error} />
		</DialogFormField>
	)
}
