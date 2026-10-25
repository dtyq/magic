import { RefreshCw } from "lucide-react"
import type { ReactNode } from "react"
import { useCallback, useState } from "react"
import { useListQueryParams } from "@magic-admin-v2/hooks/use-list-query-params"
import { useTranslation } from "react-i18next"
import { ListShell } from "@magic-admin-v2/components/list-shell"
import { PageHeaderActionButton } from "@magic-admin-v2/components/page-header-action-button"
import { PageHeaderFilterButton } from "@magic-admin-v2/components/page-header-filter-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs"
import { EmployeeMarketPanel } from "@magic-admin-v2/features/platform-official-marketplace/components/employee-market-panel"
import { SkillMarketPanel } from "@magic-admin-v2/features/platform-official-marketplace/components/skill-market-panel"
import type {
	AgentMarketListParams,
	MarketFilterDraft,
	MarketKind,
	SkillMarketListParams,
} from "@magic-admin-v2/features/platform-official-marketplace/types"
import {
	countActiveMarketFilters,
	createDefaultFilterDraft,
	getOfficialMarketplacePermissions,
	resolveOfficialMarketplaceTab,
	toAgentMarketParams,
	toSkillMarketParams,
} from "@magic-admin-v2/features/platform-official-marketplace/utils"
import { useRuntime } from "@magic-admin-v2/runtime/context"
import { cn } from "@magic-admin-v2/utils/cn"

/** Top-level page orchestration; tab-specific data and mutations live in their panels. */
export default function PlatformOfficialMarketplacePage() {
	const { t } = useTranslation()
	const { access } = useRuntime()
	const [selectedTab, setSelectedTab] = useState<MarketKind>("employee")
	const [activeTabFetching, setActiveTabFetching] = useState(false)
	const [refreshToken, setRefreshToken] = useState(0)
	const [tabActions, setTabActions] = useState<ReactNode>(null)
	const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
	const { availableTabs, canEditEmployee, canEditSkill, canViewEmployee, canViewSkill } =
		getOfficialMarketplacePermissions(access)
	const activeTab = resolveOfficialMarketplaceTab(selectedTab, availableTabs)
	const handleInitialLoadingChange = useCallback(() => undefined, [])
	const handleActiveFetchingChange = useCallback((isFetching: boolean) => {
		setActiveTabFetching(isFetching)
	}, [])
	const handleTabChange = useCallback((value: string) => {
		setMobileFilterOpen(false)
		setTabActions(null)
		setSelectedTab(value as MarketKind)
	}, [])
	const employeeQueryState = useListQueryParams<MarketFilterDraft, AgentMarketListParams>({
		debounceFields: ["code", "name_i18n", "organization_code", "package_name"],
		initialDraft: createDefaultFilterDraft,
		toParams: toAgentMarketParams,
	})
	const skillQueryState = useListQueryParams<MarketFilterDraft, SkillMarketListParams>({
		debounceFields: ["code", "name_i18n", "organization_code", "package_name"],
		initialDraft: createDefaultFilterDraft,
		toParams: toSkillMarketParams,
	})

	return (
		<ListShell
			testId="official-marketplace-page"
			actions={
				<>
					{activeTab ? (
						<PageHeaderFilterButton
							data-testid="platform-official-marketplace-filter-button"
							count={
								activeTab === "employee"
									? countActiveMarketFilters(employeeQueryState.filterDraft)
									: countActiveMarketFilters(skillQueryState.filterDraft)
							}
							label={t("officialMarketplace.filter.title")}
							onClick={() => setMobileFilterOpen(true)}
						/>
					) : null}
					<PageHeaderActionButton
						data-testid="platform-official-marketplace-refresh-button"
						disabled={!activeTab || activeTabFetching}
						onClick={() => setRefreshToken((previous) => previous + 1)}
						variant="outline"
					>
						<RefreshCw
							className={cn("size-4", activeTabFetching && "animate-spin")}
							aria-hidden="true"
						/>
						{t("common.refresh")}
					</PageHeaderActionButton>
				</>
			}
			description={t("officialMarketplace.description")}
			title={t("officialMarketplace.title")}
		>
			<Tabs value={activeTab ?? ""} onValueChange={handleTabChange}>
				<div className="flex flex-wrap items-center justify-between gap-2">
					<TabsList>
						{canViewEmployee ? (
							<TabsTrigger
								data-testid="platform-official-marketplace-tab-trigger"
								value="employee"
							>
								{t("officialMarketplace.tab.employee")}
							</TabsTrigger>
						) : null}
						{canViewSkill ? (
							<TabsTrigger
								data-testid="platform-official-marketplace-tab-trigger"
								value="skill"
							>
								{t("officialMarketplace.tab.skill")}
							</TabsTrigger>
						) : null}
					</TabsList>
					{tabActions}
				</div>

				{canViewEmployee ? (
					<TabsContent value="employee" className="mt-5">
						<EmployeeMarketPanel
							canEdit={canEditEmployee}
							isActive={activeTab === "employee"}
							onFetchingChange={handleActiveFetchingChange}
							onInitialLoadingChange={handleInitialLoadingChange}
							queryState={employeeQueryState}
							onMobileFilterOpenChange={setMobileFilterOpen}
							mobileFilterOpen={mobileFilterOpen}
							onToolbarActionsChange={setTabActions}
							refreshToken={refreshToken}
						/>
					</TabsContent>
				) : null}

				{canViewSkill ? (
					<TabsContent value="skill" className="mt-5">
						<SkillMarketPanel
							canEdit={canEditSkill}
							isActive={activeTab === "skill"}
							onFetchingChange={handleActiveFetchingChange}
							onInitialLoadingChange={handleInitialLoadingChange}
							queryState={skillQueryState}
							onMobileFilterOpenChange={setMobileFilterOpen}
							mobileFilterOpen={mobileFilterOpen}
							onToolbarActionsChange={setTabActions}
							refreshToken={refreshToken}
						/>
					</TabsContent>
				) : null}
			</Tabs>
		</ListShell>
	)
}
