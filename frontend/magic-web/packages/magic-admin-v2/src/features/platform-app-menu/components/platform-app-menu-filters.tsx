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
import { appMenuStatus } from "@magic-admin-v2/features/platform-app-menu/types"
import {
	APP_MENU_ALL_VALUE,
	createDefaultAppMenuFilterDraft,
	type AppMenuFilterDraft,
} from "@magic-admin-v2/features/platform-app-menu/utils"

interface PlatformAppMenuFiltersProps {
	mobileOpen?: boolean
	onChange: Dispatch<SetStateAction<AppMenuFilterDraft>>
	onMobileOpenChange?: (open: boolean) => void
	onSearchValueChange: (value: string) => void
	value: AppMenuFilterDraft
}

export function PlatformAppMenuFilters({
	mobileOpen,
	onChange,
	onMobileOpenChange,
	onSearchValueChange,
	value,
}: PlatformAppMenuFiltersProps) {
	const { t } = useTranslation()

	return (
		<ListFilterPanel
			applyLabel={t("appMenu.filter.apply")}
			mobileOpen={mobileOpen}
			onMobileOpenChange={onMobileOpenChange}
			showMobileTrigger={false}
			createDefaultValue={createDefaultAppMenuFilterDraft}
			onChange={(patch) => onChange((previous) => ({ ...previous, ...patch }))}
			onReset={() => onChange(createDefaultAppMenuFilterDraft())}
			renderFields={(props) => (
				<AppMenuFilterFields {...props} onSearchValueChange={onSearchValueChange} />
			)}
			resetLabel={t("appMenu.action.reset")}
			title={t("appMenu.filter.title")}
			value={value}
			desktopResetTestId="app-menu-reset-button"
			desktopTestId="app-menu-filters"
			mobileApplyTestId="app-menu-advanced-apply-button"
			mobileBodyTestId="app-menu-advanced-body"
			mobileCloseButtonTestId="app-menu-advanced-close-button"
			mobileContentTestId="app-menu-advanced-content"
			mobileResetTestId="app-menu-advanced-reset-button"
		/>
	)
}

function AppMenuFilterFields({
	onChange,
	onSearchValueChange,
	layout,
	value,
}: ListFilterPanelFieldsProps<AppMenuFilterDraft> & {
	onSearchValueChange: (value: string) => void
}) {
	const { t } = useTranslation()

	return (
		<>
			<FilterControlField label={t("appMenu.filter.name")}>
				<FilterSearchInput
					aria-label={t("appMenu.filter.name")}
					clearButtonTestId={
						layout === "sheet"
							? "app-menu-advanced-name-clear-button"
							: "app-menu-name-clear-button"
					}
					clearLabel={t("common.clear")}
					inputTestId={
						layout === "sheet" ? "app-menu-advanced-name-input" : "app-menu-name-input"
					}
					onValueChange={(name) =>
						layout === "grid" ? onSearchValueChange(name) : onChange({ name })
					}
					placeholder={t("appMenu.placeholder.searchName")}
					value={value.name}
				/>
			</FilterControlField>
			<FilterControlField label={t("appMenu.filter.status")}>
				<Select onValueChange={(status) => onChange({ status })} value={value.status}>
					<SelectTrigger
						aria-label={t("appMenu.filter.status")}
						className="w-full"
						data-testid={
							layout === "sheet"
								? "app-menu-advanced-status-trigger"
								: "app-menu-status-trigger"
						}
					>
						<SelectValue />
					</SelectTrigger>
					<SelectContent data-testid="platform-app-menu-filter-content">
						<SelectItem
							data-testid="platform-app-menu-option"
							value={APP_MENU_ALL_VALUE}
						>
							{t("appMenu.filter.statusAll")}
						</SelectItem>
						<SelectItem
							data-testid="platform-app-menu-option"
							value={String(appMenuStatus.enabled)}
						>
							{t("appMenu.status.enabled")}
						</SelectItem>
						<SelectItem
							data-testid="platform-app-menu-option"
							value={String(appMenuStatus.disabled)}
						>
							{t("appMenu.status.disabled")}
						</SelectItem>
					</SelectContent>
				</Select>
			</FilterControlField>
		</>
	)
}
