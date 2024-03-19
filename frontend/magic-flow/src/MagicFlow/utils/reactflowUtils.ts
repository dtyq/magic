import { getIncomers, internalsSymbol, getOutgoers, Node, Edge, Position, Connection, ViewportHelperFunctions, getNodesBounds } from "reactflow"
import dagre from "dagre"
import { UpdateStepType } from "../hooks/useBaseFlow"
import _ from "lodash"
import { MagicFlow } from "../types/flow"
import { nodeManager } from "../register/node"
import { GROUP_MIN_DISTANCE, GROUP_TOP_GAP } from "../constants"
import { generatePasteEdges, generatePasteNode, judgeIsLoopBody } from "."

export const Ranksep = 100
export const Nodesep = 100

// 获取节点的中心坐标
export function getNodeCenter (node: Node) {
	return {
		x: node.positionAbsolute!.x + node.width! / 2,
		y: node.positionAbsolute!.y + node.height! / 2
	}
}

// 获取某条边的原点和终点坐标
export function getEdgeHandlePosition (sourceNode: Node, targetNode: Node) {
	const sourceNodeHandle = sourceNode[internalsSymbol]!.handleBounds!.source![0]
	const targetNodeHandle = targetNode[internalsSymbol]!.handleBounds!.target![0]

	return {
		sx: sourceNodeHandle.x,
		sy: sourceNodeHandle.y,
		tx: targetNodeHandle.x,
		ty: targetNodeHandle.y
	}
}

// 递归获取节点的所有前置节点
export const getAllPredecessors = (curNode: MagicFlow.Node, nodes: Node[], edges: Edge[], predecessors = [] as MagicFlow.Node[]): MagicFlow.Node[] => {
	// 使用 React Flow 提供的 getIncomers 函数获取节点的所有入度节点
    // @ts-ignore
	const incomers = [...(getIncomers(curNode, nodes, edges) || [])] as MagicFlow.Node[]

    // 当入度节点是分支节点，对入度节点进行二次处理
    const branchNodes = incomers.filter(incomeNode => nodeManager.branchNodeIds.includes(`${incomeNode.node_type}`))
    branchNodes.forEach(branchNode => {
        const edgesBranchNode2CurNode = edges.filter(edge => edge.source === branchNode.node_id && edge.target === curNode.node_id)
        const branchIds = edgesBranchNode2CurNode.map(edge => edge.sourceHandle)
		if(!branchNode.params) return
        branchNode.params.outputBranchIds = branchIds
    })

	// 如果没有入度节点，或者已经遍历过所有前置节点，则返回当前结果
	if (!incomers || incomers.length === 0) {
		return predecessors
	}

	// 合并新的前置节点 到已有的前置节点数组中
	const updatedPredecessors = [ ...incomers, ...predecessors ]

	// 对于每个新的前置节点，递归调用该函数，获取其前置节点
	// eslint-disable-next-line no-unused-vars
	return incomers.reduce(
        // @ts-ignore
		(acc, pred) => getAllPredecessors(pred, nodes, edges, acc),
		updatedPredecessors
	) as MagicFlow.Node[]
}

// 递归获取节点的所有后置节点
export const getAllPostNodes = (curNode: MagicFlow.Node, nodes: MagicFlow.Node[], edges: Edge[], postNodes = [] as MagicFlow.Node[]): MagicFlow.Node[] => {
	// 使用 React Flow 提供的 getOutgoers 函数获取节点的所有出度节点
    // @ts-ignore
	const outNodes = getOutgoers(curNode, nodes, edges)

	// 如果没有出度节点，或者已经遍历过所有前置节点，则返回当前结果
	if (!outNodes || outNodes.length === 0) {
		return postNodes
	}

	// 合并新的前置节点 到已有的前置节点数组中
	const updatedPredecessors = [ ...outNodes, ...postNodes ]

	// 对于每个新的前置节点，递归调用该函数，获取其后置节点
	// eslint-disable-next-line no-unused-vars
	return outNodes.reduce(
        // @ts-ignore
		(acc, pred) => getAllPostNodes(pred, nodes, edges, acc),
		updatedPredecessors
	) as MagicFlow.Node[]
}

