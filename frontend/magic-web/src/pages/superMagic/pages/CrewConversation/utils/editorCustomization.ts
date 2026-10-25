import type { MagicWidget } from "@magic-web/widget-sdk"
import { DEFAULT_LAYOUT_CONFIG } from "@/pages/superMagic/components/MessageEditor/constants/constant"
import {
	ToolbarButton,
	type MessageEditorLayoutConfig,
	type MessageEditorModules,
} from "@/pages/superMagic/components/MessageEditor/types"

/** Host editor layout and module flags derived from widget bottom config. */
export interface CrewWidgetEditorCustomization {
	layoutConfig: MessageEditorLayoutConfig
	modules: MessageEditorModules
}

/** Send-time extra overrides that must not persist into internetSearchManager. */
export interface CrewWidgetSendOverrides {
	/** When false, outbound extra must force enable_web_search off. */
	enableWebSearch?: false
}

/** Resolves host business settings into the existing editor layout and capability contracts. */
export function resolveCrewWidgetEditorCustomization(
	config: MagicWidget.WidgetConfig,
): CrewWidgetEditorCustomization {
	const bottom = config.bottom
	const capabilityEnabled = (item: MagicWidget.CapabilityConfig | undefined) =>
		item?.enabled !== false
	const buttonVisible = (item: MagicWidget.CapabilityConfig | undefined) =>
		capabilityEnabled(item) && item?.buttonVisible !== false

	const visibleBottomButtons = new Set<ToolbarButton>([
		...(buttonVisible(bottom?.internetSearch) ? [ToolbarButton.INTERNET_SEARCH] : []),
		...(buttonVisible(bottom?.plugin) ? [ToolbarButton.MCP] : []),
		...(buttonVisible(bottom?.upload) ? [ToolbarButton.UPLOAD] : []),
		...(buttonVisible(bottom?.voice) ? [ToolbarButton.VOICE_INPUT] : []),
	])
	const configurableButtons = new Set([
		ToolbarButton.INTERNET_SEARCH,
		ToolbarButton.MCP,
		ToolbarButton.UPLOAD,
		ToolbarButton.VOICE_INPUT,
	])
	let bottomRight = DEFAULT_LAYOUT_CONFIG.bottomRight.filter(
		(button) => !configurableButtons.has(button) || visibleBottomButtons.has(button),
	)
	const dividerIndex = bottomRight.indexOf(ToolbarButton.DIVIDER)
	if (
		dividerIndex >= 0 &&
		!bottomRight.slice(0, dividerIndex).some((button) => visibleBottomButtons.has(button))
	) {
		bottomRight = bottomRight.filter((button) => button !== ToolbarButton.DIVIDER)
	}
	// The model picker is a bottom toolbar row, independent from Mention panel visibility.
	const showModelButton = bottom?.model?.buttonVisible !== false

	return {
		layoutConfig: {
			...DEFAULT_LAYOUT_CONFIG,
			bottomLeft: showModelButton
				? DEFAULT_LAYOUT_CONFIG.bottomLeft
				: DEFAULT_LAYOUT_CONFIG.bottomLeft.filter(
						(button) => button !== ToolbarButton.MODEL_SWITCH,
					),
			bottomRight,
		},
		modules: {
			mcp: { enabled: capabilityEnabled(bottom?.plugin) },
			upload: { enabled: capabilityEnabled(bottom?.upload) },
			voiceInput: { enabled: capabilityEnabled(bottom?.voice) },
		},
	}
}

/** Forces send-time web search off without writing the shared internet-search localStorage. */
export function resolveCrewWidgetSendOverrides(
	config: MagicWidget.WidgetConfig,
): CrewWidgetSendOverrides {
	if (config.bottom?.internetSearch?.enabled === false) return { enableWebSearch: false }
	return {}
}
