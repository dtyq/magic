import { describe, expect, it } from "vitest"
import { ToolbarButton } from "@/pages/superMagic/components/MessageEditor/types"
import {
	resolveCrewWidgetEditorCustomization,
	resolveCrewWidgetSendOverrides,
} from "../editorCustomization"

describe("resolveCrewWidgetEditorCustomization", () => {
	it("keeps current editor behavior when customization is omitted", () => {
		const result = resolveCrewWidgetEditorCustomization({})

		expect(result.modules.mcp?.enabled).toBe(true)
		expect(result.modules.upload?.enabled).toBe(true)
		expect(result.modules.voiceInput?.enabled).toBe(true)
		expect(result.layoutConfig.bottomRight).toContain(ToolbarButton.UPLOAD)
	})

	it("hides buttons independently from enabled capabilities", () => {
		const result = resolveCrewWidgetEditorCustomization({
			bottom: {
				internetSearch: { enabled: true, buttonVisible: false },
				upload: { enabled: true, buttonVisible: false },
			},
		})

		expect(result.layoutConfig.bottomRight).not.toContain(ToolbarButton.INTERNET_SEARCH)
		expect(result.layoutConfig.bottomRight).not.toContain(ToolbarButton.UPLOAD)
		expect(result.modules.upload?.enabled).toBe(true)
	})

	it("keeps the bottom connector independent from Mention panel rows", () => {
		const result = resolveCrewWidgetEditorCustomization({
			panel: { connectors: false },
			bottom: { upload: { enabled: false, buttonVisible: true } },
		})

		expect(result.modules.upload?.enabled).toBe(false)
		expect(result.modules.mcp?.enabled).toBe(true)
		expect(result.layoutConfig.bottomRight).not.toContain(ToolbarButton.UPLOAD)
		expect(result.layoutConfig.bottomRight).toContain(ToolbarButton.MCP)
		expect(result.layoutConfig.bottomLeft).toContain(ToolbarButton.MODEL_SWITCH)

		const disabled = resolveCrewWidgetEditorCustomization({
			bottom: { plugin: { enabled: false, buttonVisible: true } },
		})
		expect(disabled.modules.mcp?.enabled).toBe(false)
		expect(disabled.layoutConfig.bottomRight).not.toContain(ToolbarButton.MCP)
	})

	it("hides the model picker only through the model button field", () => {
		const result = resolveCrewWidgetEditorCustomization({
			bottom: { model: { buttonVisible: false } },
		})

		expect(result.layoutConfig.bottomLeft).not.toContain(ToolbarButton.MODEL_SWITCH)
	})

	it("forces send-time web search off when the capability is disabled", () => {
		expect(
			resolveCrewWidgetSendOverrides({
				bottom: { internetSearch: { enabled: false, buttonVisible: true } },
			}),
		).toEqual({ enableWebSearch: false })
		expect(
			resolveCrewWidgetEditorCustomization({
				bottom: { internetSearch: { enabled: false, buttonVisible: true } },
			}).layoutConfig.bottomRight,
		).not.toContain(ToolbarButton.INTERNET_SEARCH)
		expect(resolveCrewWidgetSendOverrides({})).toEqual({})
		expect(
			resolveCrewWidgetSendOverrides({
				bottom: { internetSearch: { enabled: true, buttonVisible: false } },
			}),
		).toEqual({})
	})
})
