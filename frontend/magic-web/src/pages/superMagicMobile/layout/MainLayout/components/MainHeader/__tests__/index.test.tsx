import { beforeEach, describe, expect, it, vi } from "vitest"
import { handleProjectTopicBackNavigation } from "../backNavigation"

describe("handleProjectTopicBackNavigation", () => {
	const navigate = vi.fn()
	const setSelectedTopic = vi.fn()
	const projectTopicCapabilities = {
		canCreateSiblingTopic: true,
		canSaveAsProject: false,
		resolveBackTarget: (projectId?: string) => ({
			name: "SuperWorkspaceProjectState",
			params: projectId ? { projectId } : undefined,
		}),
	}

	beforeEach(() => {
		navigate.mockReset()
		setSelectedTopic.mockReset()
	})

	it("clears the selected topic before navigating back to project detail", () => {
		const handled = handleProjectTopicBackNavigation({
			projectId: "project-1",
			projectTopicCapabilities,
			setSelectedTopic,
			navigate,
		})

		expect(handled).toBe(true)
		expect(setSelectedTopic).toHaveBeenCalledWith(null)
		expect(navigate).toHaveBeenCalledWith({
			name: "SuperWorkspaceProjectState",
			params: { projectId: "project-1" },
			viewTransition: false,
		})
	})

	it("does nothing when project id is missing", () => {
		const handled = handleProjectTopicBackNavigation({
			projectId: undefined,
			projectTopicCapabilities,
			setSelectedTopic,
			navigate,
		})

		expect(handled).toBe(false)
		expect(setSelectedTopic).not.toHaveBeenCalled()
		expect(navigate).not.toHaveBeenCalled()
	})
})
