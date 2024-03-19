import i18next from "i18next"

export const v0Template = {
	node_id: "MAGIC-FLOW-NODE-66d7cba1867399-04413238",
	name: "意图识别",
	description: "",
	node_type: 101,
	meta: [],
	params: {
		model: "gpt-4o-global",
		branches: [
			{
				branch_id: "branch_66e158722cd52",
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
				next_nodes: [],
				parameters: null,
			},
			{
				branch_id: "branch_66e158722cd6f",
				branch_type: "else",
				title: "",
				desc: "",
				next_nodes: [],
				parameters: null,
			},
		],
		model_config: {
			max_record: 10,
			auto_memory: false,
		},
	},
	next_nodes: [],
	input: {
		widget: null,
		form: {
			id: "component-66d7cba186802",
			version: "1",
			type: "form",
			structure: {
				type: "object",
				key: "root",
				sort: 0,
				title: "root节点",
				description: "",
				required: ["intent"],
				value: null,
				items: null,
				properties: {
					intent: {
						type: "string",
						key: "intent",
						sort: 0,
						title: i18next.t("intentionRecognize.intention", { ns: "flow" }),
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
	output: null,
}
