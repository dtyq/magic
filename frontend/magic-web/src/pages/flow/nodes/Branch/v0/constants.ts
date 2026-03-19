export const defaultBranches = [
	// 默认的如果
	{
		branch_id: "branch_66483eaf04714",
		next_nodes: [],
		parameters: {
			id: "component-66483eaf04974",
			version: "1",
			type: "condition",
			structure: undefined,
		},
	},
	// 默认的否则
	{
		branch_id: "branch_66483eaf04715",
		next_nodes: [],
		parameters: {
			id: "component-66483eaf04274",
			version: "1",
			type: "condition",
			structure: {
				ops: "AND",
				children: [
					{
						type: "compare",
						left_operands: {
							type: "expression",
							const_value: [],
							expression_value: [
								{
									type: "input",
									uniqueId: "584039175041323008",
									value: "1",
								},
							],
						},
						condition: "equals",
						right_operands: {
							type: "expression",
							const_value: [],
							expression_value: [
								{
									type: "input",
									uniqueId: "584039175041323009",
									value: "1",
								},
							],
						},
					},
				],
			},
		},
	},
]

export default {}
