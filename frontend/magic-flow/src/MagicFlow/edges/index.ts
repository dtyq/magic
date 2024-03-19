import { MarkerType } from "reactflow"
import CustomEdge from "./CustomEdge"
import CustomSmoothEdge from "./CustomSmoothEdge"

export const EdgeModelTypes = {
	CommonEdge: "commonEdge",
	SmoothStep: "smoothstep"
}

export const edgeModels = {
	[EdgeModelTypes.CommonEdge]: CustomEdge,
	[EdgeModelTypes.SmoothStep]: CustomSmoothEdge
}

export const defaultEdgeConfig = {
	type: EdgeModelTypes.CommonEdge,
	markerEnd: {
		type: MarkerType.Arrow,
		width: 20,
		height: 20,
		color: "#4d53e8"
	},
	style: {
		stroke: "#4d53e8",
		strokeWidth: 2
	},
	data: {
		// 是否允许在线条新增节点
		allowAddOnLine: true,
	}
}
