import { TabObject } from "@/MagicFlow/components/FlowMaterialPanel/constants"
import { WidgetValue } from "@/MagicFlow/examples/BaseFlow/common/Output"
import { CSSProperties, ComponentType, ReactNode } from "react"

export type BaseNodeType = string | number

export type LoopStartConfig = { height: number; [key: string]: any }

export type NodeSchema = {
	// 节点名称
	label: string
	// 节点图标
	icon: ReactNode | null
	// 节点图标背景色
	color: string
	// 节点类型
	id: BaseNodeType
	// 节点描述
	desc: string
	// 节点分组名
	groupName?: string
	// 节点自定义样式
	style?: CSSProperties
	// 节点的端点处理
	handle?: {
		// 携带终点（被链接）
		withSourceHandle: boolean
		// 携带源点
		withTargetHandle: boolean
	}
	// 当前节点是否可以变更节点类型
	changeable?: {
		// 是否可以删除/复制等
		operation: boolean
		// 是否可以切换节点类型
		nodeType: boolean
	}
	// 默认配置
	params?: Record<string, any>
	output?: WidgetValue["value"] | null
	input?: WidgetValue["value"] | null
	// 节点头部右侧自定义组件
	headerRight?: React.ReactElement
	// 是否默认可添加
	addable?: boolean
	// 节点头像取值路径(当不希望节点是图标，而是一个头像时，icon需要设置成null，并传入avatarPath)
	avatarPath?: string[]
	// 节点头像取值函数
	[key: string]: any
}

export type NodeVersion = string

export type NodeWidget = {
	// 注册节点所用的dsl
	schema: NodeSchema
	// 节点自定义参数组件
	component: ComponentType<any>
}

export type NodeVersionWidget = Record<NodeVersion, NodeWidget>

interface RegisterNodeProps {
	nodeType: BaseNodeType
	nodeVersionWidget: NodeVersionWidget
}

export type NodeGroup = {
	groupName: string
	nodeTypes: BaseNodeType[]
	desc?: string
	children?: NodeGroup[]
	icon?: ReactNode
	color?: string
	avatar?: string
}

// NodeTypes应该传入enum值
class NodeManager {
	// 实际已经完成注册的节点映射表
	nodesMap = {} as Record<BaseNodeType, NodeVersionWidget>

	// 存在多个出口端点的节点类型
	branchNodeIds = [] as BaseNodeType[]

	// 可以做为引用类型节点的节点类型列表
	canReferenceNodeTypes = [] as BaseNodeType[]

	// 不需要显示到物料面板的节点类型列表
	notMaterialNodeTypes = [] as BaseNodeType[]

	// 当引用上文节点时，需要显示指定引用值前缀的节点映射表
	nodeType2ReferenceKey = {} as Record<string, BaseNodeType>

	// 变量节点类型注册，注册完，将会改变引用上下文的取值方式，所有变量类型的数据源都会放在「变量」的分类下
	variableNodeTypes = [] as BaseNodeType[]

	// 当前节点的分组关系列表
	nodeGroups = [] as NodeGroup[]

	// 起始节点类型
	startNodeType = "startNodeType" as BaseNodeType

	// 循环节点类型
	loopNodeType = "loopNode" as BaseNodeType

	// 循环体节点类型
	loopBodyType = "loopBody" as BaseNodeType

	// 循环起始节点类型
	loopStartType = "loopStart" as BaseNodeType

	// 左侧物料列表特殊的节点类型注册
	materialNodeTypeMap = {} as Partial<Record<TabObject, BaseNodeType>>

	// 节点的头像存储路径
	avatarPath = ["params", "avatar"]

	// 循环起始节点日志
	loopStartConfig = {
		height: 0,
	} as LoopStartConfig

	constructor() {}

	registerNode({ nodeType, nodeVersionWidget }: RegisterNodeProps) {
		// if (Reflect.has(this.nodesMap, nodeType)) {
		// 	console.warn(`已存在类型 ${nodeType}，不能再注册`)
		// 	return
		// }
		Reflect.set(this.nodesMap, nodeType, nodeVersionWidget)
	}

	registerBranchNodes(branchNodeTypes: BaseNodeType[]) {
		this.branchNodeIds = branchNodeTypes
	}

	registerCanReferenceNodeTypes(canReferenceNodeTypes: BaseNodeType[]) {
		this.canReferenceNodeTypes = canReferenceNodeTypes
	}

	registerNotMaterialNodeTypes(notMaterialNodeTypes: BaseNodeType[]) {
		this.notMaterialNodeTypes = notMaterialNodeTypes
	}

