import { DataSourceOption } from "@/common/BaseUI/DropdownRenderer/Reference"
import { BaseNodeType, nodeManager, NodeSchema, NodeVersion, NodeVersionWidget, NodeWidget } from "../register/node"
import { FormItemType } from "@/MagicExpressionWidget/types"
import Schema from "@/MagicJsonSchemaEditor/types/Schema"
import _ from "lodash"
import { Edge, XYPosition } from "reactflow"
import { MagicFlow } from "../types/flow"
import { generateSnowFlake } from "@/common/utils/snowflake"
import { pasteTranslateSize } from "../nodes/common/toolbar/useToolbar"
import { SchemaValueSplitor } from "@/MagicJsonSchemaEditor/constants"
import { InnerHandleType, NodeModelType } from "../nodes"
import { defaultEdgeConfig } from "../edges"
import { DefaultNodeVersion, GROUP_MIN_DISTANCE, GROUP_TOP_GAP, NodeType } from "../constants"
import { Ranksep } from "./reactflowUtils"
import { flowStore } from "../store"
import i18next from "i18next"

export const useQuery = () => {
	return new URLSearchParams(window.location.search)
}

/** 处理基本节点模型的渲染属性
 * MagicFlow.Node -> reactflow node
 */
export const handleRenderProps = (n: MagicFlow.Node, index: number, paramsName: MagicFlow.ParamsName) => {
	const nodeSchemaListMap = nodeManager.nodesMap
	const nodeType = n[paramsName.nodeType] as NodeType

	const isLoopBody = judgeIsLoopBody(nodeType)

	// 节点元信息是否为空（空数组，或者是空值）
	const isMetaEmpty = !n.meta || (Array.isArray(n.meta) && n.meta.length === 0)

	const nodeMeta = isMetaEmpty ? { position: { x: 0, y: 0 } } : n.meta

	// 当前节点的属性，icon，颜色等
	let currentNodeProperties = _.get(nodeSchemaListMap, [nodeType, getNodeVersion(n)], {} as NodeWidget)

	// 添加循环内节点的特殊属性
	addLoopProperties(n, paramsName)

	n.deletable = false
	n.id = n.node_id
	n.type = isLoopBody ? NodeModelType.Group : NodeModelType.CommonNode
	n.node_type = nodeType
	n.position = nodeMeta.position
	n.meta = nodeMeta
	n.name = n.name || currentNodeProperties?.schema?.label
	n.step = index
	n.data = {
		...n?.data,
		deletable: false,
		changeable: {
			// 默认可以切换节点类型
			nodeType: true,
			// 默认显示节点操作项（复制粘贴、删除）
			operation: true,
			...(currentNodeProperties?.schema?.changeable || {}),
		},
		handle: {
			// 默认携带终点
			withSourceHandle: true,
			// 默认具备源点
			operation: true,
			...(currentNodeProperties?.schema?.handle || {}),
		},
		style: {
			...(currentNodeProperties?.schema?.style || {}),
		},
		...currentNodeProperties?.schema,
        desc: n.remark || currentNodeProperties?.schema?.desc,
        icon: n?.data?.icon || currentNodeProperties?.schema?.icon,
		type: nodeType,
		index: index,
	}
}


export const getPxWidth = (text: string) => {
	// re-use canvas object for better performance
	const canvas = document.createElement("canvas")
	const context = canvas.getContext("2d")
	const fontFamily =
		"ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, \"Helvetica Neue\", Arial, \"Noto Sans\", sans-serif, \"Apple Color Emoji\", \"Segoe UI Emoji\", \"Segoe UI Symbol\", \"Noto Color Emoji\""
	const fontSize = 14
    if(!context) return 0
	context.font = `${fontSize}px ${fontFamily}`

	const metrics = context.measureText(text)

	return Math.abs(metrics.actualBoundingBoxLeft) + Math.abs(metrics.actualBoundingBoxRight)
}


/**
 * 将某段字符串复制到粘贴板
 */
