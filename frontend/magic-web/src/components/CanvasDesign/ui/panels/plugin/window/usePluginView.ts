import { useMemo } from "react"

import { resolvePluginIcon, resolvePluginText } from "../../../../runtime/plugins/resolve"
import type { CanvasDesignPlugin } from "../../../../runtime/document/types"
import type { CanvasAccessMode } from "../../../../public/props"
import { createPluginSrcDoc } from "./createPluginSrcDoc"
import type { PluginView } from "./types"

export function usePluginView(
	plugin: CanvasDesignPlugin,
	locale: string,
	channelToken: string,
	accessMode: CanvasAccessMode,
): PluginView {
	return useMemo(
		() => ({
			label: resolvePluginText(plugin, plugin.label, locale),
			description: resolvePluginText(plugin, plugin.description, locale),
			icon: resolvePluginIcon(plugin),
			srcDoc: createPluginSrcDoc(plugin, locale, channelToken, { accessMode }),
		}),
		[accessMode, channelToken, locale, plugin],
	)
}
