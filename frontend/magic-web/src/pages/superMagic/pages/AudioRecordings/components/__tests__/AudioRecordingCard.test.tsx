import { describe, expect, it, vi } from "vitest"
import { fireEvent, render, screen } from "@testing-library/react"
import AudioRecordingCard from "../AudioRecordingCard"
import type { AudioProjectListItem } from "@/types/audioProject"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) => {
			if (key === "card.moreTags") return `+${options?.count}`
			const labels: Record<string, string> = {
				"card.sourceRecorded": "Phone mic",
				"card.sourceImported": "Imported audio",
				"card.sourceDevice": "Device recording",
				"card.summarized": "Summarized",
				"card.summarizing": "Summarizing now",
				"card.notSummarized": "Not summarized",
				"card.summarize": "Summarize",
				"card.generateSummary": "Generate summary",
				"card.retrySummary": "Retry summary",
				"card.collapseTags": "Collapse",
				"card.rename": "Rename",
				"card.delete": "Delete",
			}
			return labels[key] ?? key
		},
	}),
}))

vi.mock("@/utils/string", () => ({
	formatTime: (time: number, format?: string) => {
		if (format === "YYYY/MM/DD HH:mm") return "2026/06/06 11:05"
		return "Apr 10 09:15"
	},
}))

vi.mock("i18next", () => ({
	default: {
		t: (key: string, options?: { datetime?: string }) => {
			if (key === "defaultName") return `${options?.datetime} 的录音`
			return key
		},
	},
}))

function createItem(overrides: Partial<AudioProjectListItem> = {}): AudioProjectListItem {
	return {
		id: "project-1",
		project_name: "Weekly sync",
		card_status: "summarized",
		is_summarized: true,
		created_at: 1710000000,
		duration: 754,
		tags: ["Team", "Review", "Extra"],
		device_id: "Redmi K70 Ultra",
		audio_source: "recorded",
		current_phase: "summarizing",
		phase_status: "completed",
		...overrides,
	}
}

