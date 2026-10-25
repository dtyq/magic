import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import magicToast from "@/components/base/MagicToaster/utils"
import { useDownloadProgress } from "@/pages/superMagic/hooks/useDownloadProgress"
import type { RecordingDetailFileMap } from "@/pages/superMagic/pages/AudioRecordings/types/recording-detail"
import { downloadRecordingAudioFile } from "@/pages/superMagic/pages/AudioRecordings/utils/download-recording-audio"
import { downloadRecordingAttachmentFile } from "@/pages/superMagic/pages/AudioRecordings/utils/download-recording-attachment"
import {
	collectExportableFileIds,
	downloadRecordingFilesBatch,
	resolveExportableFileRefs,
} from "@/pages/superMagic/pages/AudioRecordings/utils/download-recording-batch"
import { toast } from "sonner"
import { useRecordingArtifactActions } from "./useRecordingArtifactActions"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

vi.mock("sonner", () => ({
	toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
		info: vi.fn(),
		warning: vi.fn(),
		loading: vi.fn(),
		destroy: vi.fn(),
	},
}))

vi.mock("@/pages/superMagic/hooks/useDownloadProgress", () => ({
	useDownloadProgress: () => ({ startDownload: vi.fn() }),
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/utils/download-recording-audio", () => ({
	downloadRecordingAudioFile: vi.fn(),
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/utils/download-recording-attachment", () => ({
	downloadRecordingAttachmentFile: vi.fn(),
}))

vi.mock("@/pages/superMagic/pages/AudioRecordings/utils/download-recording-batch", () => ({
	collectExportableFileIds: vi.fn(),
	downloadRecordingFilesBatch: vi.fn(),
	resolveExportableFileRefs: vi.fn(),
}))

/** Builds a minimal fictional recording file map for action tests. */
function buildFileMap(): RecordingDetailFileMap {
	return {
		audio: { file_id: "audio-file", file_name: "recording.wav" },
		transcript: { file_id: "transcript-file", file_name: "transcript.md" },
		notes: { file_id: "notes-file", file_name: "notes.md" },
		summaryFiles: [
			{
				type: "summary",
				fileName: "summary.md",
				file: { file_id: "summary-file", file_name: "summary.md" },
			},
		],
	}
}

