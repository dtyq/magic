import { Loader2 } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"
import { Controller, useWatch, type Control, type UseFormReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"
import { toast } from "sonner"
import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field"
import { FieldError } from "@magic-admin-v2/components/form/field-error"
import { GenericPricingEntry } from "@magic-admin-v2/features/platform-model-list/components/generic-pricing-entry"
import { TokenPricingEntry } from "@magic-admin-v2/features/platform-model-list/components/token-pricing-entry"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs"
import { useProviderModelPricingTemplatesQuery } from "@magic-admin-v2/features/platform-model-list/queries"
import {
	type ProviderModelCategory,
	type ProviderModelPricingEntry,
	type ProviderModelPricingTemplate,
} from "@magic-admin-v2/features/platform-model-list/types"
import {
	buildPricingBillingTiers,
	createEmptyPricingEntry,
	createPricingEntries,
	createPricingEntriesFromBillingTiers,
	createPricingEntriesFromLegacyPricing,
	hasLegacyPricing,
	isCostPricingObject,
	isTextTokenPricingTemplate,
	normalizeDependentPricingEntries,
} from "@magic-admin-v2/features/platform-model-list/utils/pricing"
import {
	getDefaultBillingType,
	getErrorMessage,
} from "@magic-admin-v2/features/platform-model-list/utils/model-editor"
import type {
	ModelEditorValues,
	ProviderBindingErrors,
} from "@magic-admin-v2/features/platform-model-list/utils/model-editor-schema"
import type { ProviderListItem } from "@magic-admin-v2/features/platform-provider-list/types"

export function ModelPricingFields({
	category,
	control,
	disabled,
	focusBillingObject,
	form,
	index,
	providers,
}: {
	category: ProviderModelCategory
	control: Control<ModelEditorValues>
	disabled: boolean
	focusBillingObject?: string
	form: UseFormReturn<ModelEditorValues>
	index: number
	providers: ProviderListItem[]
}) {
	const { t } = useTranslation()
	const providerId = useWatch({ control, name: `providers.${index}.service_provider_config_id` })
	const billingType = useWatch({ control, name: `providers.${index}.billing_type` })
	const billingCurrency = useWatch({ control, name: `providers.${index}.billing_currency` })
	const pricingEntries = useWatch({ control, name: `providers.${index}.pricing_entries` })
	const selectedProvider = providers.find((provider) => provider.id === providerId)
	const pricingTemplatesQuery = useProviderModelPricingTemplatesQuery({
		category,
		providerCode: selectedProvider?.provider_code,
	})
	const templates = useMemo(() => pricingTemplatesQuery.data ?? [], [pricingTemplatesQuery.data])
	const selectedTemplate = useMemo(
		() =>
			templates.find(
				(template) =>
					template.billing_type === billingType || template.code === billingType,
			),
		[billingType, templates],
	)
	const hasSelectedTemplate = Boolean(selectedTemplate)
	const resolvedTemplate = selectedTemplate ?? templates[0]
	const previousProviderIdRef = useRef(providerId)
	const billingTypeField = `providers.${index}.billing_type` as const
	const pricingTemplateField = `providers.${index}.pricing_template` as const
	const pricingEntriesField = `providers.${index}.pricing_entries` as const
	const billingTiersField = `providers.${index}.billing_tiers` as const
	const hydratingPricingRef = useRef(false)

	useEffect(() => {
		if (previousProviderIdRef.current === providerId) {
			return
		}

		previousProviderIdRef.current = providerId
		form.setValue(billingTypeField, getDefaultBillingType(category), { shouldDirty: true })
		form.setValue(pricingTemplateField, null, { shouldDirty: true })
		form.setValue(pricingEntriesField, {}, { shouldDirty: true })
		form.setValue(billingTiersField, [], { shouldDirty: true })
		form.setValue(`providers.${index}.legacy_pricing`, {}, { shouldDirty: true })
		hydratingPricingRef.current = false
	}, [
		billingTiersField,
		billingTypeField,
		category,
		form,
		index,
		pricingEntriesField,
		pricingTemplateField,
		providerId,
	])

	useEffect(() => {
		if (!resolvedTemplate) {
			return
		}

		const providerPrefix = `providers.${index}` as const
		const currentPricingTemplate = form.getValues(`${providerPrefix}.pricing_template`)
		const currentPricingEntries = form.getValues(`${providerPrefix}.pricing_entries`)
		if (
			currentPricingTemplate?.code === resolvedTemplate.code &&
			Object.keys(currentPricingEntries ?? {}).length
		) {
			return
		}

		if (!hasSelectedTemplate) {
			form.setValue(`${providerPrefix}.billing_type`, resolvedTemplate.billing_type, {
				shouldDirty: false,
			})
		}

		const currentBillingTiers = form.getValues(`${providerPrefix}.billing_tiers`)
		const currentLegacyPricing = form.getValues(`${providerPrefix}.legacy_pricing`)
		const currentBillingType = hasSelectedTemplate
			? form.getValues(`${providerPrefix}.billing_type`)
			: resolvedTemplate.billing_type
		const hasSavedBillingTiers =
			Boolean(currentBillingTiers?.length) && !Object.keys(currentPricingEntries ?? {}).length
		const hasSavedLegacyPricing =
			!hasSavedBillingTiers && hasLegacyPricing(currentLegacyPricing)
		const nextPricingEntries = hasSavedBillingTiers
			? createPricingEntriesFromBillingTiers(resolvedTemplate, currentBillingTiers)
			: hasSavedLegacyPricing
				? createPricingEntriesFromLegacyPricing(
						resolvedTemplate,
						currentLegacyPricing,
						currentBillingType,
						category,
					)
				: createPricingEntries(resolvedTemplate)

		form.setValue(`${providerPrefix}.pricing_template`, resolvedTemplate, {
			shouldDirty: false,
		})
		hydratingPricingRef.current = true
		form.setValue(`${providerPrefix}.pricing_entries`, nextPricingEntries, {
			shouldDirty: false,
		})
		if (!hasSavedBillingTiers) {
			form.setValue(
				`${providerPrefix}.billing_tiers`,
				hasSavedLegacyPricing
					? buildPricingBillingTiers(resolvedTemplate, nextPricingEntries)
					: [],
				{ shouldDirty: false },
			)
		}
	}, [category, form, index, providerId, resolvedTemplate, hasSelectedTemplate])

	useEffect(() => {
		if (!selectedTemplate || !Object.keys(pricingEntries ?? {}).length) {
			return
		}

		form.setValue(
			billingTiersField,
			buildPricingBillingTiers(selectedTemplate, pricingEntries ?? {}),
			{ shouldDirty: !hydratingPricingRef.current },
		)
		hydratingPricingRef.current = false
	}, [billingTiersField, form, pricingEntries, selectedTemplate])

	function handleTemplateChange(nextBillingType: string) {
		const nextTemplate = templates.find((template) => template.billing_type === nextBillingType)
		form.setValue(billingTypeField, nextBillingType, {
			shouldDirty: true,
			shouldValidate: true,
		})
		form.setValue(pricingTemplateField, nextTemplate ?? null, { shouldDirty: true })
		form.setValue(pricingEntriesField, createPricingEntries(nextTemplate), {
			shouldDirty: true,
		})
		form.setValue(billingTiersField, [], { shouldDirty: true })
	}

	function updatePricingEntry(billingObject: string, patch: Partial<ProviderModelPricingEntry>) {
		const nextEntries = {
			...(pricingEntries ?? {}),
			[billingObject]: {
				...(pricingEntries?.[billingObject] ?? createEmptyPricingEntry()),
				...patch,
			},
		}
		const normalizedEntries = selectedTemplate
			? normalizeDependentPricingEntries(selectedTemplate, nextEntries)
			: nextEntries
		const dependencyChanged = Object.entries(normalizedEntries).some(([entryKey, entry]) => {
			const previous = nextEntries[entryKey]
			return previous?.mode !== entry.mode
		})

		form.setValue(pricingEntriesField, normalizedEntries, { shouldDirty: true })
		if (dependencyChanged) {
			toast.warning(t("modelList.editor.pricingFollowReset"))
		}
	}

	return (
		<>
			<div className="grid gap-4 sm:grid-cols-2">
				<DialogFormField
					description={t("modelList.editor.fieldDesc.currency")}
					descriptionMode="text"
					fieldId={`provider-${index}-billing-currency`}
					label={t("modelList.editor.field.currency")}
				>
					<Controller
						control={control}
						name={`providers.${index}.billing_currency`}
						render={({ field }) => (
							<Select
								disabled={disabled}
								onValueChange={field.onChange}
								value={field.value}
							>
								<SelectTrigger
									className="w-full"
									id={`provider-${index}-billing-currency`}
									data-testid="platform-model-list-select-trigger"
								>
									<SelectValue />
								</SelectTrigger>
								<SelectContent data-testid="platform-model-list-select-content">
									<SelectItem
										value="CNY"
										data-testid="platform-model-list-option"
									>
										{t("modelList.editor.currency.cny")}
									</SelectItem>
									<SelectItem
										value="USD"
										data-testid="platform-model-list-option"
									>
										{t("modelList.editor.currency.usd")}
									</SelectItem>
								</SelectContent>
							</Select>
						)}
					/>
				</DialogFormField>

				<DialogFormField
					description={t("modelList.editor.fieldDesc.pricingTemplate")}
					descriptionMode="text"
					fieldId={`provider-${index}-pricing-template`}
					label={t("modelList.editor.field.pricingTemplate")}
				>
					<Select
						disabled={
							disabled ||
							!selectedProvider ||
							pricingTemplatesQuery.isLoading ||
							!templates.length
						}
						onValueChange={handleTemplateChange}
						value={selectedTemplate?.billing_type ?? ""}
					>
						<SelectTrigger
							className="w-full"
							id={`provider-${index}-pricing-template`}
							data-testid="platform-model-list-select-trigger"
						>
							<SelectValue
								placeholder={t("modelList.editor.placeholder.pricingTemplate")}
							/>
						</SelectTrigger>
						<SelectContent data-testid="platform-model-list-select-content">
							{templates.map((template) => (
								<SelectItem
									key={template.code}
									value={template.billing_type}
									data-testid="platform-model-list-option"
								>
									{template.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</DialogFormField>
			</div>

			{!selectedProvider ? (
				<p className="text-xs text-muted-foreground">
					{t("modelList.editor.pricingProviderRequired")}
				</p>
			) : null}
			{pricingTemplatesQuery.isLoading ? (
				<p className="flex items-center gap-2 text-xs text-muted-foreground">
					<Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
					{t("modelList.editor.pricingTemplateLoading")}
				</p>
			) : null}
			{selectedProvider && pricingTemplatesQuery.isError ? (
				<p className="text-xs text-destructive">
					{t("modelList.editor.pricingTemplateLoadFailed")}
				</p>
			) : null}
			{selectedProvider &&
			!pricingTemplatesQuery.isLoading &&
			!pricingTemplatesQuery.isError &&
			!templates.length ? (
				<p className="text-xs text-muted-foreground">
					{t("modelList.editor.pricingTemplateEmpty")}
				</p>
			) : null}

			{selectedTemplate ? (
				<div className="grid gap-4">
					<p className="text-xs text-muted-foreground">
						{t("modelList.editor.pricingHint")}
					</p>
					{isTextTokenPricingTemplate(selectedTemplate) ? (
						<PricingDimensionTabs
							currency={billingCurrency}
							disabled={disabled}
							entries={pricingEntries ?? {}}
							focusBillingObject={focusBillingObject}
							onChangeEntry={updatePricingEntry}
							providerIndex={index}
							template={selectedTemplate}
						/>
					) : (
						<GenericPricingSections
							billingType={billingType}
							category={category}
							currency={billingCurrency}
							disabled={disabled}
							entries={pricingEntries ?? {}}
							focusBillingObject={focusBillingObject}
							template={selectedTemplate}
							onChangeEntry={updatePricingEntry}
							providerIndex={index}
						/>
					)}
					<FieldError
						className="text-sm"
						message={getErrorMessage(
							(
								form.formState.errors.providers?.[index] as
									ProviderBindingErrors | undefined
							)?.pricing_entries?.message,
						)}
					/>
				</div>
			) : null}
		</>
	)
}

type PricingDimension = "price" | "cost"

function PricingDimensionSection({
	currency,
	disabled,
	dimension,
	entries,
	onChangeEntry,
	providerIndex,
	template,
}: {
	currency: "CNY" | "USD"
	disabled: boolean
	dimension: PricingDimension
	entries: Record<string, ProviderModelPricingEntry>
	onChangeEntry: (billingObject: string, patch: Partial<ProviderModelPricingEntry>) => void
	providerIndex: number
	template: ProviderModelPricingTemplate
}) {
	const { t } = useTranslation()
	const items = template.items.filter((item) =>
		dimension === "cost"
			? isCostPricingObject(item.billing_object)
			: !isCostPricingObject(item.billing_object),
	)

	return (
		<section
			className="grid gap-4"
			aria-label={
				dimension === "price"
					? t("modelList.editor.pricing.priceTitle")
					: t("modelList.editor.pricing.costTitle")
			}
		>
			{items.map((item) => (
				<TokenPricingEntry
					currency={currency}
					disabled={disabled}
					entry={entries[item.billing_object] ?? createEmptyPricingEntry()}
					entries={entries}
					fieldId={`providers.${providerIndex}.pricing_entries.${item.billing_object}`}
					item={item}
					key={item.billing_object}
					onChange={(patch) => onChangeEntry(item.billing_object, patch)}
					template={template}
				/>
			))}
		</section>
	)
}

function PricingDimensionTabs({
	currency,
	disabled,
	entries,
	focusBillingObject,
	onChangeEntry,
	providerIndex,
	template,
}: {
	currency: "CNY" | "USD"
	disabled: boolean
	entries: Record<string, ProviderModelPricingEntry>
	focusBillingObject?: string
	onChangeEntry: (billingObject: string, patch: Partial<ProviderModelPricingEntry>) => void
	providerIndex: number
	template: ProviderModelPricingTemplate
}) {
	const { t } = useTranslation()
	const [activeDimension, setActiveDimension] = useState<PricingDimension>(() =>
		focusBillingObject && isCostPricingObject(focusBillingObject) ? "cost" : "price",
	)

	useEffect(() => {
		if (focusBillingObject) {
			setActiveDimension(isCostPricingObject(focusBillingObject) ? "cost" : "price")
		}
	}, [focusBillingObject])

	return (
		<Tabs
			className="grid gap-4"
			onValueChange={(value) => setActiveDimension(value as PricingDimension)}
			value={activeDimension}
		>
			<TabsList className="h-9 w-fit gap-5">
				<TabsTrigger
					className="h-9 text-sm"
					value="price"
					data-testid="platform-model-list-tab-trigger"
				>
					{t("modelList.editor.pricing.priceTitle")}
				</TabsTrigger>
				<TabsTrigger
					className="h-9 text-sm"
					value="cost"
					data-testid="platform-model-list-tab-trigger"
				>
					{t("modelList.editor.pricing.costTitle")}
				</TabsTrigger>
			</TabsList>
			<TabsContent className="m-0 data-[state=inactive]:hidden" value="price">
				<PricingDimensionSection
					currency={currency}
					dimension="price"
					disabled={disabled}
					entries={entries}
					onChangeEntry={onChangeEntry}
					providerIndex={providerIndex}
					template={template}
				/>
			</TabsContent>
			<TabsContent className="m-0 data-[state=inactive]:hidden" value="cost">
				<PricingDimensionSection
					currency={currency}
					dimension="cost"
					disabled={disabled}
					entries={entries}
					onChangeEntry={onChangeEntry}
					providerIndex={providerIndex}
					template={template}
				/>
			</TabsContent>
		</Tabs>
	)
}

function GenericPricingSections({
	billingType,
	category,
	currency,
	disabled,
	entries,
	focusBillingObject,
	onChangeEntry,
	providerIndex,
	template,
}: {
	billingType: string
	category: ProviderModelCategory
	currency: "CNY" | "USD"
	disabled: boolean
	entries: Record<string, ProviderModelPricingEntry>
	focusBillingObject?: string
	onChangeEntry: (billingObject: string, patch: Partial<ProviderModelPricingEntry>) => void
	providerIndex: number
	template: ProviderModelPricingTemplate
}) {
	const { t } = useTranslation()
	const [activeDimension, setActiveDimension] = useState<PricingDimension>(() =>
		focusBillingObject && isCostPricingObject(focusBillingObject) ? "cost" : "price",
	)

	useEffect(() => {
		if (focusBillingObject) {
			setActiveDimension(isCostPricingObject(focusBillingObject) ? "cost" : "price")
		}
	}, [focusBillingObject])

	return (
		<Tabs
			className="grid gap-4"
			onValueChange={(value) => setActiveDimension(value as PricingDimension)}
			value={activeDimension}
		>
			<TabsList className="h-9 w-fit gap-5">
				<TabsTrigger
					className="h-9 text-sm"
					value="price"
					data-testid="platform-model-list-tab-trigger"
				>
					{t("modelList.editor.pricing.priceTitle")}
				</TabsTrigger>
				<TabsTrigger
					className="h-9 text-sm"
					value="cost"
					data-testid="platform-model-list-tab-trigger"
				>
					{t("modelList.editor.pricing.costTitle")}
				</TabsTrigger>
			</TabsList>
			{(["price", "cost"] as const).map((dimension) => (
				<TabsContent
					className="m-0 data-[state=inactive]:hidden"
					key={dimension}
					value={dimension}
				>
					<section
						aria-label={
							dimension === "price"
								? t("modelList.editor.pricing.priceTitle")
								: t("modelList.editor.pricing.costTitle")
						}
						className="grid gap-4"
					>
						{template.items
							.filter((item) =>
								dimension === "cost"
									? isCostPricingObject(item.billing_object)
									: !isCostPricingObject(item.billing_object),
							)
							.map((item) => (
								<GenericPricingEntry
									billingObject={item.billing_object}
									billingType={billingType}
									category={category}
									currency={currency}
									disabled={disabled}
									entry={
										entries[item.billing_object] ?? createEmptyPricingEntry()
									}
									fieldId={`providers.${providerIndex}.pricing_entries.${item.billing_object}`}
									item={item}
									key={item.billing_object}
									onChange={(patch) => onChangeEntry(item.billing_object, patch)}
								/>
							))}
					</section>
				</TabsContent>
			))}
		</Tabs>
	)
}
