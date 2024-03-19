import React from "react"
import { ConnectionLineComponentProps } from "reactflow"
export const ConnectionLine = ({ fromX, fromY, toX, toY }: ConnectionLineComponentProps) => {

	return (
		<g>
			<path
				fill="none"
				stroke="#4d53e8"
				strokeWidth={2}
				className="animated"
				d={`M${fromX},${fromY} C ${fromX} ${toY} ${fromX} ${toY} ${toX},${toY}`}
			/>
			<circle
				cx={toX}
				cy={toY}
				fill="#fff"
				r={3}
				stroke="#4d53e8"
				strokeWidth={2}
			/>
		</g>
	)
}
