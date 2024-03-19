import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type {
	ApiKeyRequestParams,
	FlowDraft,
	FlowTool,
	GetFlowListParams,
	TestNodeParams,
	TriggerConfig,
} from "@/opensource/types/flow"
import { FlowType } from "@/opensource/types/flow"
import type { File } from "@/opensource/types/sheet"
import type * as apis from "@/opensource/apis"

class FlowService {
	protected flowApi: typeof apis.FlowApi

	constructor(dependencies: typeof apis) {
		this.flowApi = dependencies.FlowApi
	}

	/** 查询流程列表 */
	getFlowList({ type = FlowType.Main, page = 1, pageSize = 100, name }: GetFlowListParams) {
		return this.flowApi.getFlowList({
			type,
			page,
			pageSize,
			name,
		})
	}

	/** 查询流程详情 */
	getFlow(flowId: string) {
		return this.flowApi.getFlow(flowId)
	}

	/** 流程试运行 */
	testFlow(flow: MagicFlow.Flow & { trigger_config: TriggerConfig }) {
		return this.flowApi.testFlow(flow)
	}

	/** 新增或修改流程基本信息 */
	addOrUpdateFlowBaseInfo(flow: Partial<MagicFlow.Flow> & { type?: FlowType }) {
		return this.flowApi.addOrUpdateFlowBaseInfo(flow)
	}

	/** 删除流程 */
	deleteFlow(flowId: string) {
		return this.flowApi.deleteFlow(flowId)
	}

	/** 保存流程详情 */
	saveFlow(flow: MagicFlow.Flow) {
		return this.flowApi.saveFlow(flow)
	}

	/** 保存流程为草稿 */
	saveFlowDraft(draftDetail: FlowDraft.RequestArgs, flowId: string) {
		return this.flowApi.saveFlowDraft(draftDetail, flowId)
	}

	/** 查询流程草稿列表 */
	getFlowDraftList(flowId: string) {
		return this.flowApi.getFlowDraftList(flowId)
	}

	/** 查询流程草稿详情 */
	getFlowDraftDetail(flowId: string, draftId: string) {
		return this.flowApi.getFlowDraftDetail(flowId, draftId)
	}

	/** 删除流程草稿 */
	deleteFlowDraft(flowId: string, draftId: string) {
		return this.flowApi.deleteFlowDraft(flowId, draftId)
	}

	/** 查询流程版本列表 */
	getFlowPublishList(flowId: string, page = 1, pageSize = 200) {
		return this.flowApi.getFlowPublishList(flowId, page, pageSize)
	}

	/** 查询流程版本详情 */
	getFlowPublishDetail(flowId: string, versionId: string) {
		return this.flowApi.getFlowPublishDetail(flowId, versionId)
	}

	/** 发布流程版本 */
	publishFlow(publishDetail: FlowDraft.RequestArgs, flowId: string) {
		return this.flowApi.publishFlow(publishDetail, flowId)
	}

	/** 回滚流程版本 */
	restoreFlow(flowId: string, versionId: string) {
		return this.flowApi.restoreFlow(flowId, versionId)
	}

	/** 修改流程启用状态 */
	changeEnableStatus(id: string) {
		return this.flowApi.changeEnableStatus(id)
	}

	/** 单点调试 */
	testNode(params: TestNodeParams) {
		return this.flowApi.testNode(params)
	}

	/** 获取可用 LLM 模型 */
	getLLMModal() {
		return this.flowApi.getLLMModal()
	}

	/** 给指定工作流添加开放平台应用 */
	bindOpenApiAccount(flowId: string, openPlatformAppIds: string[]) {
		return this.flowApi.bindOpenApiAccount(flowId, openPlatformAppIds)
	}

	/** 移除指定工作流的开放平台应用 */
	removeOpenApiAccount(flowId: string, openPlatformAppIds: string[]) {
		return this.flowApi.removeOpenApiAccount(flowId, openPlatformAppIds)
	}

	/** 获取指定工作流绑定的开放平台应用列表 */
	getOpenApiAccountList(flowId: string, page = 1, pageSize = 100) {
		return this.flowApi.getOpenApiAccountList(flowId, page, pageSize)
	}

	/** 获取当前用户可绑定的开放平台应用列表 */
	getOpenPlatformOfMine(page = 1, pageSize = 100) {
		return this.flowApi.getOpenPlatformOfMine(page, pageSize)
	}

	/** 获取子流程的出入参 */
	getSubFlowArguments(flowId: string) {
		return this.flowApi.getSubFlowArguments(flowId)
	}

	/** 保存 api-key */
	saveApiKey(params: ApiKeyRequestParams, flowId: string) {
		return this.flowApi.saveApiKey(params, flowId)
	}

	/** 查询 api-key 列表 */
	getApiKeyList(flowId: string, page = 1, pageSize = 100) {
		return this.flowApi.getApiKeyList(flowId, page, pageSize)
	}

	/** 查询 api-key 详情 */
	getApiKeyDetail(id: string, flowId: string) {
		return this.flowApi.getApiKeyDetail(id, flowId)
	}

	/** 删除 api-key  */
	deleteApiKey(id: string, flowId: string) {
		return this.flowApi.deleteApiKey(id, flowId)
	}

	/** 重建 api-key  */
	rebuildApiKey(id: string, flowId: string) {
		return this.flowApi.rebuildApiKey(id, flowId)
	}

	/** 获取数据表  */
	getSheets(fileId: string) {
		return this.flowApi.getSheets(fileId)
	}

	/** 搜索文件列表 */
	getFiles(params: File.RequestParams) {
		return this.flowApi.getFiles(params)
	}

	/** 搜索文件列表 */
	getFile(fileId: string) {
		return this.flowApi.getFile(fileId)
	}

	/** 工具集列表 */
	getToolList({ page = 1, pageSize = 10, name }: FlowTool.GetToolListParams) {
		return this.flowApi.getToolList({ page, pageSize, name })
	}

	/** 可用的工具集列表 */
	getUseableToolList() {
		return this.flowApi.getUseableToolList()
	}

	/** 可用的知识库列表 */
	getUseableDatabaseList() {
		return this.flowApi.getUseableDatabaseList()
	}

	/** 查询流工具集详情 */
	getToolDetail(id: string) {
		return this.flowApi.getToolDetail(id)
	}

	/** 删除工具集 */
	deleteTool(id: string) {
		return this.flowApi.deleteTool(id)
	}

	/** 保存工具集 */
	saveTool(params: FlowTool.SaveToolParams) {
		return this.flowApi.saveTool(params)
	}

	/** 保存工具集 */
	getAvailableTools(toolIds: string[]) {
		return this.flowApi.getAvailableTools(toolIds)
	}

	/** 获取函数表达式数据源 */
	getMethodsDataSource() {
		return this.flowApi.getMethodsDataSource()
	}

	/** 获取视觉理解模型数据源 */
	getVisionModels(category: string = "vlm") {
		return this.flowApi.getVisionModels(category)
	}

	/** 获取可用模型列表 */
	getAvailableModels(category: string = "vlm", model_types: number[] = []) {
		return this.flowApi.getAvailableModels(category, model_types)
	}

	/** Api Key 调用工具或流程 */
	callToolOrFlow(apiKey: string, params: object) {
		return this.flowApi.callToolOrFlow(apiKey, params)
	}

	/** 调用Agent进行对话 */
	callAgent(apiKey: string, params: { message: string; conversation_id: string }) {
		return this.flowApi.callAgent(apiKey, params)
	}
}

export { FlowService }
