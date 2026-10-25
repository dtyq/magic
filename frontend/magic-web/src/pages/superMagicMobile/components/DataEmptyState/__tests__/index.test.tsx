import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { DataEmptyState } from "../index"

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => {
			if (key === "mobile.emptyState.variants.chat.title") return "暂无对话"
			if (key === "mobile.emptyState.variants.chat.description") {
				return "点击右上角按钮新建对话即可开始。"
			}
			if (key === "mobile.emptyState.variants.recording.title") return "还没有录音"
			if (key === "mobile.emptyState.variants.recording.description") {
				return "点击底部录音按钮开始录音，或导入音频文件。"
			}
			return key
		},
	}),
}))

describe("DataEmptyState", () => {
	it("renders title and description for the selected variant", () => {
		render(<DataEmptyState variant="chat" />)

		expect(screen.getByRole("status")).toHaveTextContent("暂无对话")
		expect(screen.getByRole("status")).toHaveTextContent("点击右上角按钮新建对话即可开始。")
	})

	// Ensure the recording empty state describes the actual bottom recording action.
	it("renders the recording empty state copy", () => {
		render(<DataEmptyState variant="recording" />)

		expect(screen.getByRole("status")).toHaveTextContent("还没有录音")
		expect(screen.getByRole("status")).toHaveTextContent(
			"点击底部录音按钮开始录音，或导入音频文件。",
		)
	})

	it("uses variant-based test id by default", () => {
		render(<DataEmptyState variant="chat" />)

		expect(screen.getByTestId("mobile-data-empty-state-chat")).toBeInTheDocument()
	})

	it("allows a custom test id override", () => {
		render(<DataEmptyState variant="search" testId="custom-empty" />)

		expect(screen.getByTestId("custom-empty")).toBeInTheDocument()
	})
})
