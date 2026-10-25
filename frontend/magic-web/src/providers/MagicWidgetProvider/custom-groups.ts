import type { MagicWidget } from "@magic-web/widget-sdk"
import type { MagicWidgetConfigWarning, MagicWidgetConfigWarningReason } from "./types"

type ConfigWarningReporter = (warning: MagicWidgetConfigWarning) => void

interface CustomMentionFilterStats {
	droppedGroups: number
	droppedItems: number
	reasons: Set<MagicWidgetConfigWarningReason>
}

/** Keeps iframe-side limits equivalent to the SDK custom Mention contract. */
export const MAGIC_WIDGET_CUSTOM_GROUP_LIMITS = {
	maxGroups: 50,
	maxItemsPerGroup: 1_000,
	maxTotalItems: 5_000,
	maxItemBytes: 32 * 1024,
	maxPayloadBytes: 2 * 1024 * 1024,
	maxIdAndTypeLength: 64,
	maxTextLength: 512,
	maxIconUrlLength: 2048,
} as const

const RESERVED_MENTION_ROOT_IDS = new Set([
	"personal-drive",
	"enterprise-drive",
	"organization-drive",
	"project-files",
	"other-project-files",
	"mcp-extensions",
	"digital-employees",
	"flows",
	"agents",
	"micro-apps",
	"skills",
	"tools",
	"upload-files",
	"canvas-elements",
	"histories",
	"tabs",
])

/** Creates a provider-side validation error without exposing transport details. */
function invalidConfig(message: string): Error {
	return new Error(message)
}

/**
 * Validates that an optional icon URL is a safe, absolute HTTPS URL within length limits.
 * Rejects non-strings, http, data, blob, javascript, protocol-relative, and malformed URLs.
 */
function readOptionalIconUrl(
	value: Record<string, unknown>,
	key: string,
	label: string,
	maxLength = MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxIconUrlLength,
): string | undefined {
	const field = value[key]
	if (field === undefined) return undefined
	if (typeof field !== "string" || !field.trim() || field.length > maxLength) {
		throw invalidConfig(
			`Magic widget ${label}.${key} must be a non-empty string of at most ${maxLength} characters`,
		)
	}
	const trimmed = field.trim()
	let parsed: URL
	try {
		parsed = new URL(trimmed)
	} catch {
		throw invalidConfig(`Magic widget ${label}.${key} must be a valid HTTPS URL`)
	}
	if (parsed.protocol !== "https:") {
		throw invalidConfig(`Magic widget ${label}.${key} must use the https: protocol`)
	}
	return trimmed
}

/**
 * Validates the optional placement parameter for custom Mention groups.
 * Must be either "start" or "end".
 */
function readOptionalPlacement(
	record: Record<string, unknown>,
	key: string,
	label: string,
): MagicWidget.CustomMentionGroupPlacement | undefined {
	const value = record[key]
	if (value === undefined) return undefined
	if (value === "start" || value === "end") return value
	throw invalidConfig(`Magic widget ${label}.${key} must be "start" or "end"`)
}

/** Accepts plain records only so class instances cannot cross the iframe state boundary. */
function requirePlainObject(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value))
		throw invalidConfig(`Magic widget ${label} must be an object`)
	const prototype = Object.getPrototypeOf(value)
	if (prototype !== Object.prototype && prototype !== null)
		throw invalidConfig(`Magic widget ${label} must be a plain object`)
	return value as Record<string, unknown>
}

/** Rejects functions, cycles, non-finite numbers, and custom prototypes before state commit. */
function assertJsonSafe(value: unknown, label: string, seen = new WeakSet<object>()): void {
	if (value === null || typeof value === "string" || typeof value === "boolean") return
	if (typeof value === "number") {
		if (Number.isFinite(value)) return
		throw invalidConfig(`Magic widget ${label} must contain JSON-safe values`)
	}
	if (typeof value !== "object")
		throw invalidConfig(`Magic widget ${label} must contain JSON-safe values`)
	if (seen.has(value))
		throw invalidConfig(`Magic widget ${label} must not contain circular values`)
	seen.add(value)
	if (Array.isArray(value))
		value.forEach((item, index) => assertJsonSafe(item, `${label}[${index}]`, seen))
	else {
		const prototype = Object.getPrototypeOf(value)
		if (prototype !== Object.prototype && prototype !== null)
			throw invalidConfig(`Magic widget ${label} must contain JSON-safe values`)
		Object.entries(value).forEach(([key, item]) =>
			assertJsonSafe(item, `${label}.${key}`, seen),
		)
	}
	seen.delete(value)
}

/** Measures the exact UTF-8 size used by the cross-frame JSON snapshot. */
function getUtf8ByteLength(value: string): number {
	return new TextEncoder().encode(value).byteLength
}

