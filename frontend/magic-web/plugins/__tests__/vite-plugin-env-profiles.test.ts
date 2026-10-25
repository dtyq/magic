import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
	MAGIC_ENV_PROFILE_PLUGIN_NAME,
	resolveMagicEnvProfileConfig,
	resolveMagicEnvProfileRuntimeConfig,
	vitePluginMagicEnvProfiles,
	type MagicEnvProfile,
} from "../vite-plugin-env-profiles"

const enterpriseProfiles: MagicEnvProfile[] = [
	{
		name: "test",
		label: "Testing",
		host: "magic-web.example.test",
		allowedHosts: ["magic-web.example.test"],
		runtimeConfigUrl: "https://magic-web.example.test/config.js",
	},
	{
		name: "intl-pre",
		label: "International Pre-release",
		host: "www-pre.magicrew.ai",
		allowedHosts: ["www-pre.magicrew.ai"],
	},
]

const tempRoots: string[] = []
const originalFetch = globalThis.fetch

function createTempProject() {
	const projectRoot = fs.mkdtempSync(path.join(os.tmpdir(), "magic-env-profiles-"))
	tempRoots.push(projectRoot)
	return projectRoot
}

afterEach(() => {
	for (const tempRoot of tempRoots.splice(0)) {
		fs.rmSync(tempRoot, { recursive: true, force: true })
	}
	globalThis.fetch = originalFetch
	vi.restoreAllMocks()
})

describe("resolveMagicEnvProfileConfig", () => {
	it("adds the selected profile host to dev and preview allowed hosts", () => {
		const config = resolveMagicEnvProfileConfig({
			env: {
				MAGIC_ENV_PROFILE: "intl-pre",
				MAGIC_DEV_ALLOWED_HOSTS: "localhost, existing.example.com",
			},
			profiles: enterpriseProfiles,
		})

		expect(config.server?.allowedHosts).toEqual([
			"localhost",
			"existing.example.com",
			"www-pre.magicrew.ai",
		])
		expect(config.preview?.allowedHosts).toEqual([
			"localhost",
			"existing.example.com",
			"www-pre.magicrew.ai",
		])
	})

	it("supports generic .env-driven hosts without knowing enterprise profiles", () => {
		const config = resolveMagicEnvProfileConfig({
			env: {
				MAGIC_DEV_HOST: "open-source.local",
				MAGIC_DEV_ALLOWED_HOSTS: "localhost",
			},
			profiles: [],
		})

		expect(config.server?.allowedHosts).toEqual(["localhost", "open-source.local"])
		expect(config.preview?.allowedHosts).toEqual(["localhost", "open-source.local"])
	})

	it("does not emit Vite config when a profile belongs to another layer plugin instance", () => {
		const config = resolveMagicEnvProfileConfig({
			env: {
				MAGIC_ENV_PROFILE: "test",
			},
			profiles: [],
		})

		expect(config).toEqual({})
	})

	it("proxies micro app install routes to the selected profile origin", () => {
		const config = resolveMagicEnvProfileConfig({
			env: {
				MAGIC_ENV_PROFILE: "test",
			},
			profiles: enterpriseProfiles,
		})

		expect(config.server?.proxy?.["^/micro-app/[^/]+/manifest\\.webmanifest$"]).toMatchObject({
			target: "https://magic-web.example.test",
			changeOrigin: true,
		})
	})

	it("keeps ports out of allowed hosts while preserving the proxy origin", () => {
		const config = resolveMagicEnvProfileConfig({
			env: { MAGIC_ENV_PROFILE: "custom-port" },
			profiles: [
				{
					name: "custom-port",
					runtimeConfigUrl: "https://example.test:8443/config.js",
				},
			],
		})

		expect(config.server?.allowedHosts).toEqual(["example.test"])
		expect(config.server?.proxy?.["^/micro-app/[^/]+/icon"]).toMatchObject({
			target: "https://example.test:8443",
		})
	})

	it("uses a bare IPv6 hostname in allowed hosts", () => {
		const config = resolveMagicEnvProfileConfig({
			env: { MAGIC_ENV_PROFILE: "ipv6" },
			profiles: [
				{
					name: "ipv6",
					runtimeConfigUrl: "https://[2001:db8::1]:8443/config.js",
				},
			],
		})

		expect(config.server?.allowedHosts).toEqual(["[2001:db8::1]"])
	})

	it("ignores runtime config URLs without a protocol", () => {
		const config = resolveMagicEnvProfileConfig({
			env: { MAGIC_ENV_PROFILE: "invalid-url" },
			profiles: [
				{
					name: "invalid-url",
					runtimeConfigUrl: "example.test:8443/config.js",
				},
			],
		})

		expect(config).toEqual({})
	})
})

describe("resolveMagicEnvProfileRuntimeConfig", () => {
	it("resolves the selected profile runtime config URL", () => {
		const runtimeConfig = resolveMagicEnvProfileRuntimeConfig({
			env: {
				MAGIC_ENV_PROFILE: "test",
			},
			profiles: enterpriseProfiles,
		})

		expect(runtimeConfig).toEqual({
			profileName: "test",
			runtimeConfigUrl:
				"https://magic-web.example.test/config.js",
		})
	})
})

