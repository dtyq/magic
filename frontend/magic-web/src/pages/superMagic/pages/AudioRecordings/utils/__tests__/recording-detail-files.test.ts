import { describe, expect, it } from "vitest"
import type { AttachmentItem } from "@/pages/superMagic/components/TopicFilesButton/hooks/types"
import {
	buildRecordingDetailFileMap,
	flattenRecordingAttachments,
	hasConfiguredRecordingFile,
} from "../recording-detail-files"
import type { MagicProjectConfig } from "../../types/recording-detail"

/** Builds a minimal attachment row so file-map tests stay focused on lookup behavior. */
function createAttachment(overrides: Partial<AttachmentItem> = {}): AttachmentItem {
	return {
		file_id: "file-mock-001",
		file_name: "mock-file.md",
		filename: "mock-file.md",
		file_extension: "md",
		is_directory: false,
		path: "/mock-file.md",
		children: [],
		...overrides,
	}
}

/** Builds a directory-like attachment node for tree flattening scenarios. */
function createFolder(
	name: string,
	children: AttachmentItem[],
	overrides: Partial<AttachmentItem> = {},
): AttachmentItem {
	return {
		file_id: `folder-${name}`,
		name,
		path: `/${name}`,
		is_directory: true,
		children,
		...overrides,
	}
}

/** Creates a stable config object that mirrors magic.project.js file mappings. */
function createMagicProjectConfig(files: Record<string, string>): MagicProjectConfig {
	return {
		version: "1.0.0",
		type: "audio",
		name: "Mock recording bundle",
		files,
	}
}

