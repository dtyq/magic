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
import { ALL_VALUE } from "@magic-admin-v2/features/platform-system-capabilities/consts"

export type CapabilityFilterDraft = {
	keyword: string
	status: string
}

export function createDefaultCapabilityFilterDraft(): CapabilityFilterDraft {
	return { keyword: "", status: ALL_VALUE }
}

export function getCapabilityFilterActiveCount(filter: CapabilityFilterDraft) {
	return Number(Boolean(filter.keyword.trim())) + Number(filter.status !== ALL_VALUE)
}

export function CapabilityFilters({
	mobileOpen,
	onChange,
	onMobileOpenChange,
	value,
}: {
	mobileOpen?: boolean
	onChange: (value: CapabilityFilterDraft) => void
	onMobileOpenChange?: (open: boolean) => void
	value: CapabilityFilterDraft
}) {
	const { t } = useTranslation()

	return (
		<ListFilterPanel
			applyLabel={t("systemCapabilities.filter.apply")}
			mobileOpen={mobileOpen}
			onMobileOpenChange={onMobileOpenChange}
			showMobileTrigger={false}
			createDefaultValue={createDefaultCapabilityFilterDraft}
			onChange={(patch) => onChange({ ...value, ...patch })}
			onReset={() => onChange(createDefaultCapabilityFilterDraft())}
			renderFields={(props) => <CapabilityFilterFields {...props} />}
			resetLabel={t("systemCapabilities.action.reset")}
			title={t("systemCapabilities.filter.title")}
			value={value}
			desktopTestId="platform-system-capabilities-filters"
		/>
	)
}

function CapabilityFilterFields({
	onChange,
	value,
	layout,
}: ListFilterPanelFieldsProps<CapabilityFilterDraft>) {
	const { t } = useTranslation()

	return (
		<>
			<FilterControlField label={t("systemCapabilities.filter.keyword")}>
				<FilterSearchInput
					aria-label={t("systemCapabilities.filter.keyword")}
					clearButtonTestId="platform-system-capabilities-search-clear-button"
					clearLabel={t("common.clear")}
					inputTestId="platform-system-capabilities-search-input"
					onValueChange={(keyword) => onChange({ keyword })}
					placeholder={t("systemCapabilities.placeholder.keyword")}
					value={value.keyword}
				/>
			</FilterControlField>
			<FilterControlField label={t("systemCapabilities.filter.status")}>
				<Select onValueChange={(status) => onChange({ status })} value={value.status}>
					<SelectTrigger
						className="w-full"
						data-testid="platform-system-capabilities-select-trigger"
					>
						<SelectValue placeholder={t("systemCapabilities.filter.status")} />
					</SelectTrigger>
					<SelectContent data-testid="platform-system-capabilities-select-content">
						<SelectItem
							data-testid="platform-system-capabilities-option"
							value={ALL_VALUE}
						>
							{t("systemCapabilities.filter.allStatuses")}
						</SelectItem>
						<SelectItem
							data-testid="platform-system-capabilities-option"
							value="enabled"
						>
							{t("common.enabled")}
						</SelectItem>
						<SelectItem
							data-testid="platform-system-capabilities-option"
							value="disabled"
						>
							{t("common.disabled")}
						</SelectItem>
					</SelectContent>
				</Select>
			</FilterControlField>
		</>
	)
}
