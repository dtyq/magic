import { prefix } from "@/MagicFlow/constants"
import { useExternalConfig } from "@/MagicFlow/context/ExternalContext/useExternal"
import { useFlowEdges, useNodeConfig } from "@/MagicFlow/context/FlowContext/useFlow"
import { defaultEdgeConfig } from "@/MagicFlow/edges"
import { InnerHandleType } from "@/MagicFlow/nodes"
import { usePopup } from "@/MagicFlow/nodes/common/context/Popup/usePopup"
import { NodeSchema, nodeManager } from "@/MagicFlow/register/node"
import { getExtraEdgeConfigBySourceNode, judgeLoopNode } from "@/MagicFlow/utils"
import { getSubNodePosition } from "@/MagicFlow/utils/reactflowUtils"
import { generateSnowFlake } from "@/common/utils/snowflake"
import { Tooltip } from "antd"
import { IconHelp } from "@tabler/icons-react"
import { useMemoizedFn } from "ahooks"
import clsx from "clsx"
import _ from "lodash"
import React from "react"
import { Edge, useReactFlow } from "reactflow"
import { useFlowInteractionActions } from "../../FlowDesign/context/FlowInteraction/useFlowInteraction"
import useViewport from "../../common/hooks/useViewport"
import { useFlowPopup } from "../context/FlowPopupContext/useFlowPopup"
import styles from "./index.module.less"
import usePopupAction from "./usePopupAction"

type PopupNodeProps = {
	node: NodeSchema
	showIcon: boolean
	inGroup?: boolean
}

export default function PopupNode({ node, showIcon = true, inGroup }: PopupNodeProps) {
	const { target, source, edgeId, sourceHandle, nodeId: targetNodeId } = useFlowPopup()

	const { edges, setEdges, updateNextNodeIdsByConnect, updateNextNodeIdsByDeleteEdge } =
		useFlowEdges()

	const { nodeConfig } = useNodeConfig()

	const { updateViewPortToTargetNode } = useViewport()

	const { closePopup } = usePopup()

	const { paramsName } = useExternalConfig()

	const { onAddItem, layout } = useFlowInteractionActions()

	const { toggleType } = usePopupAction({ targetNodeId })

	const { screenToFlowPosition } = useReactFlow()

	const updateNextNodesByAddEdges = useMemoizedFn(
		({ newEdges = [] as Edge[], delEdges = [] as Edge[] }) => {
			delEdges.forEach((edge: any) => {
				updateNextNodeIdsByDeleteEdge(edge)
			})
			newEdges.forEach((edge: any) => {
				updateNextNodeIdsByConnect(edge)
			})
		},
	)

	// 更新分支节点的next_nodes
	const updateBranchNodeNextNodes = useMemoizedFn((nodeId: string, target: string) => {
		const branchNode = nodeConfig[nodeId]
		const oldBranches = branchNode?.[paramsName.params]?.branches || []
		if (oldBranches?.length === 0) return
		const ifBranch = oldBranches[0]
		oldBranches.splice(0, 1, {
			...ifBranch,
			next_nodes: [target],
		})

		// 更新nextNodes
		branchNode[paramsName.params].branches = oldBranches
		branchNode.next_nodes.push(target)
	})

	const generateExtraConfig = useMemoizedFn((event) => {
		const sourceNode = nodeConfig[source!]
		const parentId = sourceNode?.parentId
		if (parentId) {
			const parentNode = nodeConfig[parentId]
			const position = getSubNodePosition(event, screenToFlowPosition, parentNode)
			return {
				parentId,
				expandParent: true,
				extent: "parent",
				meta: {
					position,
					parent_id: parentId,
				},
			}
		}
		return {}
	})

	const addNodeFn = useMemoizedFn(async (event) => {
		event.stopPropagation()
		closePopup()
		const nodeId = generateSnowFlake()

		if (!targetNodeId) {
			const extraConfig = generateExtraConfig(event)
			await onAddItem({ uniqueNodeId: nodeId, ...event }, node, extraConfig)
		}

		/* 额外处理，新增边和删除边 */

		/**
		 * 如果在边新增节点
		 */

		const sourceNode = nodeConfig[source!]
		const extraEdgeConfig = getExtraEdgeConfigBySourceNode(sourceNode)
		if (target && source) {
			// 新节点的分支端点id（如果有的话）
			const defaultBranchId = _.get(
				node,
				[paramsName.params, "branches", 0, "branch_id"],
				sourceHandle,
			)
			const newEdges = [
				// 入边
				{
					id: generateSnowFlake(),
					source,
					target: nodeId,
					sourceHandle,
					...defaultEdgeConfig,
					...extraEdgeConfig,
				},

				// 出边
				{
					id: generateSnowFlake(),
					source: nodeId,
					target: target,
					sourceHandle: judgeLoopNode(node.id)
						? InnerHandleType.LoopNext
						: defaultBranchId,
					...defaultEdgeConfig,
					...extraEdgeConfig,
				},
			]

			const delEdgeIndex = edges.findIndex((edge) => edge.id === edgeId)
			const delEdge = edges[delEdgeIndex]

			edges.splice(delEdgeIndex, 1, ...newEdges)
			setEdges([...edges])

			// 特殊处理分支
			if (nodeManager.branchNodeIds.includes(`${node.id}`)) {
				updateBranchNodeNextNodes(nodeId, target)
			}
			updateNextNodesByAddEdges({ newEdges, delEdges: [delEdge] })

			setTimeout(() => {
				const layoutNodes = layout()
				console.log("layoutNodes", layoutNodes, nodeId)
				const currentNode = layoutNodes.find((n) => n.node_id === nodeId)
				updateViewPortToTargetNode(currentNode)
			}, 200)

			return
		}
		if (source) {
			const newEdges = [
				// 出边
				{
					id: generateSnowFlake(),
					source,
					target: nodeId,
					sourceHandle,
					...defaultEdgeConfig,
					...extraEdgeConfig,
				},
			]

			if (nodeManager.branchNodeIds.includes(`${nodeId}`)) {
				updateBranchNodeNextNodes(source, nodeId)
			}

			// 更新后的边
			const updatedEdges = edges.concat(newEdges)
			setEdges(updatedEdges)
			updateNextNodesByAddEdges({ newEdges })

			setTimeout(() => {
				const layoutNodes = layout()
				const currentNode = layoutNodes.find((n) => n.node_id === nodeId)
				console.log("layoutNodes", layoutNodes, nodeId)
				updateViewPortToTargetNode(currentNode)
			}, 200)
		}

		/** 走切换节点类型逻辑 */
		if (targetNodeId) {
			toggleType({ key: node.id })
		}
	})

	return (
		<div
			className={clsx(styles.popupNode, `${prefix}popup-node`, {
				[styles.inGroup]: inGroup,
			})}
			onClick={addNodeFn}
		>
			{showIcon && (
				<div
					className={clsx(styles.icon, `${prefix}icon`)}
					style={{ background: node.color }}
				>
					{node.icon}
				</div>
			)}
			<span className={clsx(styles.title, `${prefix}title`)}>{node.label}</span>
			{node.desc && (
				<Tooltip title={node.desc} showArrow={false}>
					<IconHelp
						color="#1C1D2359"
						size={22}
						className={clsx(styles.help, `${prefix}help`)}
					/>
				</Tooltip>
			)}
		</div>
	)
}
