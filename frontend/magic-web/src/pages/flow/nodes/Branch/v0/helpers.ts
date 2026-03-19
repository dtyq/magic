import type { WidgetValue } from "@dtyq/magic-flow/dist/MagicFlow/examples/BaseFlow/common/Output"

export enum BranchType {
	If = "if",
	Else = "else",
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
