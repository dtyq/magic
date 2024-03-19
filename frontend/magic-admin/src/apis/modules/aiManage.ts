import type { WithPage, WithPageToken } from "@/types/common"
import type { AiModel } from "@/const/aiModel"
import type { AiManage } from "../../types/aiManage"
import { RequestUrl } from "../constant"
import { genRequestUrl } from "../utils"
import type { HttpClient } from "../core/HttpClient"

export const generateAIManageApi = (client: HttpClient) => {
	return {
		/* -------- 模型管理API -------- */

		/** 获取服务提供商 */
		getServiceProvider(category: AiModel.ServiceProviderCategory) {
			return client.get<AiManage.ServiceProvider[]>(
				genRequestUrl(RequestUrl.getServiceProvider, {}, { category }),
			)
		},

		/** 非官方组织获取服务提供商 */
		getServiceProviderNonOfficial(category: AiModel.ServiceProviderCategory) {
			return client.get<AiManage.ServiceProvider[]>(
				genRequestUrl(RequestUrl.getServiceProviderNonOfficial, {}, { category }),
			)
		},

		/** 获取服务商列表 */
		getServiceProviderList(category: string) {
			return client.get<AiManage.ServiceProviderList[]>(
				genRequestUrl(RequestUrl.getServiceProviderList, {}, { category }),
			)
		},

		/** 非官方组织获取服务商列表 */
		getServiceProviderListNonOfficial(category: string) {
			return client.get<AiManage.ServiceProviderList[]>(
				genRequestUrl(RequestUrl.getServiceProviderListNonOfficial, {}, { category }),
			)
		},

		/** 获取服务商详细信息 */
		getServiceProviderDetail(id: string) {
			return client.get<AiManage.ServiceProviderDetail>(
				genRequestUrl(RequestUrl.getServiceProviderDetail, { id }),
			)
		},

		/** 非官方组织获取服务商详细信息 */
		getServiceProviderDetailNonOfficial(id: string) {
			return client.get<AiManage.ServiceProviderDetail>(
				genRequestUrl(RequestUrl.getServiceProviderDetailNonOfficial, {
					id,
				}),
			)
		},

		/** 更新服务商信息 */
		updateServiceProviderInfo(data: AiManage.UpdateServiceProviderParams) {
			return client.put<AiManage.ServiceProviderDetail>(
				RequestUrl.getServiceProviderList,
				data,
			)
		},

		/** 非官方组织更新服务商信息 */
		updateServiceProviderInfoNonOfficial(data: AiManage.UpdateServiceProviderParams) {
			return client.put<AiManage.ServiceProviderDetail>(
				RequestUrl.getServiceProviderListNonOfficial,
				data,
			)
		},

		/** 添加服务商 */
		addServiceProvider(data: AiManage.AddServiceProviderParams) {
			return client.post<AiManage.ServiceProviderDetail>(
				RequestUrl.getServiceProviderList,
				data,
			)
		},

		/** 非官方组织添加服务商 */
		addServiceProviderNonOfficial(data: AiManage.AddServiceProviderParams) {
			return client.post<AiManage.ServiceProviderDetail>(
				RequestUrl.getServiceProviderListNonOfficial,
				data,
			)
		},

		/** 删除服务商 */
		deleteServiceProvider(id: string) {
			return client.delete<null>(
				genRequestUrl(RequestUrl.getServiceProviderDetail, {
					id,
				}),
			)
		},

		/** 非官方组织删除服务商 */
		deleteServiceProviderNonOfficial(id: string) {
			return client.delete<null>(
				genRequestUrl(RequestUrl.getServiceProviderDetailNonOfficial, {
					id,
				}),
			)
		},

		/** 更新模型状态 */
		updateModelStatus(data: AiManage.UpdateModelStatusParams) {
			const { model_id, ...rest } = data
			return client.put<null>(
				genRequestUrl(RequestUrl.updateModelStatus, { id: model_id }),
				rest,
			)
		},

		/** 非官方组织更新模型状态 */
		updateModelStatusNonOfficial(data: AiManage.UpdateModelStatusParams) {
			const { model_id, ...rest } = data
			return client.put<null>(
				genRequestUrl(RequestUrl.updateModelStatusNonOfficial, { id: model_id }),
				rest,
			)
		},

		/** 添加模型 */
		addModel(data: AiManage.AddModelParams) {
			return client.post<AiManage.ModelInfo>(RequestUrl.addModel, data)
		},

		/** 非官方组织添加模型 */
		addModelNonOfficial(data: AiManage.AddModelParams) {
			return client.post<AiManage.ModelInfo>(RequestUrl.addModelNonOfficial, data)
		},

		/** 删除模型 */
		deleteModel(id: string) {
			return client.delete<null>(genRequestUrl(RequestUrl.deleteModel, { id }))
		},

		/** 非官方组织删除模型 */
		deleteModelNonOfficial(id: string) {
			return client.delete<null>(genRequestUrl(RequestUrl.deleteModelNonOfficial, { id }))
		},

		/** 获取模型详情 */
		getModelDetail(id: string) {
			return client.get<AiManage.ModelInfo>(genRequestUrl(RequestUrl.deleteModel, { id }))
		},

		/** 非官方组织获取模型详情 */
		getModelDetailNonOfficial(id: string) {
			return client.get<AiManage.ModelInfo>(
				genRequestUrl(RequestUrl.deleteModelNonOfficial, { id }),
			)
		},

		/** 连通性测试 */
		testConnection(data: AiManage.TestConnectionParams) {
			return client.post<AiManage.TestConnectionResult>(RequestUrl.testConnection, data)
		},

		/** 非官方组织连通性测试 */
		testConnectionNonOfficial(data: AiManage.TestConnectionParams) {
			return client.post<AiManage.TestConnectionResult>(
				RequestUrl.testConnectionNonOfficial,
				data,
			)
		},

		/** 获取模型标识列表 */
		getOriginalModelList() {
			return client.get<AiManage.ModelIdList[]>(RequestUrl.getOriginalModelList)
		},

		/** 非官方组织获取模型标识列表 */
		getOriginalModelListNonOfficial() {
			return client.get<AiManage.ModelIdList[]>(RequestUrl.getOriginalModelListNonOfficial)
		},

		/** 删除模型标识 */
		deleteModalId(id: string) {
			return client.delete<null>(genRequestUrl(RequestUrl.deleteModalId, { id }))
		},

		/** 非官方组织删除模型标识 */
		deleteModalIdNonOfficial(id: string) {
			return client.delete<null>(genRequestUrl(RequestUrl.deleteModalIdNonOfficial, { id }))
		},

		/** 添加模型标识 */
		addModalId(model_id: string) {
			return client.post<null>(RequestUrl.addModalId, { model_id })
		},

		/** 非官方组织添加模型标识 */
		addModalIdNonOfficial(model_id: string) {
			return client.post<null>(RequestUrl.addModalIdNonOfficial, { model_id })
		},

		/** 获取默认图标 */
		getDefaultIcon(params: { business_type: AiModel.BusinessType }) {
			return client.get<AiManage.Icon[]>(
				genRequestUrl(RequestUrl.getDefaultIcon, {}, params),
				{
					enableRequestUnion: true,
				},
			)
		},

		/** 上传文件到指定业务 */
		uploadFileToBusiness(data: AiManage.FileToBusinessParams) {
			return client.post<string>(RequestUrl.uploadFile, data)
		},

		/** 删除文件 */
		deleteFile(data: AiManage.FileToBusinessParams) {
			return client.post<null>(RequestUrl.deleteFile, data)
		},

		/** 获取官方服务商积分统计 */
		getOfficialPointsStatistics() {
			return client.get<AiManage.OfficialPointsStatistics>(
				RequestUrl.getOfficialPointsStatistics,
			)
		},

		/* -------- 功能配置API -------- */

		/** 获取企业内部助理列表 */
		getAgentList(data: AiManage.GetAgentListParams) {
			return client.post<WithPage<AiManage.Agent>>(RequestUrl.getAgentList, data)
		},

		/** 更新助理状态 */
		updateAgentStatus(data: AiManage.UpdateAgentStatusParams) {
			return client.post<null>(RequestUrl.updateAgentStatus, data)
		},

		/** 获取企业内助理创建人 */
		getAgentCreator() {
			return client.get<Record<string, string>>(RequestUrl.getAgentCreator)
		},

		/** 保存助理 */
		saveAgent(data: AiManage.SaveAgentParams) {
			return client.post<AiManage.Agent>(RequestUrl.saveAgent, data)
		},

		/** 判断当前组织是否是官方组织 */
		isOfficialOrg() {
			return client.get<AiManage.IsOfficialOrg>(RequestUrl.isOfficialOrg)
		},

		/* 获取助理全局设置 */
		getAgentGlobalSetting() {
			return client.get<AiManage.AgentGlobalSetting>(RequestUrl.agentGlobalSettings)
		},

		/* 设置助理全局设置 */
		setAgentGlobalSetting(data: AiManage.AgentGlobalSetting) {
			return client.put<null>(RequestUrl.agentGlobalSettings, data)
		},

		/* 获取发布助理列表 */
		getPublishList(data: AiManage.GetPublishListParams) {
			return client.get<WithPageToken<AiManage.PublishAgentList>>(
				genRequestUrl(RequestUrl.getPublishList, {}, { ...data }),
			)
		},

		/* 获取组织当前订阅的套餐 */
		getSubscriptionInfo() {
			return client.get<AiManage.SubscriptionInfo>(RequestUrl.getSubscriptionInfo)
		},

		/* -------- 管控策略API -------- */

		/* 获取积分组织管控规则列表 */
		getControlRuleList() {
			return client.get<AiManage.ControlRule>(RequestUrl.getOrgControlRule)
		},

		/* 保存积分组织管控规则 */
		saveControlRule(data: AiManage.SaveControlRuleParams) {
			return client.post<null>(RequestUrl.getOrgControlRule, data)
		},

		/* 查询管控目标已用积分 */
		getControlTargetUsedPoints(data: AiManage.GetControlTargetUsedPointsParams) {
			return client.post<{ [key: string]: number }>(
				RequestUrl.getControlTargetUsedPoints,
				data,
			)
		},

		/* 获取商品列表并携带sku */
		getProductListWithSku(params: AiManage.GetProductListWithSkuParams) {
			return client.get<AiManage.ProductListWithSku>(
				genRequestUrl(RequestUrl.getProductListWithSku, {}, { ...params }),
			)
		},
	}
}
