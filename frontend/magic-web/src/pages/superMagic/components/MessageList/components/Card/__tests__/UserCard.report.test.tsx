import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import type { ReactNode } from "react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { withUserNode } from "../UserCard"

const state = vi.hoisted(() => ({
	report: vi.fn(),
	error: vi.fn(),
	success: vi.fn(),
	toastError: vi.fn(),
	flush: vi.fn(),
	query: vi.fn(),
	compress: vi.fn(),
	messages: [
		{ app_message_id: "user-1", role: "user", seq_id: "1" },
		{ app_message_id: "assistant-1", role: "assistant", seq_id: "2" },
	],
}))

vi.mock("mobx-react-lite", () => ({ observer: <T,>(component: T) => component }))
vi.mock("mobx", async (importOriginal) => ({
	...(await importOriginal<typeof import("mobx")>()),
	toJS: <T,>(value: T) => value,
}))
vi.mock("react-i18next", () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock("ahooks", () => ({
	useMemoizedFn: <T,>(fn: T) => fn,
	useDebounceFn: (fn: unknown) => ({ run: fn }),
}))
vi.mock("@/infrastructure/logger", () => ({
	createLogger: () => ({ report: state.report, error: state.error }),
}))
vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: { success: state.success, error: state.toastError },
}))
vi.mock("@/pages/superMagic/stores", () => ({
	superMagicStore: {
		messages: new Map([["topic-1", state.messages]]),
		getMessageNode: () => ({}),
		flushMessagePersistenceForReport: state.flush,
	},
}))
vi.mock("@/pages/superMagic/stores/conversation-round-report", () => ({
	queryConversationRoundLogs: state.query,
	compressConversationRoundLogs: state.compress,
	getConversationRoundReportWriterId: () => "writer-1",
}))
vi.mock("@/pages/superMagic/components/MessageList/context", () => ({
	useMessageListContext: () => ({}),
}))
vi.mock("@/pages/superMagic/utils/query", () => ({ getSuperIdState: () => ({}) }))
vi.mock("@/pages/superMagic/stores/core", () => ({ projectStore: {} }))
vi.mock(
	"@/components/business/AccountSetting/pages/ScheduledTasks/hooks/useScheduledTasksModifyModal",
	() => ({
		useScheduledTasksModifyModal: () => ({}),
	}),
)
vi.mock("@/apis", () => ({ ScheduledTaskApi: {}, SuperMagicApi: {} }))
vi.mock("@/utils/pubsub", () => ({ default: {}, PubSubEvents: {} }))
vi.mock("@/infrastructure/editors/tiptap/core", () => ({ Editor: class {} }))
vi.mock("@/infrastructure/editors/tiptap/extension-document", () => ({ Document: {} }))
vi.mock("@/infrastructure/editors/tiptap/extension-paragraph", () => ({ Paragraph: {} }))
vi.mock("@/infrastructure/editors/tiptap/extension-text", () => ({ Text: {} }))
vi.mock("@/pages/superMagic/components/MessageEditor/extensions", () => ({ HardBlock: {} }))
vi.mock("@/pages/superMagic/components/MessageEditor/extensions/inspector-detail", () => ({
	InspectorDetailExtension: {},
	transformInspectorContent: vi.fn(),
}))
vi.mock("@/utils/clipboard-helpers", () => ({ copyWithMetadata: vi.fn() }))
vi.mock("@/components/business/MentionPanel/tiptap-plugin", () => ({ default: {} }))
vi.mock("@/pages/superMagic/components/MessageEditor/utils/markerContentUtils", () => ({
	extractAllMarkersFromContent: vi.fn(),
}))
vi.mock("@/pages/superMagic/components/MessageList/utils/mentionClipboard", () => ({
	getClipboardHtml: vi.fn(),
	getClipboardPlainText: vi.fn(),
	prependPortableMentions: vi.fn(),
}))
vi.mock("@/pages/superMagic/components/MessageList/utils/resolveClipboardFilePaths", () => ({
	resolveClipboardFilePaths: vi.fn(),
}))
vi.mock("../components/AttachmentHoverButton", () => ({ default: () => null }))
vi.mock("../OptimisticStatusIndicator", () => ({ default: () => null }))
vi.mock("@/components/base", () => ({
	MagicModal: {},
	MagicDropdown: ({
		menu,
	}: {
		menu: {
			items: { key: string; label: ReactNode; "data-testid"?: string }[]
			onClick: (info: { key: string }) => void
		}
	}) => (
		<>
			{menu.items.map((item) => (
				<button
					key={item.key}
					data-testid={item["data-testid"]}
					onClick={() => menu.onClick({ key: item.key })}
				>
					{item.label}
				</button>
			))}
		</>
	),
}))

const Card = withUserNode(() => null)
const renderCard = () =>
	render(
		<Card
			node={state.messages[0]}
			selectedTopic={{ id: "id-1", chat_topic_id: "topic-1" } as never}
		/>,
	)
async function report() {
	await act(async () => {
		fireEvent.click(screen.getByTestId("assistant-round-log-report-menu-item"))
		await vi.dynamicImportSettled()
	})
}

beforeEach(() => {
	vi.useFakeTimers()
	vi.clearAllMocks()
	state.flush.mockResolvedValue(undefined)
	state.query.mockResolvedValue([{ id: "stored-1" }])
	state.compress.mockReturnValue([{ message: "round content" }])
})
afterEach(() => {
	cleanup()
	vi.useRealTimers()
})

it("reports the prepared round directly and shows success after exactly one second without a receipt", async () => {
	renderCard()
	await report()
	expect(state.report).toHaveBeenCalledWith("messages", {
		topic_id: "id-1",
		chat_topic_id: "topic-1",
		message_id: "user-1",
		messages: [{ message: "round content" }],
	})
	expect(state.flush).toHaveBeenCalledWith("topic-1")
	expect(state.compress).toHaveBeenCalledWith({
		records: [{ id: "stored-1" }],
		roundMessages: state.messages,
		preferredWriterId: "writer-1",
	})
	await report()
	expect(state.report).toHaveBeenCalledTimes(1)
	await act(() => vi.advanceTimersByTimeAsync(999))
	expect(state.success).not.toHaveBeenCalled()
	await act(() => vi.advanceTimersByTimeAsync(1))
	expect(state.success).toHaveBeenCalledWith("ui.reportConversationRoundSuccess")
	await report()
	expect(state.report).toHaveBeenCalledTimes(2)
})

it("shows preparation failure and allows retry without scheduling a success toast", async () => {
	const error = new Error("storage unavailable")
	state.flush.mockRejectedValueOnce(error)
	renderCard()
	await report()
	expect(state.report).not.toHaveBeenCalled()
	expect(state.error).toHaveBeenCalledWith(expect.objectContaining({ error }))
	expect(state.toastError).toHaveBeenCalledWith("ui.reportConversationRoundFailed")
	await act(() => vi.advanceTimersByTimeAsync(1000))
	expect(state.success).not.toHaveBeenCalled()
	await report()
	expect(state.report).toHaveBeenCalledTimes(1)
})

it("clears the delayed toast when the card unmounts", async () => {
	const view = renderCard()
	await report()
	view.unmount()
	await act(() => vi.advanceTimersByTimeAsync(1000))
	expect(state.success).not.toHaveBeenCalled()
})
