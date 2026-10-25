import { describe, expect, it } from "vitest"
import { MONACO_CDN_VERSION, MONACO_DEV_VS_PATH, resolveMonacoVsPath } from "../configureLoader"

describe("resolveMonacoVsPath", () => {
	it("uses the local dependency in development so CDN referer rules cannot block it", () => {
		expect(resolveMonacoVsPath(true, "https://cdn.letsmagic.cn/__assets__/packages")).toBe(
			MONACO_DEV_VS_PATH,
		)
	})

	it("uses the versioned CDN path in production", () => {
		expect(resolveMonacoVsPath(false, "https://cdn.letsmagic.cn/__assets__/packages")).toBe(
			`https://cdn.letsmagic.cn/__assets__/packages/monaco-editor/${MONACO_CDN_VERSION}/min/vs`,
		)
	})

	it("does not emit a double slash or `undefined` when the CDN host has a trailing slash", () => {
		const resolved = resolveMonacoVsPath(false, "https://cdn.example.com/packages/")
		expect(resolved).toBe(
			`https://cdn.example.com/packages/monaco-editor/${MONACO_CDN_VERSION}/min/vs`,
		)
		expect(resolved).not.toContain("//monaco-editor")
		expect(resolved).not.toContain("undefined")
	})
})
