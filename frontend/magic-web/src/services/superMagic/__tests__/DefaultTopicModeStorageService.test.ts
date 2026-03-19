import { beforeEach, describe, expect, it } from "vitest"
import DefaultTopicModeStorageService from "../DefaultTopicModeStorageService"
import { TopicMode } from "@/opensource/pages/superMagic/pages/Workspace/types"
import { platformKey } from "@/opensource/utils/storage"

const userKey = "orgA/userA"

describe("DefaultTopicModeStorageService", () => {
	beforeEach(() => {
		localStorage.clear()
	})

	it("stores global and project modes per user and falls back when missing", () => {
		DefaultTopicModeStorageService.setMode({
			userKey,
			mode: TopicMode.Chat,
		})
		DefaultTopicModeStorageService.setMode({
			userKey,
			projectKey: "ws1/p1",
			mode: TopicMode.DataAnalysis,
		})

		expect(
			DefaultTopicModeStorageService.getOrFallback({
				userKey,
				projectKey: "ws1/p1",
				fallbackMode: TopicMode.General,
			}),
		).toBe(TopicMode.DataAnalysis)

		expect(
			DefaultTopicModeStorageService.getOrFallback({
				userKey,
				projectKey: "ws1/p2",
				fallbackMode: TopicMode.General,
			}),
		).toBe(TopicMode.Chat)

		const projects = DefaultTopicModeStorageService.getProjects(userKey)
		expect(projects["ws1/p1"]).toBe(TopicMode.DataAnalysis)
	})

	it("isolates users and respects fallback", () => {
		DefaultTopicModeStorageService.setMode({
			userKey,
			mode: TopicMode.Chat,
		})

		expect(
			DefaultTopicModeStorageService.getOrFallback({
				userKey: "orgA/userB",
				projectKey: "ws1/p1",
				fallbackMode: TopicMode.General,
			}),
		).toBe(TopicMode.General)
	})

	it("migrates legacy global and project keys into aggregated store", () => {
		const legacyGlobalKey = `${platformKey("super_magic/default_topic_mode")}/orgA/userA`
		const legacyProjectKey = `${platformKey(
			"super_magic/default_project_topic_mode",
		)}/orgA/userA`

		localStorage.setItem(legacyGlobalKey, JSON.stringify(TopicMode.Chat))
		localStorage.setItem(
			legacyProjectKey,
			JSON.stringify([
				["ws1/p1", TopicMode.Report],
				["ws1/p2", "invalid-mode"],
			]),
		)

		const mode = DefaultTopicModeStorageService.getOrFallback({
			userKey,
			projectKey: "ws1/p1",
			fallbackMode: TopicMode.General,
		})

		expect(mode).toBe(TopicMode.Report)
		expect(localStorage.getItem(legacyGlobalKey)).toBeNull()
		expect(localStorage.getItem(legacyProjectKey)).toBeNull()

		const projects = DefaultTopicModeStorageService.getProjects(userKey)
		expect(projects["ws1/p1"]).toBe(TopicMode.Report)
		expect(projects["ws1/p2"]).toBeUndefined()
	})

	it("ignores invalid modes and persists project map in bulk", () => {
		// 写入无效模式，读取应回退
		DefaultTopicModeStorageService.setMode({
			userKey,
			projectKey: "ws1/pX",
			mode: "invalid-mode" as TopicMode,
		})

		expect(
			DefaultTopicModeStorageService.getOrFallback({
				userKey,
				projectKey: "ws1/pX",
				fallbackMode: TopicMode.General,
			}),
		).toBe(TopicMode.General)

		// 批量持久化项目映射
		DefaultTopicModeStorageService.setProjects(userKey, {
			"ws1/p2": TopicMode.DataAnalysis,
			"ws1/p3": TopicMode.Chat,
		})

		const projects = DefaultTopicModeStorageService.getProjects(userKey)
		expect(projects["ws1/p2"]).toBe(TopicMode.DataAnalysis)
		expect(projects["ws1/p3"]).toBe(TopicMode.Chat)
	})
})
