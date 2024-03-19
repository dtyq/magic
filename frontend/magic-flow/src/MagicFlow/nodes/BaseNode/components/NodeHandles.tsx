import React, { memo, useMemo } from "react"
import { Position } from "reactflow"
import SourceHandle from "../../common/Handle/Source"
import { useCurrentNode } from "../../common/context/CurrentNode/useCurrentNode"

interface NodeHandlesProps {
	showDefaultSourceHandle: boolean
	withTargetHandle: boolean
	nodeId: string
	isConnectable: boolean
	isSelected: boolean
	canConnect: boolean
	isTarget: boolean
	showParamsComp: boolean
}

const NodeHandles = memo(
	({
		showDefaultSourceHandle,
		withTargetHandle,
		nodeId,
		isConnectable,
		isSelected,
		canConnect,
		isTarget,
		showParamsComp,
	}: NodeHandlesProps) => {
		const { currentNode } = useCurrentNode()
		const branchHandles = useMemo(() => {
			if (showParamsComp) return null
			return currentNode?.params?.branches?.map((branch) => {
				return (
					<SourceHandle
						nodeId={nodeId}
						isConnectable={isConnectable}
						isSelected={isSelected}
						type="source"
						id={branch.branch_id}
					/>
				)
			})
		}, [currentNode, isConnectable, isSelected, nodeId, showParamsComp])
		return (
			<>
				{showDefaultSourceHandle && (
					<SourceHandle
						nodeId={nodeId}
						isConnectable={isConnectable}
						isSelected={isSelected}
						type="source"
					/>
				)}
				{withTargetHandle && (
					<SourceHandle
						type="target"
						nodeId={nodeId}
						position={Position.Left}
						isConnectable={isConnectable && canConnect}
						isSelected={isSelected}
						isTarget={isTarget}
					/>
				)}
				{branchHandles}
			</>
		)
	},
)

export default NodeHandles
