import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useReferenceImageUrls } from "../useReferenceImageUrls"

const mocks = vi.hoisted(() => {
	const release = vi.fn()
	const getLowImageUrl = vi.fn(async (path: string) => {
		if (path.includes("deleted")) return null
		return {
			url: "blob:available",
			imageInfo: {
				naturalWidth: 100,
				naturalHeight: 80,
				fileSize: 1000,
				mimeType: "image/png",
				filename: "available.png",
			},
			release,
		}
	})
	const ensureFreshOssInfo = vi.fn(async (path: string) =>
		path.includes("deleted") ? null : { ossSrc: "https://cdn.test/available.png" },
	)
	const getFailureReason = vi.fn((path: string) =>
		path.includes("deleted") ? "not-found" : null,
	)
	return {
		release,
		getLowImageUrl,
		ensureFreshOssInfo,
		getFailureReason,
		canvas: {
			imageResourceManager: {
				getLowImageUrl,
				ensureFreshOssInfo,
				getFailureReason,
			},
		},
	}
})

vi.mock("../../../providers/CanvasProvider", () => ({
	useCanvas: () => ({ canvas: mocks.canvas }),
	useOptionalCanvas: () => mocks.canvas,
}))

vi.mock("../../canvas", () => ({
	useCanvasEvent: vi.fn(),
	useCanvasEventWithInstance: vi.fn(),
}))

describe("useReferenceImageUrls", () => {
	beforeEach(() => {
		mocks.release.mockClear()
		mocks.getLowImageUrl.mockClear()
		mocks.ensureFreshOssInfo.mockClear()
		mocks.getFailureReason.mockClear()
	})

	it("clears an old low/full preview when the next path is confirmed deleted", async () => {
		const { result, rerender } = renderHook(
			({ path }) => useReferenceImageUrls(path, { eagerFullUrl: true }),
			{ initialProps: { path: "./images/available.png" } },
		)

		await waitFor(() => {
			expect(result.current.lowUrl).toBe("blob:available")
			expect(result.current.fullUrl).toBe("https://cdn.test/available.png")
		})

		rerender({ path: "./images/deleted.png" })

		await waitFor(() => {
			expect(result.current.hasError).toBe(true)
			expect(result.current.lowUrl).toBeUndefined()
			expect(result.current.fullUrl).toBeUndefined()
			expect(result.current.imageInfo).toBeUndefined()
		})
		expect(mocks.release).toHaveBeenCalled()
	})
})
