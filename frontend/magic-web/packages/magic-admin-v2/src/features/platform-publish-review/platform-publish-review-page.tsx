import { RefreshCw } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { useListQueryParams } from "@magic-admin-v2/hooks/use-list-query-params"
import { useTranslation } from "react-i18next"
import { ListShell } from "@magic-admin-v2/components/list-shell"
import { PageHeaderActionButton } from "@magic-admin-v2/components/page-header-action-button"
import { PageHeaderFilterButton } from "@magic-admin-v2/components/page-header-filter-button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@magic-admin-v2/components/ui/tabs"
import { PERMISSION_KEY_MAP } from "@magic-admin-v2/constants/permissions"
import { EmployeeReviewPanel } from "@magic-admin-v2/features/platform-publish-review/components/employee-review-panel"
import { SkillReviewPanel } from "@magic-admin-v2/features/platform-publish-review/components/skill-review-panel"
import type {
	AgentReviewListParams,
	PublishReviewFilterDraft,
	PublishReviewKind,
	SkillReviewListParams,
} from "@magic-admin-v2/features/platform-publish-review/types"
import { useRights } from "@magic-admin-v2/hooks/use-rights"
import {
	countActiveReviewFilters,
	createDefaultFilterDraft,
	toAgentReviewParams,
	toSkillReviewParams,
} from "@magic-admin-v2/features/platform-publish-review/params"
import { cn } from "@magic-admin-v2/utils/cn"

export default function PlatformPublishReviewPage() {
	const { t } = useTranslation()
	const canViewEmployeeReview = useRights([
		PERMISSION_KEY_MAP.PLATFORM_EMPLOYEE_REVIEW_QUERY,
		PERMISSION_KEY_MAP.PLATFORM_EMPLOYEE_REVIEW_EDIT,
	])
	const canViewSkillReview = useRights([
		PERMISSION_KEY_MAP.PLATFORM_SKILL_REVIEW_QUERY,
		PERMISSION_KEY_MAP.PLATFORM_SKILL_REVIEW_EDIT,
	])
	const [activeTab, setActiveTab] = useState<PublishReviewKind>("employee")
	const [activeTabFetching, setActiveTabFetching] = useState(false)
	const [refreshToken, setRefreshToken] = useState(0)
	const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
	const handleActiveFetchingChange = useCallback((isFetching: boolean) => {
		setActiveTabFetching(isFetching)
	}, [])
	const handleTabChange = useCallback((value: string) => {
		setMobileFilterOpen(false)
		setActiveTab(value as PublishReviewKind)
	}, [])
	const employeeQueryState = useListQueryParams<PublishReviewFilterDraft, AgentReviewListParams>({
		debounceFields: ["name_i18n", "organization_code", "version"],
		initialDraft: () => createDefaultFilterDraft("employee", "platform"),
		toParams: toAgentReviewParams,
	})
	const skillQueryState = useListQueryParams<PublishReviewFilterDraft, SkillReviewListParams>({
		debounceFields: ["package_name", "skill_name", "version"],
		initialDraft: () => createDefaultFilterDraft("skill", "platform"),
		toParams: toSkillReviewParams,
	})

	useEffect(() => {
		if (activeTab === "employee" && !canViewEmployeeReview && canViewSkillReview) {
			setActiveTab("skill")
		}
		if (activeTab === "skill" && !canViewSkillReview && canViewEmployeeReview) {
			setActiveTab("employee")
		}
	}, [activeTab, canViewEmployeeReview, canViewSkillReview])

	return (
		<ListShell
			testId="publish-review-page"
			actions={
				<>
					{canViewEmployeeReview || canViewSkillReview ? (
						<PageHeaderFilterButton
							data-testid="platform-publish-review-filter-button"
							count={
								activeTab === "employee"
									? countActiveReviewFilters(
											employeeQueryState.filterDraft,
											"employee",
										)
									: countActiveReviewFilters(skillQueryState.filterDraft, "skill")
							}
							label={t("publishReview.filter.title")}
							onClick={() => setMobileFilterOpen(true)}
						/>
					) : null}
					<PageHeaderActionButton
						data-testid="publish-review-refresh-button"
						disabled={activeTabFetching}
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
			description={t("publishReview.description")}
			title={t("publishReview.title")}
		>
			<Tabs value={activeTab} onValueChange={handleTabChange}>
				<TabsList>
					{canViewEmployeeReview ? (
						<TabsTrigger data-testid="publish-review-employee-tab" value="employee">
							{t("publishReview.tab.employee")}
						</TabsTrigger>
					) : null}
					{canViewSkillReview ? (
						<TabsTrigger data-testid="publish-review-skill-tab" value="skill">
							{t("publishReview.tab.skill")}
						</TabsTrigger>
					) : null}
				</TabsList>
				{canViewEmployeeReview ? (
					<TabsContent value="employee" className="mt-5">
						<EmployeeReviewPanel
							isActive={activeTab === "employee"}
							onFetchingChange={handleActiveFetchingChange}
							queryState={employeeQueryState}
							onMobileFilterOpenChange={setMobileFilterOpen}
							mobileFilterOpen={mobileFilterOpen}
							refreshToken={refreshToken}
							variant="platform"
						/>
					</TabsContent>
				) : null}
				{canViewSkillReview ? (
					<TabsContent value="skill" className="mt-5">
						<SkillReviewPanel
							isActive={activeTab === "skill"}
							onFetchingChange={handleActiveFetchingChange}
							queryState={skillQueryState}
							onMobileFilterOpenChange={setMobileFilterOpen}
							mobileFilterOpen={mobileFilterOpen}
							refreshToken={refreshToken}
							variant="platform"
						/>
					</TabsContent>
				) : null}
			</Tabs>
		</ListShell>
	)
}
