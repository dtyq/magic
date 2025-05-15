import { genRequestUrl } from "@/utils/http"
import { RequestUrl } from "../constant"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type {
	ApiKey,
	ApiKeyRequestParams,
	FlowDraft,
	FlowTool,
	GetFlowListParams,
	LLMModalOption,
	NodeTestingResult,
	PlatformItem,
	SubFlowArgument,
	TestNodeParams,
	TestResult,
	TriggerConfig,
	UseableToolSet,
	WithPage,
	Flow,
} from "@/types/flow"
import { FlowType } from "@/types/flow"
import type { File, Sheet } from "@/types/sheet"
import type { Knowledge } from "@/types/knowledge"
import type { MethodOption } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import type { HttpClient } from "../core/HttpClient"

export const generateFlowApi = (fetch: HttpClient) => ({
	/**
	 * 查询流程列表
	 */
	getFlowList({ type = FlowType.Main, page = 1, pageSize = 100, name }: GetFlowListParams) {
		return fetch.post<WithPage<MagicFlow.Flow[]>>(genRequestUrl(RequestUrl.getFlowList), {
			type,
			page,
			page_size: pageSize,
			name,
		})
	},

	/**
	 * 查询流程详情
	 */
	getFlow(flowId: string) {
		return fetch.get<MagicFlow.Flow>(genRequestUrl(RequestUrl.getFlow, { flowId }))
	},

	/**
	 * 流程试运行
	 */
	testFlow(flow: MagicFlow.Flow & { trigger_config: TriggerConfig }) {
		return fetch.post<TestResult>(
			genRequestUrl(RequestUrl.testFlow, { flowId: flow.id! }),
			flow,
		)
	},

	/**
	 * 新增或修改流程基本信息
	 */
	addOrUpdateFlowBaseInfo(flow: Partial<MagicFlow.Flow> & { type?: FlowType }) {
		return fetch.post<MagicFlow.Flow>(genRequestUrl(RequestUrl.addOrUpdateFlowBaseInfo), flow)
	},

	/**
	 * 删除流程
	 */
	deleteFlow(flowId: string) {
		return fetch.delete<null>(genRequestUrl(RequestUrl.deleteFlow, { flowId }))
	},

	/**
	 * 保存流程详情
	 */
	saveFlow(flow: MagicFlow.Flow) {
		return fetch.post<null>(genRequestUrl(RequestUrl.saveFlow, { flowId: flow.id! }), flow)
	},

	/**
	 * 保存流程为草稿
	 */
	saveFlowDraft(draftDetail: FlowDraft.RequestArgs, flowId: string) {
		return fetch.post<FlowDraft.Detail>(
			genRequestUrl(RequestUrl.saveFlowDraft, { flowId }),
			draftDetail,
		)
	},

	/**
	 * 查询流程草稿列表
	 */
	getFlowDraftList(flowId: string) {
		return fetch.post<WithPage<FlowDraft.ListItem[]>>(
			genRequestUrl(RequestUrl.getFlowDraftList, { flowId }),
		)
	},

	/**
	 * 查询流程草稿详情
	 */
	getFlowDraftDetail(flowId: string, draftId: string) {
		return fetch.get<FlowDraft.Detail>(
			genRequestUrl(RequestUrl.getFlowDratDetail, { flowId, draftId }),
		)
	},

	/**
	 * 删除流程草稿
	 */
	deleteFlowDraft(flowId: string, draftId: string) {
		return fetch.delete<FlowDraft.Detail>(
			genRequestUrl(RequestUrl.deleteFlowDraft, { flowId, draftId }),
		)
	},

	/**
	 * 查询流程版本列表
	 */
	getFlowPublishList(flowId: string, page = 1, pageSize = 200) {
		return fetch.post<WithPage<FlowDraft.ListItem[]>>(
			genRequestUrl(RequestUrl.getFlowPublishList, { flowId, page, pageSize }),
		)
	},

	/**
	 * 查询流程版本详情
	 */
	getFlowPublishDetail(flowId: string, versionId: string) {
		return fetch.get<FlowDraft.Detail>(
			genRequestUrl(RequestUrl.getFlowPublishDetail, { flowId, versionId }),
		)
	},

	/**
	 * 发布流程版本
	 */
	publishFlow(publishDetail: FlowDraft.RequestArgs, flowId: string) {
		return fetch.post<FlowDraft.Detail>(
			genRequestUrl(RequestUrl.publishFlow, { flowId }),
			publishDetail,
		)
	},

	/**
	 * 回滚流程版本
	 */
	restoreFlow(flowId: string, versionId: string) {
		return fetch.post<null>(genRequestUrl(RequestUrl.restoreFlow, { flowId, versionId }))
	},

	/**
	 * 修改流程启用状态
	 */
	changeEnableStatus(id: string) {
		return fetch.post<null>(genRequestUrl(RequestUrl.changeEnableStatus, { flowId: id }))
	},

	/**
	 * 单点调试
	 */
	testNode(params: TestNodeParams) {
		return fetch.post<NodeTestingResult>(genRequestUrl(RequestUrl.testNode), params)
	},

	/**
	 * 获取可用 LLM 模型
	 */
	getLLMModal() {
		return fetch.get<{ models: LLMModalOption[] }>(genRequestUrl(RequestUrl.getLLMModal))
	},

	/**
	 * 给指定工作流添加开放平台应用
	 */
	bindOpenApiAccount(flowId: string, openPlatformAppIds: string[]) {
		return fetch.post(genRequestUrl(RequestUrl.bindOpenApiAccount, { flowId }), {
			open_platform_app_ids: openPlatformAppIds,
		})
	},

	/**
	 * 移除指定工作流的开放平台应用
	 */
	removeOpenApiAccount(flowId: string, openPlatformAppIds: string[]) {
		return fetch.delete(genRequestUrl(RequestUrl.removeOpenApiAccount, { flowId }), {
			open_platform_app_ids: openPlatformAppIds,
		})
	},

	/**
	 * 获取指定工作流绑定的开放平台应用列表
	 */
	getOpenApiAccountList(flowId: string, page = 1, pageSize = 100) {
		return fetch.post<WithPage<PlatformItem[]>>(
			genRequestUrl(RequestUrl.getOpenApiAccountList, { flowId }),
			{
				page,
				page_size: pageSize,
			},
		)
	},

	/**
	 * 获取我的开放平台应用列表
	 */
	getOpenPlatformOfMine(page = 1, pageSize = 100) {
		return fetch.post<WithPage<PlatformItem[]>>(
			genRequestUrl(RequestUrl.getOpenPlatformOfMine),
			{
				page,
				page_size: pageSize,
			},
		)
	},

	/**
	 * 获取子流程参数
	 */
	getSubFlowArguments(flowId: string) {
		return fetch.get<SubFlowArgument>(genRequestUrl(RequestUrl.getSubFlowArgument, { flowId }))
	},

	/**
	 * 保存 API Key
	 */
	saveApiKey(params: ApiKeyRequestParams, flowId: string) {
		return fetch.post<ApiKey>(genRequestUrl(RequestUrl.saveApiKey, { flowId }), params)
	},

	/**
	 * 获取 API Key 列表
	 */
	getApiKeyList(flowId: string, page = 1, pageSize = 100) {
		return fetch.post<WithPage<ApiKey[]>>(genRequestUrl(RequestUrl.getApiKeyList, { flowId }), {
			page,
			page_size: pageSize,
		})
	},

	/**
	 * 获取 API Key 详情
	 */
	getApiKeyDetail(id: string, flowId: string) {
		return fetch.get<ApiKey>(genRequestUrl(RequestUrl.getApiKeyDetail, { id, flowId }))
	},

	/**
	 * 删除 API Key
	 */
	deleteApiKey(id: string, flowId: string) {
		return fetch.delete<null>(genRequestUrl(RequestUrl.deleteApiKey, { id, flowId }))
	},

	/**
	 * 重建 API Key
	 */
	rebuildApiKey(id: string, flowId: string) {
		return fetch.post<ApiKey>(genRequestUrl(RequestUrl.rebuildApiKey, { id, flowId }))
	},

	/**
	 * 获取表格列表
	 */
	getSheets(fileId: string) {
		return fetch.get<{ sheets: Record<string, Sheet.Detail> }>(
			genRequestUrl(RequestUrl.getSheets, { fileId }),
		)
	},

	/**
	 * 获取文件列表
	 */
	getFiles(params: File.RequestParams) {
		return fetch.post<WithPage<File.Detail[]>>(genRequestUrl(RequestUrl.getFiles), params)
	},

	/**
	 * 获取文件详情
	 */
	getFile(fileId: string) {
		return fetch.get<File.Detail>(genRequestUrl(RequestUrl.getFile, { fileId }))
	},

	/**
	 * 获取工具列表
	 */
	getToolList({ page = 1, pageSize = 10, name }: FlowTool.GetToolListParams) {
		return fetch.post<WithPage<MagicFlow.Flow[]>>(genRequestUrl(RequestUrl.getToolList), {
			page,
			page_size: pageSize,
			name,
		})
	},

	/**
	 * 获取可用工具列表
	 */
	getUseableToolList() {
		return fetch.post<WithPage<UseableToolSet.Item[]>>(
			genRequestUrl(RequestUrl.getUseableToolList),
		)
	},

	/**
	 * 获取可用数据库列表
	 */
	getUseableDatabaseList() {
		return fetch.post<WithPage<Knowledge.KnowledgeItem[]>>(
			genRequestUrl(RequestUrl.getUseableDatabaseList),
		)
	},

	/**
	 * 获取工具详情
	 */
	getToolDetail(id: string) {
		return fetch.get<FlowTool.Detail>(genRequestUrl(RequestUrl.getTool, { id }))
	},

	/**
	 * 删除工具
	 */
	deleteTool(id: string) {
		return fetch.delete<null>(genRequestUrl(RequestUrl.deleteTool, { id }))
	},

	/**
	 * 保存工具
	 */
	saveTool(params: FlowTool.SaveToolParams) {
		return fetch.post<FlowTool.Detail>(genRequestUrl(RequestUrl.saveTool), params)
	},

	/**
	 * 获取可用工具
	 */
	getAvailableTools(toolIds: string[]) {
		return fetch.post<WithPage<MagicFlow.Flow[]>>(genRequestUrl(RequestUrl.getAvailableTools), {
			codes: toolIds,
		})
	},

	/**
	 * 获取方法数据源
	 */
	getMethodsDataSource() {
		return fetch.post<{
			expression_data_source: MethodOption[]
		}>(genRequestUrl(RequestUrl.getMethodsDataSource))
	},

	/**
	 * 获取视觉模型
	 */
	getVisionModels(category: string = "vlm") {
		return fetch.post<Flow.VLMProvider[]>(genRequestUrl(RequestUrl.getVisionModels), {
			category,
		})
	},

	/** Api Key 调用工具或流程 */
	callToolOrFlow(apiKey: string, params: object) {
		return fetch.post<any>(genRequestUrl(RequestUrl.callToolOrFlow), {
			params,
			headers: {
				"api-key": apiKey,
			},
		})
	},

	/** 调用Agent进行对话 */
	callAgent(apiKey: string, params: { message: string; conversation_id: string }) {
		return fetch.post<any>(genRequestUrl(RequestUrl.callAgent), {
			params,
			headers: {
				"api-key": apiKey,
			},
		})
	},

	/**
	 * 获取节点模板
	 */
	getNodeTemplate(nodeType: string) {
		return fetch.post<MagicFlow.Node>(genRequestUrl(RequestUrl.getNodeTemplate), {
			params: {},
			node_type: nodeType,
            node_version: "latest"
		})
	},
})
