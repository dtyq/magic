import type { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"
import { FilterControlField } from "@magic-admin-v2/components/filter-control-field"
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input"
import {
	ListFilterPanel,
	type ListFilterPanelFieldsProps,
} from "@magic-admin-v2/components/list-filter-panel"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import { MultiSelectFilter } from "@magic-admin-v2/features/platform-model-list/components/multi-select-filter"
import {
	providerModelStatus,
	type ProviderModelStatus,
	type ProviderModelType,
} from "@magic-admin-v2/features/platform-model-list/types"
import {
	allStatusFilterValue,
	createDefaultFilterDraft,
	type FilterOption,
	type ModelListFilterDraft,
} from "@magic-admin-v2/features/platform-model-list/utils/model-list"

type ModelListFiltersProps = {
	modelTypeOptions: Array<FilterOption<ProviderModelType>>
	mobileOpen?: boolean
	onChange: Dispatch<SetStateAction<ModelListFilterDraft>>
	onMobileOpenChange?: (open: boolean) => void
	/** The model type filter is hidden for categories that only contain a single type. */
	showModelTypes: boolean
	value: ModelListFilterDraft
}

export function ModelListFilters({
	modelTypeOptions,
	mobileOpen,
	onChange,
	onMobileOpenChange,
	showModelTypes,
	value,
}: ModelListFiltersProps) {
	const { t } = useTranslation()

	return (
		<ListFilterPanel
			applyLabel={t("modelList.action.applyFilters")}
			mobileOpen={mobileOpen}
			onMobileOpenChange={onMobileOpenChange}
			showMobileTrigger={false}
			createDefaultValue={createDefaultFilterDraft}
			onChange={(patch) => onChange((previous) => ({ ...previous, ...patch }))}
			onReset={() => onChange(createDefaultFilterDraft())}
			renderFields={(props) => (
				<ModelListFilterFields
					{...props}
					modelTypeOptions={modelTypeOptions}
					showModelTypes={showModelTypes}
				/>
			)}
			resetLabel={t("modelList.action.reset")}
			title={t("modelList.filter.title")}
			value={value}
			desktopResetTestId="model-list-reset-button"
			desktopTestId="model-list-filters"
			mobileApplyTestId="model-list-advanced-apply-button"
			mobileBodyTestId="model-list-advanced-body"
			mobileCloseButtonTestId="model-list-advanced-close-button"
			mobileContentTestId="model-list-advanced-content"
			mobileResetTestId="model-list-advanced-reset-button"
		/>
	)
}

function ModelListFilterFields({
	modelTypeOptions,
	onChange,
	showModelTypes,
	value,
	layout,
}: ListFilterPanelFieldsProps<ModelListFilterDraft> &
	Pick<ModelListFiltersProps, "modelTypeOptions" | "showModelTypes">) {
	const { t } = useTranslation()
	const statusOptions: Array<FilterOption<ProviderModelStatus>> = [
		{ value: providerModelStatus.enabled, label: t("modelList.status.enabled") },
		{ value: providerModelStatus.disabled, label: t("modelList.status.disabled") },
	]

	return (
		<>
			<FilterControlField label={t("modelList.filter.search")}>
				<FilterSearchInput
					aria-label={t("modelList.placeholder.search")}
					clearButtonTestId={
						layout === "sheet"
							? "model-list-advanced-search-clear-button"
							: "model-list-search-clear-button"
					}
					clearLabel={t("common.clear")}
					inputTestId={
						layout === "sheet"
							? "model-list-advanced-search-input"
							: "model-list-search-input"
					}
					onValueChange={(keyword) => onChange({ keyword })}
					placeholder={t("modelList.placeholder.search")}
					value={value.keyword}
				/>
			</FilterControlField>
			<FilterControlField label={t("modelList.filter.statuses")}>
				<Select
					onValueChange={(status) =>
						onChange({
							status:
								status === allStatusFilterValue
									? null
									: (Number(status) as ProviderModelStatus),
						})
					}
					value={value.status === null ? allStatusFilterValue : String(value.status)}
				>
					<SelectTrigger
						aria-label={t("modelList.filter.statuses")}
						className="w-full"
						data-testid={
							layout === "sheet"
								? "model-list-advanced-status-trigger"
								: "model-list-status-trigger"
						}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent
						data-testid={
							layout === "sheet"
								? "platform-model-list-model-list-advanced-status-content"
								: "platform-model-list-model-list-status-content"
						}
					>
						<SelectItem
							data-testid="platform-model-list-option"
							value={allStatusFilterValue}
						>
							{t("modelList.filter.allStatuses")}
						</SelectItem>
						{statusOptions.map((option) => (
							<SelectItem
								data-testid="platform-model-list-option"
								key={option.value}
								value={String(option.value)}
							>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</FilterControlField>
			{showModelTypes ? (
				<FilterControlField label={t("modelList.filter.modelTypes")}>
					<MultiSelectFilter
						allLabel={t("modelList.filter.allModelTypes")}
						ariaLabel={t("modelList.filter.modelTypes")}
						onChange={(modelTypes) => onChange({ modelTypes })}
						options={modelTypeOptions}
						triggerTestId={
							layout === "sheet"
								? "model-list-advanced-model-type-trigger"
								: "model-list-model-type-trigger"
						}
						contentTestId={
							layout === "sheet"
								? "model-list-advanced-model-type-content"
								: "model-list-model-type-content"
						}
						clearButtonTestId={
							layout === "sheet"
								? "model-list-advanced-model-type-clear-button"
								: "model-list-model-type-clear-button"
						}
						optionTestId={
							layout === "sheet"
								? "model-list-advanced-model-type-option"
								: "model-list-model-type-option"
						}
						value={value.modelTypes}
					/>
				</FilterControlField>
			) : null}
		</>
	)
}
