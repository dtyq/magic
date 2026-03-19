//@ts-nocheck
/**
 * JSON转YAML转换工具
 * 将Flow格式的JSON转换为YAML DSL格式
 */

import yaml from "js-yaml"
import { customNodeType } from "../constants"

interface Position {
	x: number
	y: number
}

interface Edge {
	id: string
	source: string
	target: string
	sourceHandle?: string
	targetHandle?: string
	type: string
	data?: any
	style?: any
	markerEnd?: any
	selected?: boolean
}

interface Node {
	id: string
	node_id: string
	node_type: string
	node_version: string
	name: string
	description?: string
	position: Position
	params: any
	meta: any
	next_nodes: string[]
	step: number
	data: any
	system_output: any
}

interface Flow {
	id: string
	name: string
	description: string
	icon: string
	type: number
	tool_set_id: string
	edges: Edge[]
	nodes: Node[]
	global_variable: any
	enabled: boolean
	version_code: string
	creator?: string
	created_at?: string
	modifier?: string
	updated_at?: string
	creator_info?: any
	modifier_info?: any
	user_operation?: number
}

interface FlowDSL {
	flow: {
		id: string
		name: string
		description: string
		version: string
		type: string
		icon?: string
		enabled?: boolean
	}
	variables: any[]
	nodes: any[]
	edges: any[]
}

/**
 * 获取可读的节点类型名称
 * @param flowNodeType Flow节点类型数字
 * @returns 节点类型名称
 */
const getNodeTypeName = (flowNodeType: string): string => {
	switch (flowNodeType) {
		case customNodeType.Start:
			return "start"
		case customNodeType.LLM:
			return "llm"
		case customNodeType.ReplyMessage:
			return "reply-message"
		case customNodeType.If:
			return "if-else"
		case customNodeType.Code:
			return "code"
		case customNodeType.Loader:
			return "loader"
		case customNodeType.HTTP:
			return "http-request"
		case customNodeType.Sub:
			return "sub-flow"
		case customNodeType.End:
			return "end"
		case customNodeType.MessageSearch:
			return "message-search"
		case customNodeType.TextSplit:
			return "text-split"
		case customNodeType.VectorStorage:
			return "vector-storage"
		case customNodeType.VectorSearch:
			return "vector-search"
		case customNodeType.VectorDelete:
			return "vector-delete"
		case customNodeType.CacheSetter:
			return "cache-setter"
		case customNodeType.CacheGetter:
			return "cache-getter"
		case customNodeType.MessageMemory:
			return "message-memory"
		case customNodeType.VariableSave:
			return "variable-save"
		case customNodeType.IntentionRecognition:
			return "intention-recognition"
		case customNodeType.Loop:
			return "loop"
		case customNodeType.LoopBody:
			return "loop-body"
		case customNodeType.LoopEnd:
			return "loop-end"
		case customNodeType.SearchUsers:
			return "search-users"
		case customNodeType.WaitForReply:
			return "wait-for-reply"
		case customNodeType.LLMCall:
			return "llm-call"
		case customNodeType.AddRecord:
			return "add-record"
		case customNodeType.UpdateRecord:
			return "update-record"
		case customNodeType.FindRecord:
			return "find-record"
		case customNodeType.DeleteRecord:
			return "delete-record"
		case customNodeType.DocumentResolve:
			return "document-resolve"
		case customNodeType.Agent:
			return "agent"
		case customNodeType.Excel:
			return "excel"
		case customNodeType.Tools:
			return "tool"
		case customNodeType.VectorDatabaseMatch:
			return "vector-database-match"
		case customNodeType.KnowledgeSearch:
			return "knowledge-search"
		case customNodeType.Text2Image:
			return "text-to-image"
		case customNodeType.GroupChat:
			return "group-chat"
		default:
			return "unknown"
	}
}

/**
 * 获取流程类型名称
 * @param type Flow类型数字
 * @returns 流程类型名称
 */
const getFlowTypeName = (type: number): string => {
	switch (type) {
		case 1:
			return "workflow"
		case 2:
			return "chat"
		default:
			return "workflow"
	}
}

/**
 * 将Flow全局变量转换为DSL变量数组
 * @param globalVariable Flow全局变量
 * @returns DSL变量数组
 */
