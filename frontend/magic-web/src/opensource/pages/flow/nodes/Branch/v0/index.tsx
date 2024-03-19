import React, { useEffect, useMemo, useState } from "react"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import type { Expression } from "@dtyq/magic-flow/dist/MagicConditionEdit/types/expression"
import { nanoid } from "nanoid"
import { useCurrentNode } from "@dtyq/magic-flow/dist/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import type { ConditionInstance } from "@dtyq/magic-flow/dist/MagicConditionEdit/index"
import { set } from "lodash-es"
import {
	useFlowEdgesActions,
	useNodeConfigActions,
} from "@dtyq/magic-flow/dist/MagicFlow/context/FlowContext/useFlow"
import usePrevious from "@/opensource/pages/flow/common/hooks/usePrevious"
import styles from "./index.module.less"
import BranchItem from "./components/BranchItem"
import addBranchTypeIfWithout, { BranchType } from "./helpers"
import "./index.less"
import { useFlowInstance } from "../../../context/FlowInstanceContext"
import { v0Template } from "./template"

export default function Branch() {
	const { currentNode } = useCurrentNode()
	const { deleteEdges } = useFlowEdgesActions()
	const { flowInstance } = useFlowInstance()
	const { notifyNodeChange } = useNodeConfigActions()
	const [branchList, setBranchList] = useState(
		addBranchTypeIfWithout(
			// @ts-ignore
			currentNode?.params?.branches || v0Template.params.branches,
		) as Record<string, any>[],
	)

	// 创建一个存储所有元素 ref 的数组
	const conditionRefsMap = useMemo(() => {
		return branchList.map((branch) => {
			return {
				id: branch.branch_id,
				ref: React.createRef<ConditionInstance>(),
			}
		})
	}, [branchList])

	const updateBranch = useMemoizedFn(
		(structureValue: Expression.Condition | undefined, branchIndex: number) => {
			if (!currentNode) return
			set(
				currentNode,
				["params", "branches", branchIndex, "parameters", "structure"],
				structureValue,
			)
			notifyNodeChange?.()
		},
	)

	const addBranch = useMemoizedFn((beforeIndex: number) => {
		const newBranch = {
			branch_id: nanoid(8),
			next_nodes: [],
			branch_type: BranchType.If,
			parameters: {
				id: nanoid(8),
				version: "1",
				type: "condition",
				structure: undefined,
			},
		}

		currentNode?.params?.branches?.splice(beforeIndex + 1, 0, newBranch)
		setBranchList([...(currentNode?.params?.branches || [])])

		notifyNodeChange?.()
	})

	const deleteBranch = useMemoizedFn((branchIndex: number) => {
		if (!currentNode) return

		const branchToDelete = branchList[branchIndex]
		const branchId = branchToDelete.branch_id
		const edges = flowInstance.current?.getEdges() || []

		// 1. 找到所有从该分支出发的边
		const edgesToRemove = edges.filter(
			(edge) => edge.source === currentNode.node_id && edge.sourceHandle === branchId,
		)

		// 2. 使用deleteEdges方法同时删除边和更新nextNodes
		deleteEdges(edgesToRemove)

		// 3. 更新分支列表
		currentNode?.params?.branches?.splice(branchIndex, 1)
		setBranchList([...(currentNode?.params?.branches || [])])
		notifyNodeChange?.()
	})

	useUpdateEffect(() => {
		if (!currentNode) return

		set(currentNode, ["params", "branches"], branchList)
		conditionRefsMap.forEach(({ ref }, index) => {
			const branchValue = ref.current?.getValue()
			set(currentNode, ["params", "branches", index, "parameters", "structure"], branchValue)
		})

		notifyNodeChange?.()
		// updateNodeConfig({
		// 	...node,
		// })
	}, [branchList])

	const { expressionDataSource } = usePrevious()

	const BranchList = useMemo(() => {
		return branchList.map((branch, index) => {
			return (
				<BranchItem
					//  @ts-ignore
					value={branch}
					onChange={updateBranch}
					showTrash={branchList.length > 2}
					isLast={index === branchList.length - 1}
					currentIndex={index}
					onAddItem={addBranch}
					onDeleteItem={deleteBranch}
					conditionRefsMap={conditionRefsMap}
					expressionDataSource={expressionDataSource}
					key={branch.branch_id}
				/>
			)
		})
	}, [addBranch, branchList, conditionRefsMap, deleteBranch, expressionDataSource, updateBranch])

	return <div className={styles.branch}>{BranchList}</div>
}
