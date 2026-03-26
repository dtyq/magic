import type { WithPage } from "@/types/common"
import type { AiManage } from "@/types/aiManage"
import type { PlatformPackage } from "@/types/platformPackage"
import { RequestUrl } from "../constant"
import { genRequestUrl } from "../utils"
import type { HttpClient } from "../core/HttpClient"

export const generatePlatformPackageApi = (client: HttpClient) => {
	return {
		/** 获取模式列表 */
		getModeList(params: PlatformPackage.ModeListParams) {
			return client.get<WithPage<PlatformPackage.Mode>>(
				genRequestUrl(RequestUrl.getModeList, {}, params),
			)
		},

		/** 添加模式 */
		addMode(data: PlatformPackage.AddModeParams) {
			return client.post<PlatformPackage.Mode>(RequestUrl.getModeList, data)
		},

		/** 更新模式状态 */
		updateModeStatus(data: { id: string; status: boolean }) {
			return client.put<null>(genRequestUrl(RequestUrl.updateModeStatus, { id: data.id }), {
				status: data.status,
			})
		},

		/** 获取默认模式 */
		getDefaultMode() {
			return client.get<PlatformPackage.ModeDetail>(RequestUrl.getDefaultMode)
		},

		/** 获取模式详情 */
		getModelDetail(id: string) {
			return client.get<PlatformPackage.ModeDetail>(
				genRequestUrl(RequestUrl.getModeDetail, { id }),
			)
		},

		/** 更新模式 */
		updateMode(id: string, data: PlatformPackage.AddModeParams) {
			return client.put<PlatformPackage.ModeDetail>(
				genRequestUrl(RequestUrl.getModeDetail, { id }),
				data,
			)
		},

		/** 保存模式配置 */
		saveModeConfig(id: string, data: PlatformPackage.ModeDetail) {
			return client.put<PlatformPackage.ModeDetail>(
				genRequestUrl(RequestUrl.saveModeConfig, { id }),
				data,
			)
		},

		/** 获取所有模型列表 */
		getAllModelList(data: PlatformPackage.GetAllModelListParams) {
			return client.post<AiManage.ModelInfo[]>(RequestUrl.getAllModelList, data)
		},

		/** 获取模式原始信息 */
		getModeOriginalInfo(id: string) {
			return client.get<PlatformPackage.ModeDetail>(
				genRequestUrl(RequestUrl.getModeOriginalInfo, { id }),
			)
		},

		/** 创建分组 */
		createModeGroup(data: PlatformPackage.AddModeGroupParams) {
			return client.post<PlatformPackage.ModeGroup>(RequestUrl.createModeGroup, data)
		},

		/** 修改分组 */
		updateModeGroup(id: string, data: PlatformPackage.ModeGroup) {
			return client.put<PlatformPackage.ModeGroup>(
				genRequestUrl(RequestUrl.updateModeGroup, { id }),
				data,
			)
		},

		/** 删除分组 */
		deleteModeGroup(id: string) {
			return client.delete<null>(genRequestUrl(RequestUrl.updateModeGroup, { id }))
		},

		/** 获取员工详情 */
		getAgentDetail(code: string) {
			return client.get<PlatformPackage.Mode>(
				genRequestUrl(RequestUrl.getAgentDetail, { code }),
			)
		},

		/** 获取订单列表 */
		getOrderList(data: PlatformPackage.GetOrderListParams) {
			return client.post<WithPage<PlatformPackage.OrderList>>(RequestUrl.getOrderList, data)
		},

		/** 获取 Skill 版本列表 */
		getSkillVersionList(data: PlatformPackage.GetSkillVersionListParams) {
			return client.post<WithPage<PlatformPackage.SkillVersion>>(
				RequestUrl.getSkillVersionList,
				data,
			)
		},

		/** 获取 Skill 市场列表 */
		getSkillMarketList(data: PlatformPackage.GetSkillMarketListParams) {
			return client.post<WithPage<PlatformPackage.SkillMarketItem>>(
				RequestUrl.getSkillMarketList,
				data,
			)
		},

		/** 更新 Skill 市场信息 */
		updateSkillMarketInfo(id: string, data: PlatformPackage.UpdateSkillMarketInfoParams) {
			return client.put<null>(genRequestUrl(RequestUrl.updateSkillMarketInfo, { id }), data)
		},

		/** 获取员工审核列表 */
		getAgentVersionReviewList(data: PlatformPackage.GetAgentVersionReviewListParams) {
			return client.post<WithPage<PlatformPackage.AgentVersionReview>>(
				RequestUrl.getAgentVersionReviewList,
				data,
			)
		},

		/** 审核员工版本 */
		reviewAgentVersion(id: string, data: PlatformPackage.ReviewSkillVersionParams) {
			return client.put<null>(genRequestUrl(RequestUrl.reviewAgentVersion, { id }), data)
		},

		/** 获取员工市场列表 */
		getAgentMarketList(data: PlatformPackage.GetAgentMarketListParams) {
			return client.post<WithPage<PlatformPackage.AgentMarketItem>>(
				RequestUrl.getAgentMarketList,
				data,
			)
		},

		/** 更新员工市场信息 */
		updateAgentMarketInfo(id: string, data: PlatformPackage.UpdateAgentMarketInfoParams) {
			return client.put<null>(genRequestUrl(RequestUrl.updateAgentMarketInfo, { id }), data)
		},

		/** 审核 Skill 版本 */
		reviewSkillVersion(id: string, data: PlatformPackage.ReviewSkillVersionParams) {
			return client.put<null>(genRequestUrl(RequestUrl.reviewSkillVersion, { id }), data)
		},

		/** 获取订单商品筛选条件 */
		getOrderProduct() {
			return client.get<PlatformPackage.OrderProduct[]>(RequestUrl.getOrderProduct)
		},

		/** 获取组织积分列表 */
		getOrgPointsList(data: PlatformPackage.GetOrgPointsListParams) {
			return client.get<WithPage<PlatformPackage.OrgPointsList>>(
				genRequestUrl(RequestUrl.getOrgPointsList, {}, data),
			)
		},

		/** 获取组织积分明细 */
		getOrgPointsDetail(data: PlatformPackage.GetOrgPointsDetailParams) {
			return client.get<WithPage<PlatformPackage.OrgPointsDetail>>(
				genRequestUrl(RequestUrl.getOrgPointsDetail, {}, data),
			)
		},

		/** 添加组织积分 */
		addOrganizationPoints(data: PlatformPackage.AddOrgPointsParams) {
			return client.post<null>(RequestUrl.addOrgPoints, data)
		},

		/** 绑定套餐 */
		bindPackage(data: PlatformPackage.BindPackageParams) {
			return client.post<null>(RequestUrl.bindPackage, data)
		},

		/** 获取AI能力列表 */
		getAiPowerList(params?: PlatformPackage.GetAiPowerListParams) {
			return client.get<PlatformPackage.AiPower[]>(
				genRequestUrl(RequestUrl.getAiPowerList, {}, params),
			)
		},

		/** 获取AI能力详情 */
		getAiPowerDetail(code: string) {
			return client.get<PlatformPackage.AiPowerDetail>(
				genRequestUrl(RequestUrl.updateAiPower, { code }),
			)
		},

		/** 更改AI能力 */
		updateAiPower(data: PlatformPackage.UpdateAiPowerParams) {
			return client.put<PlatformPackage.AiPower>(
				genRequestUrl(RequestUrl.updateAiPower, { code: data.code }),
				data,
			)
		},

		/** 能力管理联通性测试 */
		testAiPowerConnection(data: { ai_ability: string; provider: string }) {
			return client.post<PlatformPackage.TestAiPowerConnection>(
				RequestUrl.testAiPowerConnection,
				data,
			)
		},

		/** 获取全局配置 */
		getGlobalConfig() {
			return client.get<PlatformPackage.GlobalConfig>(RequestUrl.getGlobalConfig)
		},

		/** 更新全局配置 */
		updateGlobalConfig(data: { is_maintenance: boolean; maintenance_description: string }) {
			return client.put(genRequestUrl(RequestUrl.getGlobalConfig), data)
		},
	}
}
