import { fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"

const confirmMock = vi.hoisted(() => vi.fn())

vi.mock("@/components/base/MagicModal", () => ({
	default: { confirm: confirmMock },
}))

vi.mock("i18next", async (importOriginal) => {
	const actual = await importOriginal<typeof import("i18next")>()
	return {
		...actual,
		t: (key: string) => key,
		default: { ...actual.default, t: (key: string) => key },
	}
})

import { confirmForceRecordingRetry } from "../force-recording-override"

describe("confirmForceRecordingRetry", () => {
	beforeEach(() => {
		confirmMock.mockReset()
	})

	it("settles cancel when the cancel button is clicked", async () => {
		const destroy = vi.fn()
		confirmMock.mockImplementation((config: { footer?: ReactNode }) => {
			render(<>{config.footer}</>)
			return { destroy }
		})

		const resultPromise = confirmForceRecordingRetry()
		fireEvent.click(screen.getByTestId("recording-force-override-retry-cancel-button"))

		await expect(resultPromise).resolves.toBe("cancel")
		expect(destroy).toHaveBeenCalledTimes(1)
	})

	it("settles cancel when the modal reports onCancel", async () => {
		let onCancel: (() => void) | undefined
		confirmMock.mockImplementation((config: { onCancel?: () => void }) => {
			onCancel = config.onCancel
			return { destroy: vi.fn() }
		})

		const resultPromise = confirmForceRecordingRetry()
		onCancel?.()

		await expect(resultPromise).resolves.toBe("cancel")
	})
})
