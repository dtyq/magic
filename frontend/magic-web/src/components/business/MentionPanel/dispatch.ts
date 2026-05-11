import type { I18nTexts } from "./i18n/types"
import type { MentionData, MentionItem, MentionItemType } from "./types"

export type MentionQueryKind = "default" | "search" | "children" | "catalog" | "validate" | "effect"

export type MentionEffect = "refresh-mcp"

export interface MentionRequestOptions {
	t?: I18nTexts
	refresh?: boolean
}

interface MentionStoreRequestBase {
	kind: MentionQueryKind
}

export interface DefaultItemsRequest extends MentionStoreRequestBase {
	kind: "default"
	options: {
		t: I18nTexts
	}
}

export interface SearchRequest extends MentionStoreRequestBase {
	kind: "search"
	query: string
	/** 非空时仅在该文件夹节点子树内搜索（如画布项目附件） */
	scopeFolderId?: string
}

export interface ChildrenRequest extends MentionStoreRequestBase {
	kind: "children"
	id: string
}

export interface CatalogRequest extends MentionStoreRequestBase {
	kind: "catalog"
	catalogId: string
	id?: string
	options?: MentionRequestOptions
}

export interface ValidateMentionRequest extends MentionStoreRequestBase {
	kind: "validate"
	item: {
		type: MentionItemType
		data?: MentionData
	}
}

export interface EffectRequest extends MentionStoreRequestBase {
	kind: "effect"
	effect: MentionEffect
}

export type MentionStoreRequest =
	| DefaultItemsRequest
	| SearchRequest
	| ChildrenRequest
	| CatalogRequest
	| ValidateMentionRequest
	| EffectRequest

export interface MentionStoreResult {
	items?: MentionItem[]
	isValid?: boolean
}
