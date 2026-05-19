import { fireEvent, render, screen } from "@testing-library/react"
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import MessageHeader from "../index"

const mockSmartRenameTopic = vi.fn()

const mockHistoryControl = vi.fn(
	({
		historyTriggerMode,
		isHistoryButtonActive,
		onToggleHistoryPanel,
	}: {
		historyTriggerMode: "dropdown" | "layout"
		isHistoryButtonActive: boolean
		onToggleHistoryPanel?: () => void
	}) => (
		<div>
			<button
				type="button"
				data-testid="message-header-history-button"
				className={isHistoryButtonActive ? "bg-accent" : ""}
				onClick={onToggleHistoryPanel}
			>
				history
			</button>
			{historyTriggerMode === "dropdown" ? (
				<div data-testid="mock-topic-history-dropdown" />
			) : null}
		</div>
	),
)

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
	initReactI18next: {
		type: "3rdParty",
		init: vi.fn(),
	},
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: any[]) => any>(fn: T) => fn,
	useMount: (fn: () => void) => fn(),
}))

vi.mock("mobx", () => ({
	computed: (factory: () => unknown) => ({
		get: factory,
	}),
	makeAutoObservable: vi.fn(),
}))

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("antd", () => ({
	App: {
		useApp: () => ({
			message: {
				success: vi.fn(),
				error: vi.fn(),
				info: vi.fn(),
				warning: vi.fn(),
				loading: vi.fn(),
			},
		}),
	},
}))

vi.mock("@/components/base", () => ({
	MagicTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: {
		confirm: vi.fn(),
	},
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		success: vi.fn(),
		error: vi.fn(),
	},
}))

vi.mock("@/utils/http", () => ({
	genRequestUrl: vi.fn(),
}))

vi.mock("@/apis", () => ({
	SuperMagicApi: {},
}))

vi.mock("@/assets/locales/create", () => ({
	createI18nNext: () => ({
		init: vi.fn(),
		instance: {
			changeLanguage: vi.fn(),
		},
	}),
}))

vi.mock("@/models/config", () => ({
	configStore: {
		i18n: {
			displayLanguage: "zh_CN",
		},
		cluster: {
			clusterCode: "",
		},
	},
}))

vi.mock("@/models/config/stores", () => ({
	configStore: {
		i18n: {
			displayLanguage: "zh_CN",
		},
		cluster: {
			clusterCode: "",
		},
	},
}))

vi.mock("antd/locale/zh_CN", () => ({
	default: {},
}))

vi.mock("antd/es/locale/zh_CN", () => ({
	default: {},
}))

vi.mock("rc-pagination/es/locale/zh_CN", () => ({
	default: {},
}))

vi.mock("rc-pagination/es/locale/zh_CN.js", () => ({
	default: {},
}))

vi.mock("lucide-react", () => {
	function createIcon(name: string) {
		return function MockIcon() {
			return <span data-testid={`icon-${name}`} />
		}
	}

	return {
		MessageCirclePlus: createIcon("message-circle-plus"),
		PanelRightClose: createIcon("panel-right-close"),
		PanelRightOpen: createIcon("panel-right-open"),
		Ellipsis: createIcon("ellipsis"),
		PenLine: createIcon("pen-line"),
		WandSparkles: createIcon("wand-sparkles"),
		Trash2: createIcon("trash-2"),
	}
})

vi.mock("@tabler/icons-react", () => ({
	IconShare3: () => <span data-testid="icon-share-3" />,
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({
		children,
		className,
		onClick,
		disabled,
		...props
	}: ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button
			type="button"
			className={className}
			onClick={onClick}
			disabled={disabled}
			{...props}
		>
			{children}
		</button>
	),
}))

vi.mock("@/components/shadcn-ui/input", () => ({
	Input: ({ className, value, onChange, ...props }: InputHTMLAttributes<HTMLInputElement>) => (
		<input className={className} value={value} onChange={onChange} {...props} />
	),
}))

vi.mock("@/components/shadcn-ui/dropdown-menu", () => ({
	DropdownMenu: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
	DropdownMenuContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DropdownMenuItem: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
		<button type="button" onClick={onClick}>
			{children}
		</button>
	),
	DropdownMenuSeparator: () => <hr />,
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: vi.fn(),
	},
	PubSubEvents: {
		GuideTourElementReady: "GuideTourElementReady",
	},
}))

vi.mock("@/stores/recordingSummary", () => ({
	default: {
		isRecordingTopic: () => false,
	},
}))

vi.mock("@/pages/superMagic/providers/file-action-visibility-provider", () => ({
	useFileActionVisibility: () => ({
		hideCreateNewTopic: false,
		hideShareTopic: true,
	}),
}))

