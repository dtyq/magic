import type { ReactNode } from "react"
import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { SummaryMessageService, SummaryStage } from "../SummaryMessageService"

const loadingMock = vi.fn()

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		loading: (...args: unknown[]) => loadingMock(...args),
		success: vi.fn(),
		error: vi.fn(),
		destroy: vi.fn(),
	},
}))

vi.mock("i18next", () => ({
	default: {
		t: (key: string) => key,
	},
}))

vi.mock("../UploadProgressToastContent", () => ({
	UploadProgressToastContent: ({
		text,
		showRetry,
		onRetry,
	}: {
		text: string
		showRetry?: boolean
		onRetry?: () => void
	}) => (
		<div>
			<span>{text}</span>
			{showRetry ? (
				<button
					type="button"
					data-testid="recording-summary-upload-retry-button"
					onClick={onRetry}
				>
					Retry
				</button>
			) : null}
		</div>
	),
}))

function renderLatestLoadingContent() {
	const options = loadingMock.mock.calls.at(-1)?.[0] as { content?: ReactNode }
	return render(<>{options?.content}</>)
}

describe("SummaryMessageService", () => {
	it("keeps the upload toast visible and shows a retry action", () => {
		const service = new SummaryMessageService()
		const onRetry = vi.fn()
		service.setUploadRetryHandler(onRetry)
		service.showStageMessage(SummaryStage.UploadingChunks)

		const options = loadingMock.mock.calls.at(-1)?.[0] as {
			duration?: number
			dismissible?: boolean
		}

		expect(options.duration).toBe(0)
		expect(options.dismissible).toBe(false)

		renderLatestLoadingContent()
		expect(screen.getByTestId("recording-summary-upload-retry-button")).toBeInTheDocument()
	})

	it("keeps retry available while upload progress updates", () => {
		const service = new SummaryMessageService()
		service.setUploadRetryHandler(vi.fn())
		service.showStageMessage(SummaryStage.UploadingChunks)
		service.updateProgress("17% complete")

		const options = loadingMock.mock.calls.at(-1)?.[0] as {
			duration?: number
			dismissible?: boolean
		}

		expect(options.duration).toBe(0)
		expect(options.dismissible).toBe(false)

		renderLatestLoadingContent()
		expect(screen.getByText(/17% complete/)).toBeInTheDocument()
		expect(screen.getByTestId("recording-summary-upload-retry-button")).toBeInTheDocument()
	})
})