describe("useRecordingArtifactActions", () => {
	const writeText = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
		// `collectExportableFileIds` feeds `exportAvailability` on every render, so it must never return undefined.
		vi.mocked(collectExportableFileIds).mockReturnValue([])
		writeText.mockResolvedValue(undefined)
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText },
			configurable: true,
		})
	})

	it("copies the active content and reports success", async () => {
		const { result } = renderHook(() =>
			useRecordingArtifactActions({
				projectId: "project-1",
				recordingName: "Meeting Recording",
				fileMap: buildFileMap(),
				activeContent: { content: "some copied text" },
			}),
		)

		let ok = false
		await act(async () => {
			ok = await result.current.copyActiveContent()
		})

		expect(ok).toBe(true)
		expect(writeText).toHaveBeenCalledWith("some copied text")
		expect(vi.mocked(magicToast.success)).toHaveBeenCalledWith("copy.success")
	})

	it("does nothing when the active content is empty", async () => {
		const { result } = renderHook(() =>
			useRecordingArtifactActions({
				projectId: "project-1",
				recordingName: "Meeting Recording",
				fileMap: buildFileMap(),
				activeContent: { content: "   " },
			}),
		)

		let ok = true
		await act(async () => {
			ok = await result.current.copyActiveContent()
		})

		expect(ok).toBe(false)
		expect(writeText).not.toHaveBeenCalled()
	})

	it("returns false and reports an error when the clipboard write fails", async () => {
		writeText.mockRejectedValueOnce(new Error("clipboard denied"))

		const { result } = renderHook(() =>
			useRecordingArtifactActions({
				projectId: "project-1",
				recordingName: "Meeting Recording",
				fileMap: buildFileMap(),
				activeContent: { content: "text" },
			}),
		)

		let ok = true
		await act(async () => {
			ok = await result.current.copyActiveContent()
		})

		expect(ok).toBe(false)
		expect(vi.mocked(magicToast.error)).toHaveBeenCalledWith("copy.failed")
	})

	it("downloads the recording audio through the shared helper", async () => {
		vi.mocked(downloadRecordingAudioFile).mockResolvedValue(true)
		const fileMap = buildFileMap()

		const { result } = renderHook(() =>
			useRecordingArtifactActions({
				projectId: "project-1",
				recordingName: "Meeting Recording",
				fileMap,
				activeContent: {},
			}),
		)

		let ok = false
		await act(async () => {
			ok = await result.current.downloadAudio()
		})

		expect(ok).toBe(true)
		expect(downloadRecordingAudioFile).toHaveBeenCalledWith({
			fileId: "audio-file",
			audioFile: fileMap.audio,
			fallbackName: "recording.wav",
		})
	})

	it("skips audio download when the bundle has no audio file id", async () => {
		const { result } = renderHook(() =>
			useRecordingArtifactActions({
				projectId: "project-1",
				recordingName: "Meeting Recording",
				fileMap: { ...buildFileMap(), audio: { file_name: "recording.wav" } },
				activeContent: {},
			}),
		)

		let ok = true
		await act(async () => {
			ok = await result.current.downloadAudio()
		})

		expect(ok).toBe(false)
		expect(downloadRecordingAudioFile).not.toHaveBeenCalled()
	})

	it("ignores duplicate download starts while one is already in flight", async () => {
		let resolveDownload!: (value: boolean) => void
		vi.mocked(downloadRecordingAudioFile).mockImplementation(
			() => new Promise<boolean>((resolve) => (resolveDownload = resolve)),
		)

		const { result } = renderHook(() =>
			useRecordingArtifactActions({
				projectId: "project-1",
				recordingName: "Meeting Recording",
				fileMap: buildFileMap(),
				activeContent: {},
			}),
		)

		// Kick off the first download inside act so the downloading state update is wrapped.
		let first!: Promise<boolean>
		act(() => {
			first = result.current.downloadAudio()
		})
		await waitFor(() => expect(result.current.downloading).toBe(true))

		// The second call runs with the refreshed callback whose closure sees downloading=true.
		let second = true
		await act(async () => {
			second = await result.current.downloadAudio()
		})
		expect(second).toBe(false)

		await act(async () => {
			resolveDownload(true)
			await first
		})
		await waitFor(() => expect(result.current.downloading).toBe(false))
	})

	it("suppresses the failure toast when a batch download is cancelled", async () => {
		vi.mocked(collectExportableFileIds).mockReturnValue(["audio-file"])
		vi.mocked(resolveExportableFileRefs).mockReturnValue([
			{ fileId: "audio-file", fileName: "recording.wav" },
		])
		vi.mocked(downloadRecordingFilesBatch).mockImplementation(async ({ onCancel }) => {
			onCancel?.()
			return false
		})

		const { result } = renderHook(() =>
			useRecordingArtifactActions({
				projectId: "project-1",
				recordingName: "Meeting Recording",
				fileMap: buildFileMap(),
				activeContent: {},
			}),
		)

		let ok = true
		await act(async () => {
			ok = await result.current.downloadAll()
		})

		expect(ok).toBe(false)
		expect(vi.mocked(toast.error)).not.toHaveBeenCalled()
	})

	it("shows a failure toast when a batch download fails without cancellation", async () => {
		vi.mocked(collectExportableFileIds).mockReturnValue(["audio-file"])
		vi.mocked(resolveExportableFileRefs).mockReturnValue([
			{ fileId: "audio-file", fileName: "recording.wav" },
		])
		vi.mocked(downloadRecordingFilesBatch).mockResolvedValue(false)

		const { result } = renderHook(() =>
			useRecordingArtifactActions({
				projectId: "project-1",
				recordingName: "Meeting Recording",
				fileMap: buildFileMap(),
				activeContent: {},
			}),
		)

		let ok = true
		await act(async () => {
			ok = await result.current.downloadAll()
		})

		expect(ok).toBe(false)
		expect(vi.mocked(toast.error)).toHaveBeenCalledWith("detail.loadFailed")
	})
})
