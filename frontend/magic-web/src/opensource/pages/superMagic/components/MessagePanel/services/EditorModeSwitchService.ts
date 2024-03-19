import { platformKey } from "@/opensource/utils/storage"
import { RecordingSummaryEditorMode } from "../const/recordSummary"

const localStorageKey = platformKey("recording-summary-editor-mode")
// 当前存储版本，预留向后兼容
const storeVersion = 1
// 迁移旧散列键时使用的兜底用户桶
const legacyUserBucket = "legacy"

interface EditorModeStore {
	version: number
	users: Record<string, Record<string, RecordingSummaryEditorMode>>
}

interface EditorModeParams {
	userId: string
	topicId: string
}

function isValidEditorMode(value: string | null): value is RecordingSummaryEditorMode {
	return (
		value === RecordingSummaryEditorMode.Recording ||
		value === RecordingSummaryEditorMode.Editing
	)
}

function createEmptyStore(): EditorModeStore {
	return {
		version: storeVersion,
		users: {},
	}
}

function persistStore(store: EditorModeStore) {
	localStorage.setItem(localStorageKey, JSON.stringify(store))
}

function getUserBucket(store: EditorModeStore, userId: string) {
	if (!store.users[userId]) {
		store.users[userId] = {}
	}
	return store.users[userId]
}

function migrateLegacyKeys(): EditorModeStore {
	// 旧格式：MAGIC:recording-summary-editor-mode/{topicId}
	const legacyPrefix = `${localStorageKey}/`
	const migratedStore = createEmptyStore()
	const legacyKeys: string[] = []

	for (let index = 0; index < localStorage.length; index += 1) {
		const key = localStorage.key(index)
		if (!key || !key.startsWith(legacyPrefix)) continue
		legacyKeys.push(key)
		const topicId = key.slice(legacyPrefix.length)
		if (!topicId) continue

		const mode = localStorage.getItem(key)
		if (!isValidEditorMode(mode)) continue

		const bucket = getUserBucket(migratedStore, legacyUserBucket)
		bucket[topicId] = mode
	}

	if (legacyKeys.length > 0) {
		legacyKeys.forEach((key) => localStorage.removeItem(key))
		persistStore(migratedStore)
		return migratedStore
	}

	return migratedStore
}

function readStore(): EditorModeStore {
	const raw = localStorage.getItem(localStorageKey)
	if (!raw) return migrateLegacyKeys()

	try {
		const parsed = JSON.parse(raw) as EditorModeStore
		if (!parsed || !parsed.users) {
			return migrateLegacyKeys()
		}
		return parsed
	} catch (error) {
		return migrateLegacyKeys()
	}
}

function pickMode(store: EditorModeStore, userId: string, topicId: string) {
	const userMode = store.users[userId]?.[topicId]
	if (isValidEditorMode(userMode)) return userMode

	// 用户未命中则尝试 legacy 桶（迁移时放入）
	const legacyMode = store.users[legacyUserBucket]?.[topicId]
	if (isValidEditorMode(legacyMode)) return legacyMode

	return null
}

const EditorModeSwitchService = {
	getEditorMode({ userId, topicId }: EditorModeParams) {
		if (!topicId) return RecordingSummaryEditorMode.Recording
		const store = readStore()
		const mode = pickMode(store, userId, topicId)
		if (isValidEditorMode(mode)) return mode
		return RecordingSummaryEditorMode.Recording
	},

	hasDefaultEditorMode({ userId, topicId }: EditorModeParams) {
		if (!topicId) return false
		const store = readStore()
		return isValidEditorMode(pickMode(store, userId, topicId))
	},

	saveDefaultEditorMode({
		userId,
		topicId,
		editorMode,
	}: EditorModeParams & { editorMode: RecordingSummaryEditorMode }) {
		if (!userId || !topicId) return
		const store = readStore()
		const bucket = getUserBucket(store, userId)
		bucket[topicId] = editorMode
		persistStore(store)
	},
}

export default EditorModeSwitchService
