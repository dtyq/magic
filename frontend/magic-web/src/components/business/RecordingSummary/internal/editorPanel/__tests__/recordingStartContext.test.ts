import { describe, expect, it } from "vitest"
import { TopicMode } from "@/pages/superMagic/pages/Workspace/TopicMode"
import {
	getHomepageRecordingStartBlocker,
	isHomepageRecordingStartReady,
	resolveEnsuredRecordingTopicMode,
	resolveRecordingStartContext,
	resolveSelectedProjectStartContext,
} from "../recordingStartContext"

const activeWorkspace = { id: "active-workspace" } as never
const activeProject = { id: "active-project", workspace_id: "active-workspace" } as never
const activeTopic = { id: "active-topic", project_id: "active-project" } as never
const activeModel = { model_id: "active-model" } as never

const selectedWorkspace = { id: "selected-workspace" } as never
const selectedProject = { id: "selected-project", workspace_id: "selected-workspace" } as never
const selectedTopic = { id: "selected-topic", project_id: "selected-project" } as never
const selectedModel = { model_id: "selected-model" } as never

describe("resolveEnsuredRecordingTopicMode", () => {
	it("keeps an existing project on the record-summary topic", () => {
		expect(
			resolveEnsuredRecordingTopicMode({
				hasProject: true,
				fallbackTopicMode: TopicMode.General,
			}),
		).toBe(TopicMode.RecordSummary)
	})

	it("uses the homepage topic mode when recording must create the project", () => {
		expect(
			resolveEnsuredRecordingTopicMode({
				hasProject: false,
				recordingNewProjectTopicMode: TopicMode.RecordSummary,
				fallbackTopicMode: TopicMode.General,
			}),
		).toBe(TopicMode.RecordSummary)
	})

	it("keeps the previous fallback when no homepage topic mode is provided", () => {
		expect(
			resolveEnsuredRecordingTopicMode({
				hasProject: false,
				fallbackTopicMode: TopicMode.General,
			}),
		).toBe(TopicMode.General)
	})
})

describe("resolveRecordingStartContext", () => {
	it("uses the homepage selection when the full context is available", () => {
		expect(
			resolveRecordingStartContext({
				selectedWorkspace,
				selectedProject,
				selectedTopic,
				selectedModel,
				activeWorkspace,
				activeProject,
				activeTopic,
				activeModel,
			}),
		).toEqual({
			workspace: selectedWorkspace,
			project: selectedProject,
			topic: selectedTopic,
			model: selectedModel,
		})
	})

	it("does not stitch the active recording when only the homepage workspace is selected", () => {
		expect(
			resolveRecordingStartContext({
				selectedWorkspace,
				selectedProject: null,
				selectedTopic: null,
				selectedModel,
				activeWorkspace,
				activeProject,
				activeTopic,
				activeModel,
			}),
		).toEqual({
			workspace: selectedWorkspace,
			project: null,
			topic: null,
			model: selectedModel,
		})
	})

	it("drops a selected project that belongs to a different workspace", () => {
		const staleProject = { id: "stale-project", workspace_id: "active-workspace" } as never
		const staleTopic = { id: "stale-topic", project_id: "stale-project" } as never

		expect(
			resolveRecordingStartContext({
				selectedWorkspace,
				selectedProject: staleProject,
				selectedTopic: staleTopic,
				selectedModel,
				activeWorkspace,
				activeProject,
				activeTopic,
				activeModel,
			}),
		).toEqual({
			workspace: selectedWorkspace,
			project: null,
			topic: null,
			model: selectedModel,
		})
	})

	it("keeps a selected project that belongs to the selected workspace", () => {
		expect(
			resolveRecordingStartContext({
				selectedWorkspace,
				selectedProject,
				selectedTopic: null,
				selectedModel,
				activeWorkspace,
				activeProject,
				activeTopic,
				activeModel,
			}),
		).toEqual({
			workspace: selectedWorkspace,
			project: selectedProject,
			topic: null,
			model: selectedModel,
		})
	})

	it("drops a selected topic that belongs to a different project", () => {
		const staleTopic = { id: "stale-topic", project_id: "other-project" } as never

		expect(
			resolveRecordingStartContext({
				selectedWorkspace,
				selectedProject,
				selectedTopic: staleTopic,
				selectedModel,
				activeWorkspace,
				activeProject,
				activeTopic,
				activeModel,
			}),
		).toEqual({
			workspace: selectedWorkspace,
			project: selectedProject,
			topic: null,
			model: selectedModel,
		})
	})

	it("does not fall back to the active model when the homepage has a workspace", () => {
		expect(
			resolveRecordingStartContext({
				selectedWorkspace,
				selectedProject: null,
				selectedTopic: null,
				selectedModel: null,
				activeWorkspace,
				activeProject,
				activeTopic,
				activeModel,
			}),
		).toEqual({
			workspace: selectedWorkspace,
			project: null,
			topic: null,
			model: null,
		})
	})

	it("does not use the active recording when the homepage has no workspace", () => {
		expect(
			resolveRecordingStartContext({
				selectedWorkspace: null,
				selectedProject: null,
				selectedTopic: null,
				selectedModel: null,
				activeWorkspace,
				activeProject,
				activeTopic,
				activeModel,
			}),
		).toEqual({
			workspace: null,
			project: null,
			topic: null,
			model: null,
		})
	})
})

