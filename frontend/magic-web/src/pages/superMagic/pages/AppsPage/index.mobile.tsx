import { observer } from "mobx-react-lite"
import { useTranslation } from "react-i18next"
import { hasOrganizationAppsShortcuts } from "@/layouts/BaseLayoutMobile/components/MobileTabBar/constants/tabsConfig.shared"
import { userStore } from "@/models/user"
import { Navigate } from "@/routes/components/Navigate"
import { RouteName } from "@/routes/constants"
import { DataEmptyState } from "@/pages/superMagicMobile/components/DataEmptyState"
import { AppsPageView } from "./components/AppsPageView"
import { useAppsPage } from "./hooks/useAppsPage"

/**
 * 移动端 Apps 面板作为 container，只拼接壳层能力和页面数据，不承载视觉细节。
 */
const AppsPageMobilePanel = observer(function AppsPageMobilePanel() {
	const { t } = useTranslation("super")
	const { entries, loading, error, refresh, handleOpenEntry } = useAppsPage()
	const shouldShowAppsEntry = hasOrganizationAppsShortcuts({
		isPersonalOrganization: userStore.user.isPersonalOrganization,
	})

	/** 当旧线上语义下不存在 Apps 固定快捷项时，独立页也应回退而不是展示空壳。 */
	if (!shouldShowAppsEntry) {
		return <Navigate name={RouteName.MobileHome} replace />
	}

	return (
		<AppsPageView
			title={t("mobile.shell.navApps")}
			errorTitle={t("mobile.apps.errorTitle")}
			errorDescription={t("mobile.apps.errorDescription")}
			emptyTitle={t("mobile.apps.emptyTitle")}
			emptyDescription={t("mobile.apps.emptyDescription")}
			emptyContent={<DataEmptyState variant="apps" className="py-12" />}
			retryLabel={t("mobile.apps.retry")}
			loading={loading}
			hasError={error != null}
			entries={entries}
			onRetry={refresh}
			onOpenEntry={handleOpenEntry}
		/>
	)
})

export default AppsPageMobilePanel
