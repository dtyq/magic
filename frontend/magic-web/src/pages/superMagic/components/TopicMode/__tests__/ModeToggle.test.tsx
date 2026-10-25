import { fireEvent, render, screen } from "@testing-library/react"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { createContext, useContext, useRef } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const {
	modeListMock,
	getModeConfigWithLegacyMock,
	publishMock,
	shouldSuppressInputAutoFocusOnIPadMock,
	preventOpenAutoFocusMock,
	useIsMobileMock,
} = vi.hoisted(() => {
	const modeList = [
		{
			agent: { is_visible: true },
			mode: {
				identifier: "mode-a",
				name: "Mode A",
				description:
					"This is a very long description for Mode A that should be expandable in tests.",
			},
		},
		{
			agent: { is_visible: true },
			mode: {
				identifier: "mode-b",
				name: "Mode B",
				description:
					"This is a very long description for Mode B that should also be expandable.",
			},
		},
		{
			agent: { is_visible: false },
			mode: {
				identifier: "mode-hidden",
				name: "Hidden Mode",
				description: "This mode is hidden from the home crew list.",
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
				const identifier = topicMode === "custom_agent" && agentCode ? agentCode : topicMode
				return modeList.find((item) => item.mode.identifier === identifier) ?? null
			},
		),
		publishMock: vi.fn(),
		shouldSuppressInputAutoFocusOnIPadMock: vi.fn(() => false),
		preventOpenAutoFocusMock: vi.fn(),
		useIsMobileMock: vi.fn(() => false),
	}
})

