import type { AiModel } from "@admin/const/aiModel"
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

		/** 获取服务商列表 */
		getServiceProviderList(category: string) {
			return client.get<AiManage.ServiceProviderList[]>(
				genRequestUrl(RequestUrl.getServiceProviderList, {}, { category }),
			)
		},

		/** 获取服务商详细信息 */
		getServiceProviderDetail(id: string) {
			return client.get<AiManage.ServiceProviderDetail>(
				genRequestUrl(RequestUrl.getServiceProviderDetail, { id }),
			)
		},

		/** 获取服务商模型价格模板 */
		getModelPricingTemplates(
			category: AiModel.ServiceProviderCategory,
			provider_code: AiModel.ServiceProvider | string,
		) {
			return client.get<AiManage.ModelPricingTemplate[]>(
				genRequestUrl(RequestUrl.getModelPricingTemplates, {}, { category, provider_code }),
			)
		},

		/** 更新服务商信息 */
		updateServiceProviderInfo(data: AiManage.UpdateServiceProviderParams) {
			return client.put<AiManage.ServiceProviderDetail>(
				RequestUrl.getServiceProviderList,
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

		/** 删除服务商 */
		deleteServiceProvider(id: string) {
			return client.delete<null>(
				genRequestUrl(RequestUrl.getServiceProviderDetail, {
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

		/** 添加模型 */
		addModel(data: AiManage.AddModelParams) {
			return client.post<AiManage.ModelInfo>(RequestUrl.addModel, data)
		},

		/** 删除模型 */
		deleteModel(id: string) {
			return client.delete<null>(genRequestUrl(RequestUrl.deleteModel, { id }))
		},

		/** 获取模型详情 */
		getModelDetail(id: string) {
			return client.get<AiManage.ModelInfo>(genRequestUrl(RequestUrl.deleteModel, { id }))
		},

		/** 连通性测试 */
		testConnection(data: AiManage.TestConnectionParams) {
			return client.post<AiManage.TestConnectionResult>(RequestUrl.testConnection, data)
		},

		/** 获取模型标识列表 */
		getOriginalModelList() {
			return client.get<AiManage.ModelIdList[]>(RequestUrl.getOriginalModelList)
		},

		/** 删除模型标识 */
		deleteModalId(id: string) {
			return client.delete<null>(genRequestUrl(RequestUrl.deleteModalId, { id }))
		},

		/** 添加模型标识 */
		addModalId(model_id: string) {
			return client.post<null>(RequestUrl.addModalId, { model_id })
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

		/** 判断当前组织是否是官方组织 */
		isOfficialOrg() {
			return client.get<AiManage.IsOfficialOrg>(RequestUrl.isOfficialOrg)
		},
	}
}
