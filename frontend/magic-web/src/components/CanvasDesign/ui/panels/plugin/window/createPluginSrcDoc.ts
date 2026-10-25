import type { CanvasDesignPlugin } from "../../../../runtime/document/types"
import type { CanvasAccessMode } from "../../../../public/props"
import {
	CANVAS_DESIGN_PLUGIN_RUNTIME_VERSION,
	createPluginSrcDocV1,
} from "../runtime-protocol/v1/index"

export function createPluginSrcDoc(
	plugin: CanvasDesignPlugin,
	locale: string,
	channelToken: string,
	hostState: { accessMode: CanvasAccessMode },
) {
	if (plugin.version === CANVAS_DESIGN_PLUGIN_RUNTIME_VERSION) {
		return createPluginSrcDocV1(plugin, locale, channelToken, hostState)
	}
	console.warn(
		`[PluginPanel] Unsupported plugin runtime version: ${plugin.version}.`,
		plugin.name,
	)
	return null
}
