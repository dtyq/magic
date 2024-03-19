/**
 * 处理流程的鼠标事件
 */

import { useMemoizedFn, useUpdateEffect } from "ahooks"
import { useFlowEdges, useFlowNodes, useFlowUI, useNodeConfig, useNodeConfigActions } from "@/MagicFlow/context/FlowContext/useFlow"
import { useNodes } from "@/MagicFlow/context/NodesContext/useNodes"
import { NodeSchema } from "@/MagicFlow/register/node"
import { generateSnowFlake } from "@/common/utils/snowflake"
import { useEffect, useRef, useState } from "react"
import { Edge, Node, NodeDragHandler, XYPosition, useReactFlow, useStoreApi, useUpdateNodeInternals } from "reactflow"
import _ from "lodash"
import { useExternalConfig } from "@/MagicFlow/context/ExternalContext/useExternal"
import { FlowDesignerEvents, renderSkeletonRatio } from "@/MagicFlow/constants"
import useViewport from "../../common/hooks/useViewport"
import { controlDuration } from "./useFlowControls"
import { generateLoopBody, generateNewNode, judgeIsLoopBody, judgeLoopNode } from "@/MagicFlow/utils"
import { MagicFlow } from "@/MagicFlow/types/flow"
import { FLOW_EVENTS, flowEventBus } from "@/common/BaseUI/Select/constants"

type UseFlowEventProps = {
    // 重置上一次布局数据
    resetLastLayoutData: () => void
    // 重置是否可以布局
    resetCanLayout: () => void
	// 当前缩放尺度
	currentZoom: number
	// 是否显示组件参数配置变更函数
	setShowParamsComp: React.Dispatch<React.SetStateAction<boolean>>
}

/** 新增节点的位置 */
export enum AddPosition {
	// 在边新增节点
	Edge = 'edge',
	// 在节点新增节点
	Node = 'node',
	// 在画布添加
	Canvas = 'canvas'
}

