import type { ReactNode } from "react"
import type { MentionItem } from "../types"
import type { I18nTexts } from "../i18n/types"

export type MentionItemRendererPlatform = "desktop" | "mobile"

export interface MentionItemRendererContext {
	item: MentionItem
	t: I18nTexts
	isSearch?: boolean
	platform: MentionItemRendererPlatform
	filePreviewById?: Readonly<Record<string, string>>
}

export interface MentionItemRenderer {
	renderIcon?: (context: MentionItemRendererContext) => ReactNode
	renderDescription?: (context: MentionItemRendererContext) => ReactNode
	renderTitleSuffix?: (context: MentionItemRendererContext) => ReactNode
	getTypeDescription?: (context: MentionItemRendererContext) => string | null
}
