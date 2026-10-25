import type { MagicWidget } from "./types"

const CONFIG_KEYS = new Set([
	"layout",
	"shell",
	"conversation",
	"responsive",
	"header",
	"panel",
	"bottom",
	"window",
])
const SHELL_CONFIG_KEYS = new Set(["appSidebar"])
const CONVERSATION_CONFIG_KEYS = new Set([
	"projectFiles",
	"topicHistory",
	"autoHire",
	"previewMode",
])
const RESPONSIVE_CONFIG_KEYS = new Set(["mobileDetection"])
const HEADER_CONFIG_KEYS = new Set(["visible", "title", "topicName", "actions"])
const HEADER_TITLE_KEYS = new Set(["mode", "text"])
const HEADER_TOPIC_NAME_KEYS = new Set(["mode", "text"])
const HEADER_ACTION_NAME_FLAGS = {
	fullscreen: true,
	pin: true,
	newTopic: true,
	history: true,
	share: true,
	more: true,
	close: true,
} as const satisfies Record<MagicWidget.HeaderActionName, true>

/** Header action names shared by protocol checks, config validation, and the iframe shell. */
export const WIDGET_HEADER_ACTION_NAMES = Object.keys(
	HEADER_ACTION_NAME_FLAGS,
) as MagicWidget.HeaderActionName[]

const HEADER_ACTION_KEYS = new Set<MagicWidget.HeaderActionName>(WIDGET_HEADER_ACTION_NAMES)
const PANEL_CONFIG_KEYS = new Set([
	"projectFiles",
	"uploadFiles",
	"otherProjectFiles",
	"digitalEmployees",
	"microApps",
	"workflows",
	"connectors",
	"skills",
	"canvasElements",
	"customGroups",
])
const BOTTOM_CAPABILITY_KEYS = new Set(["internetSearch", "plugin", "upload", "voice"])
const BOTTOM_CONFIG_KEYS = new Set([...BOTTOM_CAPABILITY_KEYS, "model"])
const CAPABILITY_CONFIG_KEYS = new Set(["enabled", "buttonVisible"])
const MODEL_BUTTON_KEYS = new Set(["buttonVisible"])
const WINDOW_CONFIG_KEYS = new Set(["closable"])
const PREVIEW_MODES = new Set<MagicWidget.PreviewMode>(["split", "fullscreen", "switchable"])
const MOBILE_DETECTION_MODES = new Set<MagicWidget.MobileDetection>([
	"viewport",
	"device-and-viewport",
])

/** Keeps the public custom Mention payload bounded before it enters the iframe channel. */
export const CUSTOM_MENTION_LIMITS = {
	maxGroups: 50,
	maxItemsPerGroup: 1_000,
	maxTotalItems: 5_000,
	maxItemBytes: 32 * 1024,
	maxPayloadBytes: 2 * 1024 * 1024,
	maxIdAndTypeLength: 64,
	maxTextLength: 512,
	maxIconUrlLength: 2048,
} as const

type ConfigWarningReporter = (warning: MagicWidget.ConfigWarning) => void

interface CustomMentionFilterStats {
	droppedGroups: number
	droppedItems: number
	reasons: Set<MagicWidget.ConfigWarningReason>
}

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

/** Creates a public configuration error without coupling validation to iframe transport. */
function createInvalidConfigError(message: string): MagicWidget.CommandError {
	const error = new Error(message) as MagicWidget.CommandError
	error.code = "INVALID_CONFIG"
	return error
}

/** Narrows configuration sections to plain records and rejects arrays or class instances. */
function requirePlainObject(value: unknown, label: string): Record<string, unknown> {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		throw createInvalidConfigError(`Magic widget ${label} must be an object`)
	}
	const prototype = Object.getPrototypeOf(value)
	if (prototype !== Object.prototype && prototype !== null) {
		throw createInvalidConfigError(`Magic widget ${label} must be a plain object`)
	}
	return value as Record<string, unknown>
}

