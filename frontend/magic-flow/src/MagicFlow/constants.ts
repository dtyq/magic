import _ from "lodash"
import { NodeSchema, NodeWidget, nodeManager } from "./register/node"
import { getLatestNodeVersion } from "./utils"

export const prefix = "magic-flow-"

/**
 * 流程状态
 */
export enum FlowStatus {
	// 未保存
	UnSave = -1,

	// 草稿态
	Draft = 0,

	// 启用态
	Enable = 1
}

/**
 * 节点类型
 */
export enum NodeType {
    // 选择器
	If = "4",
}

/**
 * 默认的节点配置名称
 */
export const defaultParamsName = {
	params: "params",
	nodeType: "node_type",
    nextNodes: "next_nodes"
}


// 执行节点列表
export const getExecuteNodeList = () => {
	/** 过滤掉不需要显示在物料面板的节点 */
    return Object.keys(nodeManager.nodesMap)
            .filter((nodeType) => !nodeManager.notMaterialNodeTypes.includes(nodeType))
            .map(nodeType => {
                const latestVersion = getLatestNodeVersion(nodeType)
                return _.get(nodeManager.nodesMap, [nodeType, latestVersion], {} as NodeWidget)
            })
}
// 执行节点分组列表
export const getExecuteNodeGroupList = () => {
    const executeNodeList = getExecuteNodeList()
    return executeNodeList.reduce((acc, cur) => {
        const groupName = cur.schema.groupName || "默认分组"
        if (!acc[groupName]) acc[groupName] = []
        acc[groupName].push(cur.schema)
        return acc
    }, {} as Record<string, NodeSchema[]>)
}

export enum FlowDesignerEvents {
	// 保存/发布 触发事件
	SubmitStart = 1,

	// 保存/发布 触发事件完成
	SubmitFinished = 2,

	// 校验失败事件
	ValidateError = 3,

	// 物料面板显示状态变更事件
	MaterialShowStatusChanged = 4
}


// 渲染骨架的分辨率百分比
export const renderSkeletonRatio = 15

// 自适应视图需要进行渲染骨架的节点数量阈值
export const fitViewRatio = 30


// 前端缓存的key
export const localStorageKeyMap = {
	/** 前端交互模式 */
	InteractionMode: prefix + 'interaction-mode'
}

// 分组节点的默认内边距
export const GROUP_MIN_DISTANCE = 30

// 分组节点头部留白区域像素
export const GROUP_TOP_GAP = 38

export const DefaultNodeVersion = 'v0'