vi.mock("../../TopicSharePopover", () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("../../LazyGuideTour", () => ({
	GuideTourElementId: {
		MessageHeaderTopicGroup: "MessageHeaderTopicGroup",
	},
}))

vi.mock("../components/StatusIcon", () => ({
	default: () => <span data-testid="mock-status-icon" />,
}))

vi.mock("../components/TopicHistoryDropdown", () => ({
	default: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("../components/TopicHistoryPanelContent", () => ({
	default: () => <div data-testid="mock-topic-history-panel-content" />,
}))

vi.mock("../components/MessageHeaderHistoryControl", () => ({
	MessageHeaderHistoryControl: (props: {
		historyTriggerMode: "dropdown" | "layout"
		isHistoryButtonActive: boolean
		onToggleHistoryPanel?: () => void
	}) => mockHistoryControl(props),
}))

vi.mock("../../stores", () => ({
	superMagicStore: {
		messages: new Map(),
	},
}))

vi.mock("../../services/topicRename", () => ({
	smartRenameTopic: mockSmartRenameTopic,
}))

vi.mock("../../pages/Workspace/types", () => ({
	TaskStatus: {
		FINISHED: "finished",
	},
	MessageStatus: {
		REVOKED: "revoked",
	},
	TopicMode: {
		General: "general",
	},
}))

function renderComponent(overrides: Record<string, unknown> = {}) {
	const selectedTopic = {
		id: "topic-1",
		user_id: "user-1",
		chat_topic_id: "chat-topic-1",
		chat_conversation_id: "chat-conversation-1",
		topic_name: "Alpha Topic",
		task_status: "finished",
		task_mode: "chat",
		project_id: "project-1",
		topic_mode: "general",
		updated_at: "2026-04-01T00:00:00Z",
		workspace_id: "workspace-1",
		token_used: null,
	}

	return render(
		<MessageHeader
			selectedProject={
				{
					id: "project-1",
					name: "Project 1",
				} as any
			}
			topicStore={
				{
					topics: [selectedTopic],
					selectedTopic,
				} as any
			}
			topicActions={
				{
					createTopic: vi.fn(),
					selectTopic: vi.fn(),
					renameTopic: vi.fn(),
					deleteTopic: vi.fn(),
					updateTopicName: vi.fn(),
					pinTopic: vi.fn(),
					unpinTopic: vi.fn(),
					archiveTopic: vi.fn(),
					unarchiveTopic: vi.fn(),
				} as any
			}
			{...overrides}
		/>,
	)
}

describe("MessageHeader", () => {
	beforeEach(() => {
		mockHistoryControl.mockClear()
		mockSmartRenameTopic.mockReset()
		mockSmartRenameTopic.mockResolvedValue("AI Topic Name")
	})

	it("在 layout 模式下点击历史话题按钮调用页面级切换方法", () => {
		const handleToggleHistoryPanel = vi.fn()
		renderComponent({
			historyTriggerMode: "layout",
			onToggleHistoryPanel: handleToggleHistoryPanel,
		})

		fireEvent.click(screen.getByTestId("message-header-history-button"))
		expect(handleToggleHistoryPanel).toHaveBeenCalledTimes(1)
		expect(screen.queryByTestId("mock-topic-history-dropdown")).not.toBeInTheDocument()
	})

	it("在 layout 模式且历史面板已打开时高亮按钮", () => {
		renderComponent({
			historyTriggerMode: "layout",
			isHistoryPanelOpen: true,
		})

		expect(screen.getByTestId("message-header-history-button")).toHaveClass("bg-accent")
		expect(screen.queryByTestId("mock-topic-history-dropdown")).not.toBeInTheDocument()
	})

	it("默认模式下仍保留 dropdown 入口", () => {
		const handleToggleHistoryPanel = vi.fn()
		renderComponent({
			onToggleHistoryPanel: handleToggleHistoryPanel,
		})

		expect(screen.getByTestId("mock-topic-history-dropdown")).toBeInTheDocument()
		fireEvent.click(screen.getByTestId("message-header-history-button"))
		expect(handleToggleHistoryPanel).not.toHaveBeenCalled()
	})

	it("selectedProject 为空时仍会触发智能重命名", () => {
		renderComponent({
			selectedProject: null,
		})

		fireEvent.click(screen.getByText("messageHeader.aiRename"))

		expect(mockSmartRenameTopic).toHaveBeenCalledTimes(1)
		expect(mockSmartRenameTopic).toHaveBeenCalledWith({
			topicId: "topic-1",
			userQuestion: "Alpha Topic",
			updateTopicName: expect.any(Function),
		})
	})
})
