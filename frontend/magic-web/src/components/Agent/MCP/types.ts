import { OperationTypes } from "@/pages/flow/components/AuthControlButton/types"

export interface IMCPItem {
	id: string
	icon: string
	name: string
	enabled: boolean
	description: string
	user_operation: OperationTypes
	require_fields?: Array<{ field_name?: string; field_value?: string }>
}

/** MCP类型 */
export const enum MCPType {
	/** 默认工具类型 */
	Tool = "sse",
	SSE = "external_sse",
	HTTP = "external_http",
	STDIO = "external_stdio",
}