/** Rejects undeclared fields so future configuration additions stay explicit and typed. */
function assertKnownKeys(value: Record<string, unknown>, keys: Set<string>, label: string): void {
	const unknownKey = Object.keys(value).find((key) => !keys.has(key))
	if (unknownKey) {
		throw createInvalidConfigError(`Magic widget ${label}.${unknownKey} is not supported`)
	}
}

/** Copies an optional boolean field after validating its runtime value. */
function readOptionalBoolean(
	value: Record<string, unknown>,
	key: string,
	label: string,
): boolean | undefined {
	const field = value[key]
	if (field === undefined) return undefined
	if (typeof field !== "boolean") {
		throw createInvalidConfigError(`Magic widget ${label}.${key} must be a boolean`)
	}
	return field
}

/** Copies the optional preview strategy after validating its public enum value. */
function readOptionalPreviewMode(
	value: Record<string, unknown>,
	key: string,
	label: string,
): MagicWidget.PreviewMode | undefined {
	const field = value[key]
	if (field === undefined) return undefined
	if (typeof field !== "string" || !PREVIEW_MODES.has(field as MagicWidget.PreviewMode)) {
		throw createInvalidConfigError(
			`Magic widget ${label}.${key} must be split, fullscreen, or switchable`,
		)
	}
	return field as MagicWidget.PreviewMode
}

/** Copies the optional mobile detection strategy after validating its public enum value. */
function readOptionalMobileDetection(
	value: Record<string, unknown>,
	key: string,
	label: string,
): MagicWidget.MobileDetection | undefined {
	const field = value[key]
	if (field === undefined) return undefined
	if (
		typeof field !== "string" ||
		!MOBILE_DETECTION_MODES.has(field as MagicWidget.MobileDetection)
	) {
		throw createInvalidConfigError(
			`Magic widget ${label}.${key} must be viewport or device-and-viewport`,
		)
	}
	return field as MagicWidget.MobileDetection
}

/** Copies a bounded optional text value used by host-visible Widget labels. */
function readOptionalText(
	value: Record<string, unknown>,
	key: string,
	label: string,
	maxLength = 512,
): string | undefined {
	const field = value[key]
	if (field === undefined) return undefined
	if (typeof field !== "string" || field.length > maxLength) {
		throw createInvalidConfigError(
			`Magic widget ${label}.${key} must be a string of at most ${maxLength} characters`,
		)
	}
	return field
}

/** Trims a visible label and rejects whitespace so callers do not see a later silent fallback. */
function readOptionalDisplayText(
	value: Record<string, unknown>,
	key: string,
	label: string,
	maxLength = 512,
): string | undefined {
	const field = readOptionalText(value, key, label, maxLength)
	if (field === undefined) return undefined
	const trimmed = field.trim()
	if (!trimmed) {
		throw createInvalidConfigError(`Magic widget ${label}.${key} must not be blank`)
	}
	return trimmed
}

/**
 * Validates that an optional icon URL is a safe, absolute HTTPS URL within length limits.
 * Rejects non-strings, http, data, blob, javascript, protocol-relative, and malformed URLs.
 */
