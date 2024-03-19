import type { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import type { FlowDraft, LLMModalOption, UseableToolSet, Flow } from "@/opensource/types/flow"
import type { Knowledge } from "@/opensource/types/knowledge"
import type { DataSourceOption } from "@dtyq/magic-flow/dist/common/BaseUI/DropdownRenderer/Reference"
import type { useFlowStore } from "."

export interface FlowState {
	subFlows: MagicFlow.Flow[]
	draftList: FlowDraft.ListItem[]
	publishList: FlowDraft.ListItem[]
	isGlobalVariableChanged: boolean
	toolInputOutputMap: Record<string, MagicFlow.Flow>
	useableToolSets: UseableToolSet.Item[]
	models: LLMModalOption[]
	useableDatabases: Knowledge.KnowledgeItem[]
	useableTeamshareDatabase: Knowledge.KnowledgeDatabaseItem[]
	methodsDataSource: DataSourceOption[]
	visionModels: Flow.VLMProvider[]
	availableModels: Flow.VLMModel[]
	useableMCPs: Flow.Mcp.Detail[]
}

export type FlowStore = ReturnType<typeof useFlowStore>