describe("vitePluginMagicEnvProfiles", () => {
	it("exposes a stable Vite plugin name", () => {
		const plugin = vitePluginMagicEnvProfiles()

		expect(plugin.name).toBe(MAGIC_ENV_PROFILE_PLUGIN_NAME)
	})

	it("loads the selected profile from the Vite mode env file", async () => {
		const projectRoot = createTempProject()
		fs.writeFileSync(path.join(projectRoot, ".env.enterprise-test"), "MAGIC_ENV_PROFILE=test\n")
		const plugin = vitePluginMagicEnvProfiles({
			projectRoot,
			profiles: enterpriseProfiles,
		})

		const config = await runConfigHook(plugin, "enterprise-test")

		expect(config?.server?.allowedHosts).toContain(
			"magic-web.example.test",
		)
	})

	it("uses injected layered env without reloading the lower-priority root env", async () => {
		const projectRoot = createTempProject()
		fs.writeFileSync(path.join(projectRoot, ".env"), "MAGIC_DEV_HOST=lower-layer.local\n")
		const plugin = vitePluginMagicEnvProfiles({
			projectRoot,
			env: { MAGIC_ENV_PROFILE: "test" },
			profiles: enterpriseProfiles,
		})

		const config = await runConfigHook(plugin, "development")

		expect(config?.server?.allowedHosts).toContain(
			"magic-web.example.test",
		)
		expect(config?.server?.allowedHosts).not.toContain("lower-layer.local")
	})

	it("serves /config.js from the selected profile runtime config URL", async () => {
		const projectRoot = createTempProject()
		fs.writeFileSync(path.join(projectRoot, ".env.enterprise-test"), "MAGIC_ENV_PROFILE=test\n")
		const remoteConfig = 'window.CONFIG = {"MAGIC_APP_ENV":"saas-test"}'
		const fetchMock = vi.fn().mockResolvedValue(
			new Response(remoteConfig, {
				status: 200,
				headers: {
					"content-type": "application/javascript",
				},
			}),
		)
		globalThis.fetch = fetchMock
		const plugin = vitePluginMagicEnvProfiles({
			projectRoot,
			profiles: enterpriseProfiles,
		})

		await runConfigHook(plugin, "enterprise-test")

		const middleware = registerServerMiddleware(plugin)
		const response = await invokeMiddleware(middleware, "/config.js?ts=1")

		expect(response.statusCode).toBe(200)
		expect(response.headers["content-type"]).toBe("application/javascript; charset=utf-8")
		expect(response.headers["cache-control"]).toBe("no-cache, no-store, must-revalidate")
		expect(response.body).toBe(remoteConfig)
		expect(response.next).not.toHaveBeenCalled()
		expect(fetchMock).toHaveBeenCalledWith(
			"https://magic-web.example.test/config.js",
			{
				headers: {
					"cache-control": "no-cache",
					pragma: "no-cache",
				},
			},
		)
	})

	it("does not merge .env profile values when runtimeConfigUrl is configured", async () => {
		const projectRoot = createTempProject()
		fs.writeFileSync(path.join(projectRoot, ".env.enterprise-test"), "MAGIC_ENV_PROFILE=test\n")
		fs.writeFileSync(path.join(projectRoot, ".env.test"), "MAGIC_DEV_HOST=profile-env.local\n")
		const plugin = vitePluginMagicEnvProfiles({
			projectRoot,
			profiles: [
				{
					name: "test",
					runtimeConfigUrl: "https://example.com/config.js",
				},
			],
		})

		const config = await runConfigHook(plugin, "enterprise-test")

		expect(config?.server?.allowedHosts).toEqual(["example.com"])
		expect(config?.server?.allowedHosts).not.toContain("profile-env.local")
	})
})

async function runConfigHook(plugin: ReturnType<typeof vitePluginMagicEnvProfiles>, mode: string) {
	if (!("config" in plugin) || !plugin.config) throw new Error("config hook is required")

	const hook = typeof plugin.config === "function" ? plugin.config : plugin.config.handler
	return hook.call(
		{} as never,
		{},
		{
			command: "serve",
			mode,
		},
	)
}

function registerServerMiddleware(plugin: ReturnType<typeof vitePluginMagicEnvProfiles>) {
	let middleware:
		| ((req: Record<string, unknown>, res: Record<string, unknown>, next: () => void) => void)
		| undefined

	if (!("configureServer" in plugin) || !plugin.configureServer) {
		throw new Error("configureServer hook is required")
	}

	const hook =
		typeof plugin.configureServer === "function"
			? plugin.configureServer
			: plugin.configureServer.handler
	hook.call(
		{} as never,
		{
			middlewares: {
				use: (handler: typeof middleware) => {
					middleware = handler
				},
			},
		} as never,
	)

	if (!middleware) throw new Error("middleware is required")
	return middleware
}

async function invokeMiddleware(
	middleware: (
		req: Record<string, unknown>,
		res: Record<string, unknown>,
		next: () => void,
	) => void | Promise<void>,
	url: string,
) {
	const headers: Record<string, string> = {}
	let body = ""
	const next = vi.fn()
	const res = {
		statusCode: 0,
		setHeader: (name: string, value: string) => {
			headers[name.toLowerCase()] = value
		},
		end: (value?: string) => {
			body = value ?? ""
		},
	}

	await middleware(
		{
			method: "GET",
			url,
		},
		res,
		next,
	)

	return {
		body,
		headers,
		next,
		statusCode: res.statusCode,
	}
}
