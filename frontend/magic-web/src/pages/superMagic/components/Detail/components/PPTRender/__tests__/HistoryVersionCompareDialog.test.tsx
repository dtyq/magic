import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import HistoryVersionCompareDialog from "../components/HistoryVersionCompareDialog"

const capturedRendererProps = vi.hoisted(() => ({
	latest: [] as Array<{ isPptRender?: boolean; disableHtmlAppPermissions?: boolean }>,
	history: [] as Array<{ isPptRender?: boolean; disableHtmlAppPermissions?: boolean }>,
}))

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/components/base", () => ({
	MagicTooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/shadcn-ui/select", async () => {
	const React = await import("react")

	const SelectContext = React.createContext<{
		onValueChange?: (value: string) => void
	}>({})

	return {
		Select: ({
			onValueChange,
			children,
			value,
		}: {
			onValueChange?: (value: string) => void
			children: React.ReactNode
			value?: string
		}) => (
			<SelectContext.Provider value={{ onValueChange }}>
				<div data-testid="mock-select" data-value={value}>
					{children}
				</div>
			</SelectContext.Provider>
		),
		SelectTrigger: ({
			children,
			...props
		}: {
			children: React.ReactNode
			"data-testid"?: string
		}) => (
			<button type="button" {...props}>
				{children}
			</button>
		),
		SelectValue: ({ children }: { children: React.ReactNode }) => <>{children}</>,
		SelectContent: ({ children }: { children: React.ReactNode }) => (
			<div data-testid="mock-select-content">{children}</div>
		),
		SelectItem: ({ value, children }: { value: string; children: React.ReactNode }) => {
			const context = React.useContext(SelectContext)
			return (
				<button
					type="button"
					data-testid={`mock-select-item-${value}`}
					onClick={() => context.onValueChange?.(value)}
				>
					{children}
				</button>
			)
		},
	}
})

vi.mock("@/components/base/MagicModal", () => ({
	default: ({
		open,
		title,
		children,
	}: {
		open: boolean
		title?: React.ReactNode
		children: React.ReactNode
	}) =>
		open ? (
			<div data-testid="magic-modal">
				{title}
				{children}
			</div>
		) : null,
}))

vi.mock("../../../contents/HTML/IsolatedHTMLRenderer", async () => {
	const React = await import("react")

	return {
		__esModule: true,
		default: React.forwardRef(function MockIsolatedHTMLRenderer(
			props: {
				isPptRender?: boolean
				fileId?: string
				disableHtmlAppPermissions?: boolean
			},
			_ref,
		) {
			if (props.fileId?.includes("-latest")) {
				capturedRendererProps.latest.push({
					isPptRender: props.isPptRender,
					disableHtmlAppPermissions: props.disableHtmlAppPermissions,
				})
			} else {
				capturedRendererProps.history.push({
					isPptRender: props.isPptRender,
					disableHtmlAppPermissions: props.disableHtmlAppPermissions,
				})
			}
			return <div data-testid="isolated-html-renderer" />
		}),
	}
})

const defaultProps = {
	open: true,
	onOpenChange: vi.fn(),
	latestContent: "<html>latest</html>",
	historyContent: "<html>history</html>",
	historyVersion: 2,
	fileVersionsList: [
		{ version: 3, edit_type: 0 },
		{ version: 2, edit_type: 1 },
		{ version: 1, edit_type: 1 },
	],
	onUseHistoryVersion: vi.fn(),
	onUseLatestVersion: vi.fn(),
	onSwitchHistoryVersion: vi.fn().mockResolvedValue(undefined),
	filePathMapping: new Map<string, string>(),
	openNewTab: vi.fn(),
	fileId: "file-1",
}

