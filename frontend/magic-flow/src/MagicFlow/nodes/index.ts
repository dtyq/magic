import CommonNode from "./BaseNode"
import IfElseNode from "./BranchNode"
import GroupNode from "./GroupNode"

export const NodeModelType = {
	// 普通节点
	CommonNode: "common",

	// 条件节点
	IfElseNode: "ifElse",

	// 组合节点
	Group: "Group"
}

export default {
	[NodeModelType.CommonNode]: CommonNode,
	[NodeModelType.IfElseNode]: IfElseNode,
	[NodeModelType.Group]: GroupNode
}


export const InnerHandleType = {
	// 循环端点
	LoopHandle : "LoopBodyHandle",
	// 循环节点下一个节点端点
	LoopNext : "LoopNextHandle"
}