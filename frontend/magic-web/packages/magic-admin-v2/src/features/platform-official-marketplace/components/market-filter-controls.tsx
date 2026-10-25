import { useTranslation } from "react-i18next"
import { FilterControlField } from "@magic-admin-v2/components/filter-control-field"
import { FilterSearchInput } from "@magic-admin-v2/components/filter-search-input"
import {
	ListFilterPanel,
	type ListFilterPanelFieldsProps,
} from "@magic-admin-v2/components/list-filter-panel"
import { SearchableMultiSelect } from "@magic-admin-v2/components/searchable-multi-select"
import { TimeFilterPanel } from "@magic-admin-v2/components/time-filter-panel"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@magic-admin-v2/components/ui/select"
import {
	marketPublishStatus,
	marketPublisherType,
	marketSelectAllValue,
	type MarketCategoryOption,
	type MarketDraftUpdater,
	type MarketFilterDraft,
	type MarketKind,
	type MarketOrderBy,
} from "@magic-admin-v2/features/platform-official-marketplace/types"
import {
	createDefaultFilterDraft,
	getPublisherTypeLabel,
	getPublishStatusLabel,
} from "@magic-admin-v2/features/platform-official-marketplace/utils"

type MarketFiltersProps = {
	categoryOptions?: MarketCategoryOption[]
	categoryOptionsLoading?: boolean
	codeLabel: string
	codePlaceholder: string
	filterDraft: MarketFilterDraft
	/** Kept for call-site compatibility; the search fields no longer depend on the tab kind. */
	kind?: MarketKind
	onDraftChange: (value: MarketDraftUpdater) => void
	showCategoryFilter?: boolean
	showPackageName: boolean
	mobileOpen?: boolean
	onMobileOpenChange?: (open: boolean) => void
}

/** Shared search area for both marketplace tabs. */
export function MarketFilters({
	categoryOptions = [],
	categoryOptionsLoading = false,
	codeLabel,
	codePlaceholder,
	filterDraft,
	onDraftChange,
	showCategoryFilter = false,
	showPackageName,
	mobileOpen,
	onMobileOpenChange,
}: MarketFiltersProps) {
	const { t } = useTranslation()

	return (
		<ListFilterPanel
			applyLabel={t("officialMarketplace.filter.apply")}
			createDefaultValue={createDefaultFilterDraft}
			onChange={(patch) => onDraftChange((previous) => ({ ...previous, ...patch }))}
			onReset={() => onDraftChange(createDefaultFilterDraft())}
			mobileOpen={mobileOpen}
			onMobileOpenChange={onMobileOpenChange}
			showMobileTrigger={false}
			renderFields={(props) => (
				<MarketFilterFields
					{...props}
					categoryOptions={categoryOptions}
					categoryOptionsLoading={categoryOptionsLoading}
					codeLabel={codeLabel}
					codePlaceholder={codePlaceholder}
					showCategoryFilter={showCategoryFilter}
					showPackageName={showPackageName}
				/>
			)}
			resetLabel={t("officialMarketplace.action.reset")}
			title={t("officialMarketplace.filter.title")}
			value={filterDraft}
			desktopResetTestId="platform-official-marketplace-reset-button"
			mobileApplyTestId="platform-official-marketplace-apply-button"
			mobileBodyTestId="platform-official-marketplace-filter-body"
			mobileCloseButtonTestId="platform-official-marketplace-filter-close-button"
			mobileContentTestId="platform-official-marketplace-filter-sheet"
			mobileResetTestId="platform-official-marketplace-reset-button"
		/>
	)
}

type MarketFilterFieldsProps = ListFilterPanelFieldsProps<MarketFilterDraft> & {
	categoryOptions: MarketCategoryOption[]
	categoryOptionsLoading: boolean
	codeLabel: string
	codePlaceholder: string
	showCategoryFilter: boolean
	showPackageName: boolean
}

function SearchInput({
	label,
	onChange,
	placeholder,
	value,
}: {
	label: string
	onChange: (value: string) => void
	placeholder: string
	value: string
}) {
	const { t } = useTranslation()

	return (
		<FilterControlField label={label}>
			<FilterSearchInput
				aria-label={label}
				clearButtonTestId="platform-official-marketplace-advanced-search-clear-button"
				clearLabel={t("common.clear")}
				containerClassName="min-w-0"
				inputTestId="platform-official-marketplace-advanced-search-input"
				onValueChange={onChange}
				placeholder={placeholder}
				value={value}
			/>
		</FilterControlField>
	)
}

