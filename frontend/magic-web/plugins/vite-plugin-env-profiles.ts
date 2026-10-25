import { resolve } from "node:path"
import {
	loadEnv,
	type Connect,
	type Plugin,
	type PreviewServer,
	type UserConfig,
	type ViteDevServer,
} from "vite"
import { resolveMicroAppInstallDevProxy } from "../vite/micro-app-install-proxy"

export const MAGIC_ENV_PROFILE_PLUGIN_NAME = "magic-env-profiles"
const RUNTIME_CONFIG_PATH = "/config.js"

export interface MagicEnvProfile {
	name: string
	label?: string
	host?: string
	allowedHosts?: string[]
	runtimeConfigUrl?: string
}

export interface MagicEnvProfileConfigOptions {
	env: Record<string, string | undefined>
	profiles?: MagicEnvProfile[]
	profileEnvName?: string
	hostEnvName?: string
	allowedHostsEnvName?: string
}

export interface VitePluginMagicEnvProfilesOptions extends Omit<
	MagicEnvProfileConfigOptions,
	"env"
> {
	projectRoot?: string
	/** Pre-resolved layered env; avoids reloading the lower-priority root env directory. */
	env?: Record<string, string | undefined>
}

export interface MagicEnvProfileRuntimeConfig {
	profileName: string
	runtimeConfigUrl: string
}

const DEFAULT_PROFILE_ENV_NAME = "MAGIC_ENV_PROFILE"
const DEFAULT_HOST_ENV_NAME = "MAGIC_DEV_HOST"
const DEFAULT_ALLOWED_HOSTS_ENV_NAME = "MAGIC_DEV_ALLOWED_HOSTS"

export function resolveMagicEnvProfileRuntimeConfig({
	env,
	profiles = [],
	profileEnvName = DEFAULT_PROFILE_ENV_NAME,
}: MagicEnvProfileConfigOptions): MagicEnvProfileRuntimeConfig | undefined {
	const profile = resolveSelectedProfile({
		env,
		profiles,
		profileEnvName,
	})
	const runtimeConfigUrl = profile?.runtimeConfigUrl?.trim()
	if (!profile || !runtimeConfigUrl) return undefined

	return {
		profileName: profile.name,
		runtimeConfigUrl,
	}
}

export function resolveMagicEnvProfileConfig({
	env,
	profiles = [],
	profileEnvName = DEFAULT_PROFILE_ENV_NAME,
	hostEnvName = DEFAULT_HOST_ENV_NAME,
	allowedHostsEnvName = DEFAULT_ALLOWED_HOSTS_ENV_NAME,
}: MagicEnvProfileConfigOptions): UserConfig {
	const profile = resolveSelectedProfile({
		env,
		profiles,
		profileEnvName,
	})
	const envHost = env[hostEnvName]?.trim()
	const allowedHosts = uniqueStrings([
		...splitCsv(env[allowedHostsEnvName]),
		...(profile?.allowedHosts ?? []),
		// Remote config profiles usually share the page host with their /config.js URL.
		// Use it only as a fallback so layer configs can still override or extend it.
		envHost || profile?.host || getUrlHostname(profile?.runtimeConfigUrl),
	])

	const profileOrigin = getUrlOrigin(profile?.runtimeConfigUrl)
	const microAppInstallProxy = resolveMicroAppInstallDevProxy(env, {
		fallbackOrigin: profileOrigin,
	})

	if (allowedHosts.length === 0 && Object.keys(microAppInstallProxy).length === 0) return {}

	const serverConfig: NonNullable<UserConfig["server"]> = {}
	if (allowedHosts.length > 0) serverConfig.allowedHosts = allowedHosts
	if (Object.keys(microAppInstallProxy).length > 0) serverConfig.proxy = microAppInstallProxy

	return {
		preview: allowedHosts.length > 0 ? { allowedHosts } : {},
		server: Object.keys(serverConfig).length > 0 ? serverConfig : {},
	}
}

export function vitePluginMagicEnvProfiles(
	options: VitePluginMagicEnvProfilesOptions = {},
): Plugin {
	let runtimeConfig: MagicEnvProfileRuntimeConfig | undefined

	return {
		name: MAGIC_ENV_PROFILE_PLUGIN_NAME,
		config(userConfig, configEnv) {
			const projectRoot = resolve(options.projectRoot ?? userConfig.root ?? process.cwd())
			const env =
				options.env ??
				loadMagicEnvProfileVariables({
					mode: configEnv.mode,
					projectRoot,
				})
			runtimeConfig = resolveMagicEnvProfileRuntimeConfig({
				env,
				profiles: options.profiles,
				profileEnvName: options.profileEnvName,
				hostEnvName: options.hostEnvName,
				allowedHostsEnvName: options.allowedHostsEnvName,
			})

			return resolveMagicEnvProfileConfig({
				env,
				profiles: options.profiles,
				profileEnvName: options.profileEnvName,
				hostEnvName: options.hostEnvName,
				allowedHostsEnvName: options.allowedHostsEnvName,
			})
		},
		configureServer(server) {
			configureRuntimeConfigMiddleware({
				middlewares: server.middlewares,
				resolveRuntimeConfig: () => runtimeConfig,
			})
		},
		configurePreviewServer(server) {
			configureRuntimeConfigMiddleware({
				middlewares: server.middlewares,
				resolveRuntimeConfig: () => runtimeConfig,
			})
		},
	}
}