export default function useFlowEvents ({ resetLastLayoutData, resetCanLayout, currentZoom, setShowParamsComp }: UseFlowEventProps) {
	const store = useStoreApi()


    const { 
		addNode,
        selectedNodeId,
		setSelectedNodeId,
		deleteNodes,
		updateNodesPosition,
    } = useFlowNodes()

	const { nodeConfig } = useNodeConfig()

	const { notifyNodeChange } = useNodeConfigActions()

	const {
		edges,
		setEdges,
		setSelectedEdgeId,
		updateNextNodeIdsByDeleteEdge,
    } = useFlowEdges()

    const {
        flowDesignListener
    } = useFlowUI()
	
	const { 
		nodes
	} = useNodes()

	const updateNodeInternals = useUpdateNodeInternals();
	const states = store.getState()

	const reactFlowWrapper = useRef<HTMLDivElement>(null)

	const reactflowRef = useRef(null)
	const { screenToFlowPosition } = useReactFlow()

	/** 是否懒渲染 */
	const [ onlyRenderVisibleElements, setOnlyRenderVisibleElements ] = useState(true)

	/** 将流程视图定位到position */
	const { updateViewPortToTargetNode } = useViewport()

	useUpdateEffect(() => {
		setShowParamsComp(Math.ceil(currentZoom * 100) > renderSkeletonRatio || !onlyRenderVisibleElements)
	}, [ currentZoom, onlyRenderVisibleElements ])


	// 是否正在拖拽
	const [ isDragging, setIsDragging ] = useState(false)

	const { paramsName } = useExternalConfig()


	const onEdgeClick = useMemoizedFn((event, edge) => {
		event.stopPropagation()
		setSelectedEdgeId(edge.id)
        flowEventBus.emit(FLOW_EVENTS.EDGE_SELECTED, edge.id)
	})

	const onNodeDragStart = useMemoizedFn((event, node) => {
		setIsDragging(true)
		setSelectedNodeId(node.id)
		resetLastLayoutData()
		resetCanLayout()

	})

	flowDesignListener.useSubscription((event) => {
		switch (event.type) {
			case FlowDesignerEvents.SubmitStart:
				setOnlyRenderVisibleElements(false)
				break
			case FlowDesignerEvents.SubmitFinished:
				setOnlyRenderVisibleElements(true)
				break
			case FlowDesignerEvents.ValidateError:
				setOnlyRenderVisibleElements(true)
				const errorNodeIds = event.data || []
				if (errorNodeIds.length > 0) {
					const locationId = errorNodeIds[0]

					// 校验失败的节点
					const errorNode = nodes.find(n => n.node_id === locationId)
					const errorNodeRef = nodeConfig[locationId]

					updateViewPortToTargetNode(errorNode)

					// 需要对校验失败的节点进行二次校验，因为懒渲染导致上一次的校验结果失效了
					setTimeout(() => {
						errorNodeRef?.validate?.()
					}, controlDuration)
				}
				break
			default:
				return
		}
	})

	// 节点拖拽结束
	const onNodeDragStop = useMemoizedFn((event: any, node: Node, dragNodes: Node[]) => {
		setIsDragging(false)
		const nodeIds = dragNodes.map((n) => n.id)

		// {[id]: position}
        // @ts-ignore
		const positionMap = nodes.reduce((acc, cur) => ({ ...acc, [cur.id]: cur.position }), {} as Record<string, XYPosition>)
		updateNodesPosition(nodeIds, positionMap)
		if(node?.parentId) {
			updateNodeInternals(node?.parentId)
		}
	})

	// 节点拖拽事件
	// areaNodes，只会罗列出当前分组的节点
	const onNodeDrag: NodeDragHandler = useMemoizedFn((event, node, areaNodes) => {
		// 如果在分组内，则获取分组所有节点的boundary，设置父节点的大小
		// if(node.parentId) {
		// 	const childNodes = nodes.filter(n => n.parentId === node.parentId)
		// 	const restNodes = childNodes.filter(n => n.id !== node.id)
		// 	const parentNode = nodes.find(n => n.id === node.parentId)
		// 	const childBounds = getNodesBounds(childNodes)
		// 	console.log("bounds", childBounds)


		// 	if(parentNode) {

				
		// 		// 复制父节点并更新尺寸和位置
		// 		const newParentNode = {
		// 			...parentNode,
		// 			position: { ...parentNode.position }, // 确保 position 是一个新对象
		// 			style: { ...parentNode.style }, // 确保 style 是一个新对象
		// 		};

		// 		const rawParentX = newParentNode.position.x
		// 		const rawParentY = newParentNode.position.y
		// 		// 超过左边界时
		// 		if(childBounds.x < newParentNode.position.x + MIN_DISTANCE) {
		// 			console.log("超过左边界")
		// 			newParentNode.position.x =  childBounds.x - MIN_DISTANCE
		// 		}
		// 		// 超过右边界时
		// 		else if((childBounds.x + childBounds.width) > (newParentNode.position.x + newParentNode.width! - MIN_DISTANCE)) {
		// 			console.log("超过右边界 ",childBounds.width)
		// 			newParentNode.position.x = childBounds.x - MIN_DISTANCE
					
		// 			// const parentOffsetX = Math.abs(newParentNode.position.x - rawParentX )
		// 			// restNodes.forEach(n => {
		// 			// 	n.position.x = n.position.x - parentOffsetX
		// 			// })
		// 		}
		// 		// 超过上边界时，38px为留白的区域
		// 		else if(childBounds.y < newParentNode.position.y + MIN_DISTANCE + TOP_GAP) {
		// 			console.log("超过上边界")
		// 			newParentNode.position.y =  childBounds.y - MIN_DISTANCE - TOP_GAP
					
		// 		}
		// 		// 超过下边界时
		// 		else if((childBounds.y + childBounds.height) > (newParentNode.position.y + newParentNode.height! - MIN_DISTANCE)) {
		// 			console.log("超过下边界")
		// 			newParentNode.position.y = childBounds.y - MIN_DISTANCE - TOP_GAP
		// 		}

		// 		newParentNode.width = childBounds.width + MIN_DISTANCE * 2// @ts-ignore
		// 		newParentNode.style.width = newParentNode.width
		// 		newParentNode.height = childBounds.height + MIN_DISTANCE * 2 + TOP_GAP // @ts-ignore
		// 		newParentNode.style.height = newParentNode.height
		// 		console.log("parent", _.pick(newParentNode, ['width', 'height']))
		// 		setNodes(prevNodes => prevNodes.map(n => n.id === newParentNode.id ? newParentNode : n));
		// 	}
			
		// }
	})

	const onAddItem = useMemoizedFn(async (event: any, nodeData: NodeSchema, extraConfig?: Record<string, any>) => {
        if(!reactFlowWrapper.current) return
		const newNodes = []
		const newEdges = []
		// TODO 通过 node schema 渲染
		const nodeModel = {
			remark: ""
		}
		if (!nodeModel) {
			return
		}
		const id = event.uniqueNodeId || generateSnowFlake()

		const position = screenToFlowPosition({
			x: (event.clientX || 100),
			y: (event.clientY || 200)
		})

		const newNode = generateNewNode(nodeData, paramsName, id, position, extraConfig)

		newNodes.push(newNode)

		// 如果新增的是循环，则需要多新增一个循环体和一条边
		if (judgeLoopNode(newNode[paramsName.nodeType])) {
			const { newNodes: bodyNodes, newEdges: bodyEdges } = generateLoopBody(
				newNode,
				paramsName,
				edges,
			)
			newNodes.push(...bodyNodes)
			newEdges.push(...bodyEdges)
		}

		addNode(newNodes, newEdges)

		resetLastLayoutData()
		resetCanLayout()
	})

	// 拖拽物料释放
	const onDrop = useMemoizedFn(async (event) => {
		console.log("states", states, event)

		event.preventDefault()

		const jsonString = event.dataTransfer.getData("node-data")

		try {
			// 检查输入是否为空或未定义
			if (jsonString) {
				let dragData = JSON.parse(jsonString);
				onAddItem(event, dragData)
			} else {
				console.log("JSON string is empty or undefined. Returning default value.");
			}
		} catch (error) {
			console.error("Failed to parse JSON:", error);
			// 这里你可以选择返回一个默认值或采取其他错误处理措施
		}


	})

	const onDragOver = useMemoizedFn((event) => {
		event.stopPropagation()
		event.preventDefault()
	})

	const onReactFlowClick = useMemoizedFn(() => {
		setSelectedNodeId(null)
		setSelectedEdgeId(null)
        flowEventBus.emit(FLOW_EVENTS.EDGE_SELECTED, null)
        flowEventBus.emit(FLOW_EVENTS.NODE_SELECTED, null)
		// states.unselectNodesAndEdges()
	})

	// backspace删除事件
	const onNodesDelete = useMemoizedFn((_nodes: (Node & Partial<MagicFlow.Node>)[]) => {
		const deleteIds = _nodes.reduce((acc, n) => {
			// @ts-ignore
			const nodeType = n.node_type
			// 如果删除的是分组节点，则需要把子节点一并删除
			if(judgeIsLoopBody(nodeType)) {
				const subNodeIds = nodes.filter(_n => _n.parentId === n.id).map(_n => _n.id)
				const result = [...acc,...subNodeIds, n.id]
				// 如果删除的是循环体，则需要将循环节点一并删除
				// @ts-ignore
				if(n.meta.parent_id) {
					result.push(n?.meta?.parent_id)
				}
				return result
			}
			// 如果删除的是循环节点，则需要把循环体和循环体内节点删除
			if(judgeLoopNode(nodeType)) {
				const loopBodyNodeIds = nodes.filter(_n => _n.parentId === n.id || n?.meta?.parent_id === n.id).map(_n => _n.id)
				return [...acc,...loopBodyNodeIds, n.id]
			}
			return [...acc, n.id]
		}, [] as string[])

        deleteNodes(deleteIds)

		resetLastLayoutData()
		resetCanLayout()
		
		notifyNodeChange?.()
	})

	const onEdgesDelete = useMemoizedFn((_edges: Edge[]) => {
		const deleteIds = _edges.map(n => {
			updateNextNodeIdsByDeleteEdge(n)
			return n.id
		})

		const leaveEdges = edges.filter(e => !deleteIds.includes(e.target))

		// 更新边数据
		setEdges(leaveEdges)

		resetLastLayoutData()
		resetCanLayout()

		notifyNodeChange?.()
	})

	useEffect(() => {
		const handleSaveShortcut = (event: any) => {
		  if ((event.metaKey || event.ctrlKey) && event.key === 's') {
			event.preventDefault();
		  }
		};
	
		window.addEventListener('keydown', handleSaveShortcut);
	
		return () => {
		  window.removeEventListener('keydown', handleSaveShortcut);
		};
	  }, []);

	return {
		onEdgeClick,
		selectedNodeId,
		setSelectedNodeId,
		onNodeDragStop,
		onDrop,
		onDragOver,
		reactFlowWrapper,
		onReactFlowClick,
		onNodeDragStart,
		isDragging,
		onNodesDelete,
		onEdgesDelete,
		reactflowRef,
		onAddItem,
		onlyRenderVisibleElements,
		onNodeDrag
	}
}