	registerNodeType2ReferenceKey(nodeType2ReferenceKey: Record<BaseNodeType, string>) {
		this.nodeType2ReferenceKey = nodeType2ReferenceKey
	}

	registerVariableNodeTypes(nodeTypes: BaseNodeType[]) {
		this.variableNodeTypes = nodeTypes
	}

	registerStartNodeType(nodeType: BaseNodeType) {
		this.startNodeType = nodeType
	}

	registerLoopNodeType(nodeType: BaseNodeType) {
		this.loopNodeType = nodeType
	}

	registerLoopBodyType(nodeType: BaseNodeType) {
		this.loopBodyType = nodeType
	}

	registerLoopStartType(nodeType: BaseNodeType) {
		this.loopStartType = nodeType
	}

	registerLoopStartConfig(config: LoopStartConfig) {
		this.loopStartConfig = config
	}

	registerNodeGroups(groups: NodeGroup[]) {
		this.nodeGroups = groups
	}

	registerMaterialNodeTypeMap(tab2NodeType: Partial<Record<TabObject, BaseNodeType>>) {
		this.materialNodeTypeMap = tab2NodeType
	}

	registerAvatarPath(avatarPath: string[]) {
		this.avatarPath = avatarPath
	}
}

export const nodeManager = new NodeManager()

/**
 * 向外暴露注册节点方法
 */
export const installNodes = (nodesMap: Record<BaseNodeType, NodeVersionWidget>) => {
	console.log(nodesMap)
	Object.entries(nodesMap).forEach(([nodeType, nodeVersionWidget]) => {
		nodeManager.registerNode({
			nodeType,
			nodeVersionWidget,
		})
	})
	return nodeManager
}

/**
 * 向外暴露注册「分支类」节点的方法
 */
export const registerBranchNodes = (nodeTypes: BaseNodeType[]) => {
	nodeManager.registerBranchNodes(nodeTypes)
}

/**
 * 向外暴露注册「可引用类」节点的方法
 */
export const registerCanReferenceNodeTypes = (nodeTypes: BaseNodeType[]) => {
	nodeManager.registerCanReferenceNodeTypes(nodeTypes)
}

/**
 * 向外暴露注册「不需要展示到物料列表」节点的方法
 */
export const registerNotMaterialNodeTypes = (nodeTypes: BaseNodeType[]) => {
	nodeManager.registerNotMaterialNodeTypes(nodeTypes)
}

/**
 * 向外暴露注册需要「指定引用上文节点时，固定的前缀」
 */
export const registerNodeType2ReferenceKey = (nodeTypes: Record<BaseNodeType, string>) => {
	nodeManager.registerNodeType2ReferenceKey(nodeTypes)
}

/**
 * 向外暴露注册「变量节点类型列表」
 */
export const registerVariableNodeTypes = (nodeTypes: BaseNodeType[]) => {
	nodeManager.registerVariableNodeTypes(nodeTypes)
}

/**
 * 向外暴露注册「触发节点类型」
 */
export const registerStartNodeType = (nodeType: BaseNodeType) => {
	nodeManager.registerStartNodeType(nodeType)
}

/**
 * 向外暴露注册「循环节点类型」
 */
export const registerLoopNodeType = (nodeType: BaseNodeType) => {
	nodeManager.registerLoopNodeType(nodeType)
}

/**
 * 向外暴露注册「循环体节点类型」
 */
export const registerLoopBodyType = (nodeType: BaseNodeType) => {
	nodeManager.registerLoopBodyType(nodeType)
}

/**
 * 向外暴露注册「循环体起始类型」
 */
export const registerLoopStartType = (nodeType: BaseNodeType) => {
	nodeManager.registerLoopStartType(nodeType)
}

export const registerLoopStartConfig = (config: LoopStartConfig) => {
	nodeManager.registerLoopStartConfig(config)
}

/**
 * 向外暴露注册「节点分组信息」
 */
export const registerNodeGroups = (nodeGroups: NodeGroup[]) => {
	nodeManager.registerNodeGroups(nodeGroups)
}

/**
 * 向外暴露注册左侧「特殊物料面板节点类型」方法
 */
export const registerMaterialNodeTypeMap = (
	tab2NodeType: Partial<Record<TabObject, BaseNodeType>>,
) => {
	nodeManager.registerMaterialNodeTypeMap(tab2NodeType)
}

/**
 * 向外暴露注册节点头像读取路径
 */
export const registerAvatarPath = (avatarPath: string[]) => {
	nodeManager.registerAvatarPath(avatarPath)
}
