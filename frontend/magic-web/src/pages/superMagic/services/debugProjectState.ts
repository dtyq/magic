import projectFilesStore from "@/stores/projectFiles"
import { userStore } from "@/models/user"
import { ProjectStateRepository } from "@/models/config/repositories/SuperProjectStateRepository"
import { projectStore, topicStore, workspaceStore } from "../stores/core"
import { superMagicStore } from "../stores"

const DEBUG_MAX_DEPTH = 8
const DEBUG_MAX_ITEMS = 5000
const DEBUG_MAX_STRING_LENGTH = 200_000

function formatLocalExportTime(date = new Date()) {
	const offsetMinutes = -date.getTimezoneOffset()
	const sign = offsetMinutes >= 0 ? "+" : "-"
	const absoluteOffset = Math.abs(offsetMinutes)
	const pad = (value: number) => String(value).padStart(2, "0")
	const offset = `${sign}${pad(Math.floor(absoluteOffset / 60))}:${pad(absoluteOffset % 60)}`
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
		date.getHours(),
	)}:${pad(date.getMinutes())}:${pad(date.getSeconds())} ${offset}`
}

function toSerializable(value: unknown, seen = new WeakSet<object>(), depth = 0): unknown {
	if (value === null || typeof value !== "object") {
		if (typeof value === "bigint") return `${value}n`
		if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`
		if (typeof value === "string" && value.length > DEBUG_MAX_STRING_LENGTH) {
			return `${value.slice(0, DEBUG_MAX_STRING_LENGTH)}...[truncated ${value.length - DEBUG_MAX_STRING_LENGTH} chars]`
		}
		return value
	}
	if (depth >= DEBUG_MAX_DEPTH) return "[Max depth reached]"
	if (seen.has(value)) return "[Circular]"
	seen.add(value)
	if (value instanceof Map) {
		const entries = Array.from(value.entries()).slice(0, DEBUG_MAX_ITEMS)
		return {
			entries: entries.map(([key, item]) => [
				toSerializable(key, seen, depth + 1),
				toSerializable(item, seen, depth + 1),
			]),
			...(value.size > entries.length ? { truncated: value.size - entries.length } : {}),
		}
	}
	if (value instanceof Set) {
		const items = Array.from(value).slice(0, DEBUG_MAX_ITEMS)
		return {
			items: items.map((item) => toSerializable(item, seen, depth + 1)),
			...(value.size > items.length ? { truncated: value.size - items.length } : {}),
		}
	}
	if (Array.isArray(value)) {
		const items = value.slice(0, DEBUG_MAX_ITEMS)
		return items
			.map((item) => toSerializable(item, seen, depth + 1))
			.concat(
				value.length > items.length
					? [`[Truncated ${value.length - items.length} items]`]
					: [],
			)
	}
	const entries = Object.entries(value).slice(0, DEBUG_MAX_ITEMS)
	return Object.fromEntries(
		entries.map(([key, item]) => [key, toSerializable(item, seen, depth + 1)]),
	)
}

export function isSuperMagicDebugEnabled() {
	if (typeof window === "undefined") return false
	try {
		return window.localStorage.getItem("debug") === "1"
	} catch {
		return false
	}
}

export async function getCurrentProjectDebugState() {
	const selectedTopic = topicStore.selectedTopic
	const topicIds = Array.from(
		new Set(
			[selectedTopic?.chat_topic_id, selectedTopic?.id, superMagicStore.activeTopicId].filter(
				(id): id is string => Boolean(id),
			),
		),
	)
	const messages = topicIds.flatMap((id) => superMagicStore.messages.get(id) || [])
	const messageIds = new Set(
		messages
			.map((message) => message.super_message_id || message.app_message_id)
			.filter((id): id is string => Boolean(id)),
	)
	const projectId =
		projectStore.selectedProject?.id || projectFilesStore.currentSelectedProject?.id
	const organizationCode = userStore.user.organizationCode
	const projectStateCache =
		organizationCode && projectId
			? await new ProjectStateRepository().getProjectState(organizationCode, projectId)
			: undefined
	const state = {
		exportedAt: formatLocalExportTime(),
		location: window.location.href,
		workspace: workspaceStore.selectedWorkspace,
		project: projectStore.selectedProject,
		topic: selectedTopic,
		currentTopicId: topicIds[0] || null,
		fileTree: projectFilesStore.workspaceFileTree,
		projectStateCache,
		messages,
		messageBuffers: topicIds.map((topicId) => ({
			topicId,
			buffer: superMagicStore.buffer.get(topicId) || null,
		})),
		messageNodeCache: Array.from(superMagicStore.messageMap.entries()).filter(([key]) =>
			messageIds.has(key),
		),
		topicMeta: topicIds.map((topicId) => ({
			topicId,
			meta: superMagicStore.topicMeta.get(topicId) || null,
		})),
	}
	try {
		return JSON.stringify(toSerializable(state), null, 2)
	} catch (error) {
		console.warn("完整项目状态过大，生成精简诊断包", error)
		return JSON.stringify(
			{
				exportedAt: state.exportedAt,
				location: state.location,
				workspace: toSerializable(state.workspace),
				project: toSerializable(state.project),
				topic: toSerializable(state.topic),
				currentTopicId: state.currentTopicId,
				fileTree: {
					count: state.fileTree.length,
					sample: toSerializable(state.fileTree.slice(0, 100)),
				},
				messages: {
					count: state.messages.length,
					sample: toSerializable(state.messages.slice(-100)),
				},
				messageBuffers: toSerializable(state.messageBuffers),
				messageNodeCache: {
					count: state.messageNodeCache.length,
					sample: toSerializable(state.messageNodeCache.slice(-100)),
				},
				topicMeta: toSerializable(state.topicMeta),
				truncated: true,
				truncationReason: "完整诊断数据超过 JavaScript 字符串长度限制",
			},
			null,
			2,
		)
	}
}
