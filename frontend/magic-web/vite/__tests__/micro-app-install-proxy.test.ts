import { describe, expect, it } from "vitest"
import {
	resolveMicroAppInstallDevProxy,
	resolveMicroAppInstallDevProxyTarget,
} from "../micro-app-install-proxy"

describe("resolveMicroAppInstallDevProxyTarget", () => {
	it("accepts host-only MAGIC_WEB_URL values", () => {
		expect(
			resolveMicroAppInstallDevProxyTarget({
				MAGIC_WEB_URL: "remote.web.example.com",
			}),
		).toBe("https://remote.web.example.com")
	})

	it("falls back to profile runtime config origin", () => {
		expect(
			resolveMicroAppInstallDevProxyTarget(
				{},
				{
					fallbackOrigin: "https://remote.web.example.com",
				},
			),
		).toBe("https://remote.web.example.com")
	})

	it("normalizes MAGIC_WEB_URL to origin", () => {
		expect(
			resolveMicroAppInstallDevProxyTarget({
				MAGIC_WEB_URL: "https://web.example.com/default/super",
			}),
		).toBe("https://web.example.com")
	})
})

describe("resolveMicroAppInstallDevProxy", () => {
	it("returns manifest and icon proxy rules for a configured target", () => {
		const proxy = resolveMicroAppInstallDevProxy({
			MAGIC_WEB_URL: "https://web.example.com",
		})

		expect(Object.keys(proxy)).toEqual([
			"^/micro-app/[^/]+/manifest\\.webmanifest$",
			"^/micro-app/[^/]+/icon",
		])
		expect(proxy["^/micro-app/[^/]+/manifest\\.webmanifest$"]).toMatchObject({
			target: "https://web.example.com",
			changeOrigin: true,
			secure: true,
		})
	})

	it("returns an empty object when no proxy target is configured", () => {
		expect(resolveMicroAppInstallDevProxy({})).toEqual({})
	})

	it("ignores opaque null origins from invalid fallback URLs", () => {
		expect(
			resolveMicroAppInstallDevProxy(
				{},
				{
					fallbackOrigin: "null",
				},
			),
		).toEqual({})
	})
})
