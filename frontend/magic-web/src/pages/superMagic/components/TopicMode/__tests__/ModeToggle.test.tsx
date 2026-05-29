import { fireEvent, render, screen } from "@testing-library/react"
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react"
import { createContext, useContext } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { modeListMock, getModeConfigWithLegacyMock, publishMock } = vi.hoisted(() => {
	const modeList = [
		{
			mode: {
				identifier: "mode-a",
				name: "Mode A",
				description:
					"This is a very long description for Mode A that should be expandable in tests.",
			},
		},
		{
			mode: {
				identifier: "mode-b",
				name: "Mode B",
				description:
					"This is a very long description for Mode B that should also be expandable.",
			},
		},
	]

	return {
		modeListMock: modeList,
		getModeConfigWithLegacyMock: vi.fn(
			(
				topicMode: string | undefined,
				_t: unknown,
				_flag: boolean,
				agentCode?: string | null,
			) => {
				const identifier = topicMode === "CustomAgent" && agentCode ? agentCode : topicMode
				return modeList.find((item) => item.mode.identifier === identifier) ?? null
			},
		),
		publishMock: vi.fn(),
	}
})

vi.mock("mobx-react-lite", () => ({
	observer: (component: unknown) => component,
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: (fn: (...args: any[]) => any) => fn,
}))

vi.mock("react-i18next", () => ({
	useTranslation: (namespace?: string) => ({
		t: (key: string) => {
			if (namespace === "crew/create" && key === "untitledCrew") return "Untitled Crew"

			const translations: Record<string, string> = {
				"modeToggle.selectCrew": "Select Crew",
				"modeToggle.searchPlaceholder": "Search crew",
				"modeToggle.emptySearchResult": "No matching crew",
				"modeToggle.createNewTopic": "Create New Topic",
				"modeToggle.createNewChat": "Create New Chat",
				"messageEditor.modelSwitch.expandDescription": "Expand description",
				"messageEditor.modelSwitch.collapseDescription": "Collapse description",
			}

			return translations[key] ?? key
		},
	}),
	Trans: ({ values }: { values?: Record<string, unknown> }) => (
		<span>{`Cannot switch to ${String(values?.modeName ?? "")}`}</span>
	),
}))

vi.mock("@/pages/superMagic/hooks/useFeaturedModeListRefresh", () => ({
	useFeaturedModeListRefreshOnFirstOpen: vi.fn(),
}))

vi.mock("@/services/superMagic/SuperMagicModeService", () => ({
	default: {
		modeList: modeListMock,
		getModeConfigWithLegacy: getModeConfigWithLegacyMock,
	},
}))

vi.mock("@/components/base", () => ({
	MagicIcon: ({ component: Component, ...props }: { component: (props: any) => ReactNode }) =>
		Component ? <Component {...props} /> : null,
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: publishMock,
	},
	PubSubEvents: {
		Create_New_Topic: "Create_New_Topic",
	},
}))

vi.mock("@/components/other/BlackPurpleButton", () => ({
	default: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}))

const popoverContext = createContext<{
	open: boolean
	onOpenChange?: (open: boolean) => void
} | null>(null)

vi.mock("@/components/shadcn-ui/popover", () => ({
	Popover: ({
		children,
		open = false,
		onOpenChange,
	}: {
		children: ReactNode
		open?: boolean
		onOpenChange?: (open: boolean) => void
	}) => (
		<popoverContext.Provider value={{ open, onOpenChange }}>{children}</popoverContext.Provider>
	),
	PopoverTrigger: ({ children }: { children: React.ReactElement }) => {
		const context = useContext(popoverContext)
		return (
			<button
				type="button"
				onClick={() => context?.onOpenChange?.(!context.open)}
				data-testid="mock-popover-trigger"
			>
				{children}
			</button>
		)
	},
	PopoverContent: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => {
		const context = useContext(popoverContext)
		if (!context?.open) return null
		return <div {...props}>{children}</div>
	},
	PopoverAnchor: () => null,
}))

vi.mock("@/components/shadcn-ui/input", () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("../../MessageEditor/components/ModelSwitch/components/CollapsibleDescription", () => ({
	CollapsibleDescription: ({
		description,
		isExpanded,
		onToggle,
		expandLabel,
		collapseLabel,
	}: {
		description?: string
		isExpanded: boolean
		onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void
		expandLabel: string
		collapseLabel: string
	}) => {
		if (!description) return null

		return (
			<div>
				<div data-testid="mock-collapsible-description-content">
					{isExpanded ? description : description.slice(0, 20)}
				</div>
				<button
					type="button"
					data-collapsible-description-toggle="true"
					data-testid="collapsible-description-toggle"
					aria-expanded={isExpanded}
					aria-label={isExpanded ? collapseLabel : expandLabel}
					onClick={onToggle}
				>
					toggle
				</button>
			</div>
		)
	},
}))

vi.mock("@/hooks/use-mobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("@/components/shadcn-ui/drawer", () => ({
	DrawerTitle: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}))

vi.mock("../ModeAvatar", () => ({
	default: ({ mode }: { mode: { identifier: string; name: string } }) => (
		<div data-testid={`mode-avatar-${mode.identifier}`}>{mode.name}</div>
	),
}))

import ModeToggle from "../ModeToggle"

describe("ModeToggle", () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it("keeps the popover open when toggling a mode description", () => {
		render(<ModeToggle topicMode={"mode-a" as never} allowChangeMode onModeChange={vi.fn()} />)

		fireEvent.click(screen.getByTestId("mock-popover-trigger"))

		expect(screen.getByTestId("super-message-editor-mode-toggle-content")).toBeInTheDocument()

		const toggleButton = screen.getAllByTestId("collapsible-description-toggle")[0]
		fireEvent.click(toggleButton)

		expect(screen.getByTestId("super-message-editor-mode-toggle-content")).toBeInTheDocument()
		expect(toggleButton).toHaveAttribute("aria-expanded", "true")
	})

	it("supports keyboard selection for mode items", () => {
		const onModeChange = vi.fn()

		render(
			<ModeToggle
				topicMode={"mode-a" as never}
				allowChangeMode
				onModeChange={onModeChange}
			/>,
		)

		fireEvent.click(screen.getByTestId("mock-popover-trigger"))

		const modeItems = screen.getAllByTestId("super-message-editor-mode-toggle-item")
		fireEvent.keyDown(modeItems[1], { key: "Enter" })

		expect(onModeChange).toHaveBeenCalledWith("mode-b")
		expect(
			screen.queryByTestId("super-message-editor-mode-toggle-content"),
		).not.toBeInTheDocument()
	})

	it("shows topic copy on cannot-switch confirm when useChatTerminology is false", () => {
		render(
			<ModeToggle
				topicMode={"mode-a" as never}
				allowChangeMode={false}
				useChatTerminology={false}
				onModeChange={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mock-popover-trigger"))
		fireEvent.click(screen.getAllByTestId("super-message-editor-mode-toggle-item")[1])

		expect(
			screen.getByTestId("super-message-editor-mode-toggle-create-topic-button"),
		).toHaveTextContent("Create New Topic")
	})

	it("shows chat copy on cannot-switch confirm when useChatTerminology is true", () => {
		render(
			<ModeToggle
				topicMode={"mode-a" as never}
				allowChangeMode={false}
				useChatTerminology
				onModeChange={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mock-popover-trigger"))
		fireEvent.click(screen.getAllByTestId("super-message-editor-mode-toggle-item")[1])

		expect(
			screen.getByTestId("super-message-editor-mode-toggle-create-topic-button"),
		).toHaveTextContent("Create New Chat")
	})
})
