import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MarkdownLink } from "../MarkdownLink"

vi.mock("@/stores/projectFiles", () => ({
	default: {
		workspaceFilesList: [],
	},
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: vi.fn(),
	},
	PubSubEvents: {},
}))

describe("MarkdownLink", () => {
	it("normalizes inline style attributes before passing them to the anchor", () => {
		render(
			<MarkdownLink
				href="https://example.com"
				domNode={{
					attribs: {
						style: "color: red; background-color: blue",
						"data-source": "markdown",
					},
				}}
			>
				测试链接
			</MarkdownLink>,
		)

		const anchor = screen.getByTestId("markdown-link-anchor")

		expect(anchor).toBeInTheDocument()
		expect(anchor.style.color).toBe("red")
		expect(anchor.style.getPropertyValue("background-color")).toBe("blue")
		expect(anchor).toHaveAttribute("data-source", "markdown")
	})

	it("allows long authorization urls to wrap instead of overflowing", () => {
		const longUrl =
			"https://login.dingtalk.com/oauth2/auth?client_id=dingmbw5n9ktkkbbjv3g&prompt=consent&redirect_uri=http%3A%2F%2F127.0.0.1%3A43631%2Fcallback&response_type=code&scope=openid"

		render(<MarkdownLink href={longUrl}>{longUrl}</MarkdownLink>)

		const anchor = screen.getByTestId("markdown-link-anchor")

		expect(anchor.className).toContain("break-all")
		expect(anchor.className).toContain("whitespace-normal")
		expect(anchor.className).not.toContain("whitespace-nowrap")
		expect(anchor.className).not.toContain("text-ellipsis")
	})
})
