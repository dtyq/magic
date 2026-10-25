import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import WidgetMessageHeader from "../WidgetMessageHeader"

const magicToastError = vi.hoisted(() => vi.fn())
const shellProps = vi.hoisted(() => ({
	current: null as null | {
		titlePresentation?: {
			primary?: string
			primaryVisible?: boolean
			secondaryMode?: string
			secondaryText?: string
			renameEnabled?: boolean
		}
		isBuiltinActionVisible?: (action: string) => boolean
		onBuiltinAction?: (action: string) => Promise<void> | void
	},
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/base", () => ({
	MagicTooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/base/MagicToaster/utils", () => ({
	default: {
		error: magicToastError,
	},
}))

vi.mock("lucide-react", () => {
	function createIcon(name: string) {
		return function MockIcon() {
			return <span data-testid={`icon-${name}`} />
		}
	}

	return {
		Maximize2: createIcon("maximize-2"),
		Pin: createIcon("pin"),
		X: createIcon("x"),
	}
})

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children, onClick, ...props }: { children: ReactNode; onClick?: () => void }) => (
		<button type="button" onClick={onClick} {...props}>
			{children}
		</button>
	),
}))

vi.mock("@/pages/superMagic/components/MessageHeader", () => ({
	default: (props: {
		titlePresentation?: {
			primary?: string
			primaryVisible?: boolean
			secondaryMode?: string
			secondaryText?: string
			renameEnabled?: boolean
		}
		isBuiltinActionVisible?: (action: string) => boolean
		onBuiltinAction?: (action: string) => Promise<void> | void
		addonActionsBefore?: ReactNode
		addonActionsAfter?: ReactNode
	}) => {
		shellProps.current = props
		return (
			<div>
				<div data-testid="shell-title">{props.titlePresentation?.primary}</div>
				<div data-testid="shell-secondary-mode">
					{props.titlePresentation?.secondaryMode}
				</div>
				<div data-testid="shell-secondary-text">
					{props.titlePresentation?.secondaryText}
				</div>
				<div data-testid="shell-rename">
					{String(props.titlePresentation?.renameEnabled)}
				</div>
				<div data-testid="shell-new-topic-visible">
					{String(props.isBuiltinActionVisible?.("newTopic"))}
				</div>
				{props.addonActionsBefore}
				{props.addonActionsAfter}
				<button
					type="button"
					data-testid="shell-share"
					onClick={() => void props.onBuiltinAction?.("share")}
				>
					share
				</button>
			</div>
		)
	},
}))

const selectedTopic = {
	id: "topic-1",
	topic_name: "Alpha Topic",
}

function renderHeader(
	overrides: Partial<{
		header: {
			visible?: boolean
			title?: string | { mode?: "static" | "hidden"; text?: string }
			topicName?: { mode?: "current" | "hidden" | "static"; text?: string }
			actions?: Record<string, boolean>
		}
		windowClosable: boolean
		showTopicHistory: boolean
		onHeaderAction: ReturnType<typeof vi.fn>
	}> = {},
) {
	const onHeaderAction = overrides.onHeaderAction ?? vi.fn().mockResolvedValue(true)
	render(
		<WidgetMessageHeader
			header={overrides.header}
			windowClosable={overrides.windowClosable}
			showTopicHistory={overrides.showTopicHistory}
			onHeaderAction={onHeaderAction}
			selectedProject={null}
			topicStore={{ selectedTopic, topics: [selectedTopic] } as never}
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
				} as never
			}
		/>,
	)
	return { onHeaderAction }
}

describe("WidgetMessageHeader", () => {
	beforeEach(() => {
		magicToastError.mockReset()
		shellProps.current = null
	})

	it("hides the shell when the host header is not visible", () => {
		renderHeader({ header: { visible: false } })

		expect(screen.queryByTestId("shell-title")).not.toBeInTheDocument()
	})

	it("maps a static topic label and hides configured actions", () => {
		renderHeader({
			header: {
				title: "Mock Assistant",
				topicName: { mode: "static", text: "Mock Topic" },
				actions: { fullscreen: false, newTopic: false, close: false },
			},
			windowClosable: true,
		})

		expect(screen.getByTestId("shell-title")).toHaveTextContent("Mock Assistant")
		expect(screen.getByTestId("shell-secondary-mode")).toHaveTextContent("fixed")
		expect(screen.getByTestId("shell-secondary-text")).toHaveTextContent("Mock Topic")
		expect(screen.getByTestId("shell-rename")).toHaveTextContent("false")
		expect(screen.getByTestId("shell-new-topic-visible")).toHaveTextContent("false")
		expect(screen.queryByTestId("message-header-fullscreen-button")).not.toBeInTheDocument()
		expect(screen.getByTestId("message-header-pin-window-button")).toBeInTheDocument()
		expect(screen.queryByTestId("message-header-close-button")).not.toBeInTheDocument()
	})

	it("omits the first title line when the host hides it", () => {
		renderHeader({
			header: { title: { mode: "hidden" }, topicName: { mode: "current" } },
		})

		expect(shellProps.current?.titlePresentation).toMatchObject({
			primary: "",
			primaryVisible: false,
			secondaryMode: "live",
			renameEnabled: true,
		})
		expect(screen.getByTestId("message-header-pin-window-button")).toBeInTheDocument()
	})

	it("hides history when the conversation disables topic history", () => {
		renderHeader({ showTopicHistory: false })

		expect(shellProps.current?.isBuiltinActionVisible?.("history")).toBe(false)
		expect(shellProps.current?.isBuiltinActionVisible?.("newTopic")).toBe(true)
	})

	it("delegates fullscreen and close clicks with the current topic", () => {
		const { onHeaderAction } = renderHeader({ windowClosable: true })

		fireEvent.click(screen.getByTestId("message-header-fullscreen-button"))
		fireEvent.click(screen.getByTestId("message-header-close-button"))

		expect(onHeaderAction).toHaveBeenCalledWith("fullscreen", {
			topicId: "topic-1",
			topicName: "Alpha Topic",
		})
		expect(onHeaderAction).toHaveBeenCalledWith("close", {
			topicId: "topic-1",
			topicName: "Alpha Topic",
		})
	})

	it("reports a host callback failure without rejecting the completed action", async () => {
		const onHeaderAction = vi.fn().mockRejectedValue(new Error("timeout"))
		renderHeader({ onHeaderAction })

		fireEvent.click(screen.getByTestId("shell-share"))

		await waitFor(() => {
			expect(magicToastError).toHaveBeenCalledWith("messageHeader.headerActionFailed")
		})
		await expect(shellProps.current?.onBuiltinAction?.("share")).resolves.toBeUndefined()
	})
})
