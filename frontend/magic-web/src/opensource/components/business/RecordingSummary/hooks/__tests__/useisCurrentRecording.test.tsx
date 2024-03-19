import { describe, expect, it, vi } from "vitest"
import { renderHook } from "@testing-library/react"
import { useIsCurrentRecording } from "@/opensource/components/business/RecordingSummary/hooks/useisCurrentRecording"
import type {
	ProjectListItem,
	Topic,
	Workspace,
} from "@/opensource/pages/superMagic/pages/Workspace/types"

const mockUseCurrentRecordingSessionIdentity = vi.fn()

vi.mock("@/opensource/components/business/RecordingSummary/internal/editorRuntime", () => ({
	useCurrentRecordingSessionIdentity: () => mockUseCurrentRecordingSessionIdentity(),
}))

const topic = (id: string) => ({ id }) as Topic
const project = (id: string) => ({ id }) as ProjectListItem
const workspace = (id: string) => ({ id }) as Workspace

describe("useIsCurrentRecording", () => {
	it("returns true when workspace project and topic all match", () => {
		mockUseCurrentRecordingSessionIdentity.mockReturnValue({
			workspaceId: "workspace-1",
			projectId: "project-1",
			topicId: "topic-1",
		})

		const { result } = renderHook(() =>
			useIsCurrentRecording(topic("topic-1"), project("project-1"), workspace("workspace-1")),
		)

		expect(result.current).toBe(true)
	})

	it("returns false when any identity field differs", () => {
		mockUseCurrentRecordingSessionIdentity.mockReturnValue({
			workspaceId: "workspace-1",
			projectId: "project-1",
			topicId: "topic-1",
		})

		const { result } = renderHook(() =>
			useIsCurrentRecording(topic("topic-2"), project("project-1"), workspace("workspace-1")),
		)

		expect(result.current).toBe(false)
	})

	it("returns false when selected topic is missing", () => {
		mockUseCurrentRecordingSessionIdentity.mockReturnValue({
			workspaceId: "workspace-1",
			projectId: "project-1",
			topicId: "topic-1",
		})

		const { result } = renderHook(() =>
			useIsCurrentRecording(null, project("project-1"), workspace("workspace-1")),
		)

		expect(result.current).toBe(false)
	})
})