export function copyToClipboard(text: string) {
	// 创建一个临时的textarea元素
	const textarea = document.createElement("textarea")
	// 设置textarea的值为要复制的文本
	textarea.value = text
	// 将textarea添加到DOM中
	document.body.appendChild(textarea)
	// 选择textarea中的文本
	textarea.select()
	// 将文本复制到剪贴板
	document.execCommand("copy")
	// 移除临时textarea元素
	document.body.removeChild(textarea)
}


// schema => 表达式数据源单个项
export function schemaToDataSource(currentNodeSchema: NodeSchema & {type: BaseNodeType}, schema: Schema, isRoot = true, isGlobal = false): DataSourceOption {
    let option = {} as DataSourceOption
    // 根节点
    if(isRoot) {
        option = {
            title: currentNodeSchema.label,
            key: currentNodeSchema.id,
            nodeId: currentNodeSchema.id,
            nodeType: currentNodeSchema.type,
            type: FormItemType.Object,
            isRoot: true,
            children: [] as DataSourceOption[],
			rawSchema: schema,
			isGlobal: false,
            selectable: true
        }
    }else {
        option = {
            // @ts-ignore
            title: schema.title || schema.key || '',
            // @ts-ignore
            key: schema.key,
            nodeId: currentNodeSchema.id,
            nodeType: currentNodeSchema.type,
            type: schema.type,
            isRoot: false,
            children: [] as DataSourceOption[],
			rawSchema: schema,
			isGlobal,
            selectable: true
        }

    }
    
    // 数组情况，直接return
    if(schema?.type === FormItemType.Array) {
		// console.log("array schema", schema)
		const itemsType = schema?.items?.type
        option.type = `${FormItemType.Array}${SchemaValueSplitor}${itemsType}`
        return option
    }
    // 对象情况，将每一个子字段作为一个children
    Object.entries(schema?.properties || {}).forEach(([key,field]) => {
        // @ts-ignore
        option.children?.push(schemaToDataSource(currentNodeSchema, {...field, key: isRoot ? key : `${option.key}.${key}`}, false, isGlobal))
    })

    return option
}

/** 获取引用上文值的前缀 */
export const getReferencePrefix = (node: any) => {
	if(node?.isConstant) return null
	const { nodeType2ReferenceKey } = nodeManager
	/** 硬编码了前缀的节点类型 */
	let prefix = node.nodeId
	if (Reflect.has(nodeType2ReferenceKey, node.nodeType)) {
		prefix = Reflect.get(nodeType2ReferenceKey, node.nodeType)
	}
	return prefix
}

/** 判断当前节点类型是否是变量节点类型 */
export const judgeIsVariableNode = (nodeType: string | number) => {
	
	const variableNodeTypes = nodeManager.variableNodeTypes

	const isVariableNode = variableNodeTypes.includes(nodeType)

	return isVariableNode
}

/** 判断当前节点类型是否是循环体类型 */
export const judgeIsLoopBody = (nodeType: string | number) => {
	
	const loopBodyType = nodeManager.loopBodyType
	return nodeType == loopBodyType
}
/** 获取某个节点类型的节点schema */
export const getNodeSchema = (nodeType: string | number, nodeVersion?: NodeVersion): NodeSchema => {
	
	const { nodeVersionSchema } = flowStore.getState()

    const version = nodeVersion || getLatestNodeVersion(nodeType) as string
	console.time("克隆操作")
	const result = _.get(nodeVersionSchema, [nodeType, version, 'schema'])
	console.timeEnd("克隆操作")
	return result

}


/** 获取全局的节点分组 */
export const getNodeGroups = () => {
	
	const { nodeGroups  } = nodeManager
	const result = _.cloneDeep(nodeGroups)
	return result

}

/** 判断是否为循环节点 */
export const judgeLoopNode = (nodeType: string | number) => {
	
	const loopNodeType = nodeManager.loopNodeType

	return nodeType == loopNodeType
}



