export interface McpDomainItem {
	id: string
	name: string
	icon?: string
	description?: string
	require_fields?: unknown
	check_require_fields?: unknown
	check_auth?: boolean
}
