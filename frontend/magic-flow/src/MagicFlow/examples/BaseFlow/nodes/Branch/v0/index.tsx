import { ConditionInstance } from "@/MagicConditionEdit"
import { Expression } from "@/MagicConditionEdit/types/expression"
import { useFlow } from "@/MagicFlow/context/FlowContext/useFlow"
import { useCurrentNode } from "@/MagicFlow/nodes/common/context/CurrentNode/useCurrentNode"
import { useMemoizedFn, useUpdateEffect } from "ahooks"
import _ from "lodash"
import { nanoid } from "nanoid"
import React, { useMemo, useState } from "react"
import usePrevious from "../../../common/hooks/usePrevious"
import BranchItem from "./components/BranchItem"
import addBranchTypeIfWithout, { BranchType } from "./helpers"
import "./index.less"
import styles from "./index.module.less"

export default function Branch() {
	const {
		nodeConfig,
		notifyNodeChange,
		edges,
		deleteEdges,
	} = useFlow()

	const { currentNode } = useCurrentNode()
	const [branchList, setBranchList] = useState(
		addBranchTypeIfWithout(currentNode?.params?.branches!),
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
			const cloneBranchList = _.cloneDeep(branchList)
			_.set(cloneBranchList, [branchIndex, "parameters", "structure"], structureValue)
			_.set(nodeConfig, [currentNode.node_id, "params", "branches"], cloneBranchList)
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
	})

	const deleteBranch = useMemoizedFn((branchIndex: number) => {
		if (!currentNode) return

		const branchToDelete = branchList[branchIndex]
		const branchId = branchToDelete.branch_id

		// 1. 找到所有从该分支出发的边
		const edgesToRemove = edges.filter(
			(edge) => edge.source === currentNode.node_id && edge.sourceHandle === branchId,
		)

		// 2. 使用deleteEdges方法同时删除边和更新nextNodes
		deleteEdges(edgesToRemove)

		// 3. 更新分支列表
		branchList.splice(branchIndex, 1)
		setBranchList([...branchList])
	})

	useUpdateEffect(() => {
		if (!currentNode || !nodeConfig || !nodeConfig[currentNode?.node_id]) return
		const node = nodeConfig[currentNode.node_id]

		conditionRefsMap.forEach(({ ref }, index) => {
			const branchValue = ref.current?.getValue()
			_.set(branchList, [index, "parameters", "structure"], branchValue)
		})

		_.set(node, ["params", "branches"], branchList)

		// updateNodeConfig({
		// 	...node,
		// })
		notifyNodeChange?.()
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
				/>
			)
		})
	}, [addBranch, branchList, conditionRefsMap, deleteBranch, expressionDataSource, updateBranch])

	return <div className={styles.branch}>{BranchList}</div>
}
