import { OperationTypes } from "@/pages/flow/components/AuthControlButton/types"

/** Connector identity, display metadata, enabled state, and the user's management permission. */
export interface IMCPItem {
	id: string
	icon: string
	name: string
	enabled: boolean
	description: string
	type?: string
	updated_at?: string
	user_operation: OperationTypes
	require_fields?: Array<{ field_name?: string; field_value?: string }>
}

/** Supported MCP service transport types. */
export const enum MCPType {
	/** Built-in tool server type. */
	Tool = "sse",
	SSE = "external_sse",
	HTTP = "external_http",
	STDIO = "external_stdio",
}
