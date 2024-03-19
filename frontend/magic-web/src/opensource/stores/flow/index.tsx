import type {
	FlowDraft,
	PlatformItem,
	TestResult,
	TriggerConfig,
	WithPage,
	FlowTool,
	GetFlowListParams,
	UseableToolSet,
	LLMModalOption,
	Flow,
} from "@/opensource/types/flow"
import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type { SWRResponse } from "swr"
import useSWR from "swr"
import { create } from "zustand"
import type { Knowledge } from "@/opensource/types/knowledge"
import type { DataSourceOption } from "@dtyq/magic-flow/dist/common/BaseUI/DropdownRenderer/Reference"
import { FlowApi } from "@/opensource/apis"
import type { FlowState } from "./types"

const defaultState: FlowState = {
	subFlows: [],
	draftList: [],
	publishList: [],
	isGlobalVariableChanged: false,
	toolInputOutputMap: {},
	useableToolSets: [],
	models: [],
	useableDatabases: [],
	useableTeamshareDatabase: [],
	methodsDataSource: [],
	visionModels: [], // 添加视觉理解模型数组
	availableModels: [], // 可用模型列表
	useableMCPs: [],
}

export interface FlowStoreState {
	subFlows: MagicFlow.Flow[]
	draftList: FlowDraft.ListItem[]
	publishList: FlowDraft.ListItem[]
	useableToolSets: UseableToolSet.Item[]
	models: LLMModalOption[]
	useableDatabases: Knowledge.KnowledgeItem[]
	useableTeamshareDatabase: Knowledge.KnowledgeDatabaseItem[]
	methodsDataSource: DataSourceOption[]
	toolInputOutputMap: Record<string, MagicFlow.Flow>
	visionModels: Flow.VLMProvider[] // 使用Flow命名空间下的类型
	availableModels: Flow.VLMModel[] // 可用模型列表（扁平结构）
	useableMCPs: Flow.Mcp.Detail[]
	updateUseableMCPs: (mcpList: Flow.Mcp.Detail[]) => void
	updateVisionModels: (visionModels: Flow.VLMProvider[]) => void // 使用Flow命名空间下的类型
	updateAvailableModels: (availableModels: Flow.VLMModel[]) => void
	updateToolInputOutputMap: (toolInputOutputMap: Record<string, MagicFlow.Flow>) => void
	updateMethodDataSource: (dataSource: DataSourceOption[]) => void
	updateSubFlowList: (flows: MagicFlow.Flow[]) => void
	updateUseableTeamshareDatabase: (databases: Knowledge.KnowledgeDatabaseItem[]) => void
	updateUseableDatabases: (databases: Knowledge.KnowledgeItem[]) => void
	updateModels: (models: LLMModalOption[]) => void
	updateUseableToolSets: (toolSets: UseableToolSet.Item[]) => void
	useFlowList: (params: GetFlowListParams) => SWRResponse<WithPage<MagicFlow.Flow[]>>
	updateFlowDraftList: (flowList: FlowDraft.ListItem[]) => void
	updateFlowPublishList: (flowList: FlowDraft.ListItem[]) => void
	useFlowDetail: (flowId: string) => SWRResponse<MagicFlow.Flow>
	useTestFlow: (
		flow: MagicFlow.Flow & { trigger_config: TriggerConfig & { debug: boolean } },
	) => SWRResponse<TestResult>
	useGetOpenApiAccountList: (flowId: string) => SWRResponse<WithPage<PlatformItem[]>>
	useGetOpenPlatformAccountsOfMine: () => SWRResponse<WithPage<PlatformItem[]>>
	useFlowToolList: (params: FlowTool.GetToolListParams) => SWRResponse<WithPage<MagicFlow.Flow[]>>
	isGlobalVariableChanged: boolean
	updateIsGlobalVariableChanged: (value: boolean) => void
}
export const useFlowStore = create<FlowStoreState>((set) => ({
	...defaultState,
	useFlowList: (params: GetFlowListParams) => {
		return useSWR("/api/v1/flows/queries", () => FlowApi.getFlowList(params))
	},

	useFlowDetail: (flowId: string) => {
		return useSWR(`${"/api/v1/flows/${flowId}"}/${flowId}`, () => FlowApi.getFlow(flowId))
	},

	useTestFlow: (
		flow: MagicFlow.Flow & { trigger_config: TriggerConfig & { debug: boolean } },
	) => {
		return useSWR("/api/v1/flows/${flowId}/flow-debug", () => FlowApi.testFlow(flow))
	},

	useGetOpenApiAccountList: (flowId: string) => {
		return useSWR("/api/v1/flows/${flowId}/open-platform/apps/queries", () =>
			FlowApi.getOpenApiAccountList(flowId),
		)
	},

	useGetOpenPlatformAccountsOfMine: () => {
		return useSWR("/api/v1/flows/${flowId}/open-platform/apps/queries", () =>
			FlowApi.getOpenPlatformOfMine(),
		)
	},

	updateFlowDraftList: (flowList: FlowDraft.ListItem[]) => {
		set(() => ({
			draftList: flowList,
		}))
	},

	updateFlowPublishList: (flowList: FlowDraft.ListItem[]) => {
		set(() => ({
			publishList: flowList,
		}))
	},

	useFlowToolList: ({ page, pageSize, name }: FlowTool.GetToolListParams) => {
		return useSWR("/api/v1/flows/tool-set/queries", () =>
			FlowApi.getToolList({
				page,
				pageSize,
				name,
			}),
		)
	},

	updateIsGlobalVariableChanged: (changed: boolean) => {
		set({
			isGlobalVariableChanged: changed,
		})
	},

	updateUseableToolSets: (toolSets: UseableToolSet.Item[]) => {
		set({
			useableToolSets: toolSets,
		})
	},

	updateModels: (models: LLMModalOption[]) => {
		set({
			models,
		})
	},

	updateUseableDatabases: (databases: Knowledge.KnowledgeItem[]) => {
		set({
			useableDatabases: databases,
		})
	},

	updateUseableTeamshareDatabase: (databases: Knowledge.KnowledgeDatabaseItem[]) => {
		set({
			useableTeamshareDatabase: databases,
		})
	},

	updateSubFlowList: (flowList: MagicFlow.Flow[]) => {
		set({
			subFlows: flowList,
		})
	},

	updateMethodDataSource: (dataSource: DataSourceOption[]) => {
		set({
			methodsDataSource: dataSource,
		})
	},

	updateVisionModels: (visionModels: Flow.VLMProvider[]) => {
		set({
			visionModels,
		})
	},

	updateAvailableModels: (availableModels: Flow.VLMModel[]) => {
		set({
			availableModels,
		})
	},

	updateToolInputOutputMap: (toolInputOutputMap: Record<string, MagicFlow.Flow>) => {
		set({
			toolInputOutputMap,
		})
	},

	updateUseableMCPs: (mcpList: Flow.Mcp.Detail[]) => {
		set({
			useableMCPs: mcpList,
		})
	},
}))