function readOptionalIconUrl(
	value: Record<string, unknown>,
	key: string,
	label: string,
	maxLength = CUSTOM_MENTION_LIMITS.maxIconUrlLength,
): string | undefined {
	const field = value[key]
	if (field === undefined) return undefined
	if (typeof field !== "string" || !field.trim() || field.length > maxLength) {
		throw createInvalidConfigError(
			`Magic widget ${label}.${key} must be a non-empty string of at most ${maxLength} characters`,
		)
	}
	const trimmed = field.trim()
	let parsed: URL
	try {
		parsed = new URL(trimmed)
	} catch {
		throw createInvalidConfigError(`Magic widget ${label}.${key} must be a valid HTTPS URL`)
	}
	if (parsed.protocol !== "https:") {
		throw createInvalidConfigError(`Magic widget ${label}.${key} must use the https: protocol`)
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
	throw createInvalidConfigError(`Magic widget ${label}.${key} must be "start" or "end"`)
}

/** Measures UTF-8 bytes consistently with the browser postMessage JSON payload. */
function getUtf8ByteLength(value: string): number {
	if (typeof TextEncoder !== "undefined") return new TextEncoder().encode(value).byteLength
	return new Blob([value]).size
}

/** Accepts only JSON-safe primitives, arrays, and plain records without cycles or custom prototypes. */
function assertJsonSafe(value: unknown, label: string, seen = new WeakSet<object>()): void {
	if (value === null || typeof value === "string" || typeof value === "boolean") return
	if (typeof value === "number") {
		if (Number.isFinite(value)) return
		throw createInvalidConfigError(`Magic widget ${label} must contain JSON-safe values`)
	}
	if (typeof value !== "object") {
		throw createInvalidConfigError(`Magic widget ${label} must contain JSON-safe values`)
	}
	if (seen.has(value)) {
		throw createInvalidConfigError(`Magic widget ${label} must not contain circular values`)
	}
	seen.add(value)
	if (Array.isArray(value)) {
		value.forEach((item, index) => assertJsonSafe(item, `${label}[${index}]`, seen))
		seen.delete(value)
		return
	}
	const prototype = Object.getPrototypeOf(value)
	if (prototype !== Object.prototype && prototype !== null) {
		throw createInvalidConfigError(`Magic widget ${label} must contain JSON-safe values`)
	}
	Object.entries(value).forEach(([key, item]) => assertJsonSafe(item, `${label}.${key}`, seen))
	seen.delete(value)
}

/** Records one bounded-content adjustment for the aggregate host diagnostic. */
function recordCustomMentionFilter(
	stats: CustomMentionFilterStats,
	reason: MagicWidget.ConfigWarningReason,
	counts: { groups?: number; items?: number },
): void {
	stats.droppedGroups += counts.groups ?? 0
	stats.droppedItems += counts.items ?? 0
	stats.reasons.add(reason)
}

/** Emits one aggregate warning only after the remaining custom Mention snapshot is valid. */
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
function normalizeCustomMentionItems(
	value: unknown,
	label: string,
	maxAcceptedItems: number,
	stats: CustomMentionFilterStats,
): MagicWidget.CustomMentionItem[] {
	const record = requirePlainObject(value, label)
	assertKnownKeys(record, new Set(["items"]), label)
	if (record.items === undefined) return []
	if (!Array.isArray(record.items)) {
		throw createInvalidConfigError(`${label}.items must be an array`)
	}
	const candidateItems = record.items.slice(0, CUSTOM_MENTION_LIMITS.maxItemsPerGroup)
	if (record.items.length > candidateItems.length) {
		recordCustomMentionFilter(stats, "MAX_ITEMS_PER_GROUP", {
			items: record.items.length - candidateItems.length,
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
		const item = requirePlainObject(rawItem, `${label}.items[${index}]`)
		assertKnownKeys(
			item,
			new Set(["id", "type", "text", "title", "description", "icon", "iconUrl", "data"]),
			`${label}.items[${index}]`,
		)
		const id = item.id
		const type = item.type
		const text = item.text
		if (
			typeof id !== "string" ||
			!id.trim() ||
			id.length > CUSTOM_MENTION_LIMITS.maxIdAndTypeLength
		) {
			throw createInvalidConfigError(
				`${label}.items[${index}].id must be a non-empty string of at most ${CUSTOM_MENTION_LIMITS.maxIdAndTypeLength} characters`,
			)
		}
		if (ids.has(id)) {
			throw createInvalidConfigError(`${label}.items contains duplicate id: ${id}`)
		}
		ids.add(id)
		if (
			typeof type !== "string" ||
			!type.trim() ||
			type.length > CUSTOM_MENTION_LIMITS.maxIdAndTypeLength
		) {
			throw createInvalidConfigError(
				`${label}.items[${index}].type must be a non-empty string of at most ${CUSTOM_MENTION_LIMITS.maxIdAndTypeLength} characters`,
			)
		}
		if (
			typeof text !== "string" ||
			!text.trim() ||
			text.length > CUSTOM_MENTION_LIMITS.maxTextLength
		) {
			throw createInvalidConfigError(
				`${label}.items[${index}].text must be a non-empty string of at most ${CUSTOM_MENTION_LIMITS.maxTextLength} characters`,
			)
		}
		for (const key of ["title", "description"] as const) {
			const field = item[key]
			if (
				field !== undefined &&
				(typeof field !== "string" || field.length > CUSTOM_MENTION_LIMITS.maxTextLength)
			) {
				throw createInvalidConfigError(
					`${label}.items[${index}].${key} must be a string of at most ${CUSTOM_MENTION_LIMITS.maxTextLength} characters`,
				)
			}
		}
		if (
			item.icon !== undefined &&
			(typeof item.icon !== "string" ||
				item.icon.length > CUSTOM_MENTION_LIMITS.maxIdAndTypeLength)
		) {
			throw createInvalidConfigError(
				`${label}.items[${index}].icon must be a string of at most ${CUSTOM_MENTION_LIMITS.maxIdAndTypeLength} characters`,
			)
		}
		const iconUrl = readOptionalIconUrl(item, "iconUrl", `${label}.items[${index}]`)
		if (item.data !== undefined) {
			requirePlainObject(item.data, `${label}.items[${index}].data`)
		}
		assertJsonSafe(item, `${label}.items[${index}]`)
		const cloned = JSON.parse(
			JSON.stringify({
				...item,
				...(iconUrl !== undefined ? { iconUrl } : {}),
			}),
		) as MagicWidget.CustomMentionItem
		if (getUtf8ByteLength(JSON.stringify(cloned)) > CUSTOM_MENTION_LIMITS.maxItemBytes) {
			recordCustomMentionFilter(stats, "MAX_ITEM_BYTES", { items: 1 })
			continue
		}
		items.push(cloned)
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
			CUSTOM_MENTION_LIMITS.maxPayloadBytes
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
				CUSTOM_MENTION_LIMITS.maxPayloadBytes
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

/** Validates, bounds, and clones the complete named Mention-group snapshot atomically. */
function normalizeCustomGroupsConfig(
	value: unknown,
	label = "config.panel.customGroups",
	reportWarning?: ConfigWarningReporter,
): MagicWidget.CustomMentionGroup[] | undefined {
	if (value === undefined) return undefined
	if (!Array.isArray(value)) throw createInvalidConfigError(`${label} must be an array`)
	const stats: CustomMentionFilterStats = {
		droppedGroups: 0,
		droppedItems: 0,
		reasons: new Set(),
	}
	const candidateGroups = value.slice(0, CUSTOM_MENTION_LIMITS.maxGroups)
	if (value.length > candidateGroups.length) {
		const removedGroups = value.slice(CUSTOM_MENTION_LIMITS.maxGroups)
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
	const groups = candidateGroups.map((rawGroup, groupIndex) => {
		const groupLabel = `${label}[${groupIndex}]`
		const group = requirePlainObject(rawGroup, groupLabel)
		assertKnownKeys(group, new Set(["id", "label", "icon", "iconUrl", "placement", "items"]), groupLabel)
		const id = group.id
		const displayLabel = group.label
		if (
			typeof id !== "string" ||
			!id.trim() ||
			id.length > CUSTOM_MENTION_LIMITS.maxIdAndTypeLength
		)
			throw createInvalidConfigError(
				`${groupLabel}.id must be a non-empty string of at most ${CUSTOM_MENTION_LIMITS.maxIdAndTypeLength} characters`,
			)
		if (RESERVED_MENTION_ROOT_IDS.has(id))
			throw createInvalidConfigError(
				`${groupLabel}.id conflicts with a built-in Mention entry`,
			)
		if (groupIds.has(id))
			throw createInvalidConfigError(`${label} contains duplicate group id: ${id}`)
		groupIds.add(id)
		if (
			typeof displayLabel !== "string" ||
			!displayLabel.trim() ||
			displayLabel.length > CUSTOM_MENTION_LIMITS.maxTextLength
		)
			throw createInvalidConfigError(
				`${groupLabel}.label must be a non-empty string of at most ${CUSTOM_MENTION_LIMITS.maxTextLength} characters`,
			)
		if (
			group.icon !== undefined &&
			(typeof group.icon !== "string" ||
				group.icon.length > CUSTOM_MENTION_LIMITS.maxIdAndTypeLength)
		)
			throw createInvalidConfigError(
				`${groupLabel}.icon must be a string of at most ${CUSTOM_MENTION_LIMITS.maxIdAndTypeLength} characters`,
			)
		const iconUrl = readOptionalIconUrl(group, "iconUrl", groupLabel)
		const placement = readOptionalPlacement(group, "placement", groupLabel)
		if (!Array.isArray(group.items))
			throw createInvalidConfigError(`${groupLabel}.items must be an array`)
		const items = normalizeCustomMentionItems(
			{ items: group.items },
			groupLabel,
			CUSTOM_MENTION_LIMITS.maxTotalItems - totalItems,
			stats,
		)
		totalItems += items.length
		const clonedGroup = JSON.parse(
			JSON.stringify({
				id,
				label: displayLabel,
				...(group.icon === undefined ? {} : { icon: group.icon }),
				...(iconUrl === undefined ? {} : { iconUrl }),
				...(placement === undefined ? {} : { placement }),
				items,
			}),
		) as MagicWidget.CustomMentionGroup
		return clonedGroup
	})
	const filteredGroups = filterCustomMentionPayload(groups, stats)
	reportCustomMentionFilters(stats, reportWarning)
	return filteredGroups
}

/**
 * Accepts a legacy string title or an explicit static/hidden title.
 * A blank string stays invalid so it cannot be mistaken for hiding the line.
 */
function normalizeHeaderTitle(value: unknown): MagicWidget.HeaderConfig["title"] {
	if (value === undefined) return undefined
	if (typeof value === "string") {
		return readOptionalDisplayText({ title: value }, "title", "config.header")
	}

	const record = requirePlainObject(value, "config.header.title")
	assertKnownKeys(record, HEADER_TITLE_KEYS, "config.header.title")
	const mode = record.mode
	if (mode !== undefined && mode !== "static" && mode !== "hidden") {
		throw createInvalidConfigError(
			"Magic widget config.header.title.mode must be static or hidden",
		)
	}
	const text = readOptionalDisplayText(record, "text", "config.header.title")
	if (mode === "hidden") {
		if (text !== undefined) {
			throw createInvalidConfigError(
				"Magic widget config.header.title.text is not allowed for hidden mode",
			)
		}
		return { mode: "hidden" }
	}
	if (text === undefined) {
		throw createInvalidConfigError(
			"Magic widget config.header.title.text is required for static mode",
		)
	}
	return {
		...(mode === undefined ? {} : { mode }),
		text,
	}
}

/** Normalizes the optional two-line header labels without coupling them to React rendering. */
function normalizeHeaderConfig(value: unknown): MagicWidget.HeaderConfig | undefined {
	if (value === undefined) return undefined
	const record = requirePlainObject(value, "config.header")
	assertKnownKeys(record, HEADER_CONFIG_KEYS, "config.header")
	const visible = readOptionalBoolean(record, "visible", "config.header")
	const title = normalizeHeaderTitle(record.title)
	let actions: MagicWidget.HeaderConfig["actions"]
	if (record.actions !== undefined) {
		const actionRecord = requirePlainObject(record.actions, "config.header.actions")
		assertKnownKeys(actionRecord, HEADER_ACTION_KEYS, "config.header.actions")
		actions = Object.fromEntries(
			Array.from(HEADER_ACTION_KEYS)
				.map((key) => [
					key,
					readOptionalBoolean(actionRecord, key, "config.header.actions"),
				])
				.filter(([, field]) => field !== undefined),
		) as MagicWidget.HeaderConfig["actions"]
	}
	let topicName: MagicWidget.HeaderConfig["topicName"]
	if (record.topicName !== undefined) {
		const topicRecord = requirePlainObject(record.topicName, "config.header.topicName")
		assertKnownKeys(topicRecord, HEADER_TOPIC_NAME_KEYS, "config.header.topicName")
		const mode = topicRecord.mode
		if (mode !== undefined && mode !== "current" && mode !== "hidden" && mode !== "static") {
			throw createInvalidConfigError(
				"Magic widget config.header.topicName.mode must be current, hidden, or static",
			)
		}
		const text = readOptionalDisplayText(topicRecord, "text", "config.header.topicName")
		if (mode === "static" && text === undefined) {
			throw createInvalidConfigError(
				"Magic widget config.header.topicName.text is required for static mode",
			)
		}
		topicName = {
			...(mode === undefined ? {} : { mode }),
			...(text === undefined ? {} : { text }),
		}
	}
	return {
		...(visible === undefined ? {} : { visible }),
		...(title === undefined ? {} : { title }),
		...(actions === undefined ? {} : { actions }),
		...(topicName === undefined ? {} : { topicName }),
	}
}

/** Normalizes business panel visibility and reports non-fatal custom Mention filtering. */
function normalizePanelConfig(
	value: unknown,
	reportWarning?: ConfigWarningReporter,
): MagicWidget.WidgetPanelConfig | undefined {
	if (value === undefined) return undefined
	const record = requirePlainObject(value, "config.panel")
	assertKnownKeys(record, PANEL_CONFIG_KEYS, "config.panel")
	const visibility = Object.fromEntries(
		Array.from(PANEL_CONFIG_KEYS)
			.filter((key) => key !== "customGroups")
			.map((key) => [key, readOptionalBoolean(record, key, "config.panel")])
			.filter(([, field]) => field !== undefined),
	) as MagicWidget.WidgetPanelConfig
	const customGroups = normalizeCustomGroupsConfig(
		record.customGroups,
		"config.panel.customGroups",
		reportWarning,
	)
	return {
		...visibility,
		...(customGroups === undefined ? {} : { customGroups }),
	}
}

/** Normalizes one bottom capability and its independent button visibility. */
function normalizeCapabilityConfig(value: unknown, label: string): MagicWidget.CapabilityConfig {
	const record = requirePlainObject(value, label)
	assertKnownKeys(record, CAPABILITY_CONFIG_KEYS, label)
	const enabled = readOptionalBoolean(record, "enabled", label)
	const buttonVisible = readOptionalBoolean(record, "buttonVisible", label)
	return {
		...(enabled === undefined ? {} : { enabled }),
		...(buttonVisible === undefined ? {} : { buttonVisible }),
	}
}

/** Normalizes model-picker visibility separately from mention-panel agent entries. */
function normalizeModelButtonConfig(value: unknown): MagicWidget.ModelButtonConfig {
	const record = requirePlainObject(value, "config.bottom.model")
	assertKnownKeys(record, MODEL_BUTTON_KEYS, "config.bottom.model")
	const buttonVisible = readOptionalBoolean(record, "buttonVisible", "config.bottom.model")
	return buttonVisible === undefined ? {} : { buttonVisible }
}

/** Normalizes all bottom capabilities while keeping omitted entries backward compatible. */
function normalizeBottomConfig(value: unknown): MagicWidget.WidgetBottomConfig | undefined {
	if (value === undefined) return undefined
	const record = requirePlainObject(value, "config.bottom")
	assertKnownKeys(record, BOTTOM_CONFIG_KEYS, "config.bottom")
	return Object.fromEntries(
		Array.from(BOTTOM_CONFIG_KEYS)
			.filter((key) => record[key] !== undefined)
			.map((key) => [
				key,
				key === "model"
					? normalizeModelButtonConfig(record[key])
					: normalizeCapabilityConfig(record[key], `config.bottom.${key}`),
			]),
	) as MagicWidget.WidgetBottomConfig
}

/** Normalizes inline close-button visibility independently from floating lifecycle controls. */
function normalizeWindowConfig(value: unknown): MagicWidget.WidgetWindowConfig | undefined {
	if (value === undefined) return undefined
	const record = requirePlainObject(value, "config.window")
	assertKnownKeys(record, WINDOW_CONFIG_KEYS, "config.window")
	const closable = readOptionalBoolean(record, "closable", "config.window")
	return closable === undefined ? {} : { closable }
}

/** Normalizes the shell section into an immutable SDK-owned snapshot. */
function normalizeShellConfig(value: unknown): MagicWidget.ShellConfig | undefined {
	if (value === undefined) return undefined
	const record = requirePlainObject(value, "config.shell")
	assertKnownKeys(record, SHELL_CONFIG_KEYS, "config.shell")
	const appSidebar = readOptionalBoolean(record, "appSidebar", "config.shell")
	return appSidebar === undefined ? {} : { appSidebar }
}

/** Normalizes the conversation section into an immutable SDK-owned snapshot. */
function normalizeConversationConfig(value: unknown): MagicWidget.ConversationConfig | undefined {
	if (value === undefined) return undefined
	const record = requirePlainObject(value, "config.conversation")
	assertKnownKeys(record, CONVERSATION_CONFIG_KEYS, "config.conversation")
	const projectFiles = readOptionalBoolean(record, "projectFiles", "config.conversation")
	const topicHistory = readOptionalBoolean(record, "topicHistory", "config.conversation")
	const autoHire = readOptionalBoolean(record, "autoHire", "config.conversation")
	const previewMode = readOptionalPreviewMode(record, "previewMode", "config.conversation")
	return {
		...(projectFiles === undefined ? {} : { projectFiles }),
		...(topicHistory === undefined ? {} : { topicHistory }),
		...(autoHire === undefined ? {} : { autoHire }),
		...(previewMode === undefined ? {} : { previewMode }),
	}
}

/** Normalizes responsive behavior without changing legacy viewport defaults. */
function normalizeResponsiveConfig(value: unknown): MagicWidget.ResponsiveConfig | undefined {
	if (value === undefined) return undefined
	const record = requirePlainObject(value, "config.responsive")
	assertKnownKeys(record, RESPONSIVE_CONFIG_KEYS, "config.responsive")
	const mobileDetection = readOptionalMobileDetection(
		record,
		"mobileDetection",
		"config.responsive",
	)
	return mobileDetection === undefined ? {} : { mobileDetection }
}

/** Validates and clones a complete or partial public Widget configuration. */
export function normalizeWidgetConfig(
	value: unknown,
	reportWarning?: ConfigWarningReporter,
): MagicWidget.WidgetConfig {
	if (value === undefined) return {}
	const record = requirePlainObject(value, "config")
	assertKnownKeys(record, CONFIG_KEYS, "config")

	const layout = record.layout
	if (layout !== undefined && layout !== "desktop" && layout !== "mobile") {
		throw createInvalidConfigError(
			'Magic widget config.layout must be either "desktop" or "mobile"',
		)
	}

	const shell = normalizeShellConfig(record.shell)
	const conversation = normalizeConversationConfig(record.conversation)
	const responsive = normalizeResponsiveConfig(record.responsive)
	const header = normalizeHeaderConfig(record.header)
	const panel = normalizePanelConfig(record.panel, reportWarning)
	const bottom = normalizeBottomConfig(record.bottom)
	const windowConfig = normalizeWindowConfig(record.window)
	return {
		...(layout === undefined ? {} : { layout }),
		...(shell === undefined ? {} : { shell }),
		...(conversation === undefined ? {} : { conversation }),
		...(responsive === undefined ? {} : { responsive }),
		...(header === undefined ? {} : { header }),
		...(panel === undefined ? {} : { panel }),
		...(bottom === undefined ? {} : { bottom }),
		...(windowConfig === undefined ? {} : { window: windowConfig }),
	}
}

/** Applies backward-compatible mobile defaults before the Widget creates its initial iframe. */
export function resolveInitialWidgetConfig(
	value: unknown,
	reportWarning?: ConfigWarningReporter,
): MagicWidget.WidgetConfig {
	const normalizedConfig = normalizeWidgetConfig(value, reportWarning)
	return {
		layout: "mobile",
		...normalizedConfig,
		responsive: {
			mobileDetection: "viewport",
			...normalizedConfig.responsive,
		},
	}
}

/** Applies a validated field-level update without mutating the previous snapshot. */
export function mergeWidgetConfig(
	current: MagicWidget.WidgetConfig,
	update: unknown,
	reportWarning?: ConfigWarningReporter,
): MagicWidget.WidgetConfig {
	const normalizedUpdate = normalizeWidgetConfig(update, reportWarning)
	return {
		...current,
		...normalizedUpdate,
		...(normalizedUpdate.shell
			? { shell: { ...current.shell, ...normalizedUpdate.shell } }
			: {}),
		...(normalizedUpdate.conversation
			? { conversation: { ...current.conversation, ...normalizedUpdate.conversation } }
			: {}),
		...(normalizedUpdate.responsive
			? { responsive: { ...current.responsive, ...normalizedUpdate.responsive } }
			: {}),
		...(normalizedUpdate.header
			? {
					header: {
						...current.header,
						...normalizedUpdate.header,
						...(normalizedUpdate.header.topicName
							? {
									topicName: {
										...current.header?.topicName,
										...normalizedUpdate.header.topicName,
									},
								}
							: {}),
						...(normalizedUpdate.header.actions
							? {
									actions: {
										...current.header?.actions,
										...normalizedUpdate.header.actions,
									},
								}
							: {}),
					},
				}
			: {}),
		...(normalizedUpdate.panel
			? { panel: { ...current.panel, ...normalizedUpdate.panel } }
			: {}),
		...(normalizedUpdate.bottom
			? {
					bottom: {
						...current.bottom,
						...normalizedUpdate.bottom,
						...Object.fromEntries(
							Object.entries(normalizedUpdate.bottom).map(([key, value]) => [
								key,
								{
									...(current.bottom?.[
										key as keyof MagicWidget.WidgetBottomConfig
									] ?? {}),
									...value,
								},
							]),
						),
					},
				}
			: {}),
		...(normalizedUpdate.window
			? { window: { ...current.window, ...normalizedUpdate.window } }
			: {}),
	}
}

/** Serializes only validated configuration fields for the protected initial query. */
export function serializeWidgetConfig(config: MagicWidget.WidgetConfig): string {
	const normalized = normalizeWidgetConfig(config)
	// Custom Mention payloads travel after config_ready because the initial query is intentionally small.
	const initialPanel = normalized.panel
		? Object.fromEntries(
				Object.entries(normalized.panel).filter(([key]) => key !== "customGroups"),
			)
		: undefined
	const initialConfig = {
		...normalized,
		...(initialPanel && Object.keys(initialPanel).length > 0
			? { panel: initialPanel }
			: { panel: undefined }),
	}
	return JSON.stringify(initialConfig)
}