function loadMagicEnvProfileVariables({
	mode,
	projectRoot,
}: {
	mode: string
	projectRoot: string
}): Record<string, string | undefined> {
	const modeEnv = loadEnv(mode, projectRoot, "")

	return {
		...modeEnv,
		...process.env,
	}
}

function resolveSelectedProfile({
	env,
	profiles,
	profileEnvName,
}: {
	env: Record<string, string | undefined>
	profiles: MagicEnvProfile[]
	profileEnvName: string
}): MagicEnvProfile | undefined {
	const profileName = env[profileEnvName]?.trim()
	return profileName ? profiles.find((item) => item.name === profileName) : undefined
}

function configureRuntimeConfigMiddleware({
	middlewares,
	resolveRuntimeConfig,
}: {
	middlewares: ViteDevServer["middlewares"] | PreviewServer["middlewares"]
	resolveRuntimeConfig: () => MagicEnvProfileRuntimeConfig | undefined
}) {
	middlewares.use(async (req, res, next) => {
		if (!isRuntimeConfigRequest(req)) {
			next()
			return
		}

		const runtimeConfig = resolveRuntimeConfig()
		if (!runtimeConfig) {
			next()
			return
		}

		try {
			// Keep runtime config switching side-effect free: no local config.js writes.
			const content = await fetchRuntimeConfigJs(runtimeConfig.runtimeConfigUrl)
			res.statusCode = 200
			res.setHeader("Content-Type", "application/javascript; charset=utf-8")
			res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate")
			res.setHeader("Pragma", "no-cache")
			res.setHeader("Expires", "0")
			res.end(content)
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error)
			res.statusCode = 502
			res.setHeader("Content-Type", "text/plain; charset=utf-8")
			res.end(`[${MAGIC_ENV_PROFILE_PLUGIN_NAME}] ${message}`)
		}
	})
}

async function fetchRuntimeConfigJs(runtimeConfigUrl: string): Promise<string> {
	const response = await fetch(runtimeConfigUrl, {
		headers: {
			"cache-control": "no-cache",
			pragma: "no-cache",
		},
	})

	if (!response.ok)
		throw new Error(`Failed to fetch runtime config: ${response.status} ${response.statusText}`)

	const content = await response.text()
	if (!isValidRuntimeConfigJs(content))
		throw new Error(`Remote runtime config is not a window.CONFIG script: ${runtimeConfigUrl}`)

	return normalizeLineEndings(content)
}

function isRuntimeConfigRequest(req: Connect.IncomingMessage): boolean {
	if (req.method !== "GET" || !req.url) return false

	return new URL(req.url, "https://localhost").pathname === RUNTIME_CONFIG_PATH
}

function isValidRuntimeConfigJs(content: string): boolean {
	return /window\.CONFIG\s*=/.test(content)
}

function normalizeLineEndings(content: string): string {
	return content.replace(/\r\n/g, "\n").trimEnd()
}

function getUrlHostname(value: string | undefined): string | undefined {
	const url = parseHttpUrl(value)
	return url?.hostname || undefined
}

function getUrlOrigin(value: string | undefined): string | undefined {
	const url = parseHttpUrl(value)
	// Node may parse bad schemes into opaque origin "null".
	return url && url.origin !== "null" ? url.origin : undefined
}

function parseHttpUrl(value: string | undefined): URL | undefined {
	if (!value) return undefined

	try {
		const url = new URL(value)
		if (url.protocol !== "http:" && url.protocol !== "https:") return undefined
		return url
	} catch {
		return undefined
	}
}

function splitCsv(value: string | undefined): string[] {
	if (!value) return []

	return value
		.split(",")
		.map((item) => item.trim())
		.filter(Boolean)
}

function uniqueStrings(values: Array<string | undefined>): string[] {
	const seen = new Set<string>()
	const result: string[] = []

	for (const value of values) {
		if (!value || seen.has(value)) continue
		seen.add(value)
		result.push(value)
	}

	return result
}

export default vitePluginMagicEnvProfiles