/**
 * 根据节点Schema生成一个可用的节点
 * @param nodeSchema 节点Schema
 * @param paramsName 自定义参数名称
 * @params nodeId 生成的节点id
 * @params extraConfig 额外的节点配置
 */
export const generateNewNode = (nodeSchema: NodeSchema, paramsName: MagicFlow.ParamsName, nodeId: string, position: XYPosition, extraConfig?: Record<string, any>) => {
	const defaultParams = _.get(nodeSchema, [paramsName.params], null)

	console.time("克隆操作")
	const newNode = {
		data: {},
		[paramsName.params]: _.cloneDeep(defaultParams),
		id: nodeId,
		node_id:  nodeId,
		remark: "",
		[paramsName.nodeType]: nodeSchema.id,
		next_nodes: [],
		meta: {
			position
		},
		position,
		output: nodeSchema.output,
		input: nodeSchema.input,
		system_output: nodeSchema.system_output,
		step: 0,
        node_version: getLatestNodeVersion(nodeSchema.id),
		...(extraConfig || {})
	}
	console.timeEnd("克隆操作")
	return newNode as MagicFlow.Node
}

// 获取当前节点schema的最新版本，并做兜底
export const getLatestNodeVersion = (nodeType: BaseNodeType) => {
    const { nodeVersionSchema } = flowStore.getState()
    const latestNodeVersion = _.last(Object.keys(_.get(nodeVersionSchema, [nodeType], {})) || []) as string 
    return latestNodeVersion || DefaultNodeVersion
}

// 获取节点的版本，默认返回v0
export const getNodeVersion = (node: MagicFlow.Node) => {
    return node?.node_version ? node.node_version : DefaultNodeVersion
}


/** 是否注册了开始节点 */
export const isRegisteredStartNode = () => {
	
	const startNodeSchema = getNodeSchema(nodeManager.startNodeType)
	return !!startNodeSchema
}

/** 生成开始节点 */
export const generateStartNode = (paramsName: MagicFlow.ParamsName) => {
	const startNodeSchema = getNodeSchema(nodeManager.startNodeType)
	
	const startNodeId = generateSnowFlake()
	const startNodePosition = {
		x: 100,
		y: 200,
	}
	const newNode = generateNewNode(
		startNodeSchema,
		paramsName,
		startNodeId,
		startNodePosition,
	)

	return newNode
}


/** 根据节点，生成复制后的节点 */
export const generatePasteNode = (node: MagicFlow.Node, paramsName: MagicFlow.ParamsName) => {
	const newId = generateSnowFlake()
	
	const pasteNode = {
		...node,
		data: {...node.data},
		id: newId,
		node_id: newId,
		[paramsName?.nextNodes!]: node?.[paramsName?.nextNodes!] || [],
		position: { x: node.position!.x + pasteTranslateSize, y: node.position!.y + pasteTranslateSize }
	} as MagicFlow.Node

    
	return {
		pasteNode,
	}
}

/**
 * 生成复制后的边
 * @param rawNode 原始id到新id的映射表
 * @param oldRelationEdges 原始节点相关的边
 */
export const generatePasteEdges = (oldId2NewIdMap: Record<string,string>, oldRelationEdges: Edge[]) => {
	console.time("克隆操作")
	const cloneEdges = _.cloneDeep(oldRelationEdges)
	const newEdges = cloneEdges.reduce((acc, curEdge) => {
		curEdge.id = generateSnowFlake()
		if(Reflect.has(oldId2NewIdMap, curEdge.source)) {
			curEdge.source = Reflect.get(oldId2NewIdMap, curEdge.source)
		}
		if(Reflect.has(oldId2NewIdMap, curEdge.target)) {
			curEdge.target = Reflect.get(oldId2NewIdMap, curEdge.target)
		}
		return [...acc, curEdge ]
	}, [] as Edge[])
	console.timeEnd("克隆操作")
	return newEdges
}



/**
 * 生成循环体和相关的边
 * @param loopNode 循环节点
 * @param paramsName 自定义参数名称
 * @param edges 当前的边
 * @param addPosition 在那里新增的循环（画布、边、节点）
 * @returns 
 */
