import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { getFileContentById, getTemporaryDownloadUrl } from "@/pages/superMagic/utils/api"
import { useShareRecordingDetailData } from "../useShareRecordingDetailData"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: vi.fn(),
	getTemporaryDownloadUrl: vi.fn(),
}))

/** Creates a fictional authorized attachment for share-detail tests. */
function createAttachment(fileId: string, fileName: string) {
	return {
		file_id: fileId,
		file_name: fileName,
		filename: fileName,
		path: `/${fileName}`,
		relative_file_path: fileName,
		is_directory: false,
		children: [],
	}
}

/** Builds a minimal share bundle whose only loadable artifact is the audio file. */
function buildAudioBundle(audioFileId = "share-audio-file", audioFileName = "recording.wav") {
	const audio = createAttachment(audioFileId, audioFileName)
	const audioDir = {
		file_id: "share-audio-dir",
		file_name: "recording-dir",
		path: "/recording-dir",
		relative_file_path: "recording-dir",
		is_directory: true,
		display_config: { type: "audio" },
		children: [audio],
	}
	return { audio, audioDir, attachments: { tree: [audioDir], list: [audio] } }
}

describe("useShareRecordingDetailData", () => {
	beforeEach(() => {
		vi.mocked(getFileContentById).mockReset()
		vi.mocked(getTemporaryDownloadUrl).mockReset()
	})

	it("filters configured summary tabs that are not present in the authorized share snapshot", async () => {
		const magicProject = createAttachment("share-config-file", "magic.project.js")
		const summary = createAttachment("share-summary-file", "summary.md")
		const audio = createAttachment("share-audio-file", "recording.wav")
		const attachments = {
			tree: [{ ...magicProject, children: [magicProject, summary, audio] }],
			list: [magicProject, summary, audio],
		}
		vi.mocked(getFileContentById).mockImplementation(async (fileId) => {
			if (fileId === "share-config-file") {
				return 'window.magicProjectConfig = { files: { summary: "summary.md", topics: "topics.md" } }'
			}
			if (fileId === "share-summary-file") return "# Shared summary"
			return ""
		})
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([
			{ file_id: "share-audio-file", url: "https://example.invalid/shared-audio" },
		])

		const { result } = renderHook(() =>
			useShareRecordingDetailData({
				projectId: "project-share",
				attachments,
			}),
		)

		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.error).toBe(false)
		expect(result.current.fileMap?.summaryFiles.map((file) => file.type)).toEqual(["summary"])
		expect(result.current.texts.summary.summary?.content).toBe("# Shared summary")
	})

	it("keeps the share page usable when the shared bundle has no audio attachment", async () => {
		// A share may carry only text artifacts; audio is optional and must not fail the whole load.
		const magicProject = createAttachment("share-config-file", "magic.project.js")
		const transcript = createAttachment("share-transcript-file", "transcript.md")
		const attachments = {
			tree: [{ ...magicProject, children: [magicProject, transcript] }],
			list: [magicProject, transcript],
		}
		vi.mocked(getFileContentById).mockImplementation(async (fileId) => {
			if (fileId === "share-config-file") {
				return 'window.magicProjectConfig = { files: { transcript: "transcript.md" } }'
			}
			if (fileId === "share-transcript-file") return "# Shared transcript"
			return ""
		})

		const { result } = renderHook(() =>
			useShareRecordingDetailData({ projectId: "project-share", attachments }),
		)

		await waitFor(() => expect(result.current.loading).toBe(false))
		// The missing audio degrades to the player empty state instead of the page-level error view.
		expect(result.current.error).toBe(false)
		expect(result.current.audioUrl).toBe("")
		expect(vi.mocked(getTemporaryDownloadUrl)).not.toHaveBeenCalled()
		// Texts loaded for the same bundle must survive the absent audio.
		expect(result.current.fileMap?.transcript?.file_id).toBe("share-transcript-file")
		expect(result.current.texts.transcript?.content).toBe("# Shared transcript")
	})

	it("shows the refresh skeleton only for an explicit refresh, not silent syncs", async () => {
		const { attachments } = buildAudioBundle()
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([
			{ file_id: "share-audio-file", url: "https://example.invalid/audio" },
		])

		const { result } = renderHook(() =>
			useShareRecordingDetailData({ projectId: "project-share", attachments }),
		)
		await waitFor(() => expect(result.current.loading).toBe(false))

		// Hang the next audio-url resolution so the refreshing flag is observable mid-flight.
		let resolveUrl!: (value: Array<{ file_id: string; url: string }>) => void
		vi.mocked(getTemporaryDownloadUrl).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveUrl = resolve
				}),
		)

		// An explicit refresh (default silent=false) flips refreshing on for the same bundle.
		act(() => {
			void result.current.refresh()
		})
		expect(result.current.refreshing).toBe(true)

		await act(async () => {
			resolveUrl([{ file_id: "share-audio-file", url: "https://example.invalid/audio" }])
		})
		await waitFor(() => expect(result.current.refreshing).toBe(false))
	})

	it("keeps the skeleton hidden during a silent attachment sync", async () => {
		const { attachments } = buildAudioBundle()
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([
			{ file_id: "share-audio-file", url: "https://example.invalid/audio" },
		])

		const { result } = renderHook(() =>
			useShareRecordingDetailData({ projectId: "project-share", attachments }),
		)
		await waitFor(() => expect(result.current.loading).toBe(false))

		let resolveUrl!: (value: Array<{ file_id: string; url: string }>) => void
		vi.mocked(getTemporaryDownloadUrl).mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveUrl = resolve
				}),
		)

		// A silent refresh must not surface the skeleton for the same bundle.
		act(() => {
			void result.current.refresh({ silent: true })
		})
		expect(result.current.refreshing).toBe(false)

		await act(async () => {
			resolveUrl([{ file_id: "share-audio-file", url: "https://example.invalid/audio" }])
		})
		await waitFor(() => expect(result.current.refreshing).toBe(false))
	})

	it("reloads quietly when the authorized attachment snapshot changes", async () => {
		const { attachments, audioDir } = buildAudioBundle()
		vi.mocked(getTemporaryDownloadUrl).mockResolvedValue([
			{ file_id: "share-audio-file", url: "https://example.invalid/audio" },
		])

		const { result, rerender } = renderHook(
			(props: { projectId: string; attachments: typeof attachments }) =>
				useShareRecordingDetailData(props),
			{ initialProps: { projectId: "project-share", attachments } },
		)
		await waitFor(() => expect(result.current.loading).toBe(false))
		const callsBefore = vi.mocked(getTemporaryDownloadUrl).mock.calls.length

		// A new attachment changes attachmentsKey and must trigger a fresh silent load.
		const extraAudio = createAttachment("share-audio-file-2", "recording-2.wav")
		rerender({
			projectId: "project-share",
			attachments: {
				tree: [{ ...audioDir, children: [audioDir.children[0], extraAudio] }],
				list: [audioDir.children[0], extraAudio],
			},
		})

		await waitFor(() =>
			expect(vi.mocked(getTemporaryDownloadUrl).mock.calls.length).toBeGreaterThan(
				callsBefore,
			),
		)
	})

	it("drops a stale request when the project changes mid-flight", async () => {
		const firstBundle = buildAudioBundle("audio-1", "recording-1.wav")
		const secondBundle = buildAudioBundle("audio-2", "recording-2.wav")

		// First request hangs; second resolves immediately.
		let resolveFirst!: (value: Array<{ file_id: string; url: string }>) => void
		vi.mocked(getTemporaryDownloadUrl)
			.mockImplementationOnce(
				() =>
					new Promise((resolve) => {
						resolveFirst = resolve
					}),
			)
			.mockResolvedValueOnce([{ file_id: "audio-2", url: "https://example.invalid/audio-2" }])

		const { result, rerender } = renderHook(
			(props: { projectId: string; attachments: typeof firstBundle.attachments }) =>
				useShareRecordingDetailData(props),
			{ initialProps: { projectId: "project-1", attachments: firstBundle.attachments } },
		)

		// Switch project before the first request settles so its sequence is superseded.
		rerender({ projectId: "project-2", attachments: secondBundle.attachments })
		await waitFor(() => expect(result.current.loading).toBe(false))
		expect(result.current.fileMap?.audio?.file_id).toBe("audio-2")

		// Resolving the stale request must not overwrite the newer result.
		await act(async () => {
			resolveFirst([{ file_id: "audio-1", url: "https://example.invalid/audio-1" }])
		})
		expect(result.current.fileMap?.audio?.file_id).toBe("audio-2")
	})
})
