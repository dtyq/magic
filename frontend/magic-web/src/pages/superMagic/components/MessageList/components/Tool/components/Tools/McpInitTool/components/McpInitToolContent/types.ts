interface ServerConfig {
	name: string
	type: "http" | "stdio"
	source: string
}

export interface ServerResult {
	name: string
	label_name: string
	status: "success" | "failed"
	duration: number
	tools: string[]
	tool_count: number
	error: string | null
}

export interface McpInitToolDetail {
	phase: string
	success: boolean
	initialized_count: number
	total_count: number
	server_configs: ServerConfig[]
	error: string | null
	timestamp: string
	server_results: ServerResult[]
	data?: {
		server_results: ServerResult[]
	}
}

export interface McpInitToolContentProps {
	detail: McpInitToolDetail
	className?: string
}
