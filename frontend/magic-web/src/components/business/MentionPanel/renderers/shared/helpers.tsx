import type { MentionItemRendererContext } from "../types"
import { getItemTypeDescription, getSkillMentionSourceLabel } from "../../utils/getValue"

export function getMentionItemTypeDescription(context: MentionItemRendererContext) {
	const { item, t, isSearch } = context
	const skillSourceLabel = getMentionItemSkillSourceLabel(context)
	if (!t) return null

	try {
		return (
			(isSearch && item.description) ||
			skillSourceLabel ||
			getItemTypeDescription(item, t) ||
			null
		)
	} catch {
		return (isSearch && item.description) || skillSourceLabel || null
	}
}

export function shouldRenderMentionItemTypeDescription(context: MentionItemRendererContext) {
	const { item, isSearch, platform } = context
	const skillSourceLabel = getMentionItemSkillSourceLabel(context)
	if (platform === "mobile") {
		return (
			Boolean(isSearch) ||
			Boolean(item.tags?.includes("history")) ||
			Boolean(item.tags?.includes("tab"))
		)
	}

	return (
		Boolean(skillSourceLabel) ||
		Boolean(isSearch) ||
		Boolean(item.description) ||
		Boolean(item.tags?.includes("history")) ||
		Boolean(item.tags?.includes("tab"))
	)
}

export function getMentionItemSkillSourceLabel(context: MentionItemRendererContext) {
	try {
		return getSkillMentionSourceLabel(context.item, context.t)
	} catch {
		return ""
	}
}

export function renderMentionItemTitleSuffix() {
	return null
}

export function renderMentionItemDescription(context: MentionItemRendererContext) {
	const { item, platform } = context
	if (platform !== "mobile" || !item.description) return null

	return item.description
}
