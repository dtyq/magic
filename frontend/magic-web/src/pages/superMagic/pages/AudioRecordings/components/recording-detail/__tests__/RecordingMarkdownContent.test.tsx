import { describe, expect, it, vi } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { RecordingMarkdownContent } from "../RecordingMarkdownContent"
import { RECORDING_TIME_CHIP_CLASS } from "../recording-markdown-components"
import { resolveSingleImageUrl } from "@/pages/superMagic/utils/image-url-resolver"

vi.mock("@/pages/superMagic/utils/image-url-resolver", () => ({
	resolveSingleImageUrl: vi.fn(async (path: string) => `https://tos.invalid/${path}`),
}))

describe("RecordingMarkdownContent", () => {
	it("mounts recording-md-prose with desktop modifier by default", () => {
		const { container } = render(
			<RecordingMarkdownContent
				content={"## Section\n\n> Quote line\n\n| A | B |\n| - | - |"}
			/>,
		)

		const root = screen.getByTestId("recording-detail-markdown-content")
		expect(root).toHaveClass("recording-md-prose")
		expect(root).toHaveClass("recording-md-prose--desktop")
		expect(root).toHaveAttribute("data-layout", "desktop")
		expect(container.querySelector("h2")).toBeInTheDocument()
		expect(container.querySelector("blockquote")).toBeInTheDocument()
		expect(container.querySelector(".recording-md-table-wrap table")).toBeInTheDocument()
	})

	it("switches to mobile modifier when layout is mobile", () => {
		render(
			<RecordingMarkdownContent
				content={"| Col A | Col B |\n| --- | --- |\n| 1 | 2 |"}
				layout="mobile"
			/>,
		)

		const root = screen.getByTestId("recording-detail-markdown-content")
		expect(root).toHaveClass("recording-md-prose--mobile")
		expect(root).toHaveAttribute("data-layout", "mobile")
		expect(root.querySelector(".recording-md-table-wrap table")).toBeInTheDocument()
	})

	it("resolves project-relative images before rendering", async () => {
		render(
			<RecordingMarkdownContent
				content="![mock image](./images/mock-photo.png)"
				layout="mobile"
				attachments={[
					{
						file_id: "mock-image-file-id",
						file_name: "mock-photo.png",
						relative_file_path: "./images/mock-photo.png",
					},
				]}
				relativeFilePath="./notes/mock-note.md"
			/>,
		)

		await act(async () => {
			await vi.waitFor(() => {
				expect(resolveSingleImageUrl).toHaveBeenCalledWith(
					"./images/mock-photo.png",
					expect.any(Array),
					"./notes/mock-note.md",
				)
			})
		})
		expect(screen.getByAltText("mock image")).toBeInTheDocument()
	})

	it("renders time links as clickable chips instead of solid pills", () => {
		render(
			<RecordingMarkdownContent
				content="Jump to 01:23 for context."
				onTimeClick={() => undefined}
			/>,
		)

		const timeChip = screen.getByTestId("recording-detail-time-link")
		expect(timeChip.tagName).toBe("BUTTON")
		expect(timeChip).toHaveClass(RECORDING_TIME_CHIP_CLASS)
		expect(timeChip).not.toHaveClass("bg-foreground")
	})

	it("assigns different speaker palette classes per Speaker-N id", () => {
		render(
			<RecordingMarkdownContent
				content="Speaker-1 and Speaker-2 discussed the topic."
				onSpeakerClick={() => undefined}
			/>,
		)

		const speakerLinks = screen.getAllByTestId("recording-detail-speaker-link")
		expect(speakerLinks).toHaveLength(2)
		expect(speakerLinks[0]).toHaveAttribute("data-speaker-id", "Speaker-1")
		expect(speakerLinks[1]).toHaveAttribute("data-speaker-id", "Speaker-2")
		expect(speakerLinks[0].className).not.toEqual(speakerLinks[1].className)
		expect(speakerLinks[0].className).toMatch(/blue/)
		expect(speakerLinks[1].className).toMatch(/orange/)
	})

	it("keeps speaker chips intact inside mobile headings", () => {
		// Verify heading content still renders a single interactive chip with the edited label.
		render(
			<RecordingMarkdownContent
				content="### 项目负责人（Speaker-1）——战略决策与资源统筹者"
				layout="mobile"
				speakerNameMap={{ "Speaker-1": "朗读者" }}
				onSpeakerClick={() => undefined}
			/>,
		)

		const heading = screen.getByRole("heading", { level: 3 })
		const speakerChip = within(heading).getByTestId("recording-detail-speaker-link")

		expect(speakerChip).toHaveAttribute("data-speaker-id", "Speaker-1")
		expect(speakerChip).toHaveTextContent("朗读者")
		expect(speakerChip).toHaveClass("recording-speaker-chip")
	})

	it("truncates long speaker labels while preserving the full tooltip value", () => {
		// Verify long edited names remain available through the button title while the label can ellipsize in CSS.
		render(
			<RecordingMarkdownContent
				content="### 负责人（Speaker-1）"
				speakerNameMap={{ "Speaker-1": "这是一个非常长的讲述人名称示例" }}
				onSpeakerClick={() => undefined}
			/>,
		)

		const speakerChip = screen.getByTestId("recording-detail-speaker-link")
		expect(speakerChip).toHaveAttribute("title", "这是一个非常长的讲述人名称示例")
		expect(speakerChip.querySelector(".recording-speaker-chip-label")).toHaveTextContent(
			"这是一个非常长的讲述人名称示例",
		)
	})

	it("renders code-wrapped speaker ids as clickable speaker chips", () => {
		const onSpeakerClick = vi.fn()

		render(
			<RecordingMarkdownContent
				content="`Speaker-2` shared the core argument."
				onSpeakerClick={onSpeakerClick}
			/>,
		)

		const speakerChip = screen.getByTestId("recording-detail-speaker-link")
		expect(speakerChip.tagName).toBe("BUTTON")
		expect(speakerChip).toHaveAttribute("data-speaker-id", "Speaker-2")

		fireEvent.click(speakerChip)
		expect(onSpeakerClick).toHaveBeenCalledWith("Speaker-2")
	})

	it("renders code-wrapped speaker groups as clickable speaker chips", () => {
		const onSpeakerClick = vi.fn()

		render(
			<RecordingMarkdownContent
				content="`[Speaker-1, Speaker-2]` summarized the discussion."
				onSpeakerClick={onSpeakerClick}
			/>,
		)

		const speakerChips = screen.getAllByTestId("recording-detail-speaker-link")
		expect(speakerChips).toHaveLength(2)
		expect(speakerChips[0]).toHaveAttribute("data-speaker-id", "Speaker-1")
		expect(speakerChips[1]).toHaveAttribute("data-speaker-id", "Speaker-2")

		fireEvent.click(speakerChips[1] as HTMLElement)
		expect(onSpeakerClick).toHaveBeenCalledWith("Speaker-2")
	})

	it("renders quote attribution speaker and code-wrapped time without leaking placeholders", () => {
		const onTimeClick = vi.fn()
		const onSpeakerClick = vi.fn()

		const { container } = render(
			<RecordingMarkdownContent
				content={"—— **Speaker-1** `00:22`"}
				speakerNameMap={{ "Speaker-1": "Narrator" }}
				onTimeClick={onTimeClick}
				onSpeakerClick={onSpeakerClick}
			/>,
		)

		expect(container.textContent).not.toContain("MAGIC_PRESERVED_FRAGMENT")
		expect(screen.getByTestId("recording-detail-speaker-link")).toHaveAttribute(
			"data-speaker-id",
			"Speaker-1",
		)
		expect(screen.getByText("00:22")).toHaveClass(RECORDING_TIME_CHIP_CLASS)

		fireEvent.click(screen.getByText("Narrator"))
		expect(onSpeakerClick).toHaveBeenCalledWith("Speaker-1")

		fireEvent.click(screen.getByText("00:22"))
		expect(onTimeClick).toHaveBeenCalledWith(22)
	})

	it("renders escaped code-wrapped magic-time links as clickable time chips", () => {
		const onTimeClick = vi.fn()

		render(
			<RecordingMarkdownContent
				content={"—— Speaker-1 `\\[00:05\\]\\(magic-time:///5\\)`"}
				onTimeClick={onTimeClick}
			/>,
		)

		const timeChip = screen.getByText("00:05")
		expect(timeChip).toHaveClass(RECORDING_TIME_CHIP_CLASS)

		fireEvent.click(timeChip)
		expect(onTimeClick).toHaveBeenCalledWith(5)
	})

	it("does not inject recording chips inside external links, fenced code, or raw html", () => {
		const { container } = render(
			<RecordingMarkdownContent
				content={[
					"[Speaker-1 00:22](https://example.invalid)",
					"",
					"```",
					"Speaker-2 00:33",
					"```",
					"",
					"<span>Speaker-3</span>",
				].join("\n")}
				onSpeakerClick={() => undefined}
				onTimeClick={() => undefined}
			/>,
		)

		expect(screen.getByRole("link", { name: "Speaker-1 00:22" })).toHaveAttribute(
			"href",
			"https://example.invalid",
		)
		expect(container.querySelector("pre code")).toHaveTextContent("Speaker-2 00:33")
		expect(container.querySelector("span")).toHaveTextContent("Speaker-3")
		expect(screen.queryByTestId("recording-detail-speaker-link")).not.toBeInTheDocument()
		expect(screen.queryByTestId("recording-detail-time-link")).not.toBeInTheDocument()
	})

	it("forwards time and speaker click handlers", () => {
		const onTimeClick = vi.fn()
		const onSpeakerClick = vi.fn()

		render(
			<RecordingMarkdownContent
				content="At 02:00 Speaker-1 shared an update."
				onTimeClick={onTimeClick}
				onSpeakerClick={onSpeakerClick}
			/>,
		)

		fireEvent.click(screen.getByTestId("recording-detail-time-link"))
		expect(onTimeClick).toHaveBeenCalledWith(120)

		fireEvent.click(screen.getByTestId("recording-detail-speaker-link"))
		expect(onSpeakerClick).toHaveBeenCalledWith("Speaker-1")
	})

	it("keeps time chip clickable after many parent rerenders with unstable callbacks", () => {
		const onTimeClick = vi.fn()
		const { rerender } = render(
			<RecordingMarkdownContent
				content="Jump to 01:23 for context."
				onTimeClick={onTimeClick}
			/>,
		)

		for (let index = 0; index < 24; index += 1) {
			rerender(
				<RecordingMarkdownContent
					content="Jump to 01:23 for context."
					onTimeClick={() => onTimeClick(83)}
				/>,
			)
		}

		fireEvent.click(screen.getByTestId("recording-detail-time-link"))
		expect(onTimeClick).toHaveBeenCalledWith(83)
	})

	it("wraps markdown tables with a horizontal scroll container", () => {
		const { container } = render(
			<RecordingMarkdownContent content={"| Col A | Col B |\n| --- | --- |\n| 1 | 2 |"} />,
		)

		const tableWrap = container.querySelector(".recording-md-table-wrap")
		expect(tableWrap).toBeInTheDocument()
		expect(within(tableWrap as HTMLElement).getByRole("table")).toBeInTheDocument()
		expect(tableWrap?.querySelectorAll("th > .recording-md-cell-content")).toHaveLength(2)
		expect(tableWrap?.querySelectorAll("td > .recording-md-cell-content")).toHaveLength(2)
	})

	it("renders inline br tags as line breaks instead of literal text", () => {
		const { container } = render(
			<RecordingMarkdownContent content={"English quote line <br>（中文翻译行）"} />,
		)

		expect(container.querySelector("br")).toBeInTheDocument()
		expect(container.textContent).not.toContain("<br>")
	})

	it("renders mark tags for inline highlights", () => {
		const { container } = render(
			<RecordingMarkdownContent content={"This is <mark>highlighted</mark> text."} />,
		)

		expect(container.querySelector("mark")).toBeInTheDocument()
		expect(container.querySelector("mark")).toHaveTextContent("highlighted")
	})

	it("strips dangerous html such as script tags", () => {
		const { container } = render(
			<RecordingMarkdownContent content={'<script>alert("xss")</script>Safe text'} />,
		)

		expect(container.querySelector("script")).not.toBeInTheDocument()
		expect(container.textContent).toContain("Safe text")
	})

	it("strips img onerror handlers from inline html", () => {
		const { container } = render(
			<RecordingMarkdownContent content={'<img src="x" onerror="alert(1)" />Visible text'} />,
		)

		const img = container.querySelector("img")
		expect(img).toBeInTheDocument()
		expect(img).not.toHaveAttribute("onerror")
		expect(container.textContent).toContain("Visible text")
	})
})
