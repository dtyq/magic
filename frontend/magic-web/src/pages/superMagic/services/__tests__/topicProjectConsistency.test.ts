import { describe, expect, it } from "vitest"
import type { ProjectListItem, Topic } from "@/pages/superMagic/pages/Workspace/types"
import {
	isTopicBoundToProject,
	shouldCreateFreshTopicForProject,
	shouldRefreshChatProjectState,
	wasProjectRemovedFromLoadedList,
} from "@/pages/superMagic/services/topicProjectConsistency"

describe("topicProjectConsistency", () => {
	it("should require refresh when selected topic does not belong to current chat project", () => {
		const staleTopic = {
			id: "topic-a",
			project_id: "project-a",
		} as unknown as Topic

		expect(
			shouldRefreshChatProjectState({
				projectId: "project-b",
				selectedProjectId: "project-b",
				selectedWorkspaceId: "workspace-1",
				selectedTopic: staleTopic,
			}),
		).toBe(true)
	})

	it("should skip refresh when route project was optimistically removed from a loaded list", () => {
		expect(
			shouldRefreshChatProjectState({
				projectId: "project-deleted",
				selectedProjectId: undefined,
				selectedWorkspaceId: "workspace-1",
				selectedTopic: null,
				loadedProjects: [{ id: "project-other" } as unknown as ProjectListItem],
			}),
		).toBe(false)
	})

	it("should still refresh when project list is empty (cold entry)", () => {
		expect(
			shouldRefreshChatProjectState({
				projectId: "project-b",
				selectedProjectId: undefined,
				selectedWorkspaceId: undefined,
				selectedTopic: null,
				loadedProjects: [],
			}),
		).toBe(true)
	})

	it("wasProjectRemovedFromLoadedList detects optimistic delete", () => {
		expect(
			wasProjectRemovedFromLoadedList("project-a", [
				{ id: "project-b" } as unknown as ProjectListItem,
			]),
		).toBe(true)
		expect(wasProjectRemovedFromLoadedList("project-a", [])).toBe(false)
	})

	it("should allow skipping refresh only when project workspace and topic are all aligned", () => {
		const currentTopic = {
			id: "topic-b",
			project_id: "project-b",
		} as unknown as Topic

		expect(
			shouldRefreshChatProjectState({
				projectId: "project-b",
				selectedProjectId: "project-b",
				selectedWorkspaceId: "workspace-1",
				selectedTopic: currentTopic,
			}),
		).toBe(false)
	})

	it("should request a fresh topic before send when topic belongs to another project", () => {
		const selectedProject = { id: "project-b" } as unknown as ProjectListItem
		const staleTopic = {
			id: "topic-a",
			project_id: "project-a",
		} as unknown as Topic
		const currentTopic = {
			id: "topic-b",
			project_id: "project-b",
		} as unknown as Topic

		expect(shouldCreateFreshTopicForProject(selectedProject, staleTopic)).toBe(true)
		expect(isTopicBoundToProject(currentTopic, "project-b")).toBe(true)
	})
})