// 递归获取节点的所有后置节点
// export const setNodeSteps = (curNode, nodes, edges, postNodes = [], prevStep = 0) => {

// 	// 使用 React Flow 提供的 getOutgoers 函数获取节点的所有出度节点
// 	const outNodes = getOutgoers(curNode, nodes, edges)

// 	// 对于每个新的前置节点，递归调用该函数，获取其后置节点
// 	// eslint-disable-next-line no-unused-vars
// 	return outNodes.reduce(
// 		(acc, pred) => getAllPostNodes(pred, nodes, edges, acc),
// 		updatedPredecessors
// 	)
// }

export function sortByEdges (nodes: MagicFlow.Node[], edges: Edge[]) {
	// 创建一个字典，用来存储每个节点的入度
	const indegree = {} as Record<string, number>

	// 创建一个字典，用来存储每个节点的出边
	const outEdges = {} as Record<string, string[]>

	// 初始化入度和出边字典
	for (const node of nodes) {
		indegree[node.id] = 0
		outEdges[node.id] = []
	}

	// 计算每个节点的入度
	for (const edge of edges) {
		indegree[edge.target]++
		outEdges[edge.source].push(edge.target)
	}

	// 创建结果数组
	const result = [] as MagicFlow.Node[]
	const nextNodes = [] as MagicFlow.Node[]

	// 将入度为0的节点加入结果数组
	for (const node of nodes) {
		if (indegree[node.id] === 0) {
			nextNodes.push(node)
			result.push(node)
		}
	}

	// 遍历结果数组，并根据出边更新入度，直到结果数组为空
	while (nextNodes.length > 0) {
		const currentNode = nextNodes.shift()

        if(!currentNode) continue

		// 获取当前节点的所有出边
		const currentOutEdges = outEdges[currentNode.id]

		// 遍历当前节点的出边
		for (const targetNodeId of currentOutEdges) {
			// 将目标节点的入度减一
			indegree[targetNodeId]--

			// 如果目标节点的入度为0，则将其加入结果数组
			if (indegree[targetNodeId] === 0) {
				const targetNode = nodes.find(node => node.id === targetNodeId)
				if(targetNode){
                    nextNodes.push(targetNode)
				    result.push(targetNode)
                }
			}
		}
	}

	return result
}

/** 进行dagre实际布局 */
export const dagreLayout = (direction="TB", nodes:MagicFlow.Node[], edges: Edge[]) => {
	const triggerNode = nodes[0]
	const dagreGraph = new dagre.graphlib.Graph()
	dagreGraph.setDefaultEdgeLabel(() => ({}))

	// 保持起点不变，其他节点进行自动布局
	dagreGraph.setGraph({
		rankdir: direction,
		ranksep: Ranksep,
		nodesep: Nodesep,

		marginx: 0,
		marginy: 0
	})

	nodes.forEach((node: MagicFlow.Node) => {
		dagreGraph.setNode(node.id, { width: node.width, height: node.height })
	})

	edges.forEach((edge) => {
		dagreGraph.setEdge(edge.source, edge.target)
	})

	dagre.layout(dagreGraph)

	return dagreGraph
}

