// @ts-nocheck
/**
 * YAML转JSON转换工具
 * 将YAML DSL格式转换为Flow JSON格式
 */

import yaml from "js-yaml"
import { v4 as uuidv4 } from "uuid"
import { customNodeType } from "../constants"
import { MagicFlow } from "@dtyq/magic-flow/dist/MagicFlow/types/flow"
import { getLatestNodeVersion } from "@dtyq/magic-flow/dist/MagicFlow/utils"

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
	debug?: any
	input?: any
	output?: any
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
 * 获取节点类型编号
 * @param nodeTypeName 节点类型名称
 * @returns Flow节点类型编号
 */
const getNodeTypeNumber = (nodeTypeName: string): string => {
	switch (nodeTypeName) {
		case "start":
			return customNodeType.Start
		case "llm":
			return customNodeType.LLM
		case "reply-message":
			return customNodeType.ReplyMessage
		case "if-else":
			return customNodeType.If
		case "code":
			return customNodeType.Code
		case "loader":
			return customNodeType.Loader
		case "http-request":
			return customNodeType.HTTP
		case "sub-flow":
			return customNodeType.Sub
		case "end":
			return customNodeType.End
		case "message-search":
			return customNodeType.MessageSearch
		case "text-split":
			return customNodeType.TextSplit
		case "vector-storage":
			return customNodeType.VectorStorage
		case "vector-search":
			return customNodeType.VectorSearch
		case "vector-delete":
			return customNodeType.VectorDelete
		case "cache-setter":
			return customNodeType.CacheSetter
		case "cache-getter":
			return customNodeType.CacheGetter
		case "message-memory":
			return customNodeType.MessageMemory
		case "variable-save":
			return customNodeType.VariableSave
		case "intention-recognition":
			return customNodeType.IntentionRecognition
		case "loop":
			return customNodeType.Loop
		case "loop-body":
			return customNodeType.LoopBody
		case "loop-end":
			return customNodeType.LoopEnd
		case "search-users":
			return customNodeType.SearchUsers
		case "wait-for-reply":
			return customNodeType.WaitForReply
		case "llm-call":
			return customNodeType.LLMCall
		case "add-record":
			return customNodeType.AddRecord
		case "update-record":
			return customNodeType.UpdateRecord
		case "find-record":
			return customNodeType.FindRecord
		case "delete-record":
			return customNodeType.DeleteRecord
		case "document-resolve":
			return customNodeType.DocumentResolve
		case "agent":
			return customNodeType.Agent
		case "excel":
			return customNodeType.Excel
		case "tool":
			return customNodeType.Tools
		case "vector-database-match":
			return customNodeType.VectorDatabaseMatch
		case "knowledge-search":
			return customNodeType.KnowledgeSearch
		case "text-to-image":
			return customNodeType.Text2Image
		case "group-chat":
			return customNodeType.GroupChat
		default:
			return customNodeType.Start
	}
}

/**
 * 获取流程类型编号
 * @param typeName 流程类型名称
 * @returns 流程类型编号
 */
const getFlowTypeNumber = (typeName: string): number => {
	switch (typeName) {
		case "workflow":
			return 1
		case "chat":
			return 2
		default:
			return 1
	}
}

/**
 * 将DSL变量数组转换为Flow全局变量
 * @param variables DSL变量数组
 * @returns Flow全局变量
 */
const convertToGlobalVariables = (variables: any[]): any => {
	if (!variables || !variables.length) return null

	const globalVariable = {
		variables: variables.map((variable) => ({
			name: variable.name,
			type: variable.type,
			default_value: variable.default,
			description: variable.description || "",
		})),
	}

	return globalVariable
}

/**
 * 恢复简化的表单结构为完整结构
 * @param simplifiedForm 简化的表单数据
 * @returns 恢复的完整表单数据
 */
const restoreFormStructure = (simplifiedForm: any): any => {
	// 如果没有简化或已经是完整结构，直接返回
	if (!simplifiedForm || !simplifiedForm.fields) {
		return simplifiedForm
	}

	const result = {
		id: simplifiedForm.id,
		version: simplifiedForm.version,
		type: "form",
		structure: restoreSchema(simplifiedForm.fields),
	}

	return result
}

/**
 * 恢复简化的Schema为完整结构
 * @param fields 简化的字段列表
 * @returns 恢复的完整Schema结构
 */