describe("HistoryVersionCompareDialog", () => {
	beforeEach(() => {
		capturedRendererProps.latest = []
		capturedRendererProps.history = []
	})

	it("uses isPptRender=false for html preview", () => {
		render(<HistoryVersionCompareDialog {...defaultProps} isPptRender={false} />)

		expect(capturedRendererProps.latest[0]?.isPptRender).toBe(false)
		expect(capturedRendererProps.history[0]?.isPptRender).toBe(false)
	})

	it("disables HTML app permissions in both comparison previews", () => {
		render(<HistoryVersionCompareDialog {...defaultProps} isPptRender={false} />)

		expect(capturedRendererProps.latest[0]?.disableHtmlAppPermissions).toBe(true)
		expect(capturedRendererProps.history[0]?.disableHtmlAppPermissions).toBe(true)
	})

	it("uses isPptRender=true by default for ppt content", () => {
		render(<HistoryVersionCompareDialog {...defaultProps} />)

		expect(capturedRendererProps.latest[0]?.isPptRender).toBe(true)
		expect(capturedRendererProps.history[0]?.isPptRender).toBe(true)
		expect(capturedRendererProps.latest[0]?.disableHtmlAppPermissions).toBe(true)
		expect(capturedRendererProps.history[0]?.disableHtmlAppPermissions).toBe(true)
	})

	it("renders description as subtitle under modal title", () => {
		render(<HistoryVersionCompareDialog {...defaultProps} isPptRender={false} />)

		const title = screen.getByTestId("history-version-compare-dialog-title")
		expect(title).toHaveTextContent("ppt.versionCompare.historyTitle")
		expect(title).toHaveTextContent("ppt.versionCompare.historyDescription")
		expect(screen.queryByText("ppt.versionCompare.historyDescription")).toBeInTheDocument()
	})

	it("renders compare columns only without view mode tabs", () => {
		render(<HistoryVersionCompareDialog {...defaultProps} isPptRender={false} />)

		expect(screen.getByTestId("history-version-compare-columns")).toBeInTheDocument()
		expect(screen.queryByTestId("history-version-view-mode-compare")).not.toBeInTheDocument()
		expect(screen.queryByTestId("history-version-view-mode-preview")).not.toBeInTheDocument()
	})

	it("opens fullscreen with version selector and actions in modal header", () => {
		render(<HistoryVersionCompareDialog {...defaultProps} isPptRender={false} />)

		fireEvent.click(screen.getByTestId("history-version-fullscreen-preview-button"))

		expect(screen.getByTestId("history-version-fullscreen-modal")).toHaveAttribute(
			"data-fullscreen-active",
			"true",
		)
		expect(screen.getByTestId("history-version-fullscreen-header-actions")).toBeInTheDocument()
		expect(screen.getAllByTestId("history-version-fullscreen-version-select")).toHaveLength(1)
		expect(
			screen.queryByTestId("history-version-fullscreen-toolbar-select"),
		).not.toBeInTheDocument()
		expect(screen.getAllByTestId("magic-modal")).toHaveLength(1)
	})

	it("shows loading overlay without unmounting history renderer while switching", async () => {
		let resolveSwitch: (() => void) | undefined
		const onSwitchHistoryVersion = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					resolveSwitch = resolve
				}),
		)
		const props = {
			...defaultProps,
			isPptRender: false,
			onSwitchHistoryVersion,
		}

		render(<HistoryVersionCompareDialog {...props} />)
		fireEvent.click(screen.getByTestId("history-version-fullscreen-preview-button"))

		const headerActions = screen.getByTestId("history-version-fullscreen-header-actions")
		fireEvent.click(
			headerActions.querySelector('[data-testid="mock-select-item-1"]') as HTMLElement,
		)

		await waitFor(() => expect(onSwitchHistoryVersion).toHaveBeenCalledWith(1))
		expect(screen.getByTestId("history-version-content-loading")).toBeInTheDocument()
		expect(screen.getAllByTestId("isolated-html-renderer").length).toBeGreaterThan(0)

		resolveSwitch?.()
		await waitFor(() =>
			expect(screen.queryByTestId("history-version-content-loading")).not.toBeInTheDocument(),
		)
	})

	it("syncs compare dropdown when switching version in fullscreen", async () => {
		const onSwitchHistoryVersion = vi.fn().mockResolvedValue(undefined)
		const props = {
			...defaultProps,
			isPptRender: false,
			onSwitchHistoryVersion,
		}

		const { rerender } = render(<HistoryVersionCompareDialog {...props} />)

		fireEvent.click(screen.getByTestId("history-version-fullscreen-preview-button"))

		const headerActions = screen.getByTestId("history-version-fullscreen-header-actions")
		fireEvent.click(
			headerActions.querySelector('[data-testid="mock-select-item-1"]') as HTMLElement,
		)

		await waitFor(() => expect(onSwitchHistoryVersion).toHaveBeenCalledWith(1))

		rerender(
			<HistoryVersionCompareDialog
				{...props}
				historyVersion={1}
				historyContent="<html>v1</html>"
			/>,
		)

		expect(screen.getByTestId("history-version-fullscreen-modal")).toHaveAttribute(
			"data-fullscreen-active",
			"true",
		)
		expect(screen.getByTestId("history-version-fullscreen-version-select")).toHaveTextContent(
			"v1",
		)

		fireEvent.click(screen.getByTestId("history-version-fullscreen-close"))
		expect(screen.getByTestId("history-version-compare-version-select")).toHaveTextContent("v1")
	})

	it("keeps cancel and confirm in footer while fullscreen controls stay in header", () => {
		render(<HistoryVersionCompareDialog {...defaultProps} isPptRender={false} />)

		fireEvent.click(screen.getByTestId("history-version-fullscreen-preview-button"))

		expect(screen.getByTestId("history-version-fullscreen-modal")).toHaveAttribute(
			"data-fullscreen-active",
			"true",
		)
		const headerActions = screen.getByTestId("history-version-fullscreen-header-actions")
		expect(headerActions).toContainElement(
			screen.getByTestId("history-version-fullscreen-version-select"),
		)
		expect(headerActions).toContainElement(
			screen.getByTestId("history-version-fullscreen-close"),
		)
		expect(screen.getByTestId("history-version-compare-dialog-footer")).toBeInTheDocument()
		expect(screen.getByTestId("ppt-history-version-compare-dialog-cancel")).toBeVisible()
		expect(screen.getByTestId("ppt-history-version-compare-dialog-confirm")).toBeVisible()
	})

	it("closes fullscreen overlay from close button", () => {
		render(<HistoryVersionCompareDialog {...defaultProps} isPptRender={false} />)

		fireEvent.click(screen.getByTestId("history-version-fullscreen-preview-button"))
		expect(screen.getByTestId("history-version-fullscreen-modal")).toHaveAttribute(
			"data-fullscreen-active",
			"true",
		)

		fireEvent.click(screen.getByTestId("history-version-fullscreen-close"))
		expect(screen.getByTestId("history-version-fullscreen-modal")).toHaveAttribute(
			"data-fullscreen-active",
			"false",
		)
	})

	it("keeps a single history renderer mounted when toggling fullscreen", () => {
		render(<HistoryVersionCompareDialog {...defaultProps} isPptRender={false} />)

		expect(screen.getAllByTestId("isolated-html-renderer")).toHaveLength(2)

		fireEvent.click(screen.getByTestId("history-version-fullscreen-preview-button"))
		expect(screen.getAllByTestId("isolated-html-renderer")).toHaveLength(2)

		fireEvent.click(screen.getByTestId("history-version-fullscreen-close"))
		expect(screen.getAllByTestId("isolated-html-renderer")).toHaveLength(2)
	})

	it("reverts compare version when history fetch fails", async () => {
		const onSwitchHistoryVersion = vi.fn().mockRejectedValue(new Error("fetch failed"))
		const props = {
			...defaultProps,
			isPptRender: false,
			onSwitchHistoryVersion,
		}

		render(<HistoryVersionCompareDialog {...props} />)

		fireEvent.click(screen.getByTestId("mock-select-item-1"))

		await waitFor(() => expect(onSwitchHistoryVersion).toHaveBeenCalledWith(1))

		expect(screen.getByTestId("history-version-compare-version-select")).toHaveTextContent("v2")
	})

	it("confirms keep latest when latest column is selected", () => {
		const onUseLatestVersion = vi.fn()
		render(
			<HistoryVersionCompareDialog
				{...defaultProps}
				onUseLatestVersion={onUseLatestVersion}
			/>,
		)

		fireEvent.click(screen.getByTestId("history-version-compare-select-latest"))
		fireEvent.click(screen.getByTestId("ppt-history-version-compare-dialog-confirm"))

		expect(onUseLatestVersion).toHaveBeenCalled()
	})
})
