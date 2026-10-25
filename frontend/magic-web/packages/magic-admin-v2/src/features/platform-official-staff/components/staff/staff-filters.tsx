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
import {
	createDefaultFilterDraft,
	selectAllValue,
	type FilterDraft,
} from "@magic-admin-v2/features/platform-official-staff/utils/page-utils"

export function StaffFilters({
	mobileOpen,
	onChange,
	onMobileOpenChange,
	value,
}: {
	mobileOpen?: boolean
	onChange: Dispatch<SetStateAction<FilterDraft>>
	onMobileOpenChange?: (open: boolean) => void
	value: FilterDraft
}) {
	const { t } = useTranslation()

	return (
		<ListFilterPanel
			applyLabel={t("officialStaff.action.applyFilters")}
			desktopResetTestId="platform-official-staff-desktop-reset-button"
			mobileApplyTestId="platform-official-staff-apply-button"
			mobileBodyTestId="platform-official-staff-filter-body"
			mobileCloseButtonTestId="platform-official-staff-filter-close-button"
			mobileContentTestId="platform-official-staff-filter-sheet"
			mobileOpen={mobileOpen}
			mobileResetTestId="platform-official-staff-reset-button"
			onMobileOpenChange={onMobileOpenChange}
			showMobileTrigger={false}
			createDefaultValue={createDefaultFilterDraft}
			onChange={(patch) => onChange((previous) => ({ ...previous, ...patch }))}
			onReset={() => onChange(createDefaultFilterDraft())}
			renderFields={(props) => <StaffFilterFields {...props} />}
			resetLabel={t("officialStaff.action.reset")}
			title={t("officialStaff.filter.title")}
			value={value}
		/>
	)
}

function StaffFilterFields({
	layout,
	onChange,
	value,
}: ListFilterPanelFieldsProps<FilterDraft>) {
	const { t } = useTranslation()
	const isSheet = layout === "sheet"

	return (
		<>
			<FilterControlField label={t("officialStaff.filter.keyword")}>
				<FilterSearchInput
					aria-label={t("officialStaff.filter.keyword")}
					clearButtonTestId={
						isSheet
							? "platform-official-staff-mobile-search-clear-button"
							: "platform-official-staff-secondary-clear-button"
					}
					clearLabel={t("common.clear")}
					inputTestId={
						isSheet
							? "platform-official-staff-mobile-search-input"
							: "platform-official-staff-secondary-search-input"
					}
					onValueChange={(keyword) => onChange({ keyword })}
					placeholder={t("officialStaff.placeholder.keyword")}
					value={value.keyword}
				/>
			</FilterControlField>
			<FilterControlField label={t("officialStaff.filter.identifier")}>
				<FilterSearchInput
					aria-label={t("officialStaff.filter.identifier")}
					clearButtonTestId={
						isSheet
							? "platform-official-staff-mobile-search-clear-button"
							: "platform-official-staff-tertiary-search-clear-button"
					}
					clearLabel={t("common.clear")}
					inputTestId={
						isSheet
							? "platform-official-staff-mobile-search-input"
							: "platform-official-staff-tertiary-search-input"
					}
					onValueChange={(identifier) => onChange({ identifier })}
					placeholder={t("officialStaff.placeholder.identifier")}
					value={value.identifier}
				/>
			</FilterControlField>
			<FilterControlField label={t("officialStaff.filter.status")}>
				<Select onValueChange={(status) => onChange({ status })} value={value.status}>
					<SelectTrigger
						className="w-full"
						data-testid="platform-official-staff-select-trigger"
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent data-testid="platform-official-staff-select-content">
						<SelectItem
							data-testid="platform-official-staff-option"
							value={selectAllValue}
						>
							{t("officialStaff.filter.allStatuses")}
						</SelectItem>
						<SelectItem data-testid="platform-official-staff-option" value="1">
							{t("common.enabled")}
						</SelectItem>
						<SelectItem data-testid="platform-official-staff-option" value="0">
							{t("common.disabled")}
						</SelectItem>
					</SelectContent>
				</Select>
			</FilterControlField>
		</>
	)
}