export const generateLoopBody = (loopNode: MagicFlow.Node, paramsName:MagicFlow.ParamsName, edges: Edge[]) => {
	const id = generateSnowFlake()
	const loopNodeSchema = getNodeSchema(loopNode[paramsName.nodeType])
	const loopNodeWidth = parseInt(loopNodeSchema?.style?.width as string, 10)
	const loopStartSchema = getNodeSchema(nodeManager.loopStartType)
	const loopStartWidth = parseInt(loopStartSchema?.style?.width as string, 10)
	const loopStartConfig = nodeManager.loopStartConfig

	const newNodes = [] as MagicFlow.Node[]
	const newEdges = [] as Edge[]
	// 循环体的默认节点列表
	const defaultLoopBodyNodes = [] as MagicFlow.Node[]

	const nodePosition = {
		x: (loopNode?.position?.x || 0) + loopNodeWidth + Ranksep,
		y: loopNode?.position?.y || 0
	}

	const loopBodyType = nodeManager.loopBodyType

	if(!loopBodyType) {
		console.error("没有注册循环体节点类型")
	}

	const loopBodyNode = {
		[paramsName.params]: null,
		id: id,
		node_id:  id,
		remark: "",
		name: i18next.t("flow.loopBody", { ns: "magicFlow" }),
		[paramsName.nodeType]: loopBodyType,
		next_nodes: [],
		type: NodeModelType.Group,
		meta: {
			position: nodePosition,
			// 用于后端保存及查询
			parent_id: loopNode.id
		},
		data: {
			description: i18next.t("flow.loopBodyDesc", { ns: "magicFlow" }),
		},
		position: nodePosition,
		deletable: false,
		output: null,
		input: null,
        node_version: getLatestNodeVersion(loopBodyType),
		step: 0,
		style: {
			width: loopStartWidth + GROUP_MIN_DISTANCE * 2,
			height: loopStartConfig.height +  GROUP_TOP_GAP + GROUP_MIN_DISTANCE * 2
		},
	}

	/** 循环起始节点生成逻辑 */
	const loopStartNodeSchema = getNodeSchema(nodeManager.loopStartType)
	const loopStartNodeId = generateSnowFlake()
	const loopStartNode = generateNewNode(loopStartNodeSchema, paramsName, loopStartNodeId, {
		x: GROUP_MIN_DISTANCE,
		y: GROUP_MIN_DISTANCE + GROUP_TOP_GAP
	})
	defaultLoopBodyNodes.push(loopStartNode)

	// 设置循环节点与循环体节点的关联id，后端用于查询
	_.set(loopNode, ['meta', 'relation_id'], loopBodyNode.id)
	
	// 必须先增加循环体，不然expandParent不生效
	newNodes.push(loopBodyNode)

	// 生成循环体的节点
	defaultLoopBodyNodes.forEach((n, i) => {
		n.parentId = loopBodyNode.id
		n.expandParent = true
		n.extent = 'parent'
		n.meta.parent_id = loopBodyNode.id
		handleRenderProps(n, i, paramsName)
		newNodes.push(n)
	})

	const hasEdge = edges.find(edge => edge.source === loopNode.id && edge.target === loopBodyNode.id)
	if(!hasEdge) {
		newEdges.push({
			id: generateSnowFlake(),
			source: loopNode.id,
			target: loopBodyNode.id,
			sourceHandle: InnerHandleType.LoopHandle,
			...defaultEdgeConfig,
			deletable: false,
			data: {
				allowAddOnLine: false,
			}
		})
	}

	return {
		newEdges,
		newNodes
	}
}

// export const sortNodes = (a: MagicFlow.Node, b: MagicFlow.Node): number => {
// 	if (a.parentId && b.parentId) {
// 		return 0;
// 	}

// 	return a.parentId && !b.parentId ? 1 : -1;
// };