describe("AudioRecordingCard", () => {
	it("opens detail when recording is summarized", () => {
		const onOpen = vi.fn()
		render(<AudioRecordingCard item={createItem()} onOpen={onOpen} />)

		fireEvent.click(screen.getByTestId("audio-recording-card-project-1"))
		expect(onOpen).toHaveBeenCalledTimes(1)
		expect(
			screen.getByTestId("audio-recording-card-project-1-status-summarized"),
		).toBeInTheDocument()
	})

	it("shows generate summary button for merging completed items", () => {
		const onOpen = vi.fn()
		const onSummarize = vi.fn()
		render(
			<AudioRecordingCard
				item={createItem({
					card_status: "not_summarized",
					is_summarized: false,
					current_phase: "merging",
					phase_status: "completed",
				})}
				onOpen={onOpen}
				onSummarize={onSummarize}
			/>,
		)

		const button = screen.getByTestId("audio-recording-card-project-1-summary-button")
		expect(button).toHaveTextContent("Summarize")

		fireEvent.click(button)
		expect(onSummarize).toHaveBeenCalledTimes(1)
		expect(onOpen).not.toHaveBeenCalled()
	})

	it("shows summarizing spinner while summary is in progress", () => {
		const onOpen = vi.fn()
		render(
			<AudioRecordingCard
				item={createItem({
					card_status: "summarizing",
					is_summarized: false,
					current_phase: "summarizing",
					phase_status: "in_progress",
					project_status: "",
				})}
				onOpen={onOpen}
			/>,
		)

		fireEvent.click(screen.getByTestId("audio-recording-card-project-1"))
		expect(onOpen).not.toHaveBeenCalled()
		expect(
			screen.getByTestId("audio-recording-card-project-1-status-summarizing"),
		).toHaveTextContent("Summarizing now")
		expect(
			screen.queryByTestId("audio-recording-card-project-1-summary-button"),
		).not.toBeInTheDocument()
	})

	it("shows retry summary button when summarizing failed", () => {
		const onSummarize = vi.fn()
		render(
			<AudioRecordingCard
				item={createItem({
					card_status: "summarizing",
					is_summarized: false,
					current_phase: "summarizing",
					phase_status: "failed",
					project_status: "",
				})}
				onSummarize={onSummarize}
			/>,
		)

		const button = screen.getByTestId("audio-recording-card-project-1-summary-button")
		expect(button).toHaveTextContent("Retry summary")
		fireEvent.click(button)
		expect(onSummarize).toHaveBeenCalledTimes(1)
	})

	it("shows device id as source label", () => {
		render(
			<AudioRecordingCard
				item={createItem({
					device_id: "Redmi K70 Ultra",
					card_status: "not_summarized",
					is_summarized: false,
				})}
			/>,
		)

		expect(screen.getByTestId("audio-recording-card-project-1-source")).toHaveTextContent(
			"Redmi K70 Ultra",
		)
	})

	it("keeps tags on the same row as source badges inside meta row", () => {
		render(<AudioRecordingCard item={createItem()} />)

		const metaRow = screen.getByTestId("audio-recording-card-project-1-meta-row")
		const tagsRow = screen.getByTestId("audio-recording-card-project-1-tags")

		expect(metaRow).toContainElement(tagsRow)
		expect(metaRow).toContainElement(
			screen.getByTestId("audio-recording-card-project-1-source-row"),
		)
		expect(metaRow).toHaveClass("overflow-x-auto")
		expect(tagsRow).toHaveTextContent("Team")
	})

	it("shows end fade when meta row content overflows", () => {
		const elementProto = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "scrollWidth")
		const clientProto = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth")

		Object.defineProperty(HTMLElement.prototype, "scrollWidth", {
			configurable: true,
			get() {
				return 480
			},
		})
		Object.defineProperty(HTMLElement.prototype, "clientWidth", {
			configurable: true,
			get() {
				return 200
			},
		})

		render(
			<AudioRecordingCard
				item={createItem({
					tags: ["录音时长异常", "单方语音交互", "变更风险提示", "版本管理预留"],
				})}
			/>,
		)

		expect(
			screen.getByTestId("audio-recording-card-project-1-meta-fade-end"),
		).toBeInTheDocument()

		if (elementProto) Object.defineProperty(HTMLElement.prototype, "scrollWidth", elementProto)
		if (clientProto) Object.defineProperty(HTMLElement.prototype, "clientWidth", clientProto)
	})

	it("keeps summarized badge on the same row as the device source", () => {
		render(<AudioRecordingCard item={createItem()} />)

		const sourceRow = screen.getByTestId("audio-recording-card-project-1-source-row")
		expect(sourceRow).toContainElement(
			screen.getByTestId("audio-recording-card-project-1-source"),
		)
		expect(sourceRow).toContainElement(
			screen.getByTestId("audio-recording-card-project-1-status-summarized"),
		)
		expect(
			screen.getByTestId("audio-recording-card-project-1-status-summarized"),
		).toHaveTextContent("Summarized")
	})

	it("expands hidden tags when the more-tags control is clicked", () => {
		render(<AudioRecordingCard item={createItem()} />)

		expect(screen.getByText("Team")).toBeInTheDocument()
		expect(screen.getByText("Review")).toBeInTheDocument()
		expect(screen.queryByText("Extra")).not.toBeInTheDocument()

		fireEvent.click(screen.getByTestId("audio-recording-card-project-1-tags-expand"))

		expect(screen.getByText("Extra")).toBeInTheDocument()
		expect(
			screen.getByTestId("audio-recording-card-project-1-tags-collapse"),
		).toBeInTheDocument()
	})

	it("renders duration in metadata row", () => {
		render(<AudioRecordingCard item={createItem({ duration: 754 })} />)

		expect(screen.getByTestId("audio-recording-card-project-1-duration")).toHaveTextContent(
			"12:34",
		)
	})

	it("renders the more-actions menu trigger", () => {
		render(<AudioRecordingCard item={createItem()} onRename={vi.fn()} onDelete={vi.fn()} />)

		expect(
			screen.getByTestId("audio-recording-card-project-1-more-actions"),
		).toBeInTheDocument()
	})

	it("shows created_at fallback title when project name is empty", () => {
		render(<AudioRecordingCard item={createItem({ project_name: "" })} />)

		expect(screen.getByRole("heading", { level: 3 })).toHaveTextContent(
			"2026/06/06 11:05 的录音",
		)
	})
})
