import { times, random } from "lodash-es"
import { getDefaultTimeTriggerParams } from "./constants"

function generateRandomBranchId(length = 12) {
	// Generate a random string of 12 hexadecimal characters
	const randomHex = times(length, () => random(15).toString(16)).join("")
	// Prefix with "branch_"
	return `branch_${randomHex}`
}

export const getDefaultTimeTriggerBranches = () => {
	const branchId = generateRandomBranchId()
	const defaultBranchConfig = getDefaultTimeTriggerParams()
	return {
		branch_id: branchId,
		trigger_type: 3,
		next_nodes: [],
		config: defaultBranchConfig,
		input: {
			widget: null,
			form: {
				id: "component-66a1bd9ea09b7",
				version: "1",
				type: "form",
				structure: {
					type: "object",
					key: "root",
					sort: 0,
					title: "root节点",
					description: "",
					required: ["trigger_time"],
					value: null,
					items: null,
					properties: {
						trigger_time: {
							type: "string",
							key: "trigger_time",
							sort: 0,
							title: "触发时间",
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
				id: "component-66a1bd9ea09b7",
				version: "1",
				type: "form",
				structure: {
					type: "object",
					key: "root",
					sort: 0,
					title: "root节点",
					description: "",
					required: ["trigger_time"],
					value: null,
					items: null,
					properties: {
						trigger_time: {
							type: "string",
							key: "trigger_time",
							sort: 0,
							title: "触发时间",
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
	}
}

export default {}
