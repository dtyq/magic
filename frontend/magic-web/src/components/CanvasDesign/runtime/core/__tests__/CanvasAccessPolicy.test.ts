import { describe, expect, it } from "vitest"
import {
	CanvasAccessPolicy,
	authorizeCanvasTool,
	resolveCanvasAccessContext,
} from "../CanvasAccessPolicy"
import { PermissionManager } from "../PermissionManager"

describe("CanvasAccessPolicy", () => {
	it("allows session content preview while readonly", () => {
		const policy = new CanvasAccessPolicy({ mode: "readonly" })
		expect(policy.authorize("interaction.switchContent").allowed).toBe(true)
		expect(policy.authorize("document.write").allowed).toBe(false)
	})

	it("does not leak edit capability overrides across a mode-only change", () => {
		const policy = new CanvasAccessPolicy({
			mode: "edit",
			capabilities: { "document.write": true },
		})
		policy.setAccess({ mode: "readonly" })
		expect(policy.authorize("document.write").allowed).toBe(false)
	})

	it("derives share and history capabilities from the explicit mode", () => {
		const share = new CanvasAccessPolicy({ mode: "share" })
		const history = new CanvasAccessPolicy({ mode: "history" })

		expect(share.authorize("interaction.switchContent").allowed).toBe(true)
		expect(share.authorize("document.write").allowed).toBe(false)
		expect(history.authorize("interaction.switchContent").allowed).toBe(false)
		expect(history.authorize("document.write").allowed).toBe(false)
	})

	it("keeps document mutation capabilities hard-denied outside edit mode", () => {
		for (const mode of ["readonly", "share", "history"] as const) {
			const policy = new CanvasAccessPolicy({
				mode,
				capabilities: {
					"document.write": true,
					"document.delete": true,
					"sideEffect.generate": true,
					"sideEffect.download": true,
					"sideEffect.copy": true,
				},
			})

			expect(policy.authorize("document.write").allowed).toBe(false)
			expect(policy.authorize("document.delete").allowed).toBe(false)
			expect(policy.authorize("sideEffect.generate").allowed).toBe(false)
			expect(policy.authorize("sideEffect.download").allowed).toBe(true)
			expect(policy.authorize("sideEffect.copy").allowed).toBe(true)
		}
	})

	it("restores edit capabilities after returning from a hard readonly mode", () => {
		const policy = new CanvasAccessPolicy({ mode: "edit" })
		policy.setAccess({ mode: "share" })
		policy.setAccess({ mode: "edit" })

		expect(policy.authorize("document.write").allowed).toBe(true)
		expect(policy.authorize("document.delete").allowed).toBe(true)
		expect(policy.authorize("sideEffect.generate").allowed).toBe(true)
	})

	it("keeps the current mode when only capabilities are updated", () => {
		const policy = new CanvasAccessPolicy({ mode: "share" })
		policy.setAccess({ capabilities: { "sideEffect.download": true } })

		expect(policy.getContext().mode).toBe("share")
		expect(policy.authorize("document.write").allowed).toBe(false)
		expect(policy.authorize("sideEffect.download").allowed).toBe(true)
	})

	it("honors access mode updates even when a previous context was editable", () => {
		const policy = new CanvasAccessPolicy()
		policy.setAccess({ mode: "readonly" })

		expect(policy.getContext().mode).toBe("readonly")
		expect(policy.authorize("document.write").allowed).toBe(false)
	})

	it("applies the effect guard in addition to the declared capability", () => {
		const context = resolveCanvasAccessContext({
			mode: "readonly",
			capabilities: { "sideEffect.download": true },
		})

		expect(
			authorizeCanvasTool(context, {
				effect: "document",
				requiredCapability: "sideEffect.download",
			}),
		).toEqual({
			allowed: false,
			reason: "CAPABILITY_REQUIRED",
			requiredCapability: "document.write",
		})
	})

	it("does not let callers mutate authorization through the exposed capability snapshot", () => {
		const context = resolveCanvasAccessContext({ mode: "edit" })
		;(context.capabilities as Set<string>).delete("document.write")

		expect(context.can("document.write")).toBe(true)
	})

	it("keeps host download and conversation policies behind the permission facade", () => {
		const permissions = {
			allowFileDownload: false,
			elementMenuConversationActions: false,
		}
		const canvas = {
			magicConfigManager: {
				config: {
					permissions,
				},
			},
		} as never
		const manager = new PermissionManager({ canvas, accessMode: "edit" })

		expect(manager.canDownloadFiles()).toBe(false)
		expect(manager.canAddSelectedMediaToConversation()).toBe(false)

		permissions.allowFileDownload = true
		permissions.elementMenuConversationActions = true
		expect(manager.canDownloadFiles()).toBe(true)
		expect(manager.canAddSelectedMediaToConversation()).toBe(true)
	})
})