describe("recording detail files", () => {
	it("detects only non-empty file declarations from magic.project config", () => {
		expect(
			hasConfiguredRecordingFile(
				{
					summaryFiles: [],
					magicProjectConfig: { files: { notes: "notes/mock-notes.md" } },
				},
				"notes",
			),
		).toBe(true)
		expect(
			hasConfiguredRecordingFile(
				{
					summaryFiles: [],
					notes: createAttachment({ file_name: "fallback-notes.md" }),
					magicProjectConfig: { files: { notes: "   " } },
				},
				"notes",
			),
		).toBe(false)
		expect(
			hasConfiguredRecordingFile(
				{
					summaryFiles: [],
					notes: createAttachment({ file_name: "fallback-notes.md" }),
				},
				"notes",
			),
		).toBe(false)
	})

	it("flattens tree and list attachments without duplicating the same file", () => {
		const transcript = createAttachment({
			file_id: "file-transcript-001",
			file_name: "transcript.md",
			filename: "transcript.md",
			path: "/transcript.md",
		})
		const audio = createAttachment({
			file_id: "file-audio-001",
			file_name: "session.wav",
			filename: "session.wav",
			file_extension: "wav",
			path: "/session.wav",
		})

		const result = flattenRecordingAttachments(
			[createFolder("recording", [transcript, audio])],
			[transcript],
		)

		expect(result).toEqual([transcript, audio])
	})

	it("prefers configured files from magic.project.js and keeps summary tabs in stable order", () => {
		const files = [
			createAttachment({
				file_id: "file-audio-001",
				file_name: "audio/session.wav",
				filename: "session.wav",
				file_extension: "wav",
				path: "/audio/session.wav",
				relative_file_path: "audio/session.wav",
			}),
			createAttachment({
				file_id: "file-transcript-001",
				file_name: "transcript/full.md",
				filename: "full.md",
				path: "/transcript/full.md",
				relative_file_path: "transcript/full.md",
			}),
			createAttachment({
				file_id: "file-notes-001",
				file_name: "notes/live.md",
				filename: "live.md",
				path: "/notes/live.md",
				relative_file_path: "notes/live.md",
			}),
			createAttachment({
				file_id: "file-summary-001",
				file_name: "summary/meeting-summary.md",
				filename: "meeting-summary.md",
				path: "/summary/meeting-summary.md",
				relative_file_path: "summary/meeting-summary.md",
			}),
			createAttachment({
				file_id: "file-topics-001",
				file_name: "summary/topics.md",
				filename: "topics.md",
				path: "/summary/topics.md",
				relative_file_path: "summary/topics.md",
			}),
			createAttachment({
				file_id: "file-intent-001",
				file_name: "summary/intent.md",
				filename: "intent.md",
				path: "/summary/intent.md",
				relative_file_path: "summary/intent.md",
			}),
			createAttachment({
				file_id: "file-metrics-001",
				file_name: "summary/metrics.html",
				filename: "metrics.html",
				file_extension: "html",
				path: "/summary/metrics.html",
				relative_file_path: "summary/metrics.html",
			}),
			createAttachment({
				file_id: "file-custom-001",
				file_name: "summary/custom-view.md",
				filename: "custom-view.md",
				path: "/summary/custom-view.md",
				relative_file_path: "summary/custom-view.md",
			}),
			createAttachment({
				file_id: "file-project-001",
				file_name: "magic.project.js",
				filename: "magic.project.js",
				file_extension: "js",
				path: "/magic.project.js",
			}),
			createAttachment({
				file_id: "file-index-html-001",
				file_name: "index.html",
				filename: "index.html",
				file_extension: "html",
				path: "/index.html",
			}),
		]

		const result = buildRecordingDetailFileMap({
			tree: [createFolder("root", files)],
			list: [],
			magicProjectConfig: createMagicProjectConfig({
				audio: "audio/session.wav",
				transcript: "transcript/full.md",
				notes: "notes/live.md",
				summary: "summary/meeting-summary.md",
				topics: "summary/topics.md",
				intent: "summary/intent.md",
				metrics: "summary/metrics.html",
				custom_outline: "summary/custom-view.md",
			}),
		})

		expect(result.audio?.file_id).toBe("file-audio-001")
		expect(result.transcript?.file_id).toBe("file-transcript-001")
		expect(result.notes?.file_id).toBe("file-notes-001")
		expect(result.magicProject?.file_id).toBe("file-project-001")
		expect(result.indexHtml?.file_id).toBe("file-index-html-001")
		expect(result.summaryFiles.map((file) => file.type)).toEqual([
			"summary",
			"topics",
			"metrics",
			"intent",
			"custom_outline",
		])
		expect(result.summaryFiles[2]).toMatchObject({
			type: "metrics",
			fileName: "summary/metrics.html",
		})
		expect(result.summaryFiles[4]).toMatchObject({
			type: "custom_outline",
			fileName: "summary/custom-view.md",
		})
	})

	it("keeps configured summary tabs when their files have not arrived yet", () => {
		const result = buildRecordingDetailFileMap({
			tree: [],
			list: [],
			magicProjectConfig: createMagicProjectConfig({
				summary: "summary/meeting-summary.md",
				topics: "summary/topics.md",
			}),
		})

		expect(result.summaryFiles.map((file) => file.type)).toEqual(["summary", "topics"])
		expect(result.summaryFiles[0]?.file?.file_id).toBeUndefined()
		expect(result.summaryFiles[0]?.fileName).toBe("summary/meeting-summary.md")
	})

	it("removes summary tabs when magic.project.js removes their configured type", () => {
		const initial = buildRecordingDetailFileMap({
			tree: [],
			list: [],
			magicProjectConfig: createMagicProjectConfig({
				summary: "summary/meeting-summary.md",
				topics: "summary/topics.md",
			}),
		})
		const updated = buildRecordingDetailFileMap({
			tree: [],
			list: [],
			magicProjectConfig: createMagicProjectConfig({
				summary: "summary/meeting-summary.md",
			}),
		})

		expect(initial.summaryFiles.map((file) => file.type)).toEqual(["summary", "topics"])
		expect(updated.summaryFiles.map((file) => file.type)).toEqual(["summary"])
	})

	it("falls back to file hints when magic.project.js is absent or incomplete", () => {
		const files = [
			createAttachment({
				file_id: "file-audio-001",
				file_name: "raw-audio.m4a",
				filename: "raw-audio.m4a",
				file_extension: "m4a",
				path: "/raw-audio.m4a",
			}),
			createAttachment({
				file_id: "file-transcript-001",
				file_name: "recording-transcript.md",
				filename: "recording-transcript.md",
				path: "/recording-transcript.md",
			}),
			createAttachment({
				file_id: "file-notes-001",
				file_name: "stream-notes.md",
				filename: "stream-notes.md",
				path: "/stream-notes.md",
			}),
		]

		const result = buildRecordingDetailFileMap({
			tree: [],
			list: files,
			magicProjectConfig: undefined,
		})

		expect(result.audio?.file_id).toBe("file-audio-001")
		expect(result.transcript?.file_id).toBe("file-transcript-001")
		expect(result.notes?.file_id).toBe("file-notes-001")
		expect(result.summaryFiles).toEqual([])
	})

	it("identifies backend note files without confusing streaming transcripts", () => {
		const result = buildRecordingDetailFileMap({
			tree: [],
			list: [
				createAttachment({
					file_id: "file-stream-transcript-001",
					file_name: "流式识别.md",
					path: "/流式识别.md",
					type: "transcript",
				}),
				createAttachment({
					file_id: "file-backend-note-001",
					file_name: "recording-note.md",
					path: "/recording-note.md",
					file_type: "note",
				}),
			],
			magicProjectConfig: createMagicProjectConfig({}),
		})

		expect(result.transcript?.file_id).toBe("file-stream-transcript-001")
		expect(result.notes?.file_id).toBe("file-backend-note-001")
	})

	it("prefers the project audio file id and supports all imported audio extensions", () => {
		const preferredAudio = createAttachment({
			file_id: "preferred-audio",
			file_name: "uploaded.opus",
			filename: "uploaded.opus",
			file_extension: "opus",
		})
		const fallbackAudio = createAttachment({
			file_id: "fallback-audio",
			file_name: "uploaded.flac",
			filename: "uploaded.flac",
			file_extension: "flac",
		})

		const preferredResult = buildRecordingDetailFileMap({
			tree: [],
			list: [preferredAudio, fallbackAudio],
			preferredAudioFileId: "preferred-audio",
		})
		expect(preferredResult.audio?.file_id).toBe("preferred-audio")

		const fallbackResult = buildRecordingDetailFileMap({
			tree: [],
			list: [fallbackAudio],
		})
		expect(fallbackResult.audio?.file_id).toBe("fallback-audio")
	})

	it("limits configured lookups to the current audio bundle so sibling bundles cannot steal files", () => {
		const currentBundleFiles = [
			createAttachment({
				file_id: "current-project-config",
				file_name: "recording-a/magic.project.js",
				filename: "magic.project.js",
				file_extension: "js",
				path: "/recording-a/magic.project.js",
				relative_file_path: "recording-a/magic.project.js",
			}),
			createAttachment({
				file_id: "current-audio",
				file_name: "recording-a/session.wav",
				filename: "session.wav",
				file_extension: "wav",
				path: "/recording-a/session.wav",
				relative_file_path: "recording-a/session.wav",
			}),
			createAttachment({
				file_id: "current-transcript",
				file_name: "recording-a/transcript.md",
				filename: "transcript.md",
				path: "/recording-a/transcript.md",
				relative_file_path: "recording-a/transcript.md",
			}),
			createAttachment({
				file_id: "current-index-html",
				file_name: "recording-a/index.html",
				filename: "index.html",
				file_extension: "html",
				path: "/recording-a/index.html",
				relative_file_path: "recording-a/index.html",
			}),
		]
		const siblingBundleFiles = [
			createAttachment({
				file_id: "sibling-index-html",
				file_name: "recording-b/index.html",
				filename: "index.html",
				file_extension: "html",
				path: "/recording-b/index.html",
				relative_file_path: "recording-b/index.html",
			}),
			createAttachment({
				file_id: "sibling-audio",
				file_name: "recording-b/session.wav",
				filename: "session.wav",
				file_extension: "wav",
				path: "/recording-b/session.wav",
				relative_file_path: "recording-b/session.wav",
			}),
			createAttachment({
				file_id: "sibling-transcript",
				file_name: "recording-b/transcript.md",
				filename: "transcript.md",
				path: "/recording-b/transcript.md",
				relative_file_path: "recording-b/transcript.md",
			}),
		]

		const result = buildRecordingDetailFileMap({
			tree: [createFolder("root", [...currentBundleFiles, ...siblingBundleFiles])],
			list: [],
			magicProjectConfig: createMagicProjectConfig({
				audio: "session.wav",
				transcript: "transcript.md",
			}),
			bundleRootPath: "recording-a",
		})

		expect(result.magicProject?.file_id).toBe("current-project-config")
		expect(result.indexHtml?.file_id).toBe("current-index-html")
		expect(result.audio?.file_id).toBe("current-audio")
		expect(result.transcript?.file_id).toBe("current-transcript")
	})

	it("infers index.html from the magic.project.js bundle when explicit bundle root is absent", () => {
		const files = [
			createAttachment({
				file_id: "sibling-index-html",
				file_name: "recording-b/index.html",
				filename: "index.html",
				file_extension: "html",
				path: "/recording-b/index.html",
				relative_file_path: "recording-b/index.html",
			}),
			createAttachment({
				file_id: "current-project-config",
				file_name: "recording-a/magic.project.js",
				filename: "magic.project.js",
				file_extension: "js",
				path: "/recording-a/magic.project.js",
				relative_file_path: "recording-a/magic.project.js",
			}),
			createAttachment({
				file_id: "current-index-html",
				file_name: "recording-a/index.html",
				filename: "index.html",
				file_extension: "html",
				path: "/recording-a/index.html",
				relative_file_path: "recording-a/index.html",
			}),
		]

		const result = buildRecordingDetailFileMap({
			tree: [createFolder("root", files)],
			list: [],
		})

		expect(result.magicProject?.file_id).toBe("current-project-config")
		expect(result.indexHtml?.file_id).toBe("current-index-html")
	})

	it("does not select index.html when no bundle root can be determined", () => {
		const files = [
			createAttachment({
				file_id: "orphan-index-html",
				file_name: "recording-a/index.html",
				filename: "index.html",
				file_extension: "html",
				path: "/recording-a/index.html",
				relative_file_path: "recording-a/index.html",
			}),
		]

		const result = buildRecordingDetailFileMap({
			tree: [createFolder("root", files)],
			list: [],
		})

		expect(result.magicProject).toBeUndefined()
		expect(result.indexHtml).toBeUndefined()
	})
})