/** Every condition is an independent field; there is no field selector + shared input. */
function MarketFilterFields({
	categoryOptions,
	categoryOptionsLoading,
	codeLabel,
	codePlaceholder,
	onChange,
	showCategoryFilter,
	showPackageName,
	value,
}: MarketFilterFieldsProps) {
	const { t } = useTranslation()

	return (
		<>
			<SearchInput
				label={codeLabel}
				onChange={(code) => onChange({ code })}
				placeholder={codePlaceholder}
				value={value.code}
			/>
			<SearchInput
				label={t("officialMarketplace.filter.name")}
				onChange={(name_i18n) => onChange({ name_i18n })}
				placeholder={t("officialMarketplace.placeholder.name")}
				value={value.name_i18n}
			/>
			{showPackageName ? (
				<SearchInput
					label={t("officialMarketplace.filter.packageName")}
					onChange={(package_name) => onChange({ package_name })}
					placeholder={t("officialMarketplace.placeholder.packageName")}
					value={value.package_name}
				/>
			) : null}
			<SearchInput
				label={t("officialMarketplace.filter.organizationCode")}
				onChange={(organization_code) => onChange({ organization_code })}
				placeholder={t("officialMarketplace.placeholder.organizationCode")}
				value={value.organization_code}
			/>
			{showCategoryFilter ? (
				<FilterControlField label={t("officialMarketplace.filter.category")}>
					<SearchableMultiSelect
						ariaLabel={t("officialMarketplace.filter.category")}
						clearButtonTestId="platform-official-marketplace-multi-select-clear-button"
						clearLabel={t("officialMarketplace.filter.clearCategories")}
						contentTestId="platform-official-marketplace-multi-select-content"
						emptyLabel={t("officialMarketplace.filter.allCategories")}
						emptyTestId="platform-official-marketplace-multi-select-empty"
						isLoading={categoryOptionsLoading}
						loadingTestId="platform-official-marketplace-multi-select-loading"
						noMatchingLabel={t("officialMarketplace.filter.noMatchingCategories")}
						onChange={(category_ids) => onChange({ category_ids })}
						optionTestId="platform-official-marketplace-multi-select-option"
						options={categoryOptions}
						searchClearButtonTestId="platform-official-marketplace-multi-select-search-clear-button"
						searchInputTestId="platform-official-marketplace-multi-select-search-input"
						searchPlaceholder={t("officialMarketplace.filter.searchCategories")}
						selectedCountLabel={(count) =>
							t("officialMarketplace.filter.selectedCategoryCount", { count })
						}
						triggerTestId="platform-official-marketplace-multi-select-trigger"
						value={value.category_ids}
					/>
				</FilterControlField>
			) : null}
			<FilterControlField label={t("officialMarketplace.filter.publishStatus")}>
				<Select
					onValueChange={(publish_status) => onChange({ publish_status })}
					value={value.publish_status}
				>
					<SelectTrigger
						aria-label={t("officialMarketplace.filter.publishStatus")}
						className="w-full"
						data-testid="platform-official-marketplace-select-trigger"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent data-testid="platform-official-marketplace-select-content">
						<SelectItem
							data-testid="platform-official-marketplace-option"
							value={marketSelectAllValue}
						>
							{t("officialMarketplace.filter.all")}
						</SelectItem>
						{Object.values(marketPublishStatus).map((status) => (
							<SelectItem
								data-testid="platform-official-marketplace-option"
								key={status}
								value={status}
							>
								{getPublishStatusLabel(status, t)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</FilterControlField>
			<FilterControlField label={t("officialMarketplace.filter.publisherType")}>
				<Select
					onValueChange={(publisher_type) => onChange({ publisher_type })}
					value={value.publisher_type}
				>
					<SelectTrigger
						aria-label={t("officialMarketplace.filter.publisherType")}
						className="w-full"
						data-testid="platform-official-marketplace-select-trigger"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent data-testid="platform-official-marketplace-select-content">
						<SelectItem
							data-testid="platform-official-marketplace-option"
							value={marketSelectAllValue}
						>
							{t("officialMarketplace.filter.all")}
						</SelectItem>
						{Object.values(marketPublisherType).map((type) => (
							<SelectItem
								data-testid="platform-official-marketplace-option"
								key={type}
								value={type}
							>
								{getPublisherTypeLabel(type, t)}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</FilterControlField>
			<FilterControlField label={t("officialMarketplace.filter.orderBy")}>
				<Select
					onValueChange={(order_by) => onChange({ order_by: order_by as MarketOrderBy })}
					value={value.order_by}
				>
					<SelectTrigger
						aria-label={t("officialMarketplace.filter.orderBy")}
						className="w-full"
						data-testid="platform-official-marketplace-select-trigger"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent data-testid="platform-official-marketplace-select-content">
						<SelectItem data-testid="platform-official-marketplace-option" value="desc">
							{t("officialMarketplace.order.desc")}
						</SelectItem>
						<SelectItem data-testid="platform-official-marketplace-option" value="asc">
							{t("officialMarketplace.order.asc")}
						</SelectItem>
					</SelectContent>
				</Select>
			</FilterControlField>
			<FilterControlField label={t("officialMarketplace.filter.createdAt")}>
				<TimeFilterPanel
					className="w-full"
					testIdPrefix="platform-official-marketplace-time-filter"
					onChange={(timeRange) =>
						onChange({
							end_time: timeRange?.endDate ?? "",
							start_time: timeRange?.startDate ?? "",
							time_range: timeRange,
						})
					}
					presentation="popover"
					value={value.time_range}
				/>
			</FilterControlField>
		</>
	)
}