export const getLayoutElements = (_nodes: MagicFlow.Node[], _edges: Edge[], direction = "TB", paramsName: MagicFlow.ParamsName) => {

	const result = {
		nodes: _nodes,
		edges: _edges
	}

	const hasNodeWithoutSize = _nodes.some(n => !n.width || !n.height)
	if (hasNodeWithoutSize) return result

	if (_nodes.length === 0) return result

	const withoutGroupNodes = _nodes.filter(_n => !_n.parentId)

	const resultEdges = [..._edges]
	const resultNodes = [...withoutGroupNodes]

	const isHorizontal = direction === "LR"
	const dagreGraph = dagreLayout(direction, resultNodes, resultEdges)

	// 分组布局实例map，分组id -> 分组布局实例，可以拿到指定分组的子节点布局坐标
	const subFlowDagreMap = {} as Record<string, dagre.graphlib.Graph<{}>>

	_nodes.forEach((_n) => {
		const node = resultNodes.find(n => n.id === _n.id)!

		// 如果是分组节点，则需要对所有分组内的节点再进行一次布局优化
		// 前提：分组节点的顺序必须控制在分组子节点之前
		if(judgeIsLoopBody(node?.[paramsName.nodeType])) {
			const groupNodes = _nodes.filter(n => n.parentId === node.id)
			const groupNodeIds = groupNodes.map(n => n.id)
			const groupEdges = _edges.filter(n => groupNodeIds.includes(n.source) || groupNodeIds.includes(n.target))
			const subFlowDagreInstance = dagreLayout(direction, groupNodes, groupEdges)
			subFlowDagreMap[node.id] = subFlowDagreInstance
		}

		// 如果是分组内的节点
		if(!node) {
			// const parentNodeWithPosition = dagreGraph.node(node.parentId)
			const subFlowDagreInstance = Reflect.get(subFlowDagreMap,_n.parentId!)
			const childNodeWithPosition = subFlowDagreInstance?.node?.(_n.id)
			// 手动往结果数组添加分组的子节点
			resultNodes.push({
				..._n,
				position: {
					x: childNodeWithPosition?.x - childNodeWithPosition.width / 2 + GROUP_MIN_DISTANCE || 0,
					y: childNodeWithPosition?.y - childNodeWithPosition.height / 2 + GROUP_MIN_DISTANCE + GROUP_TOP_GAP || 0,
				},
				// @ts-ignore
				positionAbsolute: null
			})
		}else {
			const nodeWithPosition = dagreGraph.node(node?.id)
			node.targetPosition = isHorizontal ? Position.Left : Position.Top
			node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom
			node.position = {
				x: nodeWithPosition.x - node.width! / 2,
				y: nodeWithPosition.y - node.height! / 2
			}
		}

		return node
	})


	// 针对分组外壳节点进行进一步处理，主要是限制尺寸
	resultNodes.filter(n => judgeIsLoopBody(n[paramsName.nodeType])).forEach((groupNode) => {
		const subNodes = resultNodes.filter(n => n.parentId === groupNode.id)
		const isEmptyGroup = subNodes.length === 0
		// console.log("subNodes",subNodes)
		const { width, height } = getNodesBounds(subNodes)
		groupNode.width = isEmptyGroup ? 480 : width + GROUP_MIN_DISTANCE * 2
		groupNode.height = isEmptyGroup ? 600 : height + GROUP_TOP_GAP + GROUP_MIN_DISTANCE * 2
		groupNode.style = {
			width: groupNode.width,
			height: groupNode.height
		}

		// console.log("groupNode",groupNode, width, height)
	})


	return { nodes: resultNodes, edges: resultEdges }
}

/**
 * 更新步骤数据
 * @type {*}  类型，通过连线还是删除连线
 * @connection {*} 当前连线
 * @nodeConfig {*} 节点配置
 * @returns
 */

type UpdateTargetNodesStepProps = {
    type: UpdateStepType
    connection: Connection | Edge
    nodeConfig: Record<string, MagicFlow.Node>
    nodes: MagicFlow.Node[]
    edges: Edge[]
    beforeStep?: number
}

