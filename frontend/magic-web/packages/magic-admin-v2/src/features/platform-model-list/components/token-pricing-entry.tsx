import { Plus, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"

import { DialogFormField } from "@magic-admin-v2/components/form/dialog-form-field"
import { Button } from "@magic-admin-v2/components/ui/button"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { Switch } from "@magic-admin-v2/components/ui/switch"
import type {
	ProviderModelPricingEntry,
	ProviderModelPricingMode,
	ProviderModelPricingTemplate,
} from "@magic-admin-v2/features/platform-model-list/types"
import {
	buildIndependentPricingSteps,
	getFollowSourceBillingObject,
	textTokenBillingObjects,
} from "@magic-admin-v2/features/platform-model-list/utils/pricing"
import { PricingAmountInput, TokenBoundaryInput } from "./pricing-inputs"

export function TokenPricingEntry({
	currency,
	disabled,
	entries,
	entry,
	fieldId,
	item,
	onChange,
	template,
}: {
	currency: "CNY" | "USD"
	disabled: boolean
	entries: Record<string, ProviderModelPricingEntry>
	entry: ProviderModelPricingEntry
	fieldId: string
	item: ProviderModelPricingTemplate["items"][number]
	onChange: (patch: Partial<ProviderModelPricingEntry>) => void
	template: ProviderModelPricingTemplate
}) {
	const { t } = useTranslation()
	const currentBase = textTokenBillingObjects.find(
		(base) =>
			getFollowSourceBillingObject(template, item.billing_object, base) ===
			item.billing_object,
	)
	const isFollowMode = entry.mode !== "fixed" && entry.mode !== "ladder"
	const directSource = isFollowMode
		? getFollowSourceBillingObject(template, item.billing_object, entry.mode)
		: undefined
	const sourceEntry = directSource ? entries[directSource] : undefined
	const sourceLabel = directSource
		? template.items.find((templateItem) => templateItem.billing_object === directSource)?.label
		: undefined

	function handleModeChange(nextMode: ProviderModelPricingMode) {
		if (nextMode === "fixed") {
			onChange({ mode: nextMode })
			return
		}

		if (nextMode === "ladder") {
			onChange({
				mode: nextMode,
				steps: buildIndependentPricingSteps(entry.steps, sourceEntry?.steps),
			})
			return
		}

		const nextSource = getFollowSourceBillingObject(template, item.billing_object, nextMode)
		const nextSourceSteps = nextSource ? (entries[nextSource]?.steps ?? []) : []
		onChange({
			mode: nextMode,
			steps: nextSourceSteps.map((_, stepIndex) => ({
				max: "",
				price: entry.steps[stepIndex]?.price ?? "",
			})),
		})
	}

	function updateStep(
		stepIndex: number,
		patch: Partial<ProviderModelPricingEntry["steps"][number]>,
	) {
		onChange({
			steps: entry.steps.map((step, currentIndex) =>
				currentIndex === stepIndex ? { ...step, ...patch } : step,
			),
		})
	}

	return (
		<div className="grid gap-3 rounded-md bg-muted/40 p-4">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-center gap-2">
					<span className="shrink-0 text-sm font-medium">{item.label}</span>
					<span className="shrink-0 text-xs text-muted-foreground">
						{t("modelList.editor.field.pricingMode")}
					</span>
					<Select
						disabled={disabled || !entry.enabled}
						onValueChange={(value) =>
							handleModeChange(value as ProviderModelPricingMode)
						}
						value={entry.mode}
					>
						<SelectTrigger
							aria-label={t("modelList.editor.field.pricingMode")}
							className="h-7 w-44 min-w-0 border-border bg-background px-2 text-xs shadow-none hover:bg-muted/50 focus:ring-1"
						 data-testid="platform-model-list-select-trigger">
							<SelectValue />
						</SelectTrigger>
						<SelectContent className="!w-max max-w-[calc(100vw-3rem)]" data-testid="platform-model-list-select-content">
							<SelectItem className="whitespace-nowrap text-xs" value="fixed" data-testid="platform-model-list-option">
								{t("modelList.editor.pricingMode.fixed")}
							</SelectItem>
							<SelectItem className="whitespace-nowrap text-xs" value="ladder" data-testid="platform-model-list-option">
								{t("modelList.editor.pricingMode.ladder")}
							</SelectItem>
							{textTokenBillingObjects
								.filter((base) => base !== currentBase)
								.map((sourceBase) => {
									const sourceBillingObject = getFollowSourceBillingObject(
										template,
										item.billing_object,
										sourceBase,
									)!
									const followSource = entries[sourceBillingObject]
									const label =
										template.items.find(
											(templateItem) =>
												templateItem.billing_object === sourceBillingObject,
										)?.label ?? sourceBase
									return (
										<SelectItem
											className="whitespace-nowrap text-xs"
											disabled={
												!followSource?.enabled ||
												followSource.mode !== "ladder"
											}
											key={sourceBase}
											value={sourceBase}
										 data-testid="platform-model-list-option">
											{t("modelList.editor.pricingMode.follow", { label })}
										</SelectItem>
									)
								})}
						</SelectContent>
					</Select>
				</div>
				<div className="flex items-center gap-2">
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

			{isFollowMode ? (
				<p className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
					{t("modelList.editor.pricingFollowHint", { label: sourceLabel ?? "" })}
				</p>
			) : null}

			{entry.mode === "fixed" ? (
				<DialogFormField
					fieldId={`${fieldId}-value`}
					label={t("modelList.editor.field.priceValue")}
				>
					<PricingAmountInput
						currency={currency}
						unit="millionTokens"
						disabled={disabled || !entry.enabled}
						fieldId={fieldId}
						inputId={`${fieldId}-value`}
						onChange={(event) => onChange({ value: event.target.value })}
						placeholder={t("modelList.editor.placeholder.price")}
						value={entry.value}
					/>
				</DialogFormField>
			) : (
				<div className="grid gap-2">
					{entry.steps.map((step, stepIndex) => {
						const isLast = stepIndex === entry.steps.length - 1
						const startValue =
							stepIndex === 0
								? "0"
								: (isFollowMode
										? sourceEntry?.steps[stepIndex - 1]?.max
										: entry.steps[stepIndex - 1]?.max) || "0"
						const endValue = isFollowMode
							? (sourceEntry?.steps[stepIndex]?.max ?? "")
							: step.max
						return (
							<div
								className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end"
								key={`${item.billing_object}-${stepIndex}`}
							>
								{stepIndex === 0 ? (
									<DialogFormField
										fieldId={`${fieldId}-range-start`}
										label={t("modelList.editor.field.rangeStart")}
									>
										<TokenBoundaryInput
											disabled
											id={`${fieldId}-range-start`}
											value={startValue}
										/>
									</DialogFormField>
								) : (
									<TokenBoundaryInput disabled value={startValue} />
								)}
								<span className="hidden pb-2 text-xs text-muted-foreground sm:inline">
									≤ Tokens &lt;
								</span>
								{stepIndex === 0 ? (
									<DialogFormField
										fieldId={`${fieldId}-range-end`}
										label={t("modelList.editor.field.rangeEnd")}
									>
										<TokenBoundaryInput
											id={`${fieldId}-range-end`}
											disabled={
												disabled || !entry.enabled || isFollowMode || isLast
											}
											onChange={(event) =>
												updateStep(stepIndex, { max: event.target.value })
											}
											placeholder={
												isLast
													? t("modelList.editor.noLimit")
													: t(
															"modelList.editor.placeholder.tokenRangeEnd",
														)
											}
											value={isLast ? "" : endValue}
										/>
									</DialogFormField>
								) : (
									<TokenBoundaryInput
										disabled={
											disabled || !entry.enabled || isFollowMode || isLast
										}
										onChange={(event) =>
											updateStep(stepIndex, { max: event.target.value })
										}
										placeholder={
											isLast
												? t("modelList.editor.noLimit")
												: t("modelList.editor.placeholder.tokenRangeEnd")
										}
										value={isLast ? "" : endValue}
									/>
								)}
								{stepIndex === 0 ? (
									<DialogFormField
										fieldId={`${fieldId}-step-price`}
										label={t("modelList.editor.field.priceValue")}
									>
										<PricingAmountInput
											currency={currency}
											unit="millionTokens"
											disabled={disabled || !entry.enabled}
											fieldId={fieldId}
											inputId={`${fieldId}-step-price`}
											onChange={(event) =>
												updateStep(stepIndex, { price: event.target.value })
											}
											placeholder={t("modelList.editor.placeholder.price")}
											value={step.price}
										/>
									</DialogFormField>
								) : (
									<PricingAmountInput
										currency={currency}
										unit="millionTokens"
										disabled={disabled || !entry.enabled}
										fieldId={fieldId}
										onChange={(event) =>
											updateStep(stepIndex, { price: event.target.value })
										}
										placeholder={t("modelList.editor.placeholder.price")}
										value={step.price}
									/>
								)}
								{entry.mode === "ladder" ? (
									<div className="flex h-9 items-center gap-1">
										<Button
											aria-label={t("modelList.editor.action.addPricingTier")}
											disabled={disabled || !entry.enabled}
											onClick={() =>
												onChange({
													steps: [
														...entry.steps.slice(0, stepIndex + 1),
														{ max: "", price: "" },
														...entry.steps.slice(stepIndex + 1),
													],
												})
											}
											size="icon"
											type="button"
											variant="outline"
										 data-testid="platform-model-list-delete-button">
											<Plus className="size-4" aria-hidden="true" />
										</Button>
										<Button
											aria-label={t(
												"modelList.editor.action.removePricingTier",
											)}
											disabled={
												disabled ||
												!entry.enabled ||
												entry.steps.length <= 1
											}
											onClick={() =>
												onChange({
													steps: entry.steps
														.filter(
															(_, currentIndex) =>
																currentIndex !== stepIndex,
														)
														.map(
															(
																currentStep,
																currentIndex,
																nextSteps,
															) =>
																currentIndex ===
																nextSteps.length - 1
																	? { ...currentStep, max: "" }
																	: currentStep,
														),
												})
											}
											size="icon"
											type="button"
											variant="ghost"
										 data-testid="platform-model-list-delete-button">
											<Trash2 className="size-4" aria-hidden="true" />
										</Button>
									</div>
								) : null}
							</div>
						)
					})}
				</div>
			)}
		</div>
	)
}

