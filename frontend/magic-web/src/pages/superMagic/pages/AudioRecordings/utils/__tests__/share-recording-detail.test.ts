import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import {
	buildShareRecordingCapabilities,
	buildShareRecordingMagicProjectConfig,
	isAudioProjectMode,
	resolveAudioFolderShareTarget,
	shouldRenderAudioRecordingShareShell,
} from "../share-recording-detail"

/** Creates a fictional attachment row so tests never rely on real recording resource values. */
function createAttachment(overrides: Partial<AttachmentItem> = {}): AttachmentItem {
	return {
		file_id: "file-mock-001",
		file_name: "mock.md",
		file_extension: "md",
		file_key: "workspace/mock.md",
		file_size: 128,
		relative_file_path: "/bundle/mock.md",
		file_url: "https://example.test/mock.md",
		is_hidden: false,
		updated_at: "2026-06-23 10:00:00",
		is_directory: false,
		sort: 0,
		parent_id: "dir-mock-001",
		source: 3,
		...overrides,
	}
}

describe("share recording detail helpers", () => {
	it("mounts the audio share shell when the share carries an audio-marked bundle directory", () => {
		// The bundle directory row carries the audio display config that recording shares expose.
		const bundleFolder = createAttachment({
			file_id: "bundle-folder-mock",
			file_name: "mock-recording-folder",
			is_directory: true,
			display_config: { type: "audio" },
		})
		expect(
			shouldRenderAudioRecordingShareShell({
				projectMode: "audio",
				attachments: { tree: [bundleFolder], list: [bundleFolder] },
			}),
		).toBe(true)
		expect(
			shouldRenderAudioRecordingShareShell({
				projectMode: "audio",
				attachments: { tree: [], list: [] },
			}),
		).toBe(false)
		expect(isAudioProjectMode("audio")).toBe(true)
		expect(isAudioProjectMode("chat")).toBe(false)
	})

	it("keeps a plain file share inside an audio project on the ordinary file preview", () => {
		// The recording workbench cannot render plain files, so sharing one must not open an empty workbench.
		const meetingNotes = createAttachment({
			file_id: "plain-notes-mock",
			file_name: "meeting-notes.md",
		})
		expect(
			shouldRenderAudioRecordingShareShell({
				projectMode: "audio",
				attachments: { tree: [meetingNotes], list: [meetingNotes] },
			}),
		).toBe(false)
	})

	it("still mounts the audio share shell when only the bundle ancestor row arrives in the flat list", () => {
		// Cursor pages can deliver the bundle directory without any nested tree shape.
		const transcript = createAttachment({
			file_id: "bundle-transcript-mock",
			file_name: "transcript.md",
		})
		const audioFolder = createAttachment({
			file_id: "bundle-folder-mock",
			file_name: "mock-recording-folder",
			is_directory: true,
			display_config: { type: "audio" },
		})
		expect(
			shouldRenderAudioRecordingShareShell({
				projectMode: "audio",
				attachments: { tree: [], list: [audioFolder, transcript] },
			}),
		).toBe(true)
	})

	it("uses parsed magic.project.js metadata before falling back to audio directory display_config metadata", () => {
		const parsedConfig = buildShareRecordingMagicProjectConfig({
			magicProjectConfig: {
				name: "Parsed title",
				metadata: {
					title: "Parsed title",
					duration: 88,
					speakers: {
						"Speaker-1": "Host",
					},
				},
			},
			audioDisplayConfig: {
				name: "Fallback title",
				metadata: {
					title: "Fallback title",
					duration: 41,
					speakers: {
						"Speaker-1": "Fallback speaker",
					},
				},
			},
		})

		expect(parsedConfig?.metadata?.title).toBe("Parsed title")
		expect(parsedConfig?.metadata?.duration).toBe(88)
		expect(parsedConfig?.metadata?.speakers?.["Speaker-1"]).toBe("Host")
	})

	it("falls back to audio directory display_config metadata when magic.project.js is missing", () => {
		const fallbackConfig = buildShareRecordingMagicProjectConfig({
			magicProjectConfig: null,
			audioDisplayConfig: {
				name: "Fallback title",
				metadata: {
					title: "Fallback title",
					duration: 41,
					speakers: {
						"Speaker-1": "Fallback speaker",
					},
				},
				files: {
					audio: "mock.wav",
				},
			},
		})

		expect(fallbackConfig?.metadata?.title).toBe("Fallback title")
		expect(fallbackConfig?.metadata?.duration).toBe(41)
		expect(fallbackConfig?.files?.audio).toBe("mock.wav")
	})

	it("builds read-only share capabilities and only opens export when download permission is granted", () => {
		expect(buildShareRecordingCapabilities(true)).toMatchObject({
			viewMode: "share",
			canRename: false,
			canDelete: false,
			canMoveGroup: false,
			canGenerateSummary: false,
			canManageShare: false,
			canCopyToProject: false,
			canEditSpeakers: false,
			canExport: true,
		})
		expect(buildShareRecordingCapabilities(false).canExport).toBe(false)
	})

	it("resolves an explicitly selected audio folder through a nested shared entry", () => {
		const audioFolder = createAttachment({
			file_id: "audio-folder-mock",
			file_name: "mock-recording-folder",
			is_directory: true,
			parent_id: "project-root-mock",
			display_config: { type: "audio" },
		})
		const indexFile = createAttachment({
			file_id: "audio-index-mock",
			file_name: "index.html",
			file_extension: "html",
			parent_id: "audio-folder-mock",
			display_config: { type: "audio" },
		})
		audioFolder.children = [indexFile]

		expect(
			resolveAudioFolderShareTarget({
				tree: [audioFolder],
				defaultOpenFileId: "audio-index-mock",
			}),
		).toBe(indexFile)
	})

	it("does not auto-select an audio folder when the ordinary share has no target", () => {
		const audioFolder = createAttachment({
			file_id: "audio-folder-mock",
			file_name: "mock-recording-folder",
			is_directory: true,
			display_config: { type: "audio" },
		})

		expect(resolveAudioFolderShareTarget({ tree: [audioFolder] })).toBeUndefined()
	})
})
