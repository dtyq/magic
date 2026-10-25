import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { loadProjectAttachments } from "@/pages/superMagic/services/projectAttachmentsLoader"
import { getFileContentById, getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import { useRecordingDetailData } from "../useRecordingDetailData"

const queryProjectsMock = vi.hoisted(() => vi.fn())
const realtimeOptionsRef = vi.hoisted(() => ({ current: null as any }))

vi.mock("@/services/audioRecordings", () => ({
	audioRecordingsService: {
		queryProjects: queryProjectsMock,
	},
}))

vi.mock("@/pages/superMagic/services/projectAttachmentsLoader", () => ({
	loadProjectAttachments: vi.fn(),
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: vi.fn(),
	getTemporaryDownloadUrl: vi.fn(),
}))

vi.mock("@/pages/superMagic/hooks/useProjectAttachmentsChangeRealtime", () => ({
	useProjectAttachmentsChangeRealtime: vi.fn((options) => {
		realtimeOptionsRef.current = options
	}),
}))

describe("useRecordingDetailData", () => {
	beforeEach(() => {
		queryProjectsMock.mockReset()
		queryProjectsMock.mockImplementation(async ({ projectIds }: { projectIds: string[] }) => ({
			list: [
				{
					id: projectIds[0],
					project_name: `Recording ${projectIds[0]}`,
					created_at: 1710000000,
					card_status: "summarized",
					current_phase: "summarizing",
					phase_status: "completed",
					audio_source: "recorded",
					audio_file_id: "audio-file",
				},
			],
		}))
		vi.mocked(loadProjectAttachments).mockReset()
		vi.mocked(getFileContentById).mockReset()
		vi.mocked(getTemporaryDownloadUrl).mockReset()
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([])
		realtimeOptionsRef.current = null
	})

	it("aborts the stale attachment request when the route project changes", async () => {
		const signals = new Map<string, AbortSignal>()
		vi.mocked(loadProjectAttachments).mockImplementation(({ projectId, signal }) => {
			signals.set(projectId, signal as AbortSignal)
			if (projectId === "project-two") {
				return Promise.resolve({
					tree: [],
					list: [],
					total: 0,
					sourceVersion: "v1",
					strategy: "count_v1",
					diagnostics: {},
				})
			}
			return new Promise(() => undefined)
		})

		const { result, rerender, unmount } = renderHook(
			({ projectId }) => useRecordingDetailData({ projectId }),
			{ initialProps: { projectId: "project-one" } },
		)

		await waitFor(() => expect(signals.has("project-one")).toBe(true))
		rerender({ projectId: "project-two" })

		await waitFor(() => expect(signals.get("project-one")?.aborted).toBe(true))
		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.projectItem?.id).toBe("project-two")
		expect(loadProjectAttachments).toHaveBeenCalledWith(
			expect.objectContaining({
				projectId: "project-two",
				signal: expect.any(AbortSignal),
			}),
		)

		unmount()
		expect(signals.get("project-two")?.aborted).toBe(true)
	})

	it("uses the project audio_file_id when no generated summary bundle exists", async () => {
		queryProjectsMock.mockResolvedValueOnce({
			list: [
				{
					id: "project-imported",
					project_name: "Imported recording",
					created_at: 1710000000,
					card_status: "not_summarized",
					current_phase: "merging",
					phase_status: "completed",
					audio_source: "imported",
					audio_file_id: "audio-file-imported",
				},
			],
		})
		vi.mocked(loadProjectAttachments).mockResolvedValue({
			tree: [],
			list: [],
			total: 0,
			sourceVersion: "v1",
			strategy: "count_v1",
			diagnostics: {},
		})
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([
			{ file_id: "audio-file-imported", url: "https://example.invalid/audio" },
		])

		const { result } = renderHook(() =>
			useRecordingDetailData({ projectId: "project-imported" }),
		)

		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(getTemporaryDownloadUrl).toHaveBeenCalledWith({
			file_ids: ["audio-file-imported"],
		})
		expect(result.current.audioUrl).toBe("https://example.invalid/audio")
	})

	it("silently refreshes summary content after a file-change event without showing loading", async () => {
		const createAttachment = (fileId: string, fileName: string) => ({
			file_id: fileId,
			file_name: fileName,
			filename: fileName,
			path: `/${fileName}`,
			relative_file_path: fileName,
			is_directory: false,
			children: [],
		})
		const magicProject = createAttachment("file-config", "magic.project.js")
		const summary = createAttachment("file-summary", "summary.md")
		const audio = createAttachment("audio-file", "recording.wav")
		const attachmentSnapshot = {
			tree: [{ ...magicProject, children: [magicProject, summary, audio] }],
			list: [magicProject, summary, audio],
			total: 3,
			sourceVersion: "v1",
			strategy: "count_v1",
			diagnostics: {},
		}
		vi.mocked(loadProjectAttachments).mockResolvedValue(attachmentSnapshot)
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([
			{ file_id: "audio-file", url: "https://example.invalid/audio" },
		])
		const contentByFileId: Record<string, string> = {
			"file-config": 'window.magicProjectConfig = { files: { summary: "summary.md" } }',
			"file-summary": "",
		}
		vi.mocked(getFileContentById).mockImplementation(
			async (fileId) => contentByFileId[fileId] ?? "",
		)

		const { result } = renderHook(() =>
			useRecordingDetailData({ projectId: "project-summary" }),
		)
		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(realtimeOptionsRef.current?.enabled).toBe(true)
		expect(result.current.texts.summary.summary?.content).toBe("")

		contentByFileId["file-summary"] = "# Summary"
		await act(async () => {
			realtimeOptionsRef.current?.onAttachmentsChange?.({})
		})

		await waitFor(() => expect(loadProjectAttachments).toHaveBeenCalledTimes(2))
		await waitFor(() => expect(result.current.texts.summary.summary?.content).toBe("# Summary"))
		expect(result.current.loading).toBe(false)
		expect(getTemporaryDownloadUrl).toHaveBeenCalledTimes(1)
	})

	it("keeps existing content when a silent refresh fails", async () => {
		const attachment = {
			file_id: "audio-file",
			file_name: "recording.wav",
			filename: "recording.wav",
			path: "/recording.wav",
			is_directory: false,
			children: [],
		}
		vi.mocked(loadProjectAttachments).mockResolvedValueOnce({
			tree: [attachment],
			list: [attachment],
			total: 1,
			sourceVersion: "v1",
			strategy: "count_v1",
			diagnostics: {},
		})

		const { result } = renderHook(() => useRecordingDetailData({ projectId: "project-safe" }))
		await waitFor(() => expect(result.current.loading).toBe(false))
		vi.mocked(loadProjectAttachments).mockRejectedValueOnce(new Error("temporary failure"))

		await act(async () => {
			await realtimeOptionsRef.current?.onAttachmentsChange?.({})
		})

		expect(result.current.error).toBe(false)
		expect(result.current.fileMap?.audio?.file_id).toBe("audio-file")
		expect(result.current.loading).toBe(false)
	})
})
