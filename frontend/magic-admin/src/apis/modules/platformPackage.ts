import type { WithPage } from "@/types/common"
import type { AiManage } from "@/types/aiManage"
import type { PlatformPackage } from "@/types/platformPackage"
import { RequestUrl } from "../constant"
import { genRequestUrl } from "../utils"
import type { HttpClient } from "../core/HttpClient"

export const generatePlatformPackageApi = (client: HttpClient) => {
	return {
		/** 获取套餐列表 */
		getPackageList() {
			return client.get<WithPage<PlatformPackage.Package>>(RequestUrl.getPackageList)
		},

		/** 更新套餐状态 */
		updatePackageStatus(id: string, data: { status: boolean }) {
			return client.put<null>(genRequestUrl(RequestUrl.updatePackageStatus, { id }), data)
		},

		/* 获取套餐下可用的模型 */
		getPackageAvailableModels(id: string) {
			return client.get<PlatformPackage.PackageAvailableModels>(
				genRequestUrl(RequestUrl.getPackageAvailableModels, { id }),
			)
		},

		/** 获取套餐详情 */
		getPackageDetail(id: string) {
			return client.get<PlatformPackage.PackageDetail>(
				genRequestUrl(RequestUrl.getPackageDetail, { id }),
			)
		},

		/** 更新套餐信息 */
		updatePackageInfo(id: string, data: PlatformPackage.PackageDetail) {
			return client.put<PlatformPackage.PackageDetail>(
				genRequestUrl(RequestUrl.getPackageDetail, { id }),
				data,
			)
		},

		/** 添加套餐 */
		addPackage(data: PlatformPackage.PackageDetail) {
			return client.post<PlatformPackage.PackageDetail>(RequestUrl.addPackage, data)
		},

		/** 删除套餐 */
		deletePackage(id: string) {
			return client.delete<null>(genRequestUrl(RequestUrl.getPackageDetail, { id }))
		},

		/** 获取套餐常量可选项 */
		getPackageConstantOptions() {
			return client.get<PlatformPackage.PackageConstantOptions>(RequestUrl.getPackageOptions)
		},

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

		/** 获取代理列表 */
		getProxyServerList(data: PlatformPackage.GetProxyServerListParams) {
			return client.get<WithPage<PlatformPackage.ProxyServer>>(
				genRequestUrl(RequestUrl.getProxyServerList, {}, data),
			)
		},

		/** 获取单个可用代理 */
		getAvailableProxy(id: string) {
			return client.get<PlatformPackage.ProxyServer>(
				genRequestUrl(RequestUrl.getAvailableProxy, { id }),
			)
		},

		/** 创建代理 */
		createProxy(data: PlatformPackage.CreateOrUpdateProxyParams) {
			return client.post<PlatformPackage.ProxyServer>(RequestUrl.createProxy, data)
		},

		/** 更新代理 */
		updateProxy(id: string, data: PlatformPackage.CreateOrUpdateProxyParams) {
			return client.put<PlatformPackage.ProxyServer>(
				genRequestUrl(RequestUrl.updateProxy, { id }),
				data,
			)
		},

		/** 删除代理 */
		deleteProxy(id: string) {
			return client.delete<null>(genRequestUrl(RequestUrl.updateProxy, { id }))
		},

		/** 启停用代理 */
		updateProxyStatus(id: string, data: { status: 0 | 1 }) {
			return client.put<null>(genRequestUrl(RequestUrl.updateProxyStatus, { id }), data)
		},

		/** 测试代理连通性 */
		testProxyConnection(id: string) {
			return client.post<PlatformPackage.TestProxyConnection>(
				genRequestUrl(RequestUrl.testProxyConnection, { id }),
			)
		},

		/** 获取所有代理配置（仅ID和名称） */
		getAllProxyList() {
			return client.get<Pick<PlatformPackage.ProxyServer, "id" | "name">[]>(
				RequestUrl.getAllProxyList,
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

		/* ========== 组织管理相关接口 ========== */
		/** 获取组织列表 */
		getOrgList(params: PlatformPackage.GetOrgListParams) {
			return client.get<WithPage<PlatformPackage.Organization>>(
				genRequestUrl(RequestUrl.getOrgList, {}, params),
			)
		},

		/** 创建组织 */
		createOrganization(data: PlatformPackage.CreateOrganizationParams) {
			return client.post(genRequestUrl(RequestUrl.createOrganization), data)
		},

		/** 获取组织信息 */
		getOrganizationInfo(code: string) {
			return client.get<PlatformPackage.OrganizationInfo>(
				genRequestUrl(
					RequestUrl.getOrganizationInfo,
					{},
					{ magic_organization_code: code },
				),
			)
		},

		/** 更新组织信息 */
		updateOrganizationInfo(data: PlatformPackage.OrganizationInfo) {
			return client.put(
				genRequestUrl(
					RequestUrl.getOrganizationInfo,
					{},
					{
						magic_organization_code: data.magic_organization_code,
					},
				),
				data,
			)
		},
	}
}
