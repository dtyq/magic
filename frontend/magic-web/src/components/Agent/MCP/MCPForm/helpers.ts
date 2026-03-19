import { MCPType } from "../types"
import { get, set } from "lodash-es"

/** Form fields */
export const enum MCPFormField {
	Icon = "icon",
	Name = "name",
	Description = "description",
	/** MCP type */
	MCPType = "type",
	Url = "url",
	/** Request headers */
	Header = "headers",
	/** Console type MCP request header field */
	Env = "env",
	/** Authorization method */
	AuthType = "auth_type",
	Command = "command",
	Arguments = "arguments",
	HeaderKey = "key",
	HeaderValue = "value",
	HeaderMapper = "mapper_system_input",
	ServiceConfig = "service_config",
	OAuthConfig = "oauth2_config",
	ClientId = "client_id",
	ClientSecret = "client_secret",
	ClientUrl = "client_url",
	Scope = "scope",
	AuthorizationUrl = "authorization_url",
}

/** Request header import */
export function importHeaders(headers: Record<string, string>): Array<Record<string, string>> {
	if (headers) {
		const cacheHeaders: Array<Record<string, string>> = []
		Object.keys(headers).forEach((i) => {
			cacheHeaders.push({
				[MCPFormField.HeaderKey]: i,
				[MCPFormField.HeaderValue]: headers?.[i],
			})
		})
		return cacheHeaders
	}
	return []
}

/** Convert MCP form data to JSON */
export function MCPConfigToJson(values: Record<string, any>) {
	const config: Record<string, any> = {}

	function setValue(target: Record<string, any>, key: string) {
		const v = get(values, key)
		if (v) {
			set(target, key, v)
		}
	}

	function setServiceConfig(target: Record<string, any>, key: Array<string>) {
		const v = get(values, [MCPFormField.ServiceConfig, ...key])
		if (v) {
			set(target, key, v)
		}
	}

	// Special handling for request headers and Env
	function setObject(target: Record<string, any>, key: string) {
		const v = get(values, [MCPFormField.ServiceConfig, key])

		if (v && Array.isArray(v)) {
			set(
				target,
				key,
				v.reduce<Record<string, string>>((o, i) => {
					o[i.key] = i.value
					return o
				}, {}),
			)
		}
	}

	try {
		;[MCPFormField.Icon, MCPFormField.Description, MCPFormField.Name].forEach((k) =>
			setValue(config, k),
		)
		;[
			[MCPFormField.Command],
			[MCPFormField.Url],
			[MCPFormField.OAuthConfig, MCPFormField.AuthorizationUrl],
			[MCPFormField.OAuthConfig, MCPFormField.ClientSecret],
			[MCPFormField.OAuthConfig, MCPFormField.ClientId],
			[MCPFormField.OAuthConfig, MCPFormField.ClientUrl],
			[MCPFormField.OAuthConfig, MCPFormField.Scope],
		].forEach((k) => setServiceConfig(config, k))
		;[MCPFormField.Header, MCPFormField.Env].forEach((k) => setObject(config, k))

		// Handle args separately
		const args = get(values, [MCPFormField.ServiceConfig, MCPFormField.Arguments])
		if (args) {
			set(config, ["args"], args.split(","))
		}

		// Handle MCP type separately
		if (values?.[MCPFormField.MCPType] === MCPType.STDIO) {
			config[MCPFormField.MCPType] = "stdio"
		}

		// Handle MCP type separately
		if (values?.[MCPFormField.MCPType] === MCPType.HTTP) {
			config[MCPFormField.MCPType] = "streamable-http"
		}

		return config
	} catch (error) {
		console.error(error)
		return config
	}
}
