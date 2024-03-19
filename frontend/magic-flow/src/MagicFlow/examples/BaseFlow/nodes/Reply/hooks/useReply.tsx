export default function useReply() {
	const replyTemplate = {
		node_id: "MAGIC-FLOW-NODE-663c38650f7fc4-75921863",
		name: "回复消息",
		description: "",
		node_type: 3,
		meta: [],
		params: {
			type: "",
			content: {
				id: "component-663c38650fcd0",
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
			link: {
				id: "component-663c3865100d5",
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
			link_desc: {
				id: "component-663c3865100e2",
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
		},
		next_nodes: [],
		input: null,
		output: null,
	}

	return {
		replyTemplate,
	}
}
