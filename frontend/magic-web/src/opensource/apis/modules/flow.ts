import { genRequestUrl } from "@/opensource/utils/http"

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
	GetAvailableMCPListResponse,
} from "@/opensource/types/flow"
import { FlowType } from "@/opensource/types/flow"
import type { File, Sheet } from "@/opensource/types/sheet"
import type { Knowledge } from "@/opensource/types/knowledge"
import type { MethodOption } from "@dtyq/magic-flow/dist/MagicExpressionWidget/types"
import type { HttpClient } from "../core/HttpClient"
import type { MCPOAuthStatus } from "@/opensource/components/Agent/MCP/service/MCPOAuthService"
import type { IMCPItem } from "@/opensource/components/Agent/MCP"

export const generateFlowApi = (fetch: HttpClient) => ({
	/**
	 * 查询流程列表
	 */
	getFlowList({ type = FlowType.Main, page = 1, pageSize = 100, name }: GetFlowListParams) {
		return fetch.post<WithPage<MagicFlow.Flow[]>>(
			genRequestUrl("/api/v1/flows/queries"),
			{
				type,
				page,
				page_size: pageSize,
				name,
			},
			{
				enableRequestUnion: true,
			},
		)
	},

	/**
	 * 查询流程详情
	 */
	getFlow(flowId: string) {
		return fetch.get<MagicFlow.Flow>(genRequestUrl("/api/v1/flows/${flowId}", { flowId }))
	},

	/**
	 * 流程试运行
	 */
	testFlow(flow: MagicFlow.Flow & { trigger_config: TriggerConfig }) {
		return fetch.post<TestResult>(
			genRequestUrl("/api/v1/flows/${flowId}/flow-debug", { flowId: flow.id! }),
			flow,
		)
	},

	/**
	 * 新增或修改流程基本信息
	 */
	addOrUpdateFlowBaseInfo(flow: Partial<MagicFlow.Flow> & { type?: FlowType }) {
		return fetch.post<MagicFlow.Flow>(genRequestUrl("/api/v1/flows"), flow)
	},

	/**
	 * 删除流程
	 */
	deleteFlow(flowId: string) {
		return fetch.delete<null>(genRequestUrl("/api/v1/flows/${flowId}", { flowId }))
	},

	/**
	 * 保存流程详情
	 */
	saveFlow(flow: MagicFlow.Flow) {
		return fetch.post<null>(
			genRequestUrl("/api/v1/flows/${flowId}/save-node", { flowId: flow.id! }),
			flow,
		)
	},

	/**
	 * 保存流程为草稿
	 */
	saveFlowDraft(draftDetail: FlowDraft.RequestArgs, flowId: string) {
		return fetch.post<FlowDraft.Detail>(
			genRequestUrl("/api/v1/flows/${flowId}/draft", { flowId }),
			draftDetail,
		)
	},

	/**
	 * 查询流程草稿列表
	 */
	getFlowDraftList(flowId: string) {
		return fetch.post<WithPage<FlowDraft.ListItem[]>>(
			genRequestUrl("/api/v1/flows/${flowId}/draft/queries", { flowId }),
		)
	},

	/**
	 * 查询流程草稿详情
	 */
	getFlowDraftDetail(flowId: string, draftId: string) {
		return fetch.get<FlowDraft.Detail>(
			genRequestUrl("/api/v1/flows/${flowId}/draft/${draftId}", { flowId, draftId }),
		)
	},

	/**
	 * 删除流程草稿
	 */
	deleteFlowDraft(flowId: string, draftId: string) {
		return fetch.delete<FlowDraft.Detail>(
			genRequestUrl("/api/v1/flows/${flowId}/draft/${draftId}", { flowId, draftId }),
		)
	},

	/**
	 * 查询流程版本列表
	 */
	getFlowPublishList(flowId: string, page = 1, pageSize = 200) {
		return fetch.post<WithPage<FlowDraft.ListItem[]>>(
			genRequestUrl(
				"/api/v1/flows/${flowId}/version/queries?page=${page}&page_size=${pageSize}",
				{ flowId, page, pageSize },
			),
		)
	},

	/**
	 * 查询流程版本详情
	 */
	getFlowPublishDetail(flowId: string, versionId: string) {
		return fetch.get<FlowDraft.Detail>(
			genRequestUrl("/api/v1/flows/${flowId}/version/${versionId}", { flowId, versionId }),
		)
	},

	/**
	 * 发布流程版本
	 */
	publishFlow(publishDetail: FlowDraft.RequestArgs, flowId: string) {
		return fetch.post<FlowDraft.Detail>(
			genRequestUrl("/api/v1/flows/${flowId}/version/publish", { flowId }),
			publishDetail,
		)
	},

	/**
	 * 回滚流程版本
	 */
	restoreFlow(flowId: string, versionId: string) {
		return fetch.post<null>(
			genRequestUrl("/api/v1/flows/${flowId}/version/${versionId}/rollback", {
				flowId,
				versionId,
			}),
		)
	},

	/**
	 * 修改流程启用状态
	 */
	changeEnableStatus(id: string) {
		return fetch.post<null>(
			genRequestUrl("/api/v1/flows/${flowId}/change-enable", { flowId: id }),
		)
	},

	/**
	 * 单点调试
	 */
	testNode(params: TestNodeParams) {
		return fetch.post<NodeTestingResult>(genRequestUrl("/api/v1/flows/node-debug"), params)
	},

	/**
	 * 获取可用 LLM 模型
	 */
	getLLMModal() {
		return fetch.get<{ models: LLMModalOption[] }>(genRequestUrl("/api/v1/flows/models"))
	},

	/**
	 * 给指定工作流添加开放平台应用
	 */
	bindOpenApiAccount(flowId: string, openPlatformAppIds: string[]) {
		return fetch.post(genRequestUrl("/api/v1/flows/${flowId}/open-platform/apps", { flowId }), {
			open_platform_app_ids: openPlatformAppIds,
		})
	},

	/**
	 * 移除指定工作流的开放平台应用
	 */
	removeOpenApiAccount(flowId: string, openPlatformAppIds: string[]) {
		return fetch.delete(
			genRequestUrl("/api/v1/flows/${flowId}/open-platform/apps", { flowId }),
			{
				open_platform_app_ids: openPlatformAppIds,
			},
		)
	},

	/**
	 * 获取指定工作流绑定的开放平台应用列表
	 */
	getOpenApiAccountList(flowId: string, page = 1, pageSize = 100) {
		return fetch.post<WithPage<PlatformItem[]>>(
			genRequestUrl("/api/v1/flows/${flowId}/open-platform/apps/queries", { flowId }),
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
			genRequestUrl("/api/v1/flows/open-platform/applications"),
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
		return fetch.get<SubFlowArgument>(
			genRequestUrl("/api/v1/flows/${flowId}/params", { flowId }),
		)
	},

	/**
	 * 保存 API Key
	 */
	saveApiKey(params: ApiKeyRequestParams, flowId: string) {
		return fetch.post<ApiKey>(
			genRequestUrl("/api/v1/flows/${flowId}/api-key", { flowId }),
			params,
		)
	},

	/**
	 * 获取 API Key 列表
	 */
	getApiKeyList(flowId: string, page = 1, pageSize = 100) {
		return fetch.post<WithPage<ApiKey[]>>(
			genRequestUrl("/api/v1/flows/${flowId}/api-key/queries", { flowId }),
			{
				page,
				page_size: pageSize,
			},
		)
	},

	/**
	 * 获取 API Key 详情
	 */
	getApiKeyDetail(id: string, flowId: string) {
		return fetch.get<ApiKey>(
			genRequestUrl("/api/v1/flows/${flowId}/api-key/${id}", { id, flowId }),
		)
	},

	/**
	 * 删除 API Key
	 */
	deleteApiKey(id: string, flowId: string) {
		return fetch.delete<null>(
			genRequestUrl("/api/v1/flows/${flowId}/api-key/${id}", { id, flowId }),
		)
	},

	/**
	 * 重建 API Key
	 */
	rebuildApiKey(id: string, flowId: string) {
		return fetch.post<ApiKey>(
			genRequestUrl("/api/v1/flows/${flowId}/api-key/${id}/rebuild", { id, flowId }),
		)
	},

	/**
	 * 保存 API Key v1
	 */
	saveApiKeyV1(params: Flow.ApiKeyRequestParamsV1) {
		return fetch.post<ApiKey>(genRequestUrl("/api/v1/authentication/api-key"), params)
	},

	/**
	 * 获取 API Key v1 列表
	 */
	getApiKeyListV1(params: Pick<Flow.ApiKeyRequestParamsV1, "rel_type" | "rel_code">) {
		return fetch.post<WithPage<ApiKey[]>>(
			genRequestUrl("/api/v1/authentication/api-key/queries"),
			params,
		)
	},

	/**
	 * 获取 API Key v1 详情
	 */
	getApiKeyDetailV1(code: string) {
		return fetch.get<ApiKey>(genRequestUrl("/api/v1/authentication/api-key/${code}", { code }))
	},

	/**
	 * 删除 API Key v1
	 */
	deleteApiKeyV1(code: string) {
		return fetch.delete<null>(genRequestUrl("/api/v1/authentication/api-key/${code}", { code }))
	},

	/**
	 * 重建 API Key v1
	 */
	rebuildApiKeyV1(code: string) {
		return fetch.post<ApiKey>(
			genRequestUrl("/api/v1/authentication/api-key/${code}/rebuild", { code }),
		)
	},

	/**
	 * 获取表格列表
	 */
	getSheets(fileId: string) {
		return fetch.get<{ sheets: Record<string, Sheet.Detail> }>(
			genRequestUrl("/api/v1/teamshare/multi-table/${fileId}/sheets", { fileId }),
		)
	},

	/**
	 * 获取文件列表
	 */
	getFiles(params: File.RequestParams) {
		return fetch.post<WithPage<File.Detail[]>>(
			genRequestUrl("/api/v1/teamshare/multi-table/file/queries"),
			params,
		)
	},

	/**
	 * 获取文件详情
	 */
	getFile(fileId: string) {
		return fetch.get<File.Detail>(
			genRequestUrl("/api/v1/teamshare/multi-table/${fileId}", { fileId }),
		)
	},

	/**
	 * 获取工具列表
	 */
	getToolList({ page = 1, pageSize = 10, name }: FlowTool.GetToolListParams) {
		return fetch.post<WithPage<MagicFlow.Flow[]>>(
			genRequestUrl("/api/v1/flows/tool-set/queries"),
			{
				page,
				page_size: pageSize,
				name,
			},
		)
	},

	/**
	 * 获取可用工具列表
	 */
	getUseableToolList(body?: { with_builtin?: boolean }) {
		return fetch.post<WithPage<UseableToolSet.Item[]>>(
			genRequestUrl("/api/v1/flows/queries/tool-sets"),
			body,
		)
	},

	/**
	 * 获取可用数据库列表
	 */
	getUseableDatabaseList() {
		return fetch.post<WithPage<Knowledge.KnowledgeItem[]>>(
			genRequestUrl("/api/v1/flows/queries/knowledge"),
		)
	},

	/**
	 * 获取工具详情
	 */
	getToolDetail(id: string) {
		return fetch.get<FlowTool.Detail>(genRequestUrl("/api/v1/flows/tool-set/${id}", { id }))
	},

	/**
	 * 删除工具
	 */
	deleteTool(id: string) {
		return fetch.delete<null>(genRequestUrl("/api/v1/flows/tool-set/${id}", { id }))
	},

	/**
	 * 保存工具
	 */
	saveTool(params: FlowTool.SaveToolParams) {
		return fetch.post<FlowTool.Detail>(genRequestUrl("/api/v1/flows/tool-set"), params)
	},

	/**
	 * 获取可用工具
	 */
	getAvailableTools(toolIds: string[]) {
		return fetch.post<WithPage<MagicFlow.Flow[]>>(
			genRequestUrl("/api/v1/flows/queries/tools"),
			{
				codes: toolIds,
			},
		)
	},

	/**
	 * 获取方法数据源
	 */
	getMethodsDataSource() {
		return fetch.post<{
			expression_data_source: MethodOption[]
		}>(genRequestUrl("/api/v1/flows/expression-data-source"))
	},

	/**
	 * 获取视觉模型
	 * @deprecated 该接口已废弃，后端已移除
	 */
	getVisionModels(category: string = "vlm", model_types: number[] = []) {
		return fetch.post<Flow.VLMProvider[]>(genRequestUrl("/api/v1/service-providers/category"), {
			category,
			model_types,
		})
	},

	/**
	 * 获取可用模型列表
	 */
	getAvailableModels(category: string = "vlm", model_types: number[] = []) {
		return fetch.post<Flow.VLMModel[]>(
			genRequestUrl("/api/v1/service-providers/available-models"),
			{
				category,
				model_types,
			},
		)
	},

	/** Api Key 调用工具或流程 */
	callToolOrFlow(apiKey: string, params: object) {
		return fetch.post<any>(genRequestUrl("/api/param-call"), {
			params,
			headers: {
				"api-key": apiKey,
			},
		})
	},

	/** 调用Agent进行对话 */
	callAgent(apiKey: string, params: { message: string; conversation_id: string }) {
		return fetch.post<any>(genRequestUrl("/api/chat"), {
			params,
			headers: {
				"api-key": apiKey,
			},
		})
	},

	/** 获取节点模板 */
	getNodeTemplate(nodeType: string) {
		return fetch.post<MagicFlow.Node>(genRequestUrl("/api/v1/flows/node-template"), {
			params: {},
			node_type: nodeType,
			node_version: "latest",
		})
	},

	/** 创建 / 更新 MCP */
	saveMcp(params: Flow.Mcp.SaveParams) {
		return fetch.post<Flow.Mcp.Detail>(genRequestUrl("/api/v1/mcp/server"), params)
	},

	/** 获取超级麦吉项目中的MCP配置 */
	getMCPFromProject(projectId: string) {
		return fetch.get<{ servers: Array<IMCPItem> }>(
			genRequestUrl("/api/v1/mcp/super-magic/project/${projectId}/setting", { projectId }),
			{
				enableRequestUnion: true,
			},
		)
	},

	/** 获取超级麦吉项目中的MCP配置 */
	saveMCPFromProject(projectId: string, params: Array<Flow.Mcp.SaveParams>) {
		return fetch.put<{ servers: Array<IMCPItem> }>(
			genRequestUrl("/api/v1/mcp/super-magic/project/${projectId}/setting", { projectId }),
			{
				servers: params,
			},
			{
				enableRequestUnion: true,
			},
		)
	},

	/** 获取 MCP 列表 */
	getMcpList(params: Flow.Mcp.GetListParams) {
		return fetch.post<WithPage<Flow.Mcp.ListItem[]>>(
			genRequestUrl("/api/v1/mcp/server/queries"),
			{
				page: params.page,
				page_size: params.pageSize,
				name: params.name,
			},
			{ enableRequestUnion: true },
		)
	},

	/**
	 * @description 获取 MCP 配置
	 * @param params
	 * @param params.code MCP id
	 * @param params.redirectUrl 成功重定向地址
	 * @param options
	 */
	getMCPUserSettings(
		params: { code: string; redirectUrl: string },
		options?: {
			signal?: AbortSignal
			enableErrorMessagePrompt?: boolean
		},
	) {
		return fetch.get<MCPOAuthStatus>(
			genRequestUrl("/api/v1/mcp/user-setting/${code}?redirect_url=${redirectUrl}", params),
			{
				enableRequestUnion: true,
				enableErrorMessagePrompt: options?.enableErrorMessagePrompt,
				signal: options?.signal,
			},
		)
	},

	/**
	 * @description 查询可用 MCP
	 * @param {Array<string>} codes MCP ids
	 */
	getAvailableMCP(codes: Array<string>) {
		return fetch.post<GetAvailableMCPListResponse>(
			genRequestUrl("/api/v1/mcp/available/queries"),
			{
				codes,
			},
			{ enableRequestUnion: true },
		)
	},

	/**
	 * @description MCP 绑定 OAuth 2.0
	 * @param {string} code MCP id
	 * @param {string} state 状态
	 */
	bindMCPOAuth(code: string, state: string) {
		return fetch.post(
			genRequestUrl("/api/v1/mcp/oauth2/bind"),
			{ code, state },
			{ enableRequestUnion: true },
		)
	},

	/**
	 * @description MCP 解除绑定 OAuth 2.0
	 * @param {string} code MCP id
	 */
	unBindMCPOAuth(code: string) {
		return fetch.post(
			genRequestUrl("/api/v1/mcp/oauth2/unbind"),
			{
				mcp_server_code: code,
			},
			{ enableRequestUnion: true },
		)
	},

	/**
	 * @description 保存 require_fields 配置
	 * @param code MCP id
	 * @param formData 表单数据
	 */
	saveMCPRequireFields(
		code: string,
		formData: {
			require_fields: Array<{ field_name: string; field_value: string }>
		},
	) {
		return fetch.post(
			genRequestUrl("/api/v1/mcp/user-setting/${code}/require-fields", {
				code,
			}),
			formData,
			{
				enableRequestUnion: true,
			},
		)
	},

	/** 获取 MCP 详情 */
	getMcp(id: string) {
		return fetch.get<Flow.Mcp.Detail>(genRequestUrl("/api/v1/mcp/server/${id}", { id }), {
			enableRequestUnion: true,
		})
	},

	/** 删除 MCP */
	deleteMcp(id: string) {
		return fetch.delete<null>(genRequestUrl("/api/v1/mcp/server/${id}", { id }))
	},

	/** 获取 MCP 的工具列表 */
	getMcpToolList(code: string) {
		return fetch.post<WithPage<Flow.Mcp.ListItem[]>>(
			genRequestUrl("/api/v1/mcp/server/${code}/tools", { code }),
			{
				enableRequestUnion: true,
			},
		)
	},

	/** 保存 MCP 的工具（新增，更新，更新版本） */
	saveMcpTool(params: Flow.Mcp.SaveParams, code: string) {
		return fetch.post<Flow.Mcp.Detail>(
			genRequestUrl("/api/v1/mcp/server/${code}/tool", { code }),
			params,
			{
				enableRequestUnion: true,
			},
		)
	},

	/** 删除 MCP 的工具 */
	deleteMcpTool(id: string, code: string) {
		return fetch.delete<null>(
			genRequestUrl("/api/v1/mcp/server/${code}/tool/${id}", { id, code }),
			{
				enableRequestUnion: true,
			},
		)
	},

	/** 获取 MCP 的工具详情 */
	getMcpToolDetail(id: string, code: string) {
		return fetch.get<Flow.Mcp.Detail>(
			genRequestUrl("/api/v1/mcp/server/${code}/tool/${id}", { id, code }),
			{
				enableRequestUnion: true,
			},
		)
	},

	/** 获取可用 MCP 列表 */
	getUseableMCPList(params?: { office?: boolean; name?: string }) {
		return fetch.post<WithPage<Flow.Mcp.ListItem[]>>(
			genRequestUrl("/api/v1/flows/queries/mcp-list"),
			params,
			{ enableRequestUnion: true },
		)
	},

	/**
	 * @description 获取 MCP 状态
	 * @param id MCP id
	 * @param options 请求配置
	 * @param options.enableErrorMessagePrompt 是否开启异常提示
	 */
	getMCPStatus(id: string, options?: { enableErrorMessagePrompt: boolean }) {
		return fetch.get<{
			success: string
			error: string
			tools: Flow.Mcp.ListItem[]
		}>(genRequestUrl("/api/v1/mcp/server/${id}/status", { id }), {
			enableRequestUnion: true,
			enableErrorMessagePrompt: options?.enableErrorMessagePrompt,
		})
	},
})
