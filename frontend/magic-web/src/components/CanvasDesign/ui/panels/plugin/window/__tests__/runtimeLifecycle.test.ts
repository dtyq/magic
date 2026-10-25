import { beforeEach, describe, expect, it, vi } from "vitest"

import { createPluginSrcDoc } from "../index"
import type { CanvasDesignPlugin } from "../../../../../runtime/document/types"

function createPlugin(runtimeCode: string): CanvasDesignPlugin {
	return {
		name: "test-plugin",
		label: "Test Plugin",
		description: "Test plugin",
		version: 1,
		entry: "index.js",
		runtimeCode,
		source: "builtin",
		capabilities: [],
	}
}

async function runPluginSrcDoc(runtimeCode: string) {
	const srcDoc = createPluginSrcDoc(createPlugin(runtimeCode), "zh-CN", "token-1", {
		accessMode: "edit",
	})
	if (!srcDoc) throw new Error("Expected srcDoc.")
	const iframe = document.createElement("iframe")
	document.body.append(iframe)
	const frameWindow = iframe.contentWindow
	if (!frameWindow) throw new Error("Expected iframe window.")
	frameWindow.document.body.innerHTML = '<div id="root"></div>'
	;(frameWindow as unknown as { __calls?: unknown[] }).__calls = []
	const scripts = Array.from(srcDoc.matchAll(/<script>([\s\S]*?)<\/script>/g)).map(
		(match) => match[1] ?? "",
	)
	;(frameWindow as Window & typeof globalThis).eval(scripts.join("\n"))
	await Promise.resolve()
	await Promise.resolve()
	return frameWindow
}

describe("plugin iframe lifecycle", () => {
	beforeEach(() => {
		document.body.innerHTML = ""
		vi.spyOn(window, "postMessage").mockImplementation(() => undefined)
	})

	it("runs the new create/render lifecycle and dispatches state updates", async () => {
		const frameWindow = await runPluginSrcDoc(`
			registerMagicCanvasPlugin({
				create(ctx) {
					window.__calls.push("create")
					return { state: ctx.state.create({ loading: false }) }
				},
				prepare(ctx, instance) {
					window.__calls.push("prepare")
					ctx.state.patch(instance.state, { prepared: true }, { silent: true })
				},
				render(ctx, instance, root) {
					window.__calls.push("render")
					root.append(document.createElement("button"))
					return {
						activate() {
							window.__calls.push("activate")
							ctx.state.patch(instance.state, { loading: true })
						},
						update(change) {
							window.__calls.push(["update", Array.from(change.keys)])
						},
						deactivate() {
							window.__calls.push("deactivate")
						},
						dispose() {
							window.__calls.push("view.dispose")
							root.replaceChildren()
						},
					}
				},
				dispose() {
					window.__calls.push("module.dispose")
				},
			})
		`)

		await vi.waitFor(() => {
			expect((frameWindow as unknown as { __calls: unknown[] }).__calls).toContainEqual([
				"update",
				["loading"],
			])
		})

		frameWindow.dispatchEvent(new Event("pagehide"))

		await vi.waitFor(() => {
			expect((frameWindow as unknown as { __calls: unknown[] }).__calls).toEqual([
				"create",
				"prepare",
				"render",
				"activate",
				["update", ["loading"]],
				"deactivate",
				"view.dispose",
				"module.dispose",
			])
			expect(frameWindow.document.getElementById("root")?.children).toHaveLength(0)
		})
	})

	it("keeps the legacy mount cleanup path working", async () => {
		const frameWindow = await runPluginSrcDoc(`
			registerMagicCanvasPlugin({
				mount(ctx, root) {
					window.__calls.push("mount")
					root.append(document.createElement("button"))
					return function cleanup() {
						window.__calls.push("cleanup")
						root.replaceChildren()
					}
				},
			})
		`)

		expect((frameWindow as unknown as { __calls: unknown[] }).__calls).toEqual(["mount"])
		expect(frameWindow.document.getElementById("root")?.children).toHaveLength(1)

		frameWindow.dispatchEvent(new Event("pagehide"))

		await vi.waitFor(() => {
			expect((frameWindow as unknown as { __calls: unknown[] }).__calls).toEqual([
				"mount",
				"cleanup",
			])
			expect(frameWindow.document.getElementById("root")?.children).toHaveLength(0)
		})
	})
})
