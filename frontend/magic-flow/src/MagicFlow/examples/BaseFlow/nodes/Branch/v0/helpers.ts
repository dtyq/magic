import { Expression } from "@/MagicConditionEdit/types/expression"
import { WidgetValue } from "../../../common/Output"


export enum BranchType {
	If = "if",
	Else = "else",
}

// If节点的单条分直播hi
export interface IfBranch {
	branch_id: string
	next_nodes: string[]
	parameters: {
		id: string
		version: string
		type: string
		structure: Expression.Condition | undefined
	}
}

export type Branch = {
	branch_id: string
	next_nodes: string[]
	config?: Record<string, any>
	input?: WidgetValue["value"]
	output?: WidgetValue["value"]
	branch_type?: BranchType
}

// 用于处理旧数据用，之前的分支有可能没有branch_type，在这里加入默认值
export default function addBranchTypeIfWithout(branches: Branch[]) {
	return branches?.map((branch, branchIndex) => {
		if (!branch?.branch_type) {
			branch.branch_type =
				branchIndex === branches.length - 1 ? BranchType.Else : BranchType.If
		}
		return branch
	})
}
