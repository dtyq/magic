import type { WidgetValue } from "@/opensource/pages/flow/common/Output"
import type { LLMLabelTagType } from "@/opensource/pages/flow/nodes/LLM/v0/components/LLMSelect/LLMLabel"
import type { TriggerType } from "@/opensource/pages/flow/nodes/Start/v0/constants"
import type { Expression } from "@dtyq/magic-flow/MagicConditionEdit/types/expression"
import type { NodeTestingCtx } from "@dtyq/magic-flow/MagicFlow/context/NodeTesingContext/Context"
import type { MagicFlow } from "@dtyq/magic-flow/MagicFlow/types/flow"
import type Schema from "@dtyq/magic-flow/MagicJsonSchemaEditor/types/Schema"
import type { Dayjs } from "dayjs"

/** 流程类型 */
export const enum FlowType {
	/** 主流程 */
	Main = 1,
	/** 子流程 */
	Sub = 2,
	/** 工具集 */
	Tools = 3,
}

export interface WithPage<ListType> {
	page: number
	page_size: number
	list: ListType
	total: number
}

export type GetFlowListParams = {
	type: FlowType
	page?: number
	pageSize?: number
	name?: string
}
export interface TriggerConfig {
	trigger_type: TriggerType
	trigger_data: {
		nickname?: string
		chat_time?: string | Dayjs
		message_type?: string
		content?: string
		open_time?: string | Dayjs
	}
	conversation_id?: string
	[key: string]: any
}

// If节点的单条分直播hi
export interface IfBranch {
	branch_id: string
	next_nodes: string[]
	parameters: {
		id: string
		version: string
		type: string
		structure: Expression.Condition | undefined
	}
}

export type Widget<Structure> = {
	id: string
	version: string
	type: string
	structure: Structure
}

export namespace HTTP {
	export type Api = Widget<{
		method: string
		domain: string
		path: string
		uri: string
		url: string
		proxy: string
		request: {
			params_query: Widget<Schema>
			params_path: Widget<Schema>
			body_type: string
			body: Widget<Schema>
			headers: Widget<Schema>
		}
	}>

	export type Params = {
		api: Api
		quick_auth: string
	}
}

export interface NodeTestingResult {
	success: boolean
	start_time: number
	end_time: number
	elapsed_time: string
	error_message: string
	params: Pick<MagicFlow.Node, "params">
	input: string[]
	output: {
		content: string
	}
}

export type TestNodeParams = Pick<
	MagicFlow.Node,
	"params" | "input" | "node_type" | "node_version"
> & {
	trigger_config: {
		node_contexts: Record<string, any>
		global_variable: Record<string, any>
	}
}

/**
 * LLM 模型 配置
 */
export interface LLMModalOption {
	value: string
	label: string
	tags: [
		{
			type: LLMLabelTagType.Text
			value: string
		},
		{
			type: LLMLabelTagType.Icon
			value: string
		},
	]
	configs: {
		temperature: number
	}
	icon: string
	vision: boolean
}

/** platform */

export type PlatformItem = {
	id: string
	name: string
	avatar: string
}

/** 子流程出入参数据格式 */
export type SubFlowArgument = Pick<
	MagicFlow.Flow,
	"id" | "name" | "description" | "enabled" | "type"
> & {
	input: MagicFlow.Node["input"]
	output: MagicFlow.Node["input"]
	custom_system_input: WidgetValue["value"]
	icon: string
}

export type TestResult = {
	key: string
	success: boolean
	node_debug: NodeTestingCtx["testingResultMap"]
}

export namespace FlowDraft {
	export type Detail = {
		id: string
		name: string
		description: string
		creator: string
		created_at: string
		modifier: string
		updated_at: string
		magic_flow: MagicFlow.Flow
		creator_info: PlatformItem
		modifier_info: PlatformItem
	}

	export type RequestArgs = Partial<Pick<Detail, "name" | "description" | "magic_flow" | "id">>

	export type ListItem = Detail
}

export namespace FlowTool {
	export type Tool = {
		id?: string
		tool_set_id: string
		code: string
		name: string
		description: string
		icon: string
		enabled: boolean
	}
	export type Detail = {
		id: string
		name: string
		icon: string
		description: string
		creator: string
		created_at: string
		modifier: string
		updated_at: string
		tools: Tool[]
		tool_set_id: string
		agent_used_count: number
	}

