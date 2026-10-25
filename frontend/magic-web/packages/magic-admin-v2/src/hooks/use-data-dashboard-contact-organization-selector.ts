import { useMemo } from "react"
import { createDataDashboardContactOrganizationSelectorAdapters } from "@magic-admin-v2/components/organization-selectors/data-dashboard-contact"
import { useApis } from "@magic-admin-v2/runtime/context"

/** 数据看板专用联系人选择器适配器，不改变普通通讯录数据源。 */
export function useDataDashboardContactOrganizationSelector() {
	const { dataDashboardContact } = useApis()

	return useMemo(
		() => createDataDashboardContactOrganizationSelectorAdapters(dataDashboardContact),
		[dataDashboardContact],
	)
}