export const updateTargetNodesStep = ({
	type,
	connection,
	nodeConfig,
	nodes,
	edges,
	beforeStep = 0
}: UpdateTargetNodesStepProps) => {
	let sourceNode = nodes.find((n) => n.node_id === connection.source)
	if (type === UpdateStepType.Connect) {
		beforeStep = sourceNode!.step
	}
	if (!sourceNode) return
    // @ts-ignore
	const outNodes = getOutgoers(sourceNode, nodes, edges) as MagicFlow.Node[]

	for (const outNode of outNodes) {
		const outNodeConfig = nodeConfig[outNode.node_id]

		if (!outNodeConfig) {
			continue
		}

		const outNodeStep = beforeStep + 1
		outNodeConfig.step = outNodeStep

		nodeConfig[outNode.node_id] = outNodeConfig

		const _nodeIndex = nodes.findIndex((n) => n.node_id === outNode.node_id)
		if (_nodeIndex === -1) return
		nodes.splice(_nodeIndex, 1, { ...nodes[_nodeIndex], step: outNodeStep })

		const outEdges = edges.filter((edge) => edge.source === outNode.node_id)
		outEdges.forEach((outEdge) => {
			updateTargetNodesStep({
				type,
				connection: outEdge,
				nodeConfig,
				nodes,
				edges,
				beforeStep: beforeStep + 1
			})
		})

	}
}

/**
 * 校验是否存在执行节点不在流程运行范围内（如果有节点不会被执行，则会做提示）
 */
export const checkHasNodeOutOfFlow = (nodes: MagicFlow.Node[], edges: Edge[]) => {
	if (!nodes || nodes.length === 0) return false
	const triggerNode = nodes[0]
	const postNodes = getAllPostNodes(triggerNode, nodes, edges)
	const uniqPostNodes = _.uniqBy(postNodes, "nodeId")
	return uniqPostNodes.length !== nodes.length - 1
}

/** 计算所有节点的中点 */
export const calculateMidpoint = (nodes: MagicFlow.Node[]) => {
	const positions = nodes.map(n => n.position || {x: 0, y: 0})
    const totalPositions = positions.length;

    // 累加所有位置的 x 和 y 坐标
    const total = positions.reduce((acc, pos) => {
        acc.x += pos.x;
        acc.y += pos.y;
        return acc;
    }, {x: 0, y: 0});

    // 计算中点坐标
    const midpoint = {
        x: total.x / totalPositions,
        y: total.y / totalPositions
    };

    return midpoint;
}


/** 在分组内新增节点时，获取节点的实际渲染坐标 */
export const getSubNodePosition = (event: any, screenToFlowPosition: ViewportHelperFunctions['screenToFlowPosition'], parentNode: MagicFlow.Node) => {

	const groupBodyPosition = parentNode?.position || { x: 0, y: 0 }

	const newNodePosition = screenToFlowPosition({
		x: event?.clientX || 100,
		y: event?.clientY || 200,
	})

	return {
		x: newNodePosition.x - groupBodyPosition.x,
		y: newNodePosition.y - groupBodyPosition.y,
	}
}


/**
 * 生成拷贝后的节点和边
 * @param nodeConfig 当前节点完整配置
 * @param selectionNodes 选中的节点
 * @param selectionEdges 选中的边
 * @param paramsName 自定义字段
 * @returns 
 */