/** 获取当前已经注册的节点类型 */
export const getRegisterNodeTypes = () => {
    const { nodeVersionSchema } = flowStore.getState();
	return Object.values(nodeVersionSchema).filter(nodeVersionWidget => {
        const addableVersionMap =  Object.entries(nodeVersionWidget).reduce((addableNodeVersionWidget, [nodeVersion, nodeWidget]) => {
            // console.log(nodeWidget.schema)
            if(nodeWidget.schema.addable === false) {
                return addableNodeVersionWidget
            }
            addableNodeVersionWidget[nodeVersion] = nodeWidget
            return addableNodeVersionWidget
        }, {} as NodeVersionWidget)
        return Object.keys(addableVersionMap).length > 0
	}).map(nodeVersionWidget => {
        const latestWidget = _.last(Object.values(nodeVersionWidget))
        return latestWidget?.schema?.id
    }).filter(nodeType => !!nodeType) as BaseNodeType[]
}


/** 根据新增的边的源点，获取额外的边属性 */
export const getExtraEdgeConfigBySourceNode = (sourceNode: MagicFlow.Node) => {
	return sourceNode?.parentId ? {zIndex: 1001} : {}
}


/** 回显时，根据循环体节点meta，设置回显属性 */
export const addLoopProperties = (node: MagicFlow.Node, paramsName: MagicFlow.ParamsName) => {
	// 不是循环体节点 & 是循环体内的节点
	const isLoopBody = judgeIsLoopBody(node[paramsName.nodeType])
	if(!isLoopBody && node?.meta?.parent_id) {
		Object.assign(node, {
			parentId : node.meta.parent_id,
			expandParent : true,
			extent : 'parent'
		})
	}
}


export const searchLoopRelationNodesAndEdges = (loopNode: MagicFlow.Node, nodes: MagicFlow.Node[], edges: Edge[]) => {

	// 循环体节点id
	const loopBodyNodeId = nodes.find(_n => _n?.meta?.parent_id === loopNode.id)?.id
	// 循环节点到循环体节点的边
	const loopNode2LoopBodyEdgeId = edges.find(_e => _e.source === loopNode.id && _e.target === loopBodyNodeId)?.id

	// 循环体内的节点id列表
	const childNodeIds = nodes.filter(_n => _n?.meta?.parent_id === loopBodyNodeId).map(_n => _n.id)
	// 循环体内的边id列表
	const childEdgeIds = edges.filter(_e => childNodeIds.includes(_e.source) || childNodeIds.includes(_e.target)).map(_e => _e.id)


	return {
		nodeIds: [...childNodeIds, loopBodyNodeId!],
		edgeIds: [...childEdgeIds, loopNode2LoopBodyEdgeId!]
	}
}

/** 
 * 十六进制转rgba
 * @params hex 十六进制
 * @params alpha 透明度，如0.05表示5%
 * 示例使用
	const hexColor = "#FF7D00";
	const alpha = 0.05; // 5% 透明度
	const rgbaColor = hexToRgba(hexColor, alpha);
	console.log(rgbaColor);  // 输出: #FF7D000D
 */
export function hexToRgba(hex: string, alpha = 1) {
	if(!hex) return ""
    // 移除 '#' 符号
    hex = hex.replace('#', '');

    // 将颜色分为 RGB 部分
    let r = parseInt(hex.substring(0, 2), 16);
    let g = parseInt(hex.substring(2, 4), 16);
    let b = parseInt(hex.substring(4, 6), 16);

    // 确保 alpha 在 0 到 1 之间，并转为 0 到 255 的范围
    let a = Math.round(alpha * 255);

    // 返回 RGBA 值，透明度为两位16进制数
    return `#${hex}${a.toString(16).padStart(2, '0')}`;
}


// 检查是不是循环起始
export const checkIsLoopStart = (node: MagicFlow.Node,paramsName: MagicFlow.ParamsName) => {
	return nodeManager.loopStartType == node?.[paramsName.nodeType] && node?.meta?.parent_id
}


/** 检查是否在循环体内 */
export const checkIsInGroup = (node: MagicFlow.Node) => {
	return node?.meta?.parent_id
}
