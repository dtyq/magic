import type { MagicWidget } from "@magic-web/widget-sdk"

export type MagicWidgetConfig = MagicWidget.WidgetConfig
export type MagicWidgetLayout = MagicWidget.Layout

/** Mirrors the SDK reasons that can remove bounded custom Mention content. */
export type MagicWidgetConfigWarningReason =
	| "MAX_GROUPS"
	| "MAX_ITEMS_PER_GROUP"
	| "MAX_TOTAL_ITEMS"
	| "MAX_ITEM_BYTES"
	| "MAX_PAYLOAD_BYTES"

/** Carries a provider-side non-fatal filtering diagnostic back to the host SDK. */
export interface MagicWidgetConfigWarning {
	code: "CUSTOM_MENTION_FILTERED"
	message: string
	details: {
		droppedGroups: number
		droppedItems: number
		reasons: MagicWidgetConfigWarningReason[]
	}
}

export interface MagicWidgetEmbedContext {
	instanceId: string
	protocolVersion: number
	hostOrigin: string
	renderMode?: "inline" | "floating"
}

export interface MagicWidgetContextValue {
	embedContext: MagicWidgetEmbedContext | null
	config: MagicWidgetConfig
	requestCustomMentionSearch: (
		query: string,
		scope: MagicWidget.CustomMentionSearchContext["scope"],
		signal: AbortSignal,
	) => Promise<MagicWidget.CustomMentionSearchResult[]>
}