describe("resolveSelectedProjectStartContext", () => {
	it("returns the picked workspace and project without using an active recording", async () => {
		const workspace = { id: "picked-workspace" } as never
		const project = { id: "picked-project", workspace_id: "picked-workspace" } as never

		await expect(
			resolveSelectedProjectStartContext({
				openSelector: async () => ({ workspace, project }),
				selectedModel,
			}),
		).resolves.toEqual({
			workspace,
			project,
			topic: null,
			model: selectedModel,
		})
	})

	it("returns null when the project picker is canceled", async () => {
		await expect(
			resolveSelectedProjectStartContext({
				openSelector: async () => {
					throw new Error("canceled")
				},
				selectedModel,
			}),
		).resolves.toBeNull()
	})

	it("returns null when the picker has no workspace", async () => {
		await expect(
			resolveSelectedProjectStartContext({
				openSelector: async () => ({
					workspace: null,
					project: selectedProject,
				}),
				selectedModel,
			}),
		).resolves.toBeNull()
	})
})

describe("isHomepageRecordingStartReady", () => {
	it("requires a workspace and a model", () => {
		expect(
			isHomepageRecordingStartReady({
				workspace: selectedWorkspace,
				project: null,
				topic: null,
				model: selectedModel,
			}),
		).toBe(true)
	})

	it("rejects a project-only context without a workspace", () => {
		expect(
			isHomepageRecordingStartReady({
				workspace: null,
				project: selectedProject,
				topic: selectedTopic,
				model: selectedModel,
			}),
		).toBe(false)
	})

	it("rejects a workspace without a model", () => {
		expect(
			isHomepageRecordingStartReady({
				workspace: selectedWorkspace,
				project: selectedProject,
				topic: selectedTopic,
				model: null,
			}),
		).toBe(false)
	})
})

describe("getHomepageRecordingStartBlocker", () => {
	it("returns missingWorkspace before override can run", () => {
		expect(
			getHomepageRecordingStartBlocker(
				resolveRecordingStartContext({
					selectedWorkspace: null,
					selectedProject: null,
					selectedTopic: null,
					selectedModel,
				}),
			),
		).toBe("missingWorkspace")
	})

	it("returns missingModel when the homepage has a workspace but no model", () => {
		expect(
			getHomepageRecordingStartBlocker(
				resolveRecordingStartContext({
					selectedWorkspace,
					selectedProject,
					selectedTopic,
					selectedModel: null,
				}),
			),
		).toBe("missingModel")
	})

	it("returns null when the homepage can start a recording", () => {
		expect(
			getHomepageRecordingStartBlocker(
				resolveRecordingStartContext({
					selectedWorkspace,
					selectedProject: null,
					selectedTopic: null,
					selectedModel,
				}),
			),
		).toBeNull()
	})
})
