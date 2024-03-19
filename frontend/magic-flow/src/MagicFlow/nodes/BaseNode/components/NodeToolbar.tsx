import React, { memo } from "react"
import { NodeToolbar as ReactFlowNodeToolbar, Position } from "reactflow"
import ToolbarComponent from "../../common/toolbar"

interface NodeToolbarProps {
	isSelected: boolean
	id: string
	changeable: { operation: boolean }
	position?: Position
}

const NodeToolbar = memo(({ isSelected, id, changeable, position }: NodeToolbarProps) => {
	if (!isSelected || !changeable.operation) return null

	return (
		<ReactFlowNodeToolbar position={position || Position.Top}>
			<ToolbarComponent id={id} />
		</ReactFlowNodeToolbar>
	)
})

export default NodeToolbar
