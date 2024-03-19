/**
 * 定义主页各组件的数据状态 & 行为
 */

import { generateSnowFlake } from "@/common/utils/snowflake"
import { useAsyncEffect, useEventEmitter, useMemoizedFn, useUpdateEffect } from "ahooks"
import i18next from "i18next"
import _ from "lodash"
import { useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { Connection, Edge, addEdge, applyEdgeChanges, applyNodeChanges } from "reactflow"
import { useNodeChangeListener } from "../context/NodeChangeListenerContext/NodeChangeListenerContext"
import { defaultEdgeConfig } from "../edges"
import { nodeManager } from "../register/node"
import { FlowType, MagicFlow } from "../types/flow"
import {
	generateStartNode,
	getExtraEdgeConfigBySourceNode,
	handleRenderProps,
	isRegisteredStartNode,
	useQuery,
} from "../utils"
import { sortByEdges, updateTargetNodesStep } from "../utils/reactflowUtils"
import useMacTouch from "./useMacTouch"
import useUndoRedo from "./useUndoRedo"
// 1. 导入批处理hook
import useNodeBatchProcessing from "../hooks/useNodeBatchProcessing"
import { FLOW_EVENTS, flowEventBus } from "@/common/BaseUI/Select/constants"
import { useDebounceFn } from "ahooks"

export enum UpdateStepType {
	// 连线
	Connect = 1,

	// 删除边
	DelEdge = 2,
}

type UseBaseFlowProps = {
	currentFlow?: MagicFlow.Flow
	paramsName: MagicFlow.ParamsName
}

export default function useBaseFlow({ currentFlow, paramsName }: UseBaseFlowProps) {
	const query = useQuery()

	const { t } = useTranslation()

	// 是否处于调试模式
	const debuggerMode = query.get("debug") === "true"

	// 当前流程详情
	const [flow, setFlow] = useState(null as MagicFlow.Flow | null)

	// 2. 使用批处理hook
	const { processNodesBatch, isProcessing, progress, stopProcessing } = useNodeBatchProcessing({
		batchSize: 8,
		interval: 150,
	})

	// 当前流程描述
	const [description, setDescription] = useState("")

	// 当前节点配置
	const [nodeConfig, setNodeConfig] = useState({} as Record<string, MagicFlow.Node>)

	// 是否显示物料面板
	const [showMaterialPanel, setShowMaterialPanel] = useState(true)

	const [selectedNodeId, setSelectedNodeId] = useState(null as null | string)

	const [selectedEdgeId, setSelectedEdgeId] = useState(null as null | string)

	const [nodes, setNodes] = useState([] as MagicFlow.Node[])
	const [edges, setEdges] = useState([] as Edge[])

	const flowInstance = useRef<HTMLDivElement>(null)

	const { nodeChangeEventListener } = useNodeChangeListener()

	const flowDesignListener = useEventEmitter<MagicFlow.FlowEventListener>()

	const { takeSnapshot, undo, redo } = useUndoRedo(debuggerMode)

	const edgesChangesRef = useRef([])

	useMacTouch()

	// // 撤销
	// useKeyPress(
	// 	["meta.z", "ctrl.z"],
	// 	(e) => {
	// 		e.preventDefault()
	// 		const snapshot = undo({
	// 			nodes,
	// 			edges,
	// 			nodeConfig,
	// 		})
	// 		if (snapshot) {
	// 			setNodes(snapshot.nodes)
	// 			setEdges(snapshot.edges)
	// 			setNodeConfig(snapshot.nodeConfig)
	// 		}
	// 	},
	// 	{ exactMatch: true },
	// )

	// // 重做
	// useKeyPress(
	// 	["meta.shift.z", "ctrl.shift.z"],
	// 	(e) => {
	// 		e.preventDefault()
	// 		const snapshot = redo()
	// 		if (snapshot) {
	// 			setNodes(snapshot.nodes)
	// 			setEdges(snapshot.edges)
	// 			setNodeConfig(snapshot.nodeConfig)
	// 		}
	// 	},
	// 	{ exactMatch: true },
	// )

	const notifyNodeChange = useMemoizedFn(() => {
		nodeChangeEventListener.emit("NodeChange")
		console.log("nodeConfig", nodeConfig)
		// takeSnapshot(nodes, edges, nodeConfig)
	})

	const onNodesChange = useMemoizedFn((changes) => {
		//@ts-ignore
		return setNodes((nds) => applyNodeChanges(changes, nds))
	})

	// 使用防抖函数优化边更改操作，减少频繁更新导致的性能问题
	const { run: debouncedEdgesChange } = useDebounceFn(
		() => {
			setEdges((eds) => applyEdgeChanges(edgesChangesRef.current, eds))
			edgesChangesRef.current = []
		},
		{ wait: 200 },
	)

	const onEdgesChange = useMemoizedFn((changes) => {
		edgesChangesRef.current = [...edgesChangesRef.current, ...changes]
		return debouncedEdgesChange()
	})

	// useUpdateEffect(() => {
	// 	console.log("nodes", nodes, edges)
	// }, [nodes, edges])

	const getDefaultFlow = useMemoizedFn(() => {
		const defaultNodes = [] as MagicFlow.Node[]

		/** 如果已注册开始节点，则加入节点列表 */
		if (isRegisteredStartNode()) {
			const newNode = generateStartNode(paramsName)
			defaultNodes.push(newNode)
		}

		// TODO 获取节点的模板，并插入到默认的节点列表中

		return {
			name: i18next.t("flow.untitledFlow", { ns: "magicFlow" }),
			description: i18next.t("flow.defaultDesc", { ns: "magicFlow" }),
			enabled: false,
			edges: [],
			nodes: [...defaultNodes],
			type: FlowType.Main,
		}
	})

	const updateInternalDataByFlow = useMemoizedFn((serverFlow: MagicFlow.Flow) => {
		setDescription(serverFlow.description)

		const cacheNodes = [] as MagicFlow.Node[]
		const renderEdges = [] as Edge[]
		const cacheConfig = {} as Record<string, MagicFlow.Node>
		for (let i = 0; i < serverFlow.nodes.length; i++) {
			const node = serverFlow.nodes[i]

			// TODO node schema转换渲染

			/** 处理节点渲染字段 */
			handleRenderProps(node, i, paramsName)

			cacheConfig[node.id] = node

			cacheNodes.push(node)
		}

		serverFlow.edges.forEach((edge) => {
			renderEdges.push({
				...edge,
				...defaultEdgeConfig,
			})
		})

		// 初始化步骤
		if (cacheNodes.length > 0) {
			updateTargetNodesStep({
				type: UpdateStepType.Connect,
				connection: {
					source: cacheNodes[0].node_id,
				} as Connection,
				nodeConfig: cacheConfig,
				nodes: cacheNodes,
				edges: renderEdges,
			})
		}
		if (isProcessing) {
			stopProcessing()
		}
		// 使用批处理hook处理节点
		processNodesBatch(cacheNodes, (batchNodes) => {
			setNodes(batchNodes)
		})

		// 边的渲染需要在节点渲染完毕之后
		setEdges(_.cloneDeep(renderEdges))

		setNodeConfig(cacheConfig)
		setFlow({
			...serverFlow,
			nodes: [...cacheNodes],
		})
	})

	useAsyncEffect(async () => {
		const serverFlow = currentFlow || (getDefaultFlow() as MagicFlow.Flow)

		if (serverFlow?.nodes?.length === 0 && isRegisteredStartNode()) {
			const startNode = generateStartNode(paramsName)
			serverFlow?.nodes?.push?.(startNode)
		}

		updateInternalDataByFlow(serverFlow)
	}, [])

	// 将上游流程同步到内部
	useUpdateEffect(() => {
		console.log("currentFlow", currentFlow)
		if (currentFlow) {
			if (currentFlow?.nodes?.length === 0 && isRegisteredStartNode()) {
				const startNode = generateStartNode(paramsName)
				currentFlow?.nodes?.push?.(startNode)
			}
			updateInternalDataByFlow(currentFlow)
		}
	}, [currentFlow])

	const updateFlow = useMemoizedFn((flowConfig: MagicFlow.Flow) => {
		setFlow(flowConfig)
	})

	// 更新位置信息
	const updateNodesPosition = useMemoizedFn(
		_.debounce((nodeIds, positionMap) => {
			if (!flow) return
			const foundNode = nodes.find((n) => nodeIds.includes(n.node_id))
			if (!foundNode) return

			if (_.isEqual(foundNode.meta.position, positionMap[foundNode.node_id])) return
			foundNode.meta.position = positionMap[foundNode.node_id]
			foundNode.position = positionMap[foundNode.node_id]
		}, 100),
	)

	// 使用防抖函数优化节点配置更新，减少频繁更新导致的性能问题
	const { run: debouncedUpdateConfig } = useDebounceFn(
		(node: MagicFlow.Node, previousConfig: Record<string, MagicFlow.Node>) => {
			// 使用函数式更新，仅修改特定节点
			setNodeConfig((prevConfig) => {
				// 创建新的节点配置对象，但保持其他节点的引用不变
				const updatedConfig = { ...prevConfig }
				updatedConfig[node.id] = node
				return updatedConfig
			})

			// 仅通知特定节点的变化
			if (nodeChangeEventListener && nodeChangeEventListener.emit) {
				try {
					// 传递节点ID作为参数，这样可以实现针对性渲染
					nodeChangeEventListener.emit("NodeChange")
				} catch (error) {
					// 兼容旧版本的事件发射器
					nodeChangeEventListener.emit("NodeChange")
					console.warn("使用了旧版本的nodeChangeEventListener，无法传递节点ID")
				}
			}
		},
		{ wait: 500 },
	)

	// 更新节点配置
	const updateNodeConfig = useMemoizedFn(
		(node: MagicFlow.Node, originalNode?: MagicFlow.Node) => {
			const oldNodeIndex = nodes.findIndex((n) => n.id === node.id)

			// 创建快照
			if (originalNode) {
				const snapshotNodeConfig = { ...nodeConfig }
				snapshotNodeConfig[node.id] = originalNode
				takeSnapshot(nodes, edges, snapshotNodeConfig)
			}

			// 更新节点
			if (oldNodeIndex !== -1) {
				const oldNode = nodes[oldNodeIndex]
				nodes.splice(oldNodeIndex, 1, {
					...oldNode,
					...node,
					meta: oldNode.meta,
					position: oldNode.position,
				})
			}

			// 将更新状态和通知变化的操作交给防抖函数处理
			debouncedUpdateConfig(node, nodeConfig)
		},
	)

	// 触发节点
	const triggerNode = useMemo(() => {
		if (!flow || !flow.nodes || flow.nodes.length === 0) return null
		return flow.nodes[0]
	}, [flow])

	const updateNextNodeIdsByConnect = useMemoizedFn((newEdge: Edge) => {
		const { source, sourceHandle, target } = newEdge
		const node = nodeConfig[source]
		const updatedNode = _.cloneDeep(node)

		// 当从分支源点连接线到其他节点时
		// 当源节点为分支节点，则更新content.branches，source分支节点id，相当于sourceHandle相当于分支id
		if (nodeManager.branchNodeIds.includes(`${node[paramsName.nodeType]}`)) {
			const branches = updatedNode?.[paramsName.params]?.branches || []
			const branchIndex = branches.findIndex(
				(branch: any) => (branch.branch_id || branch.branchId) === sourceHandle,
			)
			if (branchIndex === -1) return
			const oldBranch = branches[branchIndex]
			const newBranch = {
				...oldBranch,
				//@ts-ignore
				[paramsName.nextNodes]: [
					...(oldBranch?.[paramsName.nextNodes] || oldBranch?.[paramsName.nextNodes]),
					target,
				],
			}
			updatedNode?.[paramsName.params]?.branches?.splice(branchIndex, 1, newBranch)
		}

		// 下一个节点id列表中没有target，包含分支节点的情况
		if (!updatedNode?.[paramsName.nextNodes]?.includes(target)) {
			updatedNode?.[paramsName.nextNodes]?.push(target)
		}
		nodeConfig[source] = updatedNode

		// console.log(nodeConfig)

		updateTargetNodesStep({
			type: UpdateStepType.Connect,
			connection: newEdge,
			nodeConfig,
			nodes,
			edges: [...edges, newEdge],
		})

		setNodeConfig({ ...nodeConfig })
	})

	// 删除分支连接到其他节点的线段时
	const updateNextNodeIdsByDeleteEdge = useMemoizedFn((connection: Edge) => {
		// 当源节点为分支节点，source分支节点id，相当于sourceHandle相当于分支id
		const { source, sourceHandle, target } = connection
		const node = nodeConfig[source]
		const updatedNode = _.cloneDeep(node)
		if (!updatedNode) return

		// 分支节点，向分支的下一节点列表删除数据
		if (nodeManager.branchNodeIds.includes(`${node[paramsName.nodeType]}`)) {
			const branches = updatedNode?.[paramsName.params]?.branches
			const branchIndex = branches?.findIndex(
				(branch: any) => (branch.branch_id || branch.branchId) === sourceHandle,
			)
			if (branchIndex === -1 || !branches) return
			const oldBranch = branches[branchIndex!]
			const newBranch = {
				...oldBranch,
				[paramsName.nextNodes]: oldBranch?.[paramsName.nextNodes]?.filter?.(
					(id: string) => id !== target,
				),
			}
			updatedNode?.[paramsName.params]?.branches?.splice(branchIndex!, 1, newBranch)
		}

		// 修改这里：只有当所有分支都不再指向该目标节点时，才从外层nextNodes中删除
		const shouldRemoveFromNextNodes = !edges.some(
			(edge) =>
				edge.id !== connection.id && // 不是当前正在删除的边
				edge.source === source &&
				edge.target === target,
		)

		if (shouldRemoveFromNextNodes && updatedNode?.[paramsName.nextNodes]?.includes(target)) {
			const nextNodeIndex = updatedNode[paramsName.nextNodes].indexOf(target)
			if (nextNodeIndex !== -1) {
				updatedNode[paramsName.nextNodes].splice(nextNodeIndex, 1)
			}
		}

		nodeConfig[source] = updatedNode

		updateTargetNodesStep({
			type: UpdateStepType.DelEdge,
			connection,
			nodeConfig,
			nodes,
			edges: [...edges],
		})

		setNodeConfig({ ...nodeConfig })
	})

	const onConnect = useMemoizedFn((connection) => {
		if (connection?.source === connection?.target) {
			return
		}
		notifyNodeChange()
		const sourceNode = nodeConfig[connection.source]
		const extraEdgeConfig = getExtraEdgeConfigBySourceNode(sourceNode)

		const newEdge = {
			id: generateSnowFlake(),
			source: connection.source,
			target: connection.target,
			sourceHandle: connection.sourceHandle,
			targetHandle: connection.targetHandle,
			...defaultEdgeConfig,
			...extraEdgeConfig,
		}

		// 更新source节点的下一个节点配置
		updateNextNodeIdsByConnect(newEdge)

		return setEdges((eds) => addEdge(newEdge, eds))
	})

	const getNewNodeIndex = useMemoizedFn(() => {
		if (nodes.length === 0) return 0
		return Math.max(...nodes.map((node) => node.step || 0)) + 1
	})

	const addNode = useMemoizedFn(
		(newNode: MagicFlow.Node | MagicFlow.Node[], newEdges?: Edge[]) => {
			const newNodes = _.castArray(newNode)
			const cloneNodes = _.cloneDeep(newNodes)
			cloneNodes.forEach((cloneNode) => {
				const i = getNewNodeIndex()
				handleRenderProps(cloneNode, i, paramsName)

				nodeConfig[cloneNode.id] = cloneNode

				// https://github.com/xyflow/xyflow/pull/2560
				// @ts-ignore
				cloneNode.zIndex = 1000

				nodes.push(cloneNode)
			})
			setNodeConfig({ ...nodeConfig })
			setNodes([...nodes])
			if (newEdges && newEdges.length > 0) {
				edges.push(...newEdges)
				setEdges([...edges])
			}
			setSelectedNodeId(cloneNodes?.[0]?.id)
			flowEventBus.emit(FLOW_EVENTS.NODE_SELECTED, cloneNodes?.[0]?.id)
			nodeChangeEventListener.emit("NodeChange")
		},
	)

	useUpdateEffect(() => {
		console.log("NODE Config ", nodeConfig)
	}, [nodeConfig])

	useUpdateEffect(() => {
		console.log("edges ", edges)
	}, [edges])

	useEffect(() => {
		try {
			if (debuggerMode) {
				/** 校验是否有节点，没有在主流程内 */
				if (debuggerMode) {
					const sortedNodes = sortByEdges(Object.values(nodeConfig), edges)

					const nextNodesMap = sortedNodes.reduce((acc, cur) => {
						if (cur[paramsName.params]?.branches?.length) {
							const branchNextNodesObject = cur[
								paramsName.params
							]?.branches?.reduce?.(
								// @ts-ignore
								(pre, cur) => {
									return {
										...pre,
										[cur?.branch_id]: cur?.next_nodes,
									}
								},
								{},
							)

							return {
								...acc,
								[cur.node_id]: branchNextNodesObject,
							}
						}
						return {
							...acc,
							[cur.node_id]: cur.next_nodes,
						}
					}, {})

					console.log("nextNodesMap", nextNodesMap)
					// @ts-ignore
					window.nextNodeMaps = nextNodesMap
				}
			}
		} catch (error) {
			console.error("校验节点出错", error)
		}
	}, [debuggerMode, nodeConfig])

	useUpdateEffect(() => {
		if (selectedEdgeId) {
			setSelectedNodeId(null)
			flowEventBus.emit(FLOW_EVENTS.NODE_SELECTED, null)
		}
		const newEdges = edges.map((o) => {
			const strokeColor = o.id === selectedEdgeId ? "#37d0ff" : "#4d53e8"
			return {
				...o,
				markerEnd: {
					// @ts-ignore
					...o.markerEnd,
					color: strokeColor,
				},
				style: {
					...o.style,
					stroke: strokeColor,
				},
			}
		})

		setEdges(newEdges)
	}, [selectedEdgeId])

	useUpdateEffect(() => {
		if (selectedNodeId) {
			setSelectedEdgeId(null)
			flowEventBus.emit(FLOW_EVENTS.EDGE_SELECTED, null)
		}
	}, [selectedNodeId])

	// 删除节点函数
	const deleteNodes = useMemoizedFn((ids: string[]) => {
		notifyNodeChange()
		ids.forEach((id) => {
			delete nodeConfig[id]
			const deleteEdges = edges.filter((e) => id === e.target || id === e.source)
			const leaveEdges = edges.filter((e) => id !== e.target && id !== e.source)

			// 更新边数据
			setEdges(leaveEdges)

			// 更新nextNodeIds
			deleteEdges.forEach((e) => updateNextNodeIdsByDeleteEdge(e))

			if (Reflect.has(nodeConfig, id)) {
				Reflect.deleteProperty(nodeConfig, id)
			}
		})

		const newNodes = nodes.filter((n) => !ids.includes(n.id))
		setNodes(newNodes)
		if (debuggerMode) {
			console.trace("删除了节点", ids)
		}
	})

	// 批量删除边并同步更新nextNodes
	const deleteEdges = useMemoizedFn((edgesToDelete: Edge[]) => {
		if (!edgesToDelete.length) return

		notifyNodeChange()

		// 1. 对每条边调用updateNextNodeIdsByDeleteEdge来更新nextNodes
		edgesToDelete.forEach((edge) => {
			updateNextNodeIdsByDeleteEdge(edge)
		})

		// 2. 从edges状态中移除这些边
		const updatedEdges = edges.filter((edge) => !edgesToDelete.some((e) => e.id === edge.id))
		setEdges(updatedEdges)
	})

	return {
		flow,
		setFlow,
		updateFlow,
		triggerNode,
		updateNodesPosition,
		updateNodeConfig,
		nodes,
		edges,
		onNodesChange,
		onEdgesChange,
		onConnect,
		nodeConfig,
		addNode,
		selectedNodeId,
		setSelectedNodeId,
		setNodes,
		setEdges,
		selectedEdgeId,
		setSelectedEdgeId,
		updateNextNodeIdsByDeleteEdge,
		updateNextNodeIdsByConnect,
		description,
		flowInstance,
		debuggerMode,
		getNewNodeIndex,
		showMaterialPanel,
		setShowMaterialPanel,
		flowDesignListener,
		deleteNodes,
		deleteEdges,
		setNodeConfig,
		notifyNodeChange,
		isProcessing,
		progress,
		edgeLength: 0,
		processNodesBatch,
	}
}
