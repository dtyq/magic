import type { ProxyOptions } from "vite"

const MANIFEST_PROXY_PATTERN = "^/micro-app/[^/]+/manifest\\.webmanifest$"
const ICON_PROXY_PATTERN = "^/micro-app/[^/]+/icon"

function normalizeProxyOrigin(value: string): string | undefined {
	const trimmed = value.trim()
	// Opaque URL origins serialize as the literal "null"; never proxy to that.
	if (!trimmed || trimmed === "null") return undefined

	try {
		const url = trimmed.includes("://") ? new URL(trimmed) : new URL(`https://${trimmed}`)
		if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
		if (!url.hostname || url.hostname === "null") return undefined
		return url.origin
	} catch {
		return undefined
	}
}

export function resolveMicroAppInstallDevProxyTarget(
	env: Record<string, string | undefined>,
	options: { fallbackOrigin?: string } = {},
): string | undefined {
	const webUrl = env.MAGIC_WEB_URL?.trim()
	if (webUrl) return normalizeProxyOrigin(webUrl)

	const fallbackOrigin = options.fallbackOrigin?.trim()
	if (fallbackOrigin) return normalizeProxyOrigin(fallbackOrigin)

	return undefined
}

export function resolveMicroAppInstallDevProxy(
	env: Record<string, string | undefined>,
	options: { fallbackOrigin?: string } = {},
): Record<string, string | ProxyOptions> {
	const target = resolveMicroAppInstallDevProxyTarget(env, options)
	if (!target) return {}

	const proxyOptions: ProxyOptions = {
		target,
		changeOrigin: true,
		secure: true,
	}

	return {
		[MANIFEST_PROXY_PATTERN]: proxyOptions,
		[ICON_PROXY_PATTERN]: proxyOptions,
	}
}