export const generatePasteNodesAndEdges = (nodeConfig: Record<string, MagicFlow.Node>,selectionNodes: MagicFlow.Node[], selectionEdges: Edge[], paramsName: MagicFlow.ParamsName) => {

    const selectedNodeIds = selectionNodes.map((n) => n.id)
    const oldId2NewIdMap = {} as Record<string, string>

    // 生成复制后的节点及配置
    const pasteNodeInfos = selectionNodes.map((n) => {
        const paste = generatePasteNode(n, paramsName)
        oldId2NewIdMap[n.id] = paste.pasteNode.id
        
        // 处理next_nodes：只保留指向选中范围内节点的引用，移除指向外部节点的引用
        if (paste.pasteNode[paramsName.nextNodes]) {
            const nextNodes = paste.pasteNode[paramsName.nextNodes] || []
            // 只保留在选中范围内的nextNodes
            const filteredNextNodes = nextNodes.filter((nodeId: string) => selectedNodeIds.includes(nodeId))
            paste.pasteNode[paramsName.nextNodes] = filteredNextNodes
        }

        // 处理分支节点的branches
        if (nodeManager.branchNodeIds.includes(`${paste.pasteNode.node_type}`)) {
            // 获取params字段中的branches
            const branches = _.get(paste.pasteNode, [paramsName.params, 'branches'])
            
            if (branches && Array.isArray(branches)) {
                // 对每个分支进行处理，只保留指向选中范围内节点的next_nodes
                branches.forEach(branch => {
                    if (branch && typeof branch === 'object' && Array.isArray(branch.next_nodes)) {
                        branch.next_nodes = branch.next_nodes.filter((nodeId: string) => selectedNodeIds.includes(nodeId))
                    }
                })
                
                // 更新节点的branches
                _.set(paste.pasteNode, [paramsName.params, 'branches'], branches)
            }
        }

        return { ...paste }
    })

    // 现在更新next_nodes和branches中的节点ID引用
    pasteNodeInfos.forEach(({ pasteNode }) => {
        // 更新常规next_nodes
        if (pasteNode[paramsName.nextNodes] && Array.isArray(pasteNode[paramsName.nextNodes])) {
            pasteNode[paramsName.nextNodes] = pasteNode[paramsName.nextNodes].map(
                (nodeId: string) => oldId2NewIdMap[nodeId] || nodeId
            );
        }
        
        // 更新分支节点的branches中的next_nodes
        if (nodeManager.branchNodeIds.includes(`${pasteNode.node_type}`)) {
            const branches = _.get(pasteNode, [paramsName.params, 'branches']);
            if (branches && Array.isArray(branches)) {
                branches.forEach(branch => {
                    if (branch && typeof branch === 'object' && Array.isArray(branch.next_nodes)) {
                        branch.next_nodes = branch.next_nodes.map(
                            (nodeId: string) => oldId2NewIdMap[nodeId] || nodeId
                        );
                    }
                });
                _.set(pasteNode, [paramsName.params, 'branches'], branches);
            }
        }
    });

    // 进一步处理引用关系，比如说被复制节点A引用了被复制节点B，则需要手动替换为新的id，通过正则替换即可
    pasteNodeInfos.forEach(({ pasteNode }) => {
        // 需要替换引用ID的属性
        const propsToReplace = [
            paramsName.params,
            'input',
            'output',
            'parentId',
            'meta'
        ]
        
        // 存储每个属性的字符串形式
        const stringifiedProps: Record<string, string> = {}
        
        // 将每个属性转换为字符串
        propsToReplace.forEach(propName => {
            if (pasteNode?.[propName]) {
                stringifiedProps[propName] = JSON.stringify(pasteNode[propName])
            }
        })
        
        // 替换所有的旧ID为新ID
        Object.entries(oldId2NewIdMap).forEach(([oldId, newId]) => {
            const regex = new RegExp(oldId, "g")
            
            // 对每个属性应用替换
            Object.keys(stringifiedProps).forEach(propName => {
                stringifiedProps[propName] = stringifiedProps[propName].replace(regex, newId)
            })
        })
        
        // 更新节点的对应属性
        Object.keys(stringifiedProps).forEach(propName => {
            _.set(pasteNode, [propName], JSON.parse(stringifiedProps[propName]))
        })
    })

    // 生成复制后的边
    const relationEdges = selectionEdges.filter((e) => {
        // 如果存在有源点或者终点不在已选节点范围内，则过滤掉
        const isRelation =
            selectedNodeIds.includes(e.source) && selectedNodeIds.includes(e.target)

        return isRelation
    })
    /** 针对当前复制的节点相关的边，生成复制后的边 */
    const pasteEdges = generatePasteEdges(oldId2NewIdMap, relationEdges)
    const pasteNodes = [] as MagicFlow.Node[]

    pasteNodeInfos.forEach(({ pasteNode }) => {
        pasteNodes.push(pasteNode)
    })

    return {
        pasteEdges,
        pasteNodes
    }
}