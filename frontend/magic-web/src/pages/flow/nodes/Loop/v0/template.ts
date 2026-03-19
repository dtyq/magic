export const v0Template = {
	node_id: "MAGIC-FLOW-NODE-66a70a8da8ed48-26322039",
	name: "循环",
	description: "",
	node_type: 22,
	meta: [],
	params: {
		type: "array", // 计数类型：count 循环数组：array 条件循环：condition,
		condition: {
			// 条件循环时启用, 用于给定一个终止循环条件
			id: "component-66da72180d2e1",
			version: "1",
			type: "condition",
			structure: undefined,
		},
		count: {
			// 计数循环时启用
			id: "component-66da73d27fea0",
			version: "1",
			type: "value",
			structure: null,
		},
		array: {
			// 遍历循环数组时启用
			id: "component-66da73d27fea0",
			version: "1",
			type: "value",
			structure: null,
		},
		max_loop_count: {
			// 最大遍历次数限制，条件循环时启用，可以允许为空
			id: "component-66da73d27fea0",
			version: "1",
			type: "value",
			structure: null,
		},
	},
	next_nodes: [],
	input: null,
	output: null,
}
