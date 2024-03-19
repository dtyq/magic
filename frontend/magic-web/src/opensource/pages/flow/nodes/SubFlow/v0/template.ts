export const v0Template = {
	node_id: "MAGIC-FLOW-NODE-6649da5637d546-69160385",
	name: "子流程",
	description: "",
	node_type: 11,
	meta: [],
	params: {
		sub_flow_id: "",
	},
	next_nodes: [],
	input: {
		widget: null,
		form: {
			id: "component-662617c1a0884",
			version: "1",
			type: "form",
			structure: {
				type: "object",
				key: "root",
				sort: 0,
				title: null,
				description: null,
				required: ["input"],
				value: null,
				items: null,
				properties: {
					input: {
						type: "string",
						key: "input",
						sort: 0,
						title: "输入",
						description: "",
						required: null,
						value: null,
						items: null,
						properties: null,
					},
				},
			},
		},
	},
	output: {
		widget: null,
		form: {
			id: "component-662617a69868d",
			version: "1",
			type: "form",
			structure: {
				type: "object",
				key: "root",
				sort: 0,
				title: null,
				description: null,
				required: [],
				value: null,
				items: null,
				properties: {
					output: {
						type: "string",
						key: "output",
						sort: 0,
						title: "输出",
						description: "",
						required: null,
						value: {
							type: "expression",
							const_value: null,
							expression_value: [
								{
									type: "fields",
									value: "MAGIC-FLOW-NODE-6629f9ee4d6248-06936049.output",
									name: "output",
									args: null,
								},
							],
						},
						items: null,
						properties: null,
					},
				},
			},
		},
	},
}