/** Records one bounded-content adjustment for the aggregate host diagnostic. */
function recordCustomMentionFilter(
	stats: CustomMentionFilterStats,
	reason: MagicWidgetConfigWarningReason,
	counts: { groups?: number; items?: number },
): void {
	stats.droppedGroups += counts.groups ?? 0
	stats.droppedItems += counts.items ?? 0
	stats.reasons.add(reason)
}

/** Emits one aggregate warning only after the remaining provider snapshot is valid. */
function reportCustomMentionFilters(
	stats: CustomMentionFilterStats,
	reportWarning?: ConfigWarningReporter,
): void {
	if (stats.reasons.size === 0) return
	reportWarning?.({
		code: "CUSTOM_MENTION_FILTERED",
		message: "Custom Mention content exceeded SDK limits and was filtered",
		details: {
			droppedGroups: stats.droppedGroups,
			droppedItems: stats.droppedItems,
			reasons: Array.from(stats.reasons),
		},
	})
}

/** Validates and clones one group's bounded item prefix without rejecting oversized content. */
function normalizeItems(
	value: unknown,
	label: string,
	maxAcceptedItems: number,
	stats: CustomMentionFilterStats,
): MagicWidget.CustomMentionItem[] {
	if (!Array.isArray(value)) throw invalidConfig(`Magic widget ${label}.items must be an array`)
	const candidateItems = value.slice(0, MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxItemsPerGroup)
	if (value.length > candidateItems.length) {
		recordCustomMentionFilter(stats, "MAX_ITEMS_PER_GROUP", {
			items: value.length - candidateItems.length,
		})
	}
	const ids = new Set<string>()
	const items: MagicWidget.CustomMentionItem[] = []
	for (let index = 0; index < candidateItems.length; index += 1) {
		if (items.length >= maxAcceptedItems) {
			recordCustomMentionFilter(stats, "MAX_TOTAL_ITEMS", {
				items: candidateItems.length - index,
			})
			break
		}
		const rawItem = candidateItems[index]
		const itemLabel = `${label}.items[${index}]`
		const item = requirePlainObject(rawItem, itemLabel)
		const allowedKeys = new Set([
			"id",
			"type",
			"text",
			"title",
			"description",
			"icon",
			"iconUrl",
			"data",
		])
		const unknownKey = Object.keys(item).find((key) => !allowedKeys.has(key))
		if (unknownKey) throw invalidConfig(`${itemLabel}.${unknownKey} is not supported`)
		const { id, type, text } = item
		if (
			typeof id !== "string" ||
			!id.trim() ||
			id.length > MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxIdAndTypeLength
		)
			throw invalidConfig(
				`${itemLabel}.id must be a non-empty string of at most ${MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxIdAndTypeLength} characters`,
			)
		if (ids.has(id)) throw invalidConfig(`${label}.items contains duplicate id: ${id}`)
		ids.add(id)
		if (
			typeof type !== "string" ||
			!type.trim() ||
			type.length > MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxIdAndTypeLength
		)
			throw invalidConfig(
				`${itemLabel}.type must be a non-empty string of at most ${MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxIdAndTypeLength} characters`,
			)
		if (
			typeof text !== "string" ||
			!text.trim() ||
			text.length > MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxTextLength
		)
			throw invalidConfig(
				`${itemLabel}.text must be a non-empty string of at most ${MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxTextLength} characters`,
			)
		for (const key of ["title", "description"] as const)
			if (
				item[key] !== undefined &&
				(typeof item[key] !== "string" ||
					item[key].length > MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxTextLength)
			)
				throw invalidConfig(
					`${itemLabel}.${key} must be a string of at most ${MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxTextLength} characters`,
				)
		if (
			item.icon !== undefined &&
			(typeof item.icon !== "string" ||
				item.icon.length > MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxIdAndTypeLength)
		)
			throw invalidConfig(
				`${itemLabel}.icon must be a string of at most ${MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxIdAndTypeLength} characters`,
			)
		const iconUrl = readOptionalIconUrl(item, "iconUrl", itemLabel)
		if (item.data !== undefined) requirePlainObject(item.data, `${itemLabel}.data`)
		assertJsonSafe(item, itemLabel)
		const clone = JSON.parse(
			JSON.stringify({
				...item,
				...(iconUrl !== undefined ? { iconUrl } : {}),
			}),
		) as MagicWidget.CustomMentionItem
		if (
			getUtf8ByteLength(JSON.stringify(clone)) > MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxItemBytes
		) {
			recordCustomMentionFilter(stats, "MAX_ITEM_BYTES", { items: 1 })
			continue
		}
		items.push(clone)
	}
	return items
}