	export type ListItem = Detail

	export type GetToolListParams = {
		page: number
		pageSize: number
		name: string
	}

	export type SaveToolParams = {
		id?: string
		name: string
		description: string
		icon: string
		enabled?: boolean
	}
}

// 可用的工具集
export namespace UseableToolSet {
	export type UsableTool = {
		code: string
		name: string
		description: string
		input: WidgetValue["value"]
		output: WidgetValue["value"]
		custom_system_input: WidgetValue["value"]
	}

	export type Item = Omit<FlowTool.Detail, "tools"> & {
		tools: UsableTool[]
	}
}

export type ApiKey = {
	id: string
	flow_code: string
	type: string
	name: string
	description: string
	secret_key: string
	conversation_id: string
	webhook_url: string
	enabled: boolean
	last_used: string
	creator: string
	created_at: string
	modifier: string
	updated_at: string
	rel_code?: string
	rel_type?: Flow.ApiKeyType
}

export type NewKeyForm = {
	name: string
	description: string
}

export type ApiKeyRequestParams = Pick<ApiKey, "name" | "description" | "id"> & {
	conversation_id: string
}

/**
 * 组件类型
 */
export enum ComponentTypes {
	/** 表单组件 */
	Form = "form",
	/** 控件组件 */
	Widget = "widget",
	/** 条件组件 */
	Condition = "condition",
	/** api组件 */
	Api = "api",
	/** value组件 */
	Value = "value",
}

/**
 * 单步调试引用值解析规则
 */
export type ResolveRule = {
	// 需要解析的类型
	type: string // schema | expression
	// 解析的参数路径
	path: string[]
	// 特殊的解析类型
	paramsType?: string
	// 特殊解析类型的key内部取值
	subKeys?: string[]
}

export enum FlowRouteType {
	Agent = "agent",
	Sub = "sub",
	Tools = "tools",
	VectorKnowledge = "knowledge",
	Mcp = "mcp",
}

export namespace Flow {
	export interface VLMModel {
		id: string
		name: string
		model_id: string
		model_version: string
		model_type: number
		category: string
		icon: string
		description: string
	}

	export interface VLMProvider {
		id: string
		name: string
		models: VLMModel[]
	}

	export enum VLMModelType {
		/** 文生图 */
		TextToImage = 0,
		/** 图生图 */
		ImageToImage = 1,
		/** 图片增强 */
		ImageEnhance = 2,
		/** 大模型 */
		LLM = 3,
		/** 嵌入 */
		Embedding = 4,
	}

	export namespace Mcp {
		export type Detail = {
			created_at: string
			created_uid: null
			creator: string
			creator_info: PlatformItem
			description: string
			enabled: boolean
			id: string
			mcp_server_code: string
			modifier: string
			modifier_info: PlatformItem
			name: string
			options: object
			rel_code: string
			rel_version_code: string
			source: number
			updated_at: string
			updated_uid: null
			version: string
			source_version: {
				latest_version_code: string
				latest_version_name: string
			}
			[property: string]: any
		}
		export type ListItem = Mcp.Detail
		export type SaveParams = {
			id?: string
			source?: Flow.Mcp.ToolSource
			rel_code?: string
			rel_version_code?: string
			name?: string
			description?: string
			enabled?: boolean
			rel_info?: Record<string, any>
			icon?: string
		}
		export type GetListParams = {
			page: number
			pageSize: number
			name: string
		}
		export enum ToolSource {
			/** 工具集 */
			Toolset = 1,
		}
	}

	export enum ApiKeyType {
		None = 0,
		Flow = 1,
		Mcp = 2,
	}

	export type ApiKeyRequestParamsV1 = {
		id?: string
		name?: string
		description?: string
		rel_type?: ApiKeyType
		rel_code?: string
	}
}

/**
 * 向量知识库
 */
export namespace VectorKnowledge {
	export enum SearchType {
		/** 全部 */
		All = 1,
		/** 已启用 */
		Enabled = 2,
		/** 已禁用 */
		Disabled = 3,
	}
}
