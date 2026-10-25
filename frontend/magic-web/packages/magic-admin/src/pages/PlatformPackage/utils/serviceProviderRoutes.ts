import { AiModel } from "@admin/const/aiModel"
import { RouteName } from "@admin/const/routes"

/**
 * 服务商详情路由。
 * 开源版只有平台模型路由。企业版同路径文件会按 isOfficialOrg 改走组织级 AI 路由。
 */
export function getServiceProviderDetailRouteName(
	category: AiModel.ServiceProviderCategory,
	_isOfficialOrg: boolean,
): string {
	switch (category) {
		case AiModel.ServiceProviderCategory.VLM:
			return RouteName.AdminPlatformAIDrawingDetails
		case AiModel.ServiceProviderCategory.VGM:
			return RouteName.AdminPlatformVideoModelDetails
		default:
			return RouteName.AdminPlatformAIModelDetails
	}
}

/** 详情页无法回退历史时的列表路由。企业版同路径文件会区分组织类型。 */
export function getServiceProviderListFallbackRoute(_isOfficialOrg: boolean): string {
	return RouteName.AdminPlatformAIModel
}
