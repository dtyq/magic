export interface McpToolDetail {
	tool_definition: {
		name: string
		original_name: string
		server_name: string
		description: string
		label_name: string
		input_schema: {
			type: string
			properties: Record<string, any>
			required: string[]
		}
	}
	input_parameters: Record<string, any>
	execution_result: {
		status: string
		execution_time: number
		tool_name: string
		content: string
	}
}

export interface McpToolContentProps {
	detail: McpToolDetail
	className?: string
}
