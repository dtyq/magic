import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { CopyableCode } from "@magic-admin-v2/features/platform-slides-template/components/copyable-code"

const { clipboardWriteText, toastError, toastSuccess } = vi.hoisted(() => ({
	clipboardWriteText: vi.fn(),
	toastError: vi.fn(),
	toastSuccess: vi.fn(),
}))

vi.mock("@magic-admin-v2/utils/clipboard-helpers", () => ({
	clipboard: { writeText: clipboardWriteText },
}))

vi.mock("sonner", () => ({
	toast: { error: toastError, success: toastSuccess },
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}))

afterEach(() => {
	vi.clearAllMocks()
})

describe("copyable code", () => {
	it("copies the code through the shared copy contract and reports success", async () => {
		clipboardWriteText.mockResolvedValue(undefined)
		render(<CopyableCode value="template-code" />)

		fireEvent.click(screen.getByRole("button", { name: "common.action.copy" }))

		await waitFor(() => expect(clipboardWriteText).toHaveBeenCalledWith("template-code"))
		expect(toastSuccess).toHaveBeenCalledWith("common.message.copySuccess")
	})

	it("reports clipboard failures without changing the rendered value", async () => {
		clipboardWriteText.mockRejectedValue(new Error("clipboard unavailable"))
		render(<CopyableCode value="template-code" />)

		fireEvent.click(screen.getByRole("button", { name: "common.action.copy" }))

		await waitFor(() => expect(toastError).toHaveBeenCalledWith("common.message.copyFailed"))
		expect(screen.getByText("template-code")).toBeInTheDocument()
	})

	it("renders the shared empty value state without a copy button", () => {
		render(<CopyableCode value="" />)

		expect(screen.queryByRole("button", { name: "common.action.copy" })).not.toBeInTheDocument()
		expect(screen.getByText("common.emptyValue")).toBeInTheDocument()
	})
})
