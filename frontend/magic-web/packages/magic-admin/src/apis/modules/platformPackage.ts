import type { WithPage } from "@admin/types/common"
import type { AiManage } from "@admin/types/aiManage"
import type { PlatformPackage } from "@admin/types/platformPackage"
import { RequestUrl } from "../constant"
import { genRequestUrl } from "../utils"
import type { HttpClient } from "../core/HttpClient"

export const generatePlatformPackageApi = (client: HttpClient) => {
	return {
		// ========== 模式管理相关接口 ==========
		getModeList(params: PlatformPackage.ModeListParams) {
			return client.get<WithPage<PlatformPackage.Mode>>(
				genRequestUrl(RequestUrl.getModeList, {}, params),
			)
		},

		addMode(data: PlatformPackage.AddModeParams) {
			return client.post<PlatformPackage.Mode>(RequestUrl.getModeList, data)
		},

		updateModeStatus(data: { id: string; status: boolean }) {
			return client.put<null>(genRequestUrl(RequestUrl.updateModeStatus, { id: data.id }), {
				status: data.status,
			})
		},

		getDefaultMode() {
			return client.get<PlatformPackage.ModeDetail>(RequestUrl.getDefaultMode)
		},

		getModelDetail(id: string) {
			return client.get<PlatformPackage.ModeDetail>(
				genRequestUrl(RequestUrl.getModeDetail, { id }),
			)
		},

		updateMode(id: string, data: PlatformPackage.AddModeParams) {
			return client.put<PlatformPackage.ModeDetail>(
				genRequestUrl(RequestUrl.getModeDetail, { id }),
				data,
			)
		},

		saveModeConfig(id: string, data: PlatformPackage.ModeDetail) {
			return client.put<PlatformPackage.ModeDetail>(
				genRequestUrl(RequestUrl.saveModeConfig, { id }),
				data,
			)
		},

		getAllModelList(data: PlatformPackage.GetAllModelListParams) {
			return client.post<AiManage.ModelInfo[]>(RequestUrl.getAllModelList, data)
		},

		getModeOriginalInfo(id: string) {
			return client.get<PlatformPackage.ModeDetail>(
				genRequestUrl(RequestUrl.getModeOriginalInfo, { id }),
			)
		},

		createModeGroup(data: PlatformPackage.AddModeGroupParams) {
			return client.post<PlatformPackage.ModeGroup>(RequestUrl.createModeGroup, data)
		},

		updateModeGroup(id: string, data: PlatformPackage.ModeGroup) {
			return client.put<PlatformPackage.ModeGroup>(
				genRequestUrl(RequestUrl.updateModeGroup, { id }),
				data,
			)
		},

		deleteModeGroup(id: string) {
			return client.delete<null>(genRequestUrl(RequestUrl.updateModeGroup, { id }))
		},

		getAgentDetail(code: string) {
			return client.get<PlatformPackage.Mode>(
				genRequestUrl(RequestUrl.getAgentDetail, { code }),
			)
		},

		// ========== skill及员工相关接口 ==========
		getSkillVersionList(data: PlatformPackage.GetSkillVersionListParams) {
			return client.post<WithPage<PlatformPackage.SkillVersion>>(
				RequestUrl.getSkillVersionList,
				data,
			)
		},

		getSkillMarketList(data: PlatformPackage.GetSkillMarketListParams) {
			return client.post<WithPage<PlatformPackage.SkillMarketItem>>(
				RequestUrl.getSkillMarketList,
				data,
			)
		},

		updateSkillMarketInfo(id: string, data: PlatformPackage.UpdateSkillMarketInfoParams) {
			return client.put<null>(genRequestUrl(RequestUrl.updateSkillMarketInfo, { id }), data)
		},

		getAgentVersionReviewList(data: PlatformPackage.GetAgentVersionReviewListParams) {
			return client.post<WithPage<PlatformPackage.AgentVersionReview>>(
				RequestUrl.getAgentVersionReviewList,
				data,
			)
		},

		reviewAgentVersion(id: string, data: PlatformPackage.ReviewSkillVersionParams) {
			return client.put<null>(genRequestUrl(RequestUrl.reviewAgentVersion, { id }), data)
		},

		getAgentMarketList(data: PlatformPackage.GetAgentMarketListParams) {
			return client.post<WithPage<PlatformPackage.AgentMarketItem>>(
				RequestUrl.getAgentMarketList,
				data,
			)
		},

		updateAgentMarketInfo(id: string, data: PlatformPackage.UpdateAgentMarketInfoParams) {
			return client.put<null>(genRequestUrl(RequestUrl.updateAgentMarketInfo, { id }), data)
		},

		reviewSkillVersion(id: string, data: PlatformPackage.ReviewSkillVersionParams) {
			return client.put<null>(genRequestUrl(RequestUrl.reviewSkillVersion, { id }), data)
		},

		// ========== 能力管理相关接口 ==========
		getAiPowerList(params?: PlatformPackage.GetAiPowerListParams) {
			return client.get<PlatformPackage.AiPower[]>(
				genRequestUrl(RequestUrl.getAiPowerList, {}, params),
			)
		},

		getAiPowerDetail(code: string) {
			return client.get<PlatformPackage.AiPowerDetail>(
				genRequestUrl(RequestUrl.updateAiPower, { code }),
			)
		},

		updateAiPower(data: PlatformPackage.UpdateAiPowerParams) {
			return client.put<PlatformPackage.AiPower>(
				genRequestUrl(RequestUrl.updateAiPower, { code: data.code }),
				data,
			)
		},

		testAiPowerConnection(data: { ai_ability: string; provider: string }) {
			return client.post<PlatformPackage.TestAiPowerConnection>(
				RequestUrl.testAiPowerConnection,
				data,
			)
		},

		getGlobalConfig() {
			return client.get<PlatformPackage.GlobalConfig>(RequestUrl.getGlobalConfig)
		},

		updateGlobalConfig(data: { is_maintenance: boolean; maintenance_description: string }) {
			return client.put(genRequestUrl(RequestUrl.getGlobalConfig), data)
		},
	}
}
