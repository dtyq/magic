import { describe, expect, it } from "vitest"
import { loadToolIcon } from "../../Nodes/ToolCall/ToolIcon"
import { getToolIconConfig } from "./config"

const tableToolNames = [
	"query_magicbase_tables",
	"get_magicbase_table",
	"create_magicbase_table",
	"create_magicbase_column",
	"update_magicbase_table_permissions",
	"delete_magicbase_table",
	"update_magicbase_column",
	"delete_magicbase_column",
]

const microAppToolNames = [
	"micro_app_plan",
	"query_magicbase_rows",
	"batch_get_magicbase_rows",
	"get_magicbase_row",
	"create_magicbase_row",
	"update_magicbase_row",
	"batch_create_magicbase_rows",
	"delete_magicbase_row",
	"batch_delete_magicbase_rows",
	"update_html_app_memory",
]

describe("table tool icons", () => {
	it.each(tableToolNames)(
		"uses the same SVG asset in both tool icon renderers: %s",
		async (toolName) => {
			const configuredAsset = getToolIconConfig(toolName).assetUrl

			expect(configuredAsset).toBeTruthy()
			expect(await loadToolIcon(toolName)).toBe(configuredAsset)
		},
	)
})

describe("micro-app tool icons", () => {
	it.each(microAppToolNames)(
		"uses the same SVG asset in both tool icon renderers: %s",
		async (toolName) => {
			const configuredAsset = getToolIconConfig(toolName).assetUrl

			expect(configuredAsset).toBeTruthy()
			expect(await loadToolIcon(toolName)).toBe(configuredAsset)
		},
	)
})
