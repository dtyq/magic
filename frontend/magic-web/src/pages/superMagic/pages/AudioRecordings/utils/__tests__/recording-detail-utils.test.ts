import i18next from "i18next"
import { beforeAll, describe, expect, it, vi } from "vitest"
import { formatTime } from "@/utils/string"
import { parseMagicProjectConfig } from "../magic-project-config"
import { mergeProjectDetailIntoAudioItem } from "../project-detail-merge"
import { resolveRecordingDetailTitle } from "../recording-detail-title"
import {
	collectSpeakerIdsFromText,
	injectMarkdownSpeakerLinks,
	injectMarkdownTimeLinks,
} from "../markdownTimeLinks"
import { formatRecordingTime, parseRecordingTimeToSeconds } from "../time"
import { parseTopicsMarkdown } from "../topics-parser"
import { parseTranscriptMarkdown } from "../transcript-parser"

vi.mock("@/utils/string", () => ({
	// Keep fallback-title tests deterministic without loading the app theme store.
	formatTime: vi.fn((value: number | string, format?: string) => {
		if (format === "YYYY/MM/DD HH:mm") return "2026/06/24 15:24"
		return String(value)
	}),
}))

describe("recording detail utils", () => {
	beforeAll(async () => {
		// Seed the minimal namespace used by the shared fallback-title helper.
		await i18next.init({
			lng: "zh-CN",
			fallbackLng: "zh-CN",
			resources: {
				"zh-CN": {
					audioRecordings: {
						defaultName: "{{datetime}} 的录音",
					},
				},
			},
		})
	})

	it("parses magic.project.js config without executing callbacks", () => {
		const config = parseMagicProjectConfig(`
window.magicProjectConfig = {
  "version": "1.0.0",
  "type": "audio",
  "name": "Demo Recording",
  "files": {
    "audio": "demo.wav",
    "summary": "demo-summary.md"
  },
  "metadata": {
    "title": "Demo Recording",
    "duration": 42
  }
};

if (typeof window.magicProjectConfigure === 'function') {
  window.magicProjectConfigure(window.magicProjectConfig);
}
`)

		expect(config?.files?.audio).toBe("demo.wav")
		expect(config?.metadata?.duration).toBe(42)
	})

	it("parses legacy magic.project.js object literals with comments and trailing commas", () => {
		const config = parseMagicProjectConfig(`
// legacy audio bundle config
window.magicProjectConfig = {
  version: '1.0.0',
  type: 'audio',
  files: {
    audio: 'recording/session.wav',
    transcript: 'recording/transcript.md',
  },
  metadata: {
    title: 'Legacy Recording',
  },
};
window.magicProjectConfigure(window.magicProjectConfig);
`)

		expect(config?.type).toBe("audio")
		expect(config?.files?.audio).toBe("recording/session.wav")
		expect(config?.metadata?.title).toBe("Legacy Recording")
	})

	it("ignores fake config assignments that only appear inside comments", () => {
		const config = parseMagicProjectConfig(`
// window.magicProjectConfig = { type: "audio", files: { audio: "wrong.wav" } };
window.magicProjectConfig = {
  "type": "audio",
  "files": {
    "audio": "right.wav"
  }
};
`)

		expect(config?.files?.audio).toBe("right.wav")
	})

	it("parses completed transcript markdown into timeline segments", () => {
		const segments = parseTranscriptMarkdown(`
## Transcript

[00:00] Speaker-1: Hello there
[00:05] Speaker-2: Hi
`)

		expect(segments).toEqual([
			{ id: "0-0", start: 0, end: 5, speaker: "Speaker-1", text: "Hello there" },
			{ id: "1-5", start: 5, end: undefined, speaker: "Speaker-2", text: "Hi" },
		])
	})

	it("parses current and legacy multiline transcript headers together", () => {
		const segments = parseTranscriptMarkdown(`
## Transcript

[00:00] Speaker-1:
Opening line
with more context

**[00:05] Speaker-2:**
Legacy line

[00:10] Speaker-3: Inline line
`)

		expect(segments).toEqual([
			{
				id: "0-0",
				start: 0,
				end: 5,
				speaker: "Speaker-1",
				text: "Opening line\nwith more context",
			},
			{ id: "1-5", start: 5, end: 10, speaker: "Speaker-2", text: "Legacy line" },
			{
				id: "2-10",
				start: 10,
				end: undefined,
				speaker: "Speaker-3",
				text: "Inline line",
			},
		])
	})

	it("preserves transcript content that starts with a hash", () => {
		const segments = parseTranscriptMarkdown(`
## Transcript

[00:00] Speaker-1:
#1 priority
#topic remains part of the transcript
`)

		expect(segments).toEqual([
			{
				id: "0-0",
				start: 0,
				end: undefined,
				speaker: "Speaker-1",
				text: "#1 priority\n#topic remains part of the transcript",
			},
		])
	})

	it("preserves extended time, range, list, and localized speaker formats", () => {
		const segments = parseTranscriptMarkdown(`
## Transcript

- **[01:02:03] Guest Alpha：** First line
* [01:02:08]–[01:02:12] Speaker-2: Second line
`)

		expect(segments).toEqual([
			{
				id: "0-3723",
				start: 3723,
				end: 3728,
				speaker: "Guest Alpha",
				text: "First line",
			},
			{
				id: "1-3728",
				start: 3728,
				end: 3732,
				speaker: "Speaker-2",
				text: "Second line",
			},
		])
	})

	it("parses structured topics markdown into summary and time cards", () => {
		const topics = parseTopicsMarkdown(`
## Topics

### 📌 demo_topic | Demo Topic | #000000

#### Key Points
[Speaker-1, Speaker-2]
Important discussion.

#### Related Dialogue
- \`00:10-00:20\` Speaker-1, Speaker-2: Discussed the plan
`)

		expect(topics).toHaveLength(1)
		expect(topics[0]?.name).toBe("Demo Topic")
		expect(topics[0]?.color).toBe("#0d6efd")
		expect(topics[0]?.summarySpeakers).toEqual(["Speaker-1", "Speaker-2"])
		expect(topics[0]?.items[0]).toMatchObject({
			time: 10,
			timeEnd: 20,
			speakers: ["Speaker-1", "Speaker-2"],
			text: "Discussed the plan",
		})
	})

	it("uses the first preview color when the markdown header omits hex", () => {
		const topics = parseTopicsMarkdown(`
## Topics

### 📌 demo_topic | Demo Topic

#### Key Points
Summary body.

#### Related Dialogue
- \`00:10-00:20\` Speaker-1: Discussed the plan
`)

		expect(topics[0]?.color).toBe("#0d6efd")
	})

	it("cycles preview colors by chapter order and ignores markdown hex", () => {
		const blocks = Array.from({ length: 7 }, (_, index) => {
			const start = String(index).padStart(2, "0")
			const end = String(index + 1).padStart(2, "0")
			return `
### 📌 topic_${index + 1} | Topic ${index + 1} | #e0e0e0

#### Key Points
Summary body.

#### Related Dialogue
- \`${start}:10-${end}:20\` Speaker-1: Discussed the plan
`
		}).join("\n---\n")

		const topics = parseTopicsMarkdown(`## Topics\n${blocks}`)

		expect(topics.map((topic) => topic.color)).toEqual([
			"#0d6efd",
			"#198754",
			"#ffc107",
			"#dc3545",
			"#0dcaf0",
			"#6f42c1",
			"#0d6efd",
		])
	})

	it("preserves existing magic-time links without leaking raw href text", () => {
		const markdown = `—— Speaker-1 [00:05](magic-time://5)\n—— Speaker-1 00:10 (magic-time://10)\n—— Speaker-1 \`[00:15](magic-time://15)\``

		expect(injectMarkdownTimeLinks(markdown)).toContain("[00:05](magic-time://5)")
		expect(injectMarkdownTimeLinks(markdown)).toContain("[00:10](magic-time://10)")
		expect(injectMarkdownTimeLinks(markdown)).toContain("[00:15](magic-time://15)")
		expect(injectMarkdownTimeLinks(markdown)).not.toContain("(magic-time://5)(magic-time://5)")
		expect(injectMarkdownTimeLinks(markdown)).not.toContain("`[00:15](magic-time://15)`")
	})

	it("normalizes triple-slash magic-time links generated by highlight files", () => {
		const markdown = "—— Speaker-1 `[00:05](magic-time:///5)`"

		expect(injectMarkdownTimeLinks(markdown)).toContain("[00:05](magic-time://5)")
		expect(injectMarkdownTimeLinks(markdown)).not.toContain("`[00:05](magic-time:///5)`")
	})

	it("normalizes escaped magic-time links inside inline code", () => {
		const markdown = "—— Speaker-1 `\\Written-1\\`"

		expect(injectMarkdownTimeLinks(markdown)).not.toContain("magic-time:///5")
	})

	it("turns speaker ids into internal speaker links with shared display names", () => {
		const markdown = `[Speaker-1, Speaker-2]\nSpeaker-1 opens.`

		expect(injectMarkdownSpeakerLinks(markdown, { "Speaker-1": "Host" })).toContain(
			"[Host](magic-speaker://Speaker-1)",
		)
		expect(injectMarkdownSpeakerLinks(markdown, {})).toContain(
			"[Speaker-2](magic-speaker://Speaker-2)",
		)
		expect(collectSpeakerIdsFromText(markdown)).toEqual(["Speaker-1", "Speaker-2"])
	})

	it("does not leak preserved placeholders when legacy markdown injectors are chained", () => {
		const markdown = "—— **Speaker-1** `00:22`"
		const result = injectMarkdownSpeakerLinks(injectMarkdownTimeLinks(markdown), {
			"Speaker-1": "Narrator",
		})

		expect(result).not.toContain("MAGIC_PRESERVED_FRAGMENT")
		expect(result).toContain("[Narrator](magic-speaker://Speaker-1)")
		expect(result).toContain("[00:22](magic-time://22)")
	})

	it("parses recording time text into seconds for both minute and hour formats", () => {
		expect(parseRecordingTimeToSeconds("05:12")).toBe(312)
		expect(parseRecordingTimeToSeconds("1:05:12")).toBe(3912)
		expect(parseRecordingTimeToSeconds("invalid")).toBe(0)
	})

	it("formats compact playback labels for short and long recordings", () => {
		expect(formatRecordingTime(0)).toBe("00:00")
		expect(formatRecordingTime(312)).toBe("05:12")
		expect(formatRecordingTime(3912)).toBe("01:05:12")
	})

	it("prefers project-level titles over bundle metadata titles", () => {
		expect(
			resolveRecordingDetailTitle({
				projectName: "Project title",
				initialTitle: "Route title",
				magicProjectConfig: {
					name: "Bundle name",
					metadata: { title: "Bundle metadata title" },
				},
			}),
		).toBe("Project title")
	})

	it("does not fall back to magic.project.js titles when project-level names are absent", () => {
		expect(
			resolveRecordingDetailTitle({
				projectName: "",
				createdAt: 0,
				initialTitle: "",
				magicProjectConfig: {
					name: "Bundle name",
					metadata: { title: "Bundle metadata title" },
				},
			}),
		).toBe("")
	})

	it("falls back to the same created-at title used by the recordings list", () => {
		const createdAt = 1710000000

		expect(
			resolveRecordingDetailTitle({
				projectName: "",
				createdAt,
				initialTitle: "Temporary route title",
			}),
		).toBe(
			i18next.t("defaultName", {
				ns: "audioRecordings",
				datetime: formatTime(createdAt, "YYYY/MM/DD HH:mm"),
			}),
		)
	})

	it("does not use route title as a fallback before canonical project detail arrives", () => {
		expect(
			resolveRecordingDetailTitle({
				projectName: "",
				createdAt: 0,
				initialTitle: "Temporary route title",
			}),
		).toBe("")

		expect(
			resolveRecordingDetailTitle({
				projectName: "Canonical detail title",
				createdAt: 1710000000,
				initialTitle: "Temporary route title",
			}),
		).toBe("Canonical detail title")
	})

	it("prefers project detail metadata over audio list metadata when both exist", () => {
		expect(
			mergeProjectDetailIntoAudioItem(
				{
					id: "project-001",
					project_name: "Stale audio list title",
					created_at: 1710000000,
					duration: 30,
					tags: [],
					device_id: "",
					audio_source: "recorded",
					current_phase: "merging",
					phase_status: "completed",
					card_status: "not_summarized",
					is_summarized: false,
					workspace_id: "workspace-a",
					workspace_name: "Workspace A",
				},
				{
					id: "project-001",
					project_name: "Canonical detail title",
					project_status: "idle" as never,
					project_mode: "" as never,
					workspace_id: "workspace-b",
					work_dir: "",
					workspace_name: "Workspace B",
					current_topic_id: "",
					current_topic_status: "ready",
					created_at: "1710000000",
					updated_at: "1710000001",
					tag: "",
				},
			),
		).toMatchObject({
			project_name: "Canonical detail title",
			workspace_id: "workspace-b",
			workspace_name: "Workspace B",
			current_topic_status: "ready",
		})
	})
})
