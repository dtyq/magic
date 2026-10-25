import type { ReactElement, ReactNode } from "react"
import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { UploadProgressToastContent } from "../UploadProgressToastContent"

vi.mock("@/components/base/MagicTooltip", () => {
	function MockMagicTooltip({ title, children }: { title?: ReactNode; children: ReactElement }) {
		return (
			<div>
				{children}
				{title ? (
					<div data-testid="recording-summary-upload-retry-tooltip">{title}</div>
				) : null}
			</div>
		)
	}

	return {
		MagicTooltip: MockMagicTooltip,
		default: MockMagicTooltip,
	}
})

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

describe("UploadProgressToastContent", () => {
	it("renders retry with a tooltip when upload can be retried", () => {
		const onRetry = vi.fn()

		render(
			<UploadProgressToastContent
				text="Uploading audio chunks..."
				showRetry
				onRetry={onRetry}
			/>,
		)

		expect(screen.getByTestId("recording-summary-upload-toast")).toHaveTextContent(
			"Uploading audio chunks...",
		)
		expect(screen.getByTestId("recording-summary-upload-retry-tooltip")).toHaveTextContent(
			"recordingSummary.message.retryUploadTooltip",
		)

		const retryButton = screen.getByTestId("recording-summary-upload-retry-button")
		expect(retryButton).toBeInTheDocument()

		fireEvent.click(retryButton)
		expect(onRetry).toHaveBeenCalledTimes(1)
	})

	it("hides retry when the upload stage does not allow it", () => {
		render(<UploadProgressToastContent text="Starting summary..." />)

		expect(
			screen.queryByTestId("recording-summary-upload-retry-button"),
		).not.toBeInTheDocument()
	})
})