const convertGlobalVariables = (globalVariable: any): any[] => {
	const variables = []

	if (!globalVariable) return variables

	// 处理全局变量
	if (globalVariable.variables && Array.isArray(globalVariable.variables)) {
		globalVariable.variables.forEach((variable: any) => {
			variables.push({
				name: variable.name,
				type: variable.type,
				default: variable.default_value,
				description: variable.description || "",
			})
		})
	}

	return variables
}

/**
 * 简化表单结构，大幅减少YAML数据量
 * @param formData 原始表单数据对象
 * @returns 简化后的表单结构
 */
const simplifyFormStructure = (formData: any): any => {
	// 如果无表单数据或没有结构体，直接返回
	if (!formData || !formData.structure) return formData

	const result = {
		id: formData.id,
		version: formData.version,
	}

	// 处理结构体
	if (formData.structure) {
		result["fields"] = simplifySchema(formData.structure)
	}

	return result
}

/**
 * 简化Schema结构，递归处理对象和数组
 * @param schema Schema对象
 * @returns 简化后的字段列表
 */
const simplifySchema = (schema: any): any => {
	if (!schema) return null

	// 处理对象类型
	if (schema.type === "object" && schema.properties) {
		const fields = []

		// 处理所有属性
		for (const [key, prop] of Object.entries(schema.properties)) {
			if (!prop) continue

			const field = {
				name: key,
				type: prop.type,
			}

			// 只保留有值的字段
			if (prop.title && prop.title !== key) field["title"] = prop.title
			if (prop.description && prop.description.trim()) field["desc"] = prop.description

			// 处理必填
			if (schema.required && schema.required.includes(key)) {
				field["required"] = true
			}

			// 处理默认值
			if (prop.value !== null && prop.value !== undefined) {
				field["value"] = prop.value
			}

			// 处理子属性
			if (prop.type === "object" && prop.properties) {
				field["fields"] = simplifySchema(prop)
			}

			// 处理数组项
			if (prop.type === "array" && prop.items) {
				if (prop.items.type === "object" && prop.items.properties) {
					field["type"] = `array:object`
					field["fields"] = simplifySchema(prop.items)
				} else {
					field["type"] = `array:${prop.items.type}`
					// 如果数组项有额外属性
					if (prop.items.title) field["itemTitle"] = prop.items.title
				}
			}

			fields.push(field)
		}
		return fields
	}

	// 数组类型
	if (schema.type === "array" && schema.items) {
		if (schema.items.type === "object" && schema.items.properties) {
			return simplifySchema(schema.items)
		}
	}

	return []
}

/**
 * 将Flow节点转换为DSL节点
 * @param flowNode Flow节点
 * @returns DSL节点
 */
const convertNode = (flowNode: Node): any => {
	const nodeType = getNodeTypeName(flowNode.node_type)
	const result = {
		id: flowNode.id,
		type: nodeType,
		name: flowNode.name || "",
		description: flowNode.description || "",
		position: flowNode.position,
		params: { ...flowNode.params },
		version: flowNode.node_version,
		next_nodes: flowNode.next_nodes,
	}

	// 处理和简化表单结构
	if (flowNode.params) {
		// 简化输入表单
		if (flowNode.params.input && flowNode.params.input.form) {
			result.params.input = {
				...flowNode.params.input,
				form: simplifyFormStructure(flowNode.params.input.form),
			}
		}

		// 简化输出表单
		if (flowNode.params.output && flowNode.params.output.form) {
			result.params.output = {
				...flowNode.params.output,
				form: simplifyFormStructure(flowNode.params.output.form),
			}
		}

		// 简化系统输出表单
		if (flowNode.params.system_output && flowNode.params.system_output.form) {
			result.params.system_output = {
				...flowNode.params.system_output,
				form: simplifyFormStructure(flowNode.params.system_output.form),
			}
		}

		// 递归处理分支中的表单
		if (flowNode.params.branches && Array.isArray(flowNode.params.branches)) {
			result.params.branches = flowNode.params.branches.map((branch) => {
				const newBranch = { ...branch }

				// 处理分支输入
				if (branch.input && branch.input.form) {
					newBranch.input = {
						...branch.input,
						form: simplifyFormStructure(branch.input.form),
					}
				}

				// 处理分支输出
				if (branch.output && branch.output.form) {
					newBranch.output = {
						...branch.output,
						form: simplifyFormStructure(branch.output.form),
					}
				}

				// 处理分支系统输出
				if (branch.system_output && branch.system_output.form) {
					newBranch.system_output = {
						...branch.system_output,
						form: simplifyFormStructure(branch.system_output.form),
					}
				}

				// 处理分支自定义系统输出
				if (branch.custom_system_output && branch.custom_system_output.form) {
					newBranch.custom_system_output = {
						...branch.custom_system_output,
						form: simplifyFormStructure(branch.custom_system_output.form),
					}
				}

				return newBranch
			})
		}
	}

	return result
}

