import { renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { CanvasDesignRef } from "@/components/CanvasDesign/public/props"
import { requestCanvasElementFocus, useDesignFocusElement } from "../useDesignFocusElement"

const focusElementMock = vi.fn()

function canvasRef(document?: unknown) {
	return {
		current: {
			focusElement: focusElementMock,
			exportCurrentDocument: () => document ?? null,
		} as unknown as CanvasDesignRef,
	}
}

describe("useDesignFocusElement", () => {
	beforeEach(() => {
		focusElementMock.mockReset()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it("consumes a focus request queued while the Canvas was opening", () => {
		const request = {
			canvasDesignId: "canvas-before-mount",
			elementIds: ["element-before-mount"],
			selectElement: ["element-before-mount"],
			animated: true,
		}

		requestCanvasElementFocus(request)
		renderHook(() =>
			useDesignFocusElement({
				designProjectId: request.canvasDesignId,
				isInitialLoading: false,
				canvasDesignRef: canvasRef(),
			}),
		)

		expect(focusElementMock).toHaveBeenCalledWith(request.elementIds, {
			animated: true,
			selectElement: request.selectElement,
			padding: undefined,
		})
	})

	it("focuses immediately when the target Canvas is already mounted", () => {
		const ref = canvasRef()
		renderHook(() =>
			useDesignFocusElement({
				designProjectId: "canvas-mounted",
				isInitialLoading: false,
				canvasDesignRef: ref,
			}),
		)

		requestCanvasElementFocus({
			canvasDesignId: "canvas-mounted",
			elementIds: ["element-mounted"],
			selectElement: ["element-mounted"],
		})

		expect(focusElementMock).toHaveBeenCalledWith(["element-mounted"], {
			animated: undefined,
			selectElement: ["element-mounted"],
			padding: undefined,
		})
	})

	it("resolves a media file to matching Canvas elements after the document loads", () => {
		const ref = canvasRef({
			elements: [
				{
					id: "frame-1",
					type: "frame",
					children: [
						{ id: "audio-1", type: "audio", contents: [{ src: "./audios/a.mp3" }] },
						{ id: "audio-2", type: "audio", contents: [{ src: "./audios/b.mp3" }] },
					],
				},
			],
		})
		renderHook(() =>
			useDesignFocusElement({
				designProjectId: "canvas-media",
				isInitialLoading: false,
				canvasDesignRef: ref,
				resolveFileBySrc: (src) => ({
					file_id: src.includes("a.mp3") ? "audio-file" : "other",
				}),
			}),
		)

		requestCanvasElementFocus({
			canvasDesignId: "canvas-media",
			mediaFileId: "audio-file",
			selectElement: true,
			animated: true,
		})

		expect(focusElementMock).toHaveBeenCalledWith(["audio-1"], {
			animated: true,
			selectElement: true,
			padding: undefined,
		})
	})

	it("does nothing when the opened Canvas has no element for the media file", () => {
		renderHook(() =>
			useDesignFocusElement({
				designProjectId: "canvas-without-media",
				isInitialLoading: false,
				canvasDesignRef: canvasRef({ elements: [] }),
				resolveFileBySrc: () => null,
			}),
		)

		requestCanvasElementFocus({
			canvasDesignId: "canvas-without-media",
			mediaFileId: "missing-audio",
			selectElement: true,
		})

		expect(focusElementMock).not.toHaveBeenCalled()
	})

	it("drops an expired request when the target Canvas never opens", () => {
		vi.useFakeTimers()
		vi.setSystemTime(0)
		requestCanvasElementFocus({
			canvasDesignId: "canvas-expired",
			mediaFileId: "expired-audio",
			selectElement: true,
		})

		vi.setSystemTime(61_000)
		renderHook(() =>
			useDesignFocusElement({
				designProjectId: "canvas-expired",
				isInitialLoading: false,
				canvasDesignRef: canvasRef({ elements: [] }),
				resolveFileBySrc: () => ({ file_id: "expired-audio" }),
			}),
		)

		expect(focusElementMock).not.toHaveBeenCalled()
	})
})