/** Applies the complete payload byte budget while preserving configured group and item order. */
function filterCustomMentionPayload(
	groups: MagicWidget.CustomMentionGroup[],
	stats: CustomMentionFilterStats,
): MagicWidget.CustomMentionGroup[] {
	const filteredGroups: MagicWidget.CustomMentionGroup[] = []
	let payloadBytes = 2
	groups.forEach((group) => {
		const emptyGroup = { ...group, items: [] }
		const groupSeparatorBytes = filteredGroups.length > 0 ? 1 : 0
		const emptyGroupBytes = getUtf8ByteLength(JSON.stringify(emptyGroup))
		if (
			payloadBytes + groupSeparatorBytes + emptyGroupBytes >
			MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxPayloadBytes
		) {
			recordCustomMentionFilter(stats, "MAX_PAYLOAD_BYTES", {
				groups: 1,
				items: group.items.length,
			})
			return
		}

		const filteredItems: MagicWidget.CustomMentionItem[] = []
		payloadBytes += groupSeparatorBytes + emptyGroupBytes
		group.items.forEach((item) => {
			const itemBytes = getUtf8ByteLength(JSON.stringify(item))
			const itemSeparatorBytes = filteredItems.length > 0 ? 1 : 0
			if (
				payloadBytes + itemSeparatorBytes + itemBytes >
				MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxPayloadBytes
			) {
				recordCustomMentionFilter(stats, "MAX_PAYLOAD_BYTES", { items: 1 })
				return
			}
			filteredItems.push(item)
			payloadBytes += itemSeparatorBytes + itemBytes
		})
		filteredGroups.push({ ...group, items: filteredItems })
	})
	return filteredGroups
}

/** Validates one complete custom Mention snapshot before React state is replaced. */
export function normalizeMagicWidgetCustomGroups(
	value: unknown,
	reportWarning?: ConfigWarningReporter,
): MagicWidget.CustomMentionGroup[] | undefined {
	if (value === undefined) return undefined
	if (!Array.isArray(value))
		throw invalidConfig("Magic widget config.panel.customGroups must be an array")
	const stats: CustomMentionFilterStats = {
		droppedGroups: 0,
		droppedItems: 0,
		reasons: new Set(),
	}
	const candidateGroups = value.slice(0, MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxGroups)
	if (value.length > candidateGroups.length) {
		const removedGroups = value.slice(MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxGroups)
		recordCustomMentionFilter(stats, "MAX_GROUPS", {
			groups: removedGroups.length,
			items: removedGroups.reduce((count, group) => {
				if (!group || typeof group !== "object" || Array.isArray(group)) return count
				const items = (group as Record<string, unknown>).items
				return count + (Array.isArray(items) ? items.length : 0)
			}, 0),
		})
	}
	const groupIds = new Set<string>()
	let totalItems = 0
	const groups = candidateGroups.map((rawGroup, index) => {
		const label = `config.panel.customGroups[${index}]`
		const group = requirePlainObject(rawGroup, label)
		const allowedKeys = new Set(["id", "label", "icon", "iconUrl", "placement", "items"])
		const unknownKey = Object.keys(group).find((key) => !allowedKeys.has(key))
		if (unknownKey) throw invalidConfig(`${label}.${unknownKey} is not supported`)
		const { id, label: displayLabel } = group
		if (
			typeof id !== "string" ||
			!id.trim() ||
			id.length > MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxIdAndTypeLength
		)
			throw invalidConfig(
				`${label}.id must be a non-empty string of at most ${MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxIdAndTypeLength} characters`,
			)
		if (RESERVED_MENTION_ROOT_IDS.has(id))
			throw invalidConfig(`${label}.id conflicts with a built-in Mention entry`)
		if (groupIds.has(id))
			throw invalidConfig(`config.panel.customGroups contains duplicate group id: ${id}`)
		groupIds.add(id)
		if (
			typeof displayLabel !== "string" ||
			!displayLabel.trim() ||
			displayLabel.length > MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxTextLength
		)
			throw invalidConfig(
				`${label}.label must be a non-empty string of at most ${MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxTextLength} characters`,
			)
		if (
			group.icon !== undefined &&
			(typeof group.icon !== "string" ||
				group.icon.length > MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxIdAndTypeLength)
		)
			throw invalidConfig(
				`${label}.icon must be a string of at most ${MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxIdAndTypeLength} characters`,
			)
		const iconUrl = readOptionalIconUrl(group, "iconUrl", label)
		const placement = readOptionalPlacement(group, "placement", label)
		if (!Array.isArray(group.items))
			throw invalidConfig(`Magic widget ${label}.items must be an array`)
		const items = normalizeItems(
			group.items,
			label,
			MAGIC_WIDGET_CUSTOM_GROUP_LIMITS.maxTotalItems - totalItems,
			stats,
		)
		totalItems += items.length
		const clone = JSON.parse(
			JSON.stringify({
				id,
				label: displayLabel,
				...(group.icon === undefined ? {} : { icon: group.icon }),
				...(iconUrl === undefined ? {} : { iconUrl }),
				...(placement === undefined ? {} : { placement }),
				items,
			}),
		) as MagicWidget.CustomMentionGroup
		return clone
	})
	const filteredGroups = filterCustomMentionPayload(groups, stats)
	reportCustomMentionFilters(stats, reportWarning)
	return filteredGroups
}
