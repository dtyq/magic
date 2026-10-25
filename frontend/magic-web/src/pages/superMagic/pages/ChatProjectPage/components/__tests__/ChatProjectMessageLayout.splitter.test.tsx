import { render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { DEFAULT_COMPOSER_MIN_INPUT_HEIGHT } from "@/pages/superMagic/components/ConversationInputResize/constants"

// test/setup.ts stubs antd globally; this test needs the real Splitter to see its usage warnings.
vi.mock("antd", async () => await vi.importActual("antd"))

vi.mock("@/pages/superMagic/components/ConversationInputResize/useConversationInputHeight", () => ({
	useConversationInputHeight: () => ({
		enabled: true,
		fillHeight: false,
		minHeight: DEFAULT_COMPOSER_MIN_INPUT_HEIGHT,
		maxHeight: 480,
		effectiveHeight: 200,
		queueListMaxHeight: 120,
		startPointerResize: vi.fn(),
		resizeByPointerDelta: vi.fn(),
		finishPointerResize: vi.fn(),
		restoreAutoHeight: vi.fn(),
	}),
}))

import ChatProjectMessageLayout from "../ChatProjectMessageLayout"

describe("ChatProjectMessageLayout with the real Splitter", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("does not trigger the antd controlled-size usage warning", () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined)

		render(
			<ChatProjectMessageLayout
				messageList={<div>messages</div>}
				input={<div>input</div>}
				isConversationPanelCollapsed={false}
			/>,
		)

		const splitterWarnings = consoleError.mock.calls.filter((args) =>
			args.some((arg) => typeof arg === "string" && arg.includes("Splitter")),
		)
		expect(splitterWarnings).toEqual([])
	})
})