vi.mock("mobx-react-lite", () => ({
	observer: (component: unknown) => component,
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: never[]) => unknown>(fn: T) => {
		const fnRef = useRef(fn)
		fnRef.current = fn
		const stableFnRef = useRef<T | null>(null)

		if (!stableFnRef.current) {
			stableFnRef.current = ((...args: Parameters<T>) => fnRef.current(...args)) as T
		}

		return stableFnRef.current
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: (namespace?: string) => ({
		t: (key: string) => {
			if (namespace === "crew/create" && key === "untitledCrew") return "Untitled Crew"

			const translations: Record<string, string> = {
				"modeToggle.selectCrew": "Select Crew",
				"modeToggle.searchPlaceholder": "Search crew",
				"modeToggle.emptySearchResult": "No matching crew",
				"modeToggle.hiddenCrew": "Hidden Crew",
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
	MagicIcon: ({
		component: Component,
		...props
	}: {
		component: (props: Record<string, unknown>) => ReactNode
	}) => (Component ? <Component {...props} /> : null),
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: publishMock,
	},
	PubSubEvents: {
		Create_New_Topic: "Create_New_Topic",
	},
}))

vi.mock("@/utils/inputFocusPolicy", () => ({
	shouldSuppressInputAutoFocusOnIPad: shouldSuppressInputAutoFocusOnIPadMock,
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
			<div
				onClick={() => context?.onOpenChange?.(!context.open)}
				data-testid="mock-popover-trigger"
			>
				{children}
			</div>
		)
	},
	PopoverContent: ({
		children,
		className,
		collisionPadding,
		avoidCollisions,
		"data-testid": testId,
		onOpenAutoFocus,
	}: {
		children: ReactNode
		className?: string
		collisionPadding?: number
		avoidCollisions?: boolean
		"data-testid"?: string
		onOpenAutoFocus?: (event: { preventDefault: () => void }) => void
	}) => {
		const context = useContext(popoverContext)
		if (!context?.open) return null
		onOpenAutoFocus?.({ preventDefault: preventOpenAutoFocusMock })
		return (
			<div
				className={className}
				data-testid={testId}
				data-collision-padding={collisionPadding}
				data-avoid-collisions={avoidCollisions}
			>
				{children}
			</div>
		)
	},
	PopoverAnchor: () => null,
}))

vi.mock("@/components/shadcn-ui/input", () => ({
	Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}))

vi.mock("@/components/base-mobile/MagicPopup", () => ({
	default: ({ children, position }: { children: ReactNode; position?: string }) => (
		<div data-testid="mock-magic-popup" data-position={position}>
			{children}
		</div>
	),
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
	useIsMobile: useIsMobileMock,
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
		vi.useRealTimers()
		shouldSuppressInputAutoFocusOnIPadMock.mockReturnValue(false)
		useIsMobileMock.mockReturnValue(false)
	})

	it("opens the mobile crew selector from the bottom when configured", () => {
		useIsMobileMock.mockReturnValue(true)

		render(
			<ModeToggle
				topicMode={"mode-a" as never}
				allowChangeMode
				mobilePopupPosition="bottom"
				onModeChange={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("set-open"))

		expect(screen.getByTestId("mock-magic-popup")).toHaveAttribute("data-position", "bottom")
	})

	it("prevents the search input from receiving automatic focus on iPad", () => {
		shouldSuppressInputAutoFocusOnIPadMock.mockReturnValue(true)

		render(<ModeToggle topicMode={"mode-a" as never} allowChangeMode onModeChange={vi.fn()} />)

		fireEvent.click(screen.getByTestId("mock-popover-trigger"))

		expect(shouldSuppressInputAutoFocusOnIPadMock).toHaveBeenCalled()
		expect(preventOpenAutoFocusMock).toHaveBeenCalledOnce()
	})

	it.each([true, false])(
		"constrains the desktop mode popover to the available viewport (%s)",
		(allowChangeMode) => {
			render(
				<ModeToggle
					topicMode={"mode-a" as never}
					allowChangeMode={allowChangeMode}
					onModeChange={vi.fn()}
				/>,
			)

			fireEvent.click(screen.getByTestId("mock-popover-trigger"))

			const popover = screen.getByTestId("super-message-editor-mode-toggle-popover")
			expect(popover).toHaveClass(
				"max-h-[min(90dvh,var(--radix-popover-content-available-height))]",
			)
			expect(popover).toHaveAttribute("data-collision-padding", "8")
			expect(popover).toHaveAttribute("data-avoid-collisions", "true")
			expect(screen.getByTestId("super-message-editor-mode-toggle-content")).toHaveClass(
				"min-h-0",
			)
			expect(
				screen.getByTestId("super-message-editor-mode-toggle-list-container"),
			).toHaveClass("min-h-0", "flex-1", "overflow-hidden")
			expect(screen.getByTestId("super-message-editor-mode-toggle-list")).toHaveClass(
				"min-h-0",
				"flex-1",
				"overflow-y-auto",
			)
		},
	)

	it("keeps the popover open when toggling a mode description", () => {
		render(<ModeToggle topicMode={"mode-a" as never} allowChangeMode onModeChange={vi.fn()} />)

		fireEvent.click(screen.getByTestId("mock-popover-trigger"))

		expect(screen.getByTestId("super-message-editor-mode-toggle-content")).toBeInTheDocument()

		const toggleButton = screen.getAllByTestId("collapsible-description-toggle")[0]
		fireEvent.click(toggleButton)

		expect(screen.getByTestId("super-message-editor-mode-toggle-content")).toBeInTheDocument()
		expect(toggleButton).toHaveAttribute("aria-expanded", "true")
	})

	it("keeps hidden modes collapsed at the bottom by default", () => {
		render(<ModeToggle topicMode={"mode-a" as never} allowChangeMode onModeChange={vi.fn()} />)

		fireEvent.click(screen.getByTestId("mock-popover-trigger"))

		const hiddenTrigger = screen.getByTestId("super-message-editor-mode-toggle-hidden-trigger")
		expect(hiddenTrigger).toHaveAttribute("aria-expanded", "false")
		expect(screen.queryByText("Hidden Mode")).not.toBeInTheDocument()

		fireEvent.click(hiddenTrigger)

		expect(hiddenTrigger).toHaveAttribute("aria-expanded", "true")
		expect(screen.getByText("Hidden Mode")).toBeInTheDocument()
	})

	it("keeps visible and hidden modes in independent scroll areas", () => {
		render(<ModeToggle topicMode={"mode-a" as never} allowChangeMode onModeChange={vi.fn()} />)

		fireEvent.click(screen.getByTestId("mock-popover-trigger"))

		const visibleList = screen.getByTestId("super-message-editor-mode-toggle-list")
		const hiddenSection = screen.getByTestId("super-message-editor-mode-toggle-hidden-section")

		expect(visibleList).not.toContainElement(hiddenSection)
		expect(visibleList).toHaveClass("overflow-y-auto")

		fireEvent.click(screen.getByTestId("super-message-editor-mode-toggle-hidden-trigger"))

		expect(screen.getByTestId("super-message-editor-mode-toggle-hidden-list")).toHaveClass(
			"overflow-y-auto",
			"scrollbar-y-thin",
		)
	})

	it("does not render the hidden section when no hidden mode matches", () => {
		render(<ModeToggle topicMode={"mode-a" as never} allowChangeMode onModeChange={vi.fn()} />)

		fireEvent.click(screen.getByTestId("mock-popover-trigger"))
		fireEvent.change(screen.getByTestId("super-message-editor-mode-toggle-search-input"), {
			target: { value: "Mode A" },
		})

		expect(
			screen.queryByTestId("super-message-editor-mode-toggle-hidden-section"),
		).not.toBeInTheDocument()
	})

	it("keeps the list scroll position when manually expanding hidden modes", () => {
		const originalScrollIntoView = HTMLElement.prototype.scrollIntoView
		const requestAnimationFrameSpy = vi
			.spyOn(window, "requestAnimationFrame")
			.mockImplementation((callback) => {
				callback(0)
				return 1
			})

		Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
			configurable: true,
			value: vi.fn(function (this: HTMLElement) {
				const list = this.closest(
					'[data-testid="super-message-editor-mode-toggle-list"]',
				) as HTMLElement | null
				if (list) list.scrollTop = 0
			}),
		})

		try {
			render(
				<ModeToggle topicMode={"mode-a" as never} allowChangeMode onModeChange={vi.fn()} />,
			)

			fireEvent.click(screen.getByTestId("mock-popover-trigger"))

			const list = screen.getByTestId("super-message-editor-mode-toggle-list")
			list.scrollTop = 160

			fireEvent.click(screen.getByTestId("super-message-editor-mode-toggle-hidden-trigger"))

			expect(list.scrollTop).toBe(160)
		} finally {
			requestAnimationFrameSpy.mockRestore()
			if (originalScrollIntoView) {
				Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
					configurable: true,
					value: originalScrollIntoView,
				})
			} else {
				Reflect.deleteProperty(HTMLElement.prototype, "scrollIntoView")
			}
		}
	})

	it("automatically expands hidden modes when the current topic uses one", () => {
		render(
			<ModeToggle
				topicMode={"custom_agent" as never}
				agentCode="mode-hidden"
				allowChangeMode
				onModeChange={vi.fn()}
			/>,
		)

		fireEvent.click(screen.getByTestId("mock-popover-trigger"))

		expect(
			screen.getByTestId("super-message-editor-mode-toggle-hidden-trigger"),
		).toHaveAttribute("aria-expanded", "true")
		expect(screen.getAllByText("Hidden Mode")).toHaveLength(2)
		expect(
			screen.getByTestId("super-message-editor-mode-toggle-item-selected"),
		).toBeInTheDocument()
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

	it("shows a selectable fallback trigger when the current mode is unavailable", () => {
		render(
			<ModeToggle
				topicMode={"missing-mode" as never}
				allowChangeMode
				onModeChange={vi.fn()}
			/>,
		)

		const trigger = screen.getByTestId("mode-toggle-button")
		expect(trigger).toHaveAttribute("data-mode-unavailable", "true")
		expect(trigger).toHaveTextContent("Select Crew")

		fireEvent.click(screen.getByTestId("mock-popover-trigger"))

		expect(screen.getByTestId("super-message-editor-mode-toggle-popover")).toBeInTheDocument()
	})

	it("publishes the requested mode when creating a new topic from a locked topic", () => {
		vi.useFakeTimers()
		const onModeChange = vi.fn()

		render(
			<ModeToggle
				topicMode={"mode-a" as never}
				allowChangeMode={false}
				onModeChange={onModeChange}
			/>,
		)

		fireEvent.click(screen.getByTestId("mock-popover-trigger"))

		const modeItems = screen.getAllByTestId("super-message-editor-mode-toggle-item")
		fireEvent.click(modeItems[1])
		fireEvent.click(screen.getByTestId("super-message-editor-mode-toggle-create-topic-button"))

		vi.runAllTimers()

		expect(publishMock).toHaveBeenCalledWith("Create_New_Topic", { topicMode: "mode-b" })
		expect(onModeChange).toHaveBeenCalledWith("mode-b")
	})

	it("uses the scoped topic callback when provided", () => {
		vi.useFakeTimers()
		const onCreateTopic = vi.fn()
		const onModeChange = vi.fn()

		render(
			<ModeToggle
				topicMode={"mode-a" as never}
				allowChangeMode={false}
				onModeChange={onModeChange}
				onCreateTopic={onCreateTopic}
			/>,
		)

		fireEvent.click(screen.getByTestId("mock-popover-trigger"))
		fireEvent.click(screen.getAllByTestId("super-message-editor-mode-toggle-item")[1])
		fireEvent.click(screen.getByTestId("super-message-editor-mode-toggle-create-topic-button"))
		vi.runAllTimers()

		expect(onCreateTopic).toHaveBeenCalledWith("mode-b")
		expect(publishMock).not.toHaveBeenCalled()
		expect(onModeChange).not.toHaveBeenCalled()
	})
})