/**
 * 将Flow边转换为DSL边
 * @param flowEdge Flow边
 * @returns DSL边
 */
const convertEdge = (flowEdge: Edge): any => {
	return {
		id: flowEdge.id,
		source: flowEdge.source,
		target: flowEdge.target,
		sourceHandle: flowEdge.sourceHandle,
		targetHandle: flowEdge.targetHandle,
	}
}

/**
 * 将Flow JSON转换为YAML DSL
 * @param flow Flow JSON对象
 * @returns FlowDSL对象
 */
export const json2yaml = (flow: Flow): FlowDSL => {
	try {
		// 转换基本信息
		const dsl: FlowDSL = {
			flow: {
				id: flow.id,
				name: flow.name,
				description: flow.description || "",
				version: flow.version_code || "1.0.0",
				type: getFlowTypeName(flow.type),
				icon: flow.icon,
				enabled: flow.enabled,
			},
			variables: convertGlobalVariables(flow.global_variable),
			nodes: flow.nodes.map((node) => convertNode(node)),
			edges: flow.edges.map((edge) => convertEdge(edge)),
		}

		return dsl
	} catch (error) {
		console.error("转换JSON到YAML失败:", error)
		throw new Error(`转换JSON到YAML失败: ${error.message}`)
	}
}

/**
 * 将Flow JSON转换为YAML字符串
 * @param flow Flow JSON对象
 * @returns YAML字符串
 */
export const json2yamlString = (flow: Flow): string => {
	try {
		const dsl = json2yaml(flow)
		return yaml.dump(dsl, { lineWidth: -1, noRefs: true })
	} catch (error) {
		console.error("转换JSON到YAML字符串失败:", error)
		throw new Error(`转换JSON到YAML字符串失败: ${error.message}`)
	}
}

/**
 * 从JSON字符串转换为YAML字符串
 * @param jsonString JSON字符串
 * @returns YAML字符串
 */
export const jsonStr2yamlString = (jsonString: string): string => {
	try {
		const flow = JSON.parse(jsonString) as Flow
		return json2yamlString(flow)
	} catch (error) {
		console.error("转换JSON字符串到YAML字符串失败:", error)
		throw new Error(`转换JSON字符串到YAML字符串失败: ${error.message}`)
	}
}

/**
 * 将单个节点从Flow格式转换为DSL格式
 * @param node Flow格式的节点
 * @returns DSL格式的节点
 */
export const nodeJson2yaml = (node: Node): any => {
	try {
		return convertNode(node)
	} catch (error) {
		console.error("转换节点JSON到YAML失败:", error)
		throw new Error(`转换节点JSON到YAML失败: ${error.message}`)
	}
}

/**
 * 将单个节点从Flow格式转换为YAML字符串
 * @param node Flow格式的节点
 * @returns YAML字符串
 */
export const nodeJson2yamlString = (node: Node): string => {
	try {
		const dslNode = nodeJson2yaml(node)
		return yaml.dump(dslNode, { lineWidth: -1, noRefs: true })
	} catch (error) {
		console.error("转换节点JSON到YAML字符串失败:", error)
		throw new Error(`转换节点JSON到YAML字符串失败: ${error.message}`)
	}
}

/**
 * 从节点JSON字符串转换为节点YAML字符串
 * @param jsonString 表示节点的JSON字符串
 * @returns 节点的YAML字符串
 */
export const nodeJsonStr2yamlString = (jsonString: string): string => {
	try {
		const node = JSON.parse(jsonString) as Node
		return nodeJson2yamlString(node)
	} catch (error) {
		console.error("转换节点JSON字符串到YAML字符串失败:", error)
		throw new Error(`转换节点JSON字符串到YAML字符串失败: ${error.message}`)
	}
}

export default {
	json2yaml,
	json2yamlString,
	jsonStr2yamlString,
	nodeJson2yaml,
	nodeJson2yamlString,
	nodeJsonStr2yamlString,
}
