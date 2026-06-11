import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import CitationCard from "../CitationCard"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, options?: Record<string, unknown>) =>
			key === "citations.sourceCount" ? `${options?.count ?? 0} sources` : key,
	}),
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: vi.fn(),
	},
	PubSubEvents: {
		Message_Suppress_Auto_Scroll: "message_suppress_auto_scroll",
	},
}))

describe("CitationCard", () => {
	beforeEach(() => {
		vi.restoreAllMocks()
	})

	it.each([
		"javascript:alert(1)",
		"data:text/html,<script>alert(1)</script>",
		"file:///etc/passwd",
	])("does not open unsafe url citation %s", (url) => {
		const open = vi.spyOn(window, "open").mockReturnValue(null)

		render(
			<CitationCard
				sources={[
					{
						index: 1,
						type: "url",
						title: "Unsafe source",
						url,
					},
				]}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "citations.openSource" }))

		expect(open).not.toHaveBeenCalled()
	})

	it("opens safe url citations with noopener and noreferrer", () => {
		const open = vi.spyOn(window, "open").mockReturnValue(null)

		render(
			<CitationCard
				sources={[
					{
						index: 1,
						type: "url",
						title: "Safe source",
						url: "https://example.com/source",
					},
				]}
			/>,
		)

		fireEvent.click(screen.getByRole("button", { name: "citations.openSource" }))

		expect(open).toHaveBeenCalledWith(
			"https://example.com/source",
			"_blank",
			"noopener,noreferrer",
		)
	})
})
