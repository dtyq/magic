import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MentionItemType } from "../../types"
import {
	MentionPanelRendererProvider,
	useMentionItemRenderer,
	useMentionItemRendererResolver,
} from "../context"

vi.mock("../../runtime/builtin/renderer", () => ({
	getBuiltinMentionItemRenderer: vi.fn(() => ({
		getTypeDescription: () => "builtin",
	})),
}))

function RendererConsumer() {
	const renderer = useMentionItemRenderer(MentionItemType.SKILL)

	return <span>{renderer.getTypeDescription ? "with-method" : "without-method"}</span>
}

function ResolverConsumer() {
	const getItemRenderer = useMentionItemRendererResolver()
	const renderer = getItemRenderer(MentionItemType.SKILL)

	return <span>{renderer.getTypeDescription ? "resolved" : "missing"}</span>
}

describe("MentionPanelRendererContext", () => {
	it("should fall back to builtin renderer resolver", () => {
		render(<RendererConsumer />)

		expect(screen.getByText("with-method")).toBeInTheDocument()
	})

	it("should use injected renderer resolver", () => {
		const getItemRenderer = vi.fn(() => ({}))

		render(
			<MentionPanelRendererProvider getItemRenderer={getItemRenderer}>
				<RendererConsumer />
			</MentionPanelRendererProvider>,
		)

		expect(getItemRenderer).toHaveBeenCalledWith(MentionItemType.SKILL)
		expect(screen.getByText("without-method")).toBeInTheDocument()
	})

	it("should expose the injected resolver to descendants", () => {
		const getItemRenderer = vi.fn(() => ({
			getTypeDescription: () => "custom",
		}))

		render(
			<MentionPanelRendererProvider getItemRenderer={getItemRenderer}>
				<ResolverConsumer />
			</MentionPanelRendererProvider>,
		)

		expect(getItemRenderer).toHaveBeenCalledWith(MentionItemType.SKILL)
		expect(screen.getByText("resolved")).toBeInTheDocument()
	})
})
