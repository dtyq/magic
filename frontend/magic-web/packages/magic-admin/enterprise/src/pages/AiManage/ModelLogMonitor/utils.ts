import type { AiManage } from "@admin/types/aiManage"
import { AiModel } from "@admin/const/aiModel"
import { DataStatistics } from "@admin-enterprise/types/dataStatistics"

export function getServiceProviderLabel(
	provider?: Pick<AiManage.ServiceProviderList, "alias" | "name" | "id">,
) {
	if (!provider) return "-"
	if (provider.alias?.trim()) return provider.alias
	if (provider.name?.trim()) return provider.name
	return provider.id
}

export function getStatusLabel(status: number, t: (key: string) => string) {
	return status === AiModel.Status.Enabled
		? t("detail.statusEnabled")
		: t("detail.statusDisabled")
}

export function getServiceProviderCategoryLabel(
	category: AiModel.ServiceProviderCategory | string | undefined,
	t: (key: string) => string,
) {
	switch (category) {
		case AiModel.ServiceProviderCategory.LLM:
			return t("detail.categoryLLM")
		case AiModel.ServiceProviderCategory.VLM:
			return t("detail.categoryVLM")
		case AiModel.ServiceProviderCategory.VGM:
			return t("detail.categoryVGM")
		default:
			return category ? String(category) : "-"
	}
}

export function getTopBreakdownItems(
	breakdown: DataStatistics.BreakdownItem[],
	field: "service_provider_config_id" | "product_code",
) {
	const values = new Set<string>()

	return breakdown
		.filter((item) => !!item[field])
		.sort((left, right) => right.total_requests - left.total_requests)
		.flatMap((item) => {
			if (values.has(item[field])) return []
			values.add(item[field])
			return [item[field]]
		})
		.slice(0, 6)
}
