import { describe, expect, it } from "vitest"
import { TaskStatus } from "@/pages/superMagic/pages/Workspace/types"
import {
	parseTemplateChatMarker,
	resolveTemplateChatState,
	isLegacyTemplateChatName,
	serializeTemplateChatMarker,
	templateChatTopicIds,
} from "../services/templateChats"

const startedAt = "2026-10-19T10:00:00.000Z"
const before = { templates_before: { "templates/voices.html": "v1" }, started_at: startedAt }
const unchanged = [{ path: "templates/voices.html", version: "v1" }]

describe("resolveTemplateChatState", () => {
	it("treats a task still queued long after sending as unsent", () => {
		const queued = { task_status: TaskStatus.WAITING }
		const at = (minutes: number) => Date.parse(startedAt) + minutes * 60 * 1000
		expect(resolveTemplateChatState(before, queued, unchanged, at(1))).toBe("generating")
		expect(resolveTemplateChatState(before, queued, unchanged, at(5))).toBe("unsent")
	})

	it("follows the topic while the conversation is open", () => {
		expect(
			resolveTemplateChatState(before, { task_status: TaskStatus.RUNNING }, unchanged),
		).toBe("generating")
		expect(
			resolveTemplateChatState(
				before,
				{ task_status: TaskStatus.WAITING },
				unchanged,
				Date.parse(startedAt),
			),
		).toBe("generating")
		expect(
			resolveTemplateChatState(
				before,
				{ task_status: TaskStatus.WAITING_FOR_USER },
				unchanged,
			),
		).toBe("waiting")
		expect(resolveTemplateChatState(before, { task_status: TaskStatus.ERROR }, unchanged)).toBe(
			"failed",
		)
	})

	it("is done once a template was added or changed, otherwise stopped", () => {
		const finished = { task_status: TaskStatus.FINISHED }
		expect(resolveTemplateChatState(before, finished, unchanged)).toBe("stopped")
		expect(
			resolveTemplateChatState(before, finished, [
				...unchanged,
				{ path: "templates/brand.html", version: "v1" },
			]),
		).toBe("done")
		expect(
			resolveTemplateChatState(before, finished, [
				{ path: "templates/voices.html", version: "v2" },
			]),
		).toBe("done")
		expect(
			resolveTemplateChatState(before, { task_status: TaskStatus.SUSPENDED }, unchanged),
		).toBe("stopped")
	})
})

describe("template chat markers", () => {
	it("round-trips and rejects unknown content", () => {
		const marker = {
			schema_version: 1 as const,
			topic_id: "42",
			mode: "edit" as const,
			template_path: "templates/brand.html",
			templates_before: { "templates/brand.html": "v3" },
			started_at: "2026-10-19T10:00:00.000Z",
			prompt: { type: "doc", content: [{ type: "paragraph" }] },
		}
		expect(parseTemplateChatMarker(serializeTemplateChatMarker(marker))).toEqual(marker)
		expect(parseTemplateChatMarker("{")).toBeNull()
		expect(parseTemplateChatMarker(JSON.stringify({ topic_id: "1" }))).toBeNull()
		expect(parseTemplateChatMarker(undefined)).toBeNull()
	})
})

describe("templateChatTopicIds", () => {
	it("reads topic ids from marker file names only", () => {
		const file = (path: string) => ({
			file_id: path,
			relative_file_path: path,
			is_directory: false,
		})
		expect(
			templateChatTopicIds([
				file("template-chats/971.json"),
				file("template-chats/old/972.json"),
				file("personas/973.json"),
				file("templates/voices.html"),
			]),
		).toEqual(new Set(["971"]))
	})
})

describe("isLegacyTemplateChatName", () => {
	it("matches report template conversations only", () => {
		expect(isLegacyTemplateChatName("新建儿童涂鸦风报告模板")).toBe(true)
		expect(isLegacyTemplateChatName("Create a dark report template")).toBe(true)
		expect(isLegacyTemplateChatName("高校二手书9元订阅付费意愿测试")).toBe(false)
		expect(isLegacyTemplateChatName(undefined)).toBe(false)
	})
})
