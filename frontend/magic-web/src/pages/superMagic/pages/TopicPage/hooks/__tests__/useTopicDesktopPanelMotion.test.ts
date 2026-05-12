import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
	DEFAULT_MIN_WIDTH,
	FIXED_TOPIC_HISTORY_REQUIRED_WIDTH,
	MIN_DETAIL_PANEL_WIDTH_FOR_FIXED_TOPIC_HISTORY,
	RESIZABLE_PANEL_HANDLE_WIDTH,
	TOPIC_HISTORY_PANEL_WIDTH,
} from "../../../../constants/resizablePanel"
import { useTopicDesktopPanelMotion } from "../useTopicDesktopPanelMotion"

const PROJECT_SIDER_WIDTH_PX = 320
const LEFT_HANDLE_WIDTH = RESIZABLE_PANEL_HANDLE_WIDTH
const FIXED_TOPIC_HISTORY_THRESHOLD = FIXED_TOPIC_HISTORY_REQUIRED_WIDTH

function createProps({
	isReadOnly = false,
	isTopicHistoryPanelOpen = true,
	shouldShowDetailPanel,
	middleContainerWidth,
	isConversationPanelCollapsed = false,
}: {
	isReadOnly?: boolean
	isTopicHistoryPanelOpen?: boolean
	shouldShowDetailPanel: boolean
	middleContainerWidth: number
	isConversationPanelCollapsed?: boolean
}) {
	return {
		isReadOnly,
		isTopicHistoryPanelOpen,
		showProjectResizeHandle: true,
		shouldShowDetailPanel,
		containerWidthPx: middleContainerWidth + PROJECT_SIDER_WIDTH_PX + LEFT_HANDLE_WIDTH,
		projectSiderWidthPx: PROJECT_SIDER_WIDTH_PX,
		messagePanelWidthPx: 420,
		collapsedMessagePanelWidthPx: 24,
		isConversationPanelCollapsed,
		isDraggingProjectSider: false,
		isDraggingMessagePanel: false,
		ensureExpandedWhenDetailVisible: vi.fn(),
	}
}

describe("useTopicDesktopPanelMotion", () => {
	it("should enter full-right when detail panel is hidden", () => {
		const { result } = renderHook(() =>
			useTopicDesktopPanelMotion(
				createProps({
					shouldShowDetailPanel: false,
					middleContainerWidth: 900,
				}),
			),
		)

		expect(result.current.middleContainerWidth).toBe(900)
		expect(result.current.canShowFixedTopicHistory).toBe(true)
		expect(result.current.topicHistoryMode).toBe("full-right")
		expect(result.current.topicHistoryPanelWidth).toBe(TOPIC_HISTORY_PANEL_WIDTH)
		expect(result.current.targetMessagePanelWidth).toBe(900 - TOPIC_HISTORY_PANEL_WIDTH)
		expect(result.current.targetRightHandleWidth).toBe(0)
		expect(result.current.targetDetailPanelWidth).toBe(0)
	})

	it("should enter drawer when detail panel is visible and width is below threshold", () => {
		const { result } = renderHook(() =>
			useTopicDesktopPanelMotion(
				createProps({
					shouldShowDetailPanel: true,
					middleContainerWidth: FIXED_TOPIC_HISTORY_THRESHOLD - 1,
				}),
			),
		)

		expect(result.current.middleContainerWidth).toBe(FIXED_TOPIC_HISTORY_THRESHOLD - 1)
		expect(result.current.canShowFixedTopicHistory).toBe(false)
		expect(result.current.topicHistoryMode).toBe("drawer")
		expect(result.current.topicHistoryPanelWidth).toBe(TOPIC_HISTORY_PANEL_WIDTH)
		expect(result.current.targetMessagePanelWidth).toBe(420)
		expect(result.current.targetRightHandleWidth).toBe(RESIZABLE_PANEL_HANDLE_WIDTH)
		expect(result.current.targetDetailPanelWidth).toBe(
			FIXED_TOPIC_HISTORY_THRESHOLD - 1 - 420 - RESIZABLE_PANEL_HANDLE_WIDTH,
		)
	})

	it("should enter fixed when detail panel is visible and width reaches threshold", () => {
		const { result } = renderHook(() =>
			useTopicDesktopPanelMotion(
				createProps({
					shouldShowDetailPanel: true,
					middleContainerWidth: FIXED_TOPIC_HISTORY_THRESHOLD,
				}),
			),
		)

		expect(result.current.middleContainerWidth).toBe(FIXED_TOPIC_HISTORY_THRESHOLD)
		expect(result.current.canShowFixedTopicHistory).toBe(true)
		expect(result.current.topicHistoryMode).toBe("fixed")
		expect(result.current.topicHistoryPanelWidth).toBe(TOPIC_HISTORY_PANEL_WIDTH)
		expect(result.current.targetMessagePanelWidth).toBe(DEFAULT_MIN_WIDTH.MESSAGE_PANEL)
		expect(result.current.targetRightHandleWidth).toBe(RESIZABLE_PANEL_HANDLE_WIDTH)
		expect(result.current.targetDetailPanelWidth).toBe(
			MIN_DETAIL_PANEL_WIDTH_FOR_FIXED_TOPIC_HISTORY,
		)
	})

	it("should not relax threshold when conversation panel is collapsed", () => {
		const { result } = renderHook(() =>
			useTopicDesktopPanelMotion(
				createProps({
					shouldShowDetailPanel: true,
					middleContainerWidth: FIXED_TOPIC_HISTORY_THRESHOLD - 1,
					isConversationPanelCollapsed: true,
				}),
			),
		)

		expect(result.current.canShowFixedTopicHistory).toBe(false)
		expect(result.current.topicHistoryMode).toBe("drawer")
		expect(result.current.targetMessagePanelWidth).toBe(24)
	})

	it("should keep topic history hidden and fixed capability false in read-only mode", () => {
		const { result } = renderHook(() =>
			useTopicDesktopPanelMotion(
				createProps({
					isReadOnly: true,
					shouldShowDetailPanel: true,
					middleContainerWidth: FIXED_TOPIC_HISTORY_THRESHOLD,
				}),
			),
		)

		expect(result.current.canShowFixedTopicHistory).toBe(false)
		expect(result.current.topicHistoryMode).toBe("hidden")
		expect(result.current.topicHistoryPanelWidth).toBe(0)
	})
})
