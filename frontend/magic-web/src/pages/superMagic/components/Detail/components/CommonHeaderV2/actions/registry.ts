import type { ActionKey, BuiltinActionDefinition } from "../types"

export const BUILTIN_ACTION_REGISTRY: Record<ActionKey, BuiltinActionDefinition> = {
	viewMode: { key: "viewMode", zone: "primary", order: 10 },
	refresh: { key: "refresh", zone: "secondary", order: 20 },
	download: { key: "download", zone: "secondary", order: 30 },
	copy: { key: "copy", zone: "secondary", order: 40 },
	share: { key: "share", zone: "secondary", order: 50 },
	openUrl: { key: "openUrl", zone: "secondary", order: 60 },
	fullscreen: { key: "fullscreen", zone: "trailing", order: 70 },
	versionMenu: { key: "versionMenu", zone: "overflow", order: 80 },
	more: { key: "more", zone: "trailing", order: 90 },
}
