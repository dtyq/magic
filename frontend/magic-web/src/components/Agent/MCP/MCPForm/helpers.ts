import { MCPType } from "../types"
import { get, set } from "lodash-es"
import { highlight, languages } from "prismjs"

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

interface JsonObject {
	[key: string]: unknown
}

interface MCPKeyValueItem {
	key?: string
	value?: string
}

interface MCPNormalizedKeyValueItem {
	key: string
	value: string
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
export function MCPConfigToJson(values: JsonObject) {
	const config: JsonObject = {}

	function setValue(target: JsonObject, key: string) {
		const v = get(values, key)
		if (v) {
			set(target, key, v)
		}
	}

	function setServiceConfig(target: JsonObject, key: Array<string>) {
		const v = get(values, [MCPFormField.ServiceConfig, ...key])
		if (v) {
			set(target, key, v)
		}
	}

	// Special handling for request headers and Env
	function setObject(target: JsonObject, key: string) {
		const v = get(values, [MCPFormField.ServiceConfig, key])

		if (v && Array.isArray(v)) {
			set(
				target,
				key,
				v.reduce<Record<string, string>>((objectValue, item) => {
					const normalizedItem = normalizeKeyValueItem(item)
					if (!normalizedItem) return objectValue

					objectValue[normalizedItem.key] = normalizedItem.value
					return objectValue
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
		if (typeof args === "string" && args) {
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

const htmlEscapeMap: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
}

const prismJsonGrammar = {
	property: {
		pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?=\s*:)/,
		lookbehind: true,
		greedy: true,
	},
	string: {
		pattern: /(^|[^\\])"(?:\\.|[^\\"\r\n])*"(?!\s*:)/,
		lookbehind: true,
		greedy: true,
	},
	comment: {
		pattern: /\/\/.*|\/\*[\s\S]*?(?:\*\/|$)/,
		greedy: true,
	},
	number: /-?\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b/i,
	punctuation: /[{}[\],]/,
	operator: /:/,
	boolean: /\b(?:false|true)\b/,
	null: {
		pattern: /\bnull\b/,
		alias: "keyword",
	},
}

function escapeHtml(value: string) {
	return value.replace(/[&<>]/g, (char) => htmlEscapeMap[char] || char)
}

function normalizeKeyValueItem(value: unknown): MCPNormalizedKeyValueItem | null {
	if (!value || typeof value !== "object") return null

	const { key, value: itemValue } = value as MCPKeyValueItem
	if (typeof key !== "string" || !key) return null

	return {
		key,
		value: typeof itemValue === "string" ? itemValue : "",
	}
}

function ensurePrismJsonGrammar() {
	if (!languages.json) languages.json = prismJsonGrammar

	if (!languages.webmanifest) languages.webmanifest = languages.json
}

export function highlightJsonCode(code: string) {
	if (!code) return ""

	try {
		ensurePrismJsonGrammar()
		return highlight(code, languages.json, "json")
	} catch (error) {
		console.warn("Prism JSON highlight failed", error)
		return escapeHtml(code)
	}
}
