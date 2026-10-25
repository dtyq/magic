import type {
	MagicWidgetConfig,
	MagicWidgetConfigWarning,
	MagicWidgetEmbedContext,
	MagicWidgetLayout,
} from "./types"
import { normalizeMagicWidgetCustomGroups } from "./custom-groups"

export const MAGIC_WIDGET_PROTOCOL = "magic-widget"
export const MAGIC_WIDGET_PROTOCOL_VERSION = 1
export const MAGIC_WIDGET_QUERY_CONFIG = "magicWidgetConfig"
export const MAGIC_WIDGET_DISMISS_PREVIEW_EVENT = "magic-widget:dismiss-preview"
const MAGIC_WIDGET_QUERY_EMBED = "magicWidgetEmbed"
const MAGIC_WIDGET_QUERY_INSTANCE_ID = "magicWidgetInstanceId"
const MAGIC_WIDGET_QUERY_PROTOCOL_VERSION = "magicWidgetProtocolVersion"
const MAGIC_WIDGET_QUERY_HOST_ORIGIN = "magicWidgetHostOrigin"
const MAGIC_WIDGET_QUERY_RENDER_MODE = "magicWidgetRenderMode"
const MAX_INITIAL_CONFIG_LENGTH = 4_096

/** Accepts a host config snapshot while reporting non-fatal custom Mention filtering. */
export function acceptMagicWidgetConfig(
	value: unknown,
	reportWarning?: (warning: MagicWidgetConfigWarning) => void,
): MagicWidgetConfig {
	if (!isPlainConfigObject(value)) {
		throw new Error("Magic widget config must be an object")
	}
	if (value.panel !== undefined) {
		if (!isPlainConfigObject(value.panel))
			throw new Error("Magic widget config.panel must be an object")
		return {
			...value,
			panel: {
				...value.panel,
				...(value.panel.customGroups === undefined
					? {}
					: {
							customGroups: normalizeMagicWidgetCustomGroups(
								value.panel.customGroups,
								reportWarning,
							),
						}),
			},
		}
	}
	return value
}

/** Keeps arrays and class instances out of widget state without reapplying the SDK field allowlist. */
function isPlainConfigObject(value: unknown): value is MagicWidgetConfig {
	if (!value || typeof value !== "object" || Array.isArray(value)) return false
	const prototype = Object.getPrototypeOf(value)
	return prototype === Object.prototype || prototype === null
}

/** Reads the private embed identity only inside a real iframe document. */
export function getMagicWidgetEmbedContext(search: string): MagicWidgetEmbedContext | null {
	if (typeof window === "undefined" || window.parent === window) return null
	const params = new URLSearchParams(search)
	if (params.get(MAGIC_WIDGET_QUERY_EMBED) !== "1") return null
	const instanceId = params.get(MAGIC_WIDGET_QUERY_INSTANCE_ID)?.trim()
	const protocolVersion = Number(params.get(MAGIC_WIDGET_QUERY_PROTOCOL_VERSION))
	const hostOriginValue = params.get(MAGIC_WIDGET_QUERY_HOST_ORIGIN)
	const renderModeValue = params.get(MAGIC_WIDGET_QUERY_RENDER_MODE)
	if (!instanceId || protocolVersion !== MAGIC_WIDGET_PROTOCOL_VERSION || !hostOriginValue) {
		return null
	}

	try {
		const hostUrl = new URL(hostOriginValue)
		if (hostUrl.protocol !== "http:" && hostUrl.protocol !== "https:") return null
		return {
			instanceId,
			protocolVersion,
			hostOrigin: hostUrl.origin,
			...(renderModeValue === "inline" || renderModeValue === "floating"
				? { renderMode: renderModeValue }
				: {}),
		}
	} catch {
		return null
	}
}

/** Parses a bounded initial configuration query after embed identity validation succeeds. */
export function getMagicWidgetInitialConfig(
	search: string,
	embedContext: MagicWidgetEmbedContext | null,
): MagicWidgetConfig {
	if (!embedContext) return {}
	const serializedConfig = new URLSearchParams(search).get(MAGIC_WIDGET_QUERY_CONFIG)
	if (!serializedConfig || serializedConfig.length > MAX_INITIAL_CONFIG_LENGTH) return {}
	try {
		return acceptMagicWidgetConfig(JSON.parse(serializedConfig))
	} catch {
		return {}
	}
}

/** Preserves legacy mobile query behavior when the SDK does not choose a layout. */
export function shouldForceMobileCrewConversation(search: string): boolean {
	const searchParams = new URLSearchParams(search)
	const view = searchParams.get("view")?.toLowerCase()
	const layout = searchParams.get("layout")?.toLowerCase()
	const mobile = searchParams.get("mobile")?.toLowerCase()
	return view === "mobile" || layout === "mobile" || mobile === "1" || mobile === "true"
}

/** Resolves the effective Crew content layout without changing the surrounding application shell. */
export function resolveMagicWidgetCrewLayout({
	configuredLayout,
	isMobileViewport,
	search,
}: {
	configuredLayout?: MagicWidgetLayout
	isMobileViewport: boolean
	search: string
}): MagicWidgetLayout {
	if (configuredLayout) return configuredLayout
	return isMobileViewport || shouldForceMobileCrewConversation(search) ? "mobile" : "desktop"
}
