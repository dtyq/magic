import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import pubsub, { PubSubEvents } from "@/opensource/utils/pubsub"
import { useTopicDetailPanelController } from "../useTopicDetailPanelController"

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

		act(() => {
			result.current.handleActiveDetailTabChange("playback")
		})
		expect(result.current.shouldShowDetailPanel).toBe(true)

		act(() => {
			result.current.clearActiveDetailTabType()
		})
		expect(result.current.shouldShowDetailPanel).toBe(false)
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

		expect(setActiveFileId).toHaveBeenCalledWith(null)
		expect(handleFileClick).toHaveBeenCalledWith({ file_id: "file-1" })
		expect(result.current.shouldShowDetailPanel).toBe(true)

		act(() => {
			vi.advanceTimersByTime(301)
		})
		expect(result.current.shouldShowDetailPanel).toBe(false)
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
})