const restoreSchema = (fields: any[]): any => {
	if (!fields || !Array.isArray(fields)) return null

	const properties = {}
	const required = []

	// 处理所有字段
	fields.forEach((field, index) => {
		const fieldType =
			field.type && field.type.includes(":") ? field.type.split(":")[0] : field.type

		const fieldItemType =
			field.type && field.type.includes(":") ? field.type.split(":")[1] : null

		// 构建属性
		const prop: any = {
			type: fieldType,
			key: field.name,
			sort: index,
			title: field.title || field.name,
			description: field.desc || "",
			required: null,
			value: field.value || null,
			encryption: false,
			encryption_value: null,
			items: null,
			properties: null,
		}

		// 处理必填项
		if (field.required) {
			required.push(field.name)
		}

		// 处理对象类型
		if (fieldType === "object" && field.fields) {
			prop.properties = {}
			const childSchema = restoreSchema(field.fields)
			prop.properties = childSchema.properties
			// 合并必填项
			if (childSchema.required && childSchema.required.length > 0) {
				prop.required = childSchema.required
			}
		}

		// 处理数组类型
		if (fieldType === "array") {
			if (fieldItemType === "object" && field.fields) {
				prop.items = {
					type: "object",
					key: field.name,
					sort: 0,
					title: field.itemTitle || field.title || "",
					description: field.desc || "",
					required: [],
					value: null,
					encryption: false,
					encryption_value: null,
					items: null,
					properties: {},
				}

				const childSchema = restoreSchema(field.fields)
				prop.items.properties = childSchema.properties

				// 设置必填项
				if (childSchema.required && childSchema.required.length > 0) {
					prop.items.required = childSchema.required
				}
			} else if (fieldItemType) {
				prop.items = {
					type: fieldItemType,
					key: "",
					sort: 0,
					title: field.itemTitle || "",
					description: "",
					required: null,
					value: null,
					encryption: false,
					encryption_value: null,
					items: null,
					properties: null,
				}
			}
		}

		properties[field.name] = prop
	})

	// 构建完整Schema
	return {
		type: "object",
		key: "root",
		sort: 0,
		title: "root节点",
		description: "",
		required: required.length > 0 ? required : [],
		value: null,
		encryption: false,
		encryption_value: null,
		items: null,
		properties: properties,
	}
}

/**
 * 将DSL节点转换为Flow节点
 * @param dslNode DSL节点
 * @returns Flow节点
 */
const convertToFlowNode = (dslNode: any): Node => {
	const result = {
		id: dslNode.node_id || dslNode.id,
		node_id: dslNode.node_id || dslNode.id,
		node_type: dslNode.node_type,
		node_version: dslNode.node_version || getLatestNodeVersion(nodeType),
		name: dslNode.name || "",
		description: dslNode.description || "",
		position: dslNode.position,
		params: { ...dslNode.params } || {},
		meta: dslNode.meta || {},
		next_nodes: dslNode.next_nodes || [],
		system_output: dslNode.system_output,
		debug: dslNode.debug,
		input: dslNode.input,
		output: dslNode.output,
	}

	// 处理和恢复表单结构
	if (result.params) {
		// 恢复输入表单
		if (result.params.input && result.params.input.form) {
			result.params.input = {
				...result.params.input,
				form: restoreFormStructure(result.params.input.form),
			}
		}

		// 恢复输出表单
		if (result.params.output && result.params.output.form) {
			result.params.output = {
				...result.params.output,
				form: restoreFormStructure(result.params.output.form),
			}
		}

		// 恢复系统输出表单
		if (result.params.system_output && result.params.system_output.form) {
			result.params.system_output = {
				...result.params.system_output,
				form: restoreFormStructure(result.params.system_output.form),
			}
		}

		// 递归处理分支中的表单
		if (result.params.branches && Array.isArray(result.params.branches)) {
			result.params.branches = result.params.branches.map((branch) => {
				const newBranch = { ...branch }

				// 处理分支输入
				if (branch.input && branch.input.form) {
					newBranch.input = {
						...branch.input,
						form: restoreFormStructure(branch.input.form),
					}
				}

				// 处理分支输出
				if (branch.output && branch.output.form) {
					newBranch.output = {
						...branch.output,
						form: restoreFormStructure(branch.output.form),
					}
				}

				// 处理分支系统输出
				if (branch.system_output && branch.system_output.form) {
					newBranch.system_output = {
						...branch.system_output,
						form: restoreFormStructure(branch.system_output.form),
					}
				}

				// 处理分支自定义系统输出
				if (branch.custom_system_output && branch.custom_system_output.form) {
					newBranch.custom_system_output = {
						...branch.custom_system_output,
						form: restoreFormStructure(branch.custom_system_output.form),
					}
				}

				return newBranch
			})
		}
	}

	// meta是空数组时，使用默认位置
	if (Array.isArray(result.meta) && result.meta.length === 0) {
		result.meta = { position: { x: 200, y: 200 } }
	}

	return result
}

