import { describe, expect, it } from "vitest"
import * as helpers from "../helpers"
import { MCPType } from "../../types"
import { MCPFormField } from "../helpers"

interface HelpersModule {
	highlightJsonCode?: (code: string) => string
}

function getHighlightJsonCode() {
	const { highlightJsonCode } = helpers as HelpersModule

	expect(highlightJsonCode).toBeTypeOf("function")

	if (!highlightJsonCode) throw new Error("highlightJsonCode is unavailable")

	return highlightJsonCode
}

describe("MCPForm helpers", () => {
	it("highlights JSON tokens without relying on Prism globals", () => {
		const highlightJsonCode = getHighlightJsonCode()

		const highlighted = highlightJsonCode(
			JSON.stringify(
				{
					name: "magic",
					enabled: true,
					count: 3,
					value: null,
				},
				null,
				2,
			),
		)

		expect(highlighted).toContain('class="token property"')
		expect(highlighted).toContain('class="token string"')
		expect(highlighted).toContain('class="token boolean"')
		expect(highlighted).toContain('class="token number"')
		expect(highlighted).toContain('class="token null keyword"')
		expect(highlighted).toContain('class="token punctuation"')
		expect(highlighted).toContain('class="token operator"')
	})

	it("escapes HTML-like content inside JSON strings", () => {
		const highlightJsonCode = getHighlightJsonCode()

		const highlighted = highlightJsonCode(
			JSON.stringify(
				{
					value: '<script>alert("xss")</script>',
				},
				null,
				2,
			),
		)

		expect(highlighted).toContain("&lt;script>")
		expect(highlighted).not.toContain("<script>")
	})

	it("serializes stdio config into Prism-safe MCP JSON payload", () => {
		const result = helpers.MCPConfigToJson({
			[MCPFormField.Name]: "stdio-mcp",
			[MCPFormField.Description]: "A local MCP server",
			[MCPFormField.MCPType]: MCPType.STDIO,
			[MCPFormField.ServiceConfig]: {
				[MCPFormField.Command]: "npx",
				[MCPFormField.Arguments]: "foo,bar",
				[MCPFormField.Env]: [
					{ key: "TOKEN", value: "secret" },
					{ key: "MODE", value: "dev" },
				],
			},
		})

		expect(result).toEqual({
			name: "stdio-mcp",
			description: "A local MCP server",
			command: "npx",
			args: ["foo", "bar"],
			env: {
				TOKEN: "secret",
				MODE: "dev",
			},
			type: "stdio",
		})
	})
})
