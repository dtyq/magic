import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useMicroAppMessageFileOpen } from "../useMicroAppMessageFileOpen"

vi.mock("@/pages/superMagic/components/Detail/components/FilesViewer/hooks/previewPolicy", () => ({
	isStandalonePreviewFile: () => false,
}))

describe("useMicroAppMessageFileOpen", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		pubsub.clear()
		vi.clearAllTimers()
		vi.useRealTimers()
	})

	it("ignores file-tab events when disabled", () => {
		const openFileTab = vi.fn()
		const showFilesView = vi.fn()
		const detailRef = {
			current: {
				openFileTab,
			},
		}

		renderHook(() =>
			useMicroAppMessageFileOpen({
				attachmentList: [{ file_id: "file-1", file_name: "index.html" }],
				detailRef,
				isFilesViewActive: false,
				showFilesView,
				enabled: false,
			}),
		)

		act(() => {
			pubsub.publish(PubSubEvents.Open_File_Tab, {
				fileId: "file-1",
				fileData: { file_id: "file-1", file_name: "index.html" },
			})
		})

		expect(showFilesView).not.toHaveBeenCalled()
		expect(openFileTab).not.toHaveBeenCalled()
	})

	it("opens a published micro-app tab after switching to files view", () => {
		const openMicroAppTab = vi.fn()
		const showFilesView = vi.fn()
		const detailRef = {
			current: {
				openFileTab: vi.fn(),
				openMicroAppTab,
			},
		}

		const { rerender } = renderHook(
			({ isFilesViewActive }: { isFilesViewActive: boolean }) =>
				useMicroAppMessageFileOpen({
					attachmentList: [],
					detailRef,
					isFilesViewActive,
					showFilesView,
				}),
			{ initialProps: { isFilesViewActive: false } },
		)

		act(() => {
			pubsub.publish(PubSubEvents.Open_Micro_App_Tab, {
				appId: "app-1",
				appName: "内购",
			})
		})
		expect(showFilesView).toHaveBeenCalledTimes(1)
		expect(openMicroAppTab).not.toHaveBeenCalled()

		rerender({ isFilesViewActive: true })
		act(() => {
			vi.advanceTimersByTime(100)
		})
		expect(openMicroAppTab).toHaveBeenCalledWith({
			appId: "app-1",
			appName: "内购",
		})
	})

	it("opens a published micro-app tab immediately when files view is active", () => {
		const openMicroAppTab = vi.fn()
		const detailRef = {
			current: {
				openFileTab: vi.fn(),
				openMicroAppTab,
			},
		}

		renderHook(() =>
			useMicroAppMessageFileOpen({
				attachmentList: [],
				detailRef,
				isFilesViewActive: true,
				showFilesView: vi.fn(),
			}),
		)

		act(() => {
			pubsub.publish(PubSubEvents.Open_Micro_App_Tab, {
				appId: "app-2",
				appName: "报表",
			})
			vi.advanceTimersByTime(100)
		})

		expect(openMicroAppTab).toHaveBeenCalledWith({
			appId: "app-2",
			appName: "报表",
		})
	})

	it("does not open a micro-app tab after unmounting before the delay", () => {
		const openMicroAppTab = vi.fn()
		const detailRef = {
			current: {
				openFileTab: vi.fn(),
				openMicroAppTab,
			},
		}

		const { unmount } = renderHook(() =>
			useMicroAppMessageFileOpen({
				attachmentList: [],
				detailRef,
				isFilesViewActive: true,
				showFilesView: vi.fn(),
			}),
		)

		act(() => {
			pubsub.publish(PubSubEvents.Open_Micro_App_Tab, {
				appId: "app-3",
				appName: "日历",
			})
		})
		unmount()
		act(() => {
			vi.advanceTimersByTime(100)
		})

		expect(openMicroAppTab).not.toHaveBeenCalled()
	})

	it("does not open a micro-app tab after leaving files view before the delay", () => {
		const openMicroAppTab = vi.fn()
		const detailRef = {
			current: {
				openFileTab: vi.fn(),
				openMicroAppTab,
			},
		}

		const { rerender } = renderHook(
			({ isFilesViewActive }: { isFilesViewActive: boolean }) =>
				useMicroAppMessageFileOpen({
					attachmentList: [],
					detailRef,
					isFilesViewActive,
					showFilesView: vi.fn(),
				}),
			{ initialProps: { isFilesViewActive: true } },
		)

		act(() => {
			pubsub.publish(PubSubEvents.Open_Micro_App_Tab, {
				appId: "app-4",
				appName: "报表",
			})
		})
		rerender({ isFilesViewActive: false })
		act(() => {
			vi.advanceTimersByTime(100)
		})

		expect(openMicroAppTab).not.toHaveBeenCalled()
	})
})