/**
 * 将DSL边转换为Flow边
 * @param dslEdge DSL边
 * @returns Flow边
 */
const convertToFlowEdge = (dslEdge: any): Edge => {
	return {
		id: dslEdge.id,
		source: dslEdge.source,
		target: dslEdge.target,
		sourceHandle: dslEdge.sourceHandle,
		targetHandle: dslEdge.targetHandle,
		type: "commonEdge",
		markerEnd: {
			type: "arrow",
			width: 20,
			height: 20,
			color: "#4d53e8",
		},
		style: {
			stroke: "#4d53e8",
			strokeWidth: 2,
		},
		data: {
			allowAddOnLine: true,
		},
	}
}

/**
 * 将YAML DSL转换为Flow JSON
 * @param yamlDSL DSL对象
 * @returns Flow JSON对象
 */
export const yaml2json = (yamlDSL: FlowDSL): Flow => {
	try {
		// 转换基本信息
		const flow: Flow = {
			id:
				yamlDSL.flow.id ||
				`MAGIC-FLOW-${uuidv4().replace(/-/g, "")}-${Date.now().toString().slice(-8)}`,
			name: yamlDSL.flow.name,
			description: yamlDSL.flow.description || "",
			icon: yamlDSL.flow.icon || "",
			type: getFlowTypeNumber(yamlDSL.flow.type),
			tool_set_id: "not_grouped",
			edges: yamlDSL.edges.map((edge) => convertToFlowEdge(edge)),
			nodes: yamlDSL.nodes.map((node) => convertToFlowNode(node)),
			global_variable: convertToGlobalVariables(yamlDSL.variables),
			enabled: yamlDSL.flow.enabled !== undefined ? yamlDSL.flow.enabled : true,
			version_code: yamlDSL.flow.version || "1.0.0",
			creator: null,
			created_at: new Date().toISOString().replace("T", " ").substring(0, 19),
			modifier: null,
			updated_at: new Date().toISOString().replace("T", " ").substring(0, 19),
			creator_info: null,
			modifier_info: null,
			user_operation: 1,
		}

		return flow
	} catch (error) {
		console.error("转换YAML到JSON失败:", error)
		throw new Error(`转换YAML到JSON失败: ${error.message}`)
	}
}

/**
 * 将YAML字符串转换为Flow JSON对象
 * @param yamlString YAML字符串
 * @returns Flow JSON对象
 */
export const yamlString2json = (yamlString: string): Flow => {
	try {
		const yamlDSL = yaml.load(yamlString) as FlowDSL
		return yaml2json(yamlDSL)
	} catch (error) {
		console.error("解析YAML字符串失败:", error)
		throw new Error(`解析YAML字符串失败: ${error.message}`)
	}
}

/**
 * 将YAML字符串转换为JSON字符串
 * @param yamlString YAML字符串
 * @returns JSON字符串
 */
export const yamlString2jsonString = (yamlString: string): string => {
	try {
		const flow = yamlString2json(yamlString)
		return JSON.stringify(flow, null, 2)
	} catch (error) {
		console.error("转换YAML字符串到JSON字符串失败:", error)
		throw new Error(`转换YAML字符串到JSON字符串失败: ${error.message}`)
	}
}

/**
 * 将节点YAML字符串转换为单个Flow节点对象
 * @param nodeYamlString 节点的YAML字符串
 * @returns Flow节点对象
 */
export const nodeYamlString2json = (nodeYamlString: string): MagicFlow.Node => {
	try {
		// 解析YAML字符串为对象
		const dslNode = yaml.load(nodeYamlString) as any

		// 转换为Flow节点
		return convertToFlowNode(dslNode)
	} catch (error) {
		console.error("转换节点YAML字符串到节点对象失败:", error)
		throw new Error(`转换节点YAML字符串到节点对象失败: ${error.message}`)
	}
}

/**
 * 将节点YAML字符串转换为节点JSON字符串
 * @param nodeYamlString 节点的YAML字符串
 * @returns 节点的JSON字符串
 */
export const nodeYamlString2jsonString = (nodeYamlString: string): string => {
	try {
		const node = nodeYamlString2json(nodeYamlString)
		return JSON.stringify(node, null, 2)
	} catch (error) {
		console.error("转换节点YAML字符串到节点JSON字符串失败:", error)
		throw new Error(`转换节点YAML字符串到节点JSON字符串失败: ${error.message}`)
	}
}

// 更新默认导出
export default {
	yaml2json,
	yamlString2json,
	yamlString2jsonString,
	nodeYamlString2json,
	nodeYamlString2jsonString,
}
