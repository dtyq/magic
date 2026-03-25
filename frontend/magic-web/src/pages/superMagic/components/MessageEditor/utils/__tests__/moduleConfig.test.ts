import { describe, expect, it } from "vitest"
import { ToolbarButton, type MessageEditorLayoutConfig } from "../../types"
import {
	DEFAULT_MESSAGE_EDITOR_MODULES,
	hasToolbarButton,
	resolveMessageEditorModules,
	resolveModuleEnabled,
} from "../moduleConfig"

describe("moduleConfig", () => {
	describe("resolveModuleEnabled", () => {
		it("prefers module config over legacy flag", () => {
			expect(resolveModuleEnabled({ enabled: false }, true)).toBe(false)
			expect(resolveModuleEnabled({ enabled: true }, false)).toBe(true)
		})

		it("falls back to legacy flag when module config is absent", () => {
			expect(resolveModuleEnabled(undefined, false)).toBe(false)
			expect(resolveModuleEnabled(undefined, true)).toBe(true)
		})

		it("falls back to default value when neither config is provided", () => {
			expect(resolveModuleEnabled(undefined, undefined)).toBe(true)
			expect(resolveModuleEnabled(undefined, undefined, false)).toBe(false)
		})
	})

	describe("hasToolbarButton", () => {
		it("finds buttons across all toolbar slots", () => {
			const layoutConfig: MessageEditorLayoutConfig = {
				topBarLeft: [ToolbarButton.DRAFT_BOX],
				bottomLeft: [ToolbarButton.AT],
				bottomRight: [ToolbarButton.SEND_BUTTON],
			}

			expect(hasToolbarButton(layoutConfig, ToolbarButton.AT)).toBe(true)
			expect(hasToolbarButton(layoutConfig, ToolbarButton.MCP)).toBe(false)
		})

		it("returns false for empty layout config", () => {
			expect(hasToolbarButton(undefined, ToolbarButton.AT)).toBe(false)
			expect(hasToolbarButton({}, ToolbarButton.AT)).toBe(false)
		})
	})

	describe("resolveMessageEditorModules", () => {
		it("uses explicit defaults when nothing is provided", () => {
			expect(
				resolveMessageEditorModules({
					modules: undefined,
					layoutConfig: undefined,
					providerConfig: undefined,
				}),
			).toEqual(DEFAULT_MESSAGE_EDITOR_MODULES)
		})

		it("enables related modules when buttons are present in layout config", () => {
			const layoutConfig: MessageEditorLayoutConfig = {
				topBarLeft: [ToolbarButton.AT],
				bottomRight: [
					ToolbarButton.UPLOAD,
					ToolbarButton.VOICE_INPUT,
					ToolbarButton.SEND_BUTTON,
				],
			}

			const resolved = resolveMessageEditorModules({
				modules: {},
				layoutConfig,
				providerConfig: {
					enableVoiceInput: false,
				},
			})

			expect(resolved.mention.enabled).toBe(true)
			expect(resolved.upload.enabled).toBe(true)
			expect(resolved.voiceInput.enabled).toBe(true)
			expect(resolved.send.enabled).toBe(true)
		})

		it("keeps explicit module config as highest priority", () => {
			const layoutConfig: MessageEditorLayoutConfig = {
				topBarLeft: [ToolbarButton.AT],
				bottomRight: [
					ToolbarButton.UPLOAD,
					ToolbarButton.VOICE_INPUT,
					ToolbarButton.SEND_BUTTON,
				],
			}

			const resolved = resolveMessageEditorModules({
				modules: {
					mention: { enabled: false },
					upload: { enabled: false, confirmDelete: false },
					voiceInput: { enabled: false },
					send: { enabled: false },
				},
				layoutConfig,
				providerConfig: {
					enableVoiceInput: true,
				},
			})

			expect(resolved.mention.enabled).toBe(false)
			expect(resolved.upload.enabled).toBe(false)
			expect(resolved.upload.confirmDelete).toBe(false)
			expect(resolved.voiceInput.enabled).toBe(false)
			expect(resolved.send.enabled).toBe(false)
		})
	})
})
