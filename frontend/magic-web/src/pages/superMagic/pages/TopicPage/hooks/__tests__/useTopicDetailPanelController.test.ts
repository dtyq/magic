import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/utils/pubsub"
import { useTopicDetailPanelController } from "../useTopicDetailPanelController"

vi.mock("@/pages/superMagic/utils/api", () => ({
	getTemporaryDownloadUrl: vi.fn(),
}))

vi.mock("@/pages/superMagic/utils/handleFIle", () => ({
	downloadFileWithAnchor: vi.fn(),
}))

describe("useTopicDetailPanelController", () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		pubsub.clear()
		vi.clearAllTimers()
		vi.useRealTimers()
	})

	it("should toggle detail panel visibility by active tab type", () => {
		const detailRef = {
			current: {
				openFileTab: vi.fn(),
				openPlaybackTab: vi.fn(),
			},
		}

		const { result } = renderHook(() =>
			useTopicDetailPanelController({
				detailRef,
				isReadOnly: false,
				activeFileId: null,
				setActiveFileId: vi.fn(),
				handleFileClick: vi.fn(),
				topicFilesProps: {},
			}),
		)

		expect(result.current.shouldShowDetailPanel).toBe(false)
		expect(result.current.hasActiveDetailTab).toBe(false)
		expect(result.current.activeDetailTabType).toBeNull()

		act(() => {
			result.current.handleActiveDetailTabChange("playback")
		})
		expect(result.current.shouldShowDetailPanel).toBe(true)
		expect(result.current.hasActiveDetailTab).toBe(true)
		expect(result.current.activeDetailTabType).toBe("playback")

		act(() => {
			result.current.clearActiveDetailTabType()
		})
		expect(result.current.shouldShowDetailPanel).toBe(false)
		expect(result.current.activeDetailTabType).toBeNull()
	})

	it("keeps a published micro-app preview open when preserving it across topic changes", () => {
		const { result } = renderHook(() =>
			useTopicDetailPanelController({
				detailRef: { current: { openFileTab: vi.fn(), openPlaybackTab: vi.fn() } },
				isReadOnly: false,
				activeFileId: null,
				setActiveFileId: vi.fn(),
				handleFileClick: vi.fn(),
				topicFilesProps: {},
			}),
		)

		act(() => {
			result.current.handleActiveDetailTabChange("micro_app")
		})
		act(() => {
			result.current.clearActiveDetailTabType({ preservePublishedMicroApp: true })
		})

		expect(result.current.shouldShowDetailPanel).toBe(true)
	})

	it("restores file tab intent from an active file after topic state is cleared", () => {
		const { result } = renderHook(() =>
			useTopicDetailPanelController({
				detailRef: { current: { openFileTab: vi.fn(), openPlaybackTab: vi.fn() } },
				isReadOnly: false,
				activeFileId: "canvas-project",
				setActiveFileId: vi.fn(),
				handleFileClick: vi.fn(),
				topicFilesProps: {},
			}),
		)

		expect(result.current.activeDetailTabType).toBe("file")

		act(() => {
			result.current.clearActiveDetailTabType({ preservePublishedMicroApp: true })
		})

		expect(result.current.activeDetailTabType).toBe("file")
		expect(result.current.shouldShowDetailPanel).toBe(true)
	})

	it("keeps the detail panel visible for non-file preview tab types", () => {
		const detailRef = {
			current: {
				openFileTab: vi.fn(),
				openPlaybackTab: vi.fn(),
			},
		}

		const { result } = renderHook(() =>
			useTopicDetailPanelController({
				detailRef,
				isReadOnly: false,
				activeFileId: null,
				setActiveFileId: vi.fn(),
				handleFileClick: vi.fn(),
				topicFilesProps: {},
			}),
		)

		act(() => {
			result.current.handleActiveDetailTabChange("website")
		})
		expect(result.current.shouldShowDetailPanel).toBe(true)

		act(() => {
			result.current.handleActiveDetailTabChange("knowledge_base")
		})
		expect(result.current.shouldShowDetailPanel).toBe(true)
	})

	it("should reset file tab intent when fallback timer expires without active file", () => {
		const setActiveFileId = vi.fn()
		const handleFileClick = vi.fn()

		const detailRef = {
			current: {
				openFileTab: vi.fn(),
				openPlaybackTab: vi.fn(),
			},
		}

		const { result } = renderHook(() =>
			useTopicDetailPanelController({
				detailRef,
				isReadOnly: false,
				activeFileId: null,
				setActiveFileId,
				handleFileClick,
				topicFilesProps: {},
			}),
		)

		act(() => {
			result.current.handleFileClickWithPanel({ file_id: "file-1" })
		})

		expect(setActiveFileId).not.toHaveBeenCalled()
		expect(handleFileClick).toHaveBeenCalledWith({ file_id: "file-1" })
		expect(result.current.shouldShowDetailPanel).toBe(true)

		act(() => {
			vi.advanceTimersByTime(301)
		})
		expect(result.current.shouldShowDetailPanel).toBe(false)
	})

	it("keeps existing detail panel visible when a file open attempt produces no active file", () => {
		const handleFileClick = vi.fn()
		const detailRef = {
			current: {
				openFileTab: vi.fn(),
				openPlaybackTab: vi.fn(),
			},
		}

		const { result } = renderHook(() =>
			useTopicDetailPanelController({
				detailRef,
				isReadOnly: false,
				activeFileId: "existing-file",
				setActiveFileId: vi.fn(),
				handleFileClick,
				topicFilesProps: {},
			}),
		)

		expect(result.current.shouldShowDetailPanel).toBe(true)

		act(() => {
			result.current.handleFileClickWithPanel({ file_id: "empty-folder", is_directory: true })
		})
		expect(result.current.shouldShowDetailPanel).toBe(true)

		act(() => {
			vi.advanceTimersByTime(301)
		})
		expect(result.current.shouldShowDetailPanel).toBe(true)
	})

	it("restores the previous non-file tab type when a file open attempt does not produce a file", () => {
		const handleFileClick = vi.fn()
		const detailRef = {
			current: {
				openFileTab: vi.fn(),
				openPlaybackTab: vi.fn(),
			},
		}

		const { result } = renderHook(() =>
			useTopicDetailPanelController({
				detailRef,
				isReadOnly: false,
				activeFileId: null,
				setActiveFileId: vi.fn(),
				handleFileClick,
				topicFilesProps: {},
			}),
		)

		act(() => {
			result.current.handleActiveDetailTabChange("website")
		})
		expect(result.current.shouldShowDetailPanel).toBe(true)

		act(() => {
			result.current.handleFileClickWithPanel({ file_id: "empty-folder", is_directory: true })
			vi.advanceTimersByTime(301)
		})

		expect(result.current.shouldShowDetailPanel).toBe(true)
	})

	it("should handle pubsub open tab events", () => {
		const openFileTab = vi.fn()
		const openPlaybackTab = vi.fn()
		const detailRef = {
			current: {
				openFileTab,
				openPlaybackTab,
			},
		}

		renderHook(() =>
			useTopicDetailPanelController({
				detailRef,
				isReadOnly: false,
				activeFileId: null,
				setActiveFileId: vi.fn(),
				handleFileClick: vi.fn(),
				topicFilesProps: {},
			}),
		)

		act(() => {
			pubsub.publish(PubSubEvents.Open_File_Tab, { fileId: "file-2" })
			vi.advanceTimersByTime(101)
		})
		expect(openFileTab).toHaveBeenCalledWith({ file_id: "file-2" })

		const toolData = { foo: "bar" }
		act(() => {
			pubsub.publish(PubSubEvents.Open_Playback_Tab, toolData)
			vi.advanceTimersByTime(101)
		})
		expect(openPlaybackTab).toHaveBeenCalledWith({ toolData, forceActivate: true })
	})

	it("opens a published micro-app tab from the shared mention event", () => {
		const openMicroAppTab = vi.fn()
		const detailRef = {
			current: {
				openFileTab: vi.fn(),
				openPlaybackTab: vi.fn(),
				openMicroAppTab,
			},
		}

		const { result } = renderHook(() =>
			useTopicDetailPanelController({
				detailRef,
				isReadOnly: false,
				activeFileId: null,
				setActiveFileId: vi.fn(),
				handleFileClick: vi.fn(),
				topicFilesProps: {},
			}),
		)

		act(() => {
			pubsub.publish(PubSubEvents.Open_Micro_App_Tab, {
				appId: "app-1",
				appName: "内购",
			})
			vi.advanceTimersByTime(101)
		})

		expect(result.current.shouldShowDetailPanel).toBe(true)
		expect(openMicroAppTab).toHaveBeenCalledWith({
			appId: "app-1",
			appName: "内购",
		})
	})

	it("skips embedded micro-app tab events when mobile popup owns the preview", () => {
		const openMicroAppTab = vi.fn()
		const detailRef = {
			current: {
				openFileTab: vi.fn(),
				openPlaybackTab: vi.fn(),
				openMicroAppTab,
			},
		}

		const { result } = renderHook(() =>
			useTopicDetailPanelController({
				detailRef,
				isReadOnly: false,
				activeFileId: null,
				setActiveFileId: vi.fn(),
				handleFileClick: vi.fn(),
				topicFilesProps: {},
				subscribeMicroAppTab: false,
			}),
		)

		act(() => {
			pubsub.publish(PubSubEvents.Open_Micro_App_Tab, {
				appId: "app-1",
				appName: "内购",
			})
			vi.advanceTimersByTime(101)
		})

		expect(result.current.shouldShowDetailPanel).toBe(false)
		expect(openMicroAppTab).not.toHaveBeenCalled()
	})

	it("keeps the detail panel when Open_File_Tab fails after file tab desync", () => {
		// Parent activeFileId stays null after closing playback, while UI is back on a file tab.
		const detailRef = {
			current: {
				openFileTab: vi.fn(),
				openPlaybackTab: vi.fn(),
			},
		}

		const { result } = renderHook(() =>
			useTopicDetailPanelController({
				detailRef,
				isReadOnly: false,
				activeFileId: null,
				setActiveFileId: vi.fn(),
				handleFileClick: vi.fn(),
				topicFilesProps: {},
			}),
		)

		act(() => {
			result.current.handleActiveDetailTabChange("file")
		})
		expect(result.current.shouldShowDetailPanel).toBe(true)

		act(() => {
			pubsub.publish(PubSubEvents.Open_File_Tab, { fileId: "missing-screenshot" })
			vi.advanceTimersByTime(301)
		})

		// Failed open restores "file", not null, so the detail panel stays visible.
		expect(result.current.shouldShowDetailPanel).toBe(true)
	})
})
