// import type { AxiosInstance } from "axios"
import type { DefaultOptionType } from "antd/es/select"
import type {
	GetTeamshareOrganization,
	GetTeamshareOrganizationParams,
	PageParams,
	WithPageStatus,
} from "../../types/common"
import { RequestUrl } from "../constant"
import type { CapabilityManage } from "../../types/capabilityManage"
import type { HttpClient } from "../core/HttpClient"
import { genRequestUrl } from "../utils"

export const generateCapabilityManageApi = (client: HttpClient) => {
	return {
		/* 获取天书组织架构 */
		GetTeamshareOrganization(data: GetTeamshareOrganizationParams) {
			return client.post<GetTeamshareOrganization>(RequestUrl.getTeamshareOrganization, data)
		},

		/** 获取离职人员列表 */
		getResignedUserList(data: CapabilityManage.ResignedUserListParams) {
			return client.post<WithPageStatus<CapabilityManage.ResignedUserList>>(
				RequestUrl.getResignedUserList,
				data,
			)
		},

		/* 获取审批模版列表 */
		getApprovalTemplateList(data?: CapabilityManage.ApprovalTemplateGroupParams) {
			return client.post<WithPageStatus<CapabilityManage.ApprovalTemplateGroup>>(
				RequestUrl.getApprovalTemplateList,
				data,
			)
		},

		/* 获取制定模版选项列表 */
		getApprovalTemplateOptions() {
			return client.get<DefaultOptionType[]>(RequestUrl.getApprovalTemplateOptions)
		},

		/** 审批数据查看 */
		oaApprovalData(data: CapabilityManage.OaApprovalDataParams) {
			return client.post<WithPageStatus<CapabilityManage.OaApprovalData>>(
				RequestUrl.oaApprovalData,
				data,
			)
		},

		/** 审批实例导出 */
		exportApproval(data: CapabilityManage.ExportInstanceParams) {
			return client.post<CapabilityManage.ExportInstance>(RequestUrl.exportApproval, data)
		},

		/** 审批实例附件导出 */
		exportApprovalAttachment(data: CapabilityManage.ExportInstanceParams) {
			return client.post<CapabilityManage.ExportInstance>(
				RequestUrl.exportApprovalAttachment,
				data,
			)
		},

		/** 审批实例导出 */
		exportApprovalRetry(params: { id: string }) {
			return client.put<null>(genRequestUrl(RequestUrl.exportApprovalRetry, params))
		},

		/** 审批导出列表 */
		exportApprovalList(data: CapabilityManage.ExportRecordParams) {
			return client.post<WithPageStatus<CapabilityManage.ExportRecord>>(
				RequestUrl.exportApprovalList,
				data,
			)
		},

		/** 获取待交接审批列表 */
		getTransferList(data: CapabilityManage.TransferListParams) {
			return client.post<WithPageStatus<CapabilityManage.TransferList>>(
				RequestUrl.getTransferList,
				data,
			)
		},

		/** 获取交接记录列表 */
		getTransferRecordList(data: CapabilityManage.TransferRecordListParams) {
			return client.post<WithPageStatus<CapabilityManage.TransferRecordList>>(
				RequestUrl.getTransferRecordList,
				data,
			)
		},

		/** 获取批次统计 */
		getBatchStatistics(data: CapabilityManage.BatchStatisticsParams) {
			return client.post<CapabilityManage.BatchStatistics>(
				RequestUrl.getBatchStatistics,
				data,
			)
		},

		/** 发起新交接 */
		initiateNewTransfer(data: CapabilityManage.InitiateNewTransferParams) {
			return client.post<null>(RequestUrl.initiateNewTransfer, data)
		},

		/** 审批单+批量交接 */
		approveTransfer(data: CapabilityManage.ApproveTransferParams) {
			return client.post<null>(RequestUrl.approveTransfer, data)
		},

		/** 获取文件临时链接 */
		getFileTemporaryLink(data: CapabilityManage.FileTemporaryLinkParams) {
			return client.post<CapabilityManage.File[]>(RequestUrl.getFileTemporaryLink, data)
		},

		/** 获取审批模板交接列表 */
		getTemplateTransferList(data: CapabilityManage.TemplateTransferListParams) {
			return client.post<WithPageStatus<CapabilityManage.TemplateTransferList>>(
				RequestUrl.getTemplateTransferList,
				data,
			)
		},

		/** 获取审批模板交接列表 */
		approveTemplateTransfer(data: CapabilityManage.TemplateTransferListParams) {
			return client.post<WithPageStatus<CapabilityManage.TemplateTransferList>>(
				RequestUrl.approveTemplateTransfer,
				data,
			)
		},

		/** 获取所有审批分组列表 -- 没有审批模板 */
		getAllGroupList() {
			return client.get<WithPageStatus<CapabilityManage.ApprovalTemplateGroup>>(
				genRequestUrl(RequestUrl.getAllGroupList),
			)
		},

		/** 获取审批分组列表 -- 有审批模板 */
		getTemplateGroupList(params?: CapabilityManage.GetTemplateGroupListParams) {
			return client.get<WithPageStatus<CapabilityManage.ApprovalTemplateGroup>>(
				genRequestUrl(RequestUrl.getGroupList, {}, { ...params }),
			)
		},

		/* 创建审批分组 */
		createGroup(data: CapabilityManage.TemplateGroupParams) {
			return client.post<CapabilityManage.ApprovalTemplateGroup>(RequestUrl.createGroup, data)
		},

		/* 修改审批分组 */
		updateGroup(code: string, data: CapabilityManage.TemplateGroupParams) {
			return client.put<null>(genRequestUrl(RequestUrl.updateGroup, { code }), data)
		},

		/* 删除审批分组 */
		deleteGroup(params: { code: string }) {
			return client.delete<null>(genRequestUrl(RequestUrl.updateGroup, params))
		},

		/* 审批分组排序 */
		reorderGroup(data: CapabilityManage.UpdateTemplateGroupParams) {
			return client.post<null>(RequestUrl.reorderGroup, data)
		},

		/* 删除审批模版 */
		deleteTemplate(params: { code: string }) {
			return client.delete<null>(genRequestUrl(RequestUrl.getApprovalTemplate, params))
		},

		/* 统计限时审批模版数量 */
		getTimeLimitTemplateStatistics() {
			return client.get<CapabilityManage.TimeLimitTemplateStatistics>(
				RequestUrl.getTimeLimitTemplateStatistics,
			)
		},

		/* 限时审批模板列表 */
		getTimeLimitTemplateList(params: CapabilityManage.TimeLimitTemplateListParams) {
			return client.get<WithPageStatus<CapabilityManage.TimeLimitTemplate>>(
				genRequestUrl(RequestUrl.getTimeLimitTemplateList, {}, { ...params }),
			)
		},

		/* 限时审批启/停用 */
		timeLimitTemplateStatus(code: string, data: { status: 1 | 0 }) {
			return client.put<null>(
				genRequestUrl(RequestUrl.timeLimitTemplateStatus, { code }),
				data,
			)
		},

		/* 获取规则组列表 */
		getRuleGroupList() {
			return client.get<CapabilityManage.TimeLimitTemplateDetail[]>(
				RequestUrl.getRuleGroupList,
			)
		},

		/* 创建规则组 */
		createRuleGroup(data: { name: string }) {
			return client.post<CapabilityManage.CreateRuleGroup>(RequestUrl.getRuleGroupList, data)
		},

		/* 编辑规则组 */
		editRuleGroup(code: string, data: { name: string }) {
			return client.put<CapabilityManage.CreateRuleGroup>(
				genRequestUrl(RequestUrl.editRuleGroup, { code }),
				data,
			)
		},

		/* 删除规则组 */
		deleteRuleGroup(code: string) {
			return client.delete<null>(genRequestUrl(RequestUrl.deleteRuleGroup, { code }))
		},

		/* 获取不计时时间配置 */
		getTimeLimitConfig() {
			return client.get<CapabilityManage.UnTimedConfig>(RequestUrl.timeLimitConfig)
		},

		/* 不计时时间配置 */
		updateTimeLimitConfig(data: CapabilityManage.UnTimedConfig) {
			return client.put<CapabilityManage.UnTimedConfig>(RequestUrl.timeLimitConfig, data)
		},

		/* 获取规则详情 */
		getRuleDetail(params: { code: string; id: string }) {
			return client.get<CapabilityManage.Rule>(
				genRequestUrl(RequestUrl.getRuleDetail, params),
			)
		},

		/* 创建规则 */
		createRule(params: { code: string }, data: CapabilityManage.Rule) {
			return client.post<CapabilityManage.Rule>(
				genRequestUrl(RequestUrl.createRule, params),
				data,
			)
		},

		/* 更新规则 */
		updateRule(params: { code: string; id: string }, data: CapabilityManage.Rule) {
			return client.put<null>(genRequestUrl(RequestUrl.getRuleDetail, params), data)
		},

		/* 删除规则 */
		deleteRule(params: { code: string; id: string }) {
			return client.delete<null>(genRequestUrl(RequestUrl.getRuleDetail, params))
		},

		/* 获取审批模版详情 */
		getApprovalTemplate(params: { code: string }) {
			return client.get<CapabilityManage.ApprovalTemplateDetail>(
				genRequestUrl(RequestUrl.getApprovalTemplate, params),
			)
		},

		/* 更新审批模版 */
		updateApprovalTemplate(data: CapabilityManage.SaveApprovalTemplate) {
			return client.put<null>(
				genRequestUrl(RequestUrl.getApprovalTemplate, { code: data.code }),
				data,
			)
		},

		/* 保存审批模版 */
		saveApprovalTemplate(data: CapabilityManage.SaveApprovalTemplate) {
			return client.post<null>(RequestUrl.saveApprovalTemplate, data)
		},

		/* 获取 AI 子流程列表 */
		getMagicSubFlowOptions() {
			return client.get<DefaultOptionType[]>(genRequestUrl(RequestUrl.getMagicSubFlowOptions))
		},

		/** 获取人员时效列表 */
		getUserTimeValidityList(data: CapabilityManage.PersonTimeValidityParams) {
			return client.post<WithPageStatus<CapabilityManage.PersonTimeValidityItem>>(
				genRequestUrl(RequestUrl.getUserTimeValidityList),
				data,
			)
		},

		/** 获取人员时效详情 */
		getUserTimeValidityDetail(id: string, data?: PageParams) {
			return client.post<WithPageStatus<CapabilityManage.PersonTimeValidityDetail>>(
				genRequestUrl(RequestUrl.getUserTimeValidityDetail, { id }),
				data,
			)
		},

		/** 获取审批时效列表 */
		getTemplateTimeValidityList(data: CapabilityManage.TemplateTimeValidityParams) {
			return client.post<WithPageStatus<CapabilityManage.TemplateTimeValidityItem>>(
				genRequestUrl(RequestUrl.getTemplateTimeValidityList),
				data,
			)
		},

		/** 导出人员时效列表 */
		exportUserTimeValidityList(data: CapabilityManage.PersonTimeValidityParams) {
			return client.post<null>(genRequestUrl(RequestUrl.exportUserTimeValidityList), data)
		},

		/** 导出审批时效列表 */
		exportTemplateTimeValidityList(data: CapabilityManage.TemplateTimeValidityParams) {
			return client.post<null>(RequestUrl.exportTemplateTimeValidityList, data)
		},

		/** 获取审批时效详情 */
		getTemplateTimeValidityDetail(
			code: string,
			data: CapabilityManage.TemplateTimeValidityParams,
		) {
			return client.post<WithPageStatus<CapabilityManage.TemplateTimeValidityDetail>>(
				genRequestUrl(RequestUrl.getTemplateTimeValidityDetail, { code }),
				data,
			)
		},

		/** 导出审批时效详情 */
		exportTemplateTimeValidity(
			code: string,
			data?: CapabilityManage.TemplateTimeValidityParams,
		) {
			return client.post<null>(
				genRequestUrl(RequestUrl.exportTemplateTimeValidityDetail, { code }),
				data,
			)
		},

		/** 导出人员时效详情 */
		exportUserTimeValidity(id: string, data?: CapabilityManage.PersonTimeValidityParams) {
			return client.post<null>(
				genRequestUrl(RequestUrl.exportUserTimeValidityDetail, { id }),
				data,
			)
		},

		/** 更新审批模版名称和描述 */
		updateApprovalTemplateInfo(
			code: string,
			data: Pick<CapabilityManage.UpdateApprovalTemplateInfo, "name" | "description">,
		) {
			return client.put<null>(
				genRequestUrl(RequestUrl.updateApprovalTemplateInfo, { code }),
				data,
			)
		},

		/** 更新审批模板分类 */
		updateApprovalTemplateCategory(
			code: string,
			data: Pick<CapabilityManage.UpdateApprovalTemplateInfo, "category_code">,
		) {
			return client.put<null>(
				genRequestUrl(RequestUrl.updateApprovalTemplateCategory, { code }),
				data,
			)
		},

		/** 更新审批模板可见范围 */
		updateApprovalTemplateVisibility(
			code: string,
			data: Pick<CapabilityManage.UpdateApprovalTemplateInfo, "visibility_data">,
		) {
			return client.put<null>(
				genRequestUrl(RequestUrl.updateApprovalTemplateVisibility, { code }),
				data,
			)
		},

		/** 更新审批模版启用停用状态 */
		updateApprovalTemplateStatus(
			code: string,
			data: { status: CapabilityManage.PublishStatus },
		) {
			return client.put<null>(
				genRequestUrl(RequestUrl.updateApprovalTemplateStatus, { code }),
				data,
			)
		},

		/** 获取多语言数据 */
		getApprovalTemplateMultiLangList(code: string) {
			return client.get<CapabilityManage.ApprovalTemplateMultiLang[]>(
				genRequestUrl(RequestUrl.getMultiLangData, { code }),
			)
		},

		/** 保存多语言数据 */
		saveApprovalTemplateMultiLang(code: string, data: CapabilityManage.SaveMultiLangData) {
			return client.put<null>(genRequestUrl(RequestUrl.getMultiLangData, { code }), data)
		},
	}
}
