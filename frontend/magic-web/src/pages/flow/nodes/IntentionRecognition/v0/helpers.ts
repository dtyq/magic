import { nanoid } from "nanoid"

// 获取默认意图
export const getDefaultIntention = () => {
	return {
		branch_type: "if",
		title: {
			id: "component-66e158722cd53",
			version: "1",
			type: "value",
			structure: {
				type: "expression",
				const_value: null,
				expression_value: [
					{
						type: "input",
						value: "",
						name: "",
						args: null,
					},
				],
			},
		},
		desc: {
			id: "component-66e158722cd63",
			version: "1",
			type: "value",
			structure: {
				type: "expression",
				const_value: null,
				expression_value: [
					{
						type: "input",
						value: "",
						name: "",
						args: null,
					},
				],
			},
		},
		branch_id: `branch_${nanoid(8)}`,
		next_nodes: [],
		parameters: null,
	}
}

export default {}
