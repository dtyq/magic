import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import PPTSlide from "../PPTSlide"

const mockState = vi.hoisted(() => ({
	triggerSave: vi.fn(),
	updateContent: vi.fn(),
	resetContent: vi.fn(),
	getContent: vi.fn(),
	clearServerUpdate: vi.fn(),
	applyServerUpdate: vi.fn(),
	onManualSave: vi.fn(),
	onDeactivate: vi.fn(),
	saveEditContent: vi.fn(),
	renderedIsolatedProps: vi.fn(),
}))

vi.mock("react-i18next", () => ({
	initReactI18next: {
		type: "3rdParty",
		init: () => undefined,
	},
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("mobx-react-lite", () => ({
	observer: <T,>(component: T) => component,
}))

vi.mock("ahooks", () => ({
	useMemoizedFn: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("@/lib/utils", () => ({
	cn: (...classNames: Array<string | false | null | undefined>) =>
		classNames.filter(Boolean).join(" "),
}))

vi.mock("../../../hooks/useEditMode", async () => {
	const React = await import("react")

	function useMockEditMode() {
		const [isEditMode, setIsEditMode] = React.useState(true)
		return { isEditMode, setIsEditMode }
	}

	return {
		default: useMockEditMode,
	}
})

vi.mock("../../../hooks/useSaveHandlerRegistration", () => ({
	default: () => undefined,
}))

vi.mock("../../../hooks/useServerUpdate", async () => {
	const React = await import("react")

	function useMockServerUpdate({
		externalServerUpdatedContent,
	}: {
		externalServerUpdatedContent?: string
	}) {
		const [showSaveWithUpdateConfirmDialog, setShowSaveWithUpdateConfirmDialog] =
			React.useState(false)
		const hasServerUpdate = Boolean(externalServerUpdatedContent)

		return {
			hasServerUpdate,
			actualServerContent: externalServerUpdatedContent || "",
			showVersionCompareDialog: false,
			showSaveWithUpdateConfirmDialog,
			currentEditingContent: "",
			handleViewServerUpdate: vi.fn(),
			handleUseMyVersion: vi.fn(),
			handleUseServerVersion: vi.fn(),
			clearServerUpdate: mockState.clearServerUpdate,
			checkServerUpdateBeforeSave: () => {
				if (hasServerUpdate) {
					setShowSaveWithUpdateConfirmDialog(true)
					return false
				}

				return true
			},
			setShowVersionCompareDialog: vi.fn(),
			setShowSaveWithUpdateConfirmDialog,
			applyServerUpdate: mockState.applyServerUpdate,
		}
	}

	return {
		default: useMockServerUpdate,
	}
})

vi.mock("../../../contents/HTML/IsolatedHTMLRenderer", async () => {
	const React = await import("react")

	return {
		__esModule: true,
		default: React.forwardRef(function MockIsolatedHTMLRenderer(
			{
				onSaveReady,
				...props
			}: {
				onSaveReady?: (triggerSave: () => Promise<unknown>) => void
				content?: string
				rawSourceCode?: string
				scaleContentDimensions?: unknown
			},
			ref,
		) {
			mockState.renderedIsolatedProps(props)

			React.useImperativeHandle(ref, () => ({
				updateContent: mockState.updateContent,
				resetContent: mockState.resetContent,
				getContent: mockState.getContent,
			}))

			React.useEffect(() => {
				onSaveReady?.(mockState.triggerSave)
			}, [onSaveReady])

			return <div data-testid="isolated-html-renderer" />
		}),
	}
})

vi.mock("../hooks/usePPTVersionManager", () => ({
	usePPTVersionManager: () => ({
		fileVersion: undefined,
		changeFileVersion: vi.fn(),
		fileVersionsList: [],
		fetchFileVersions: vi.fn(),
		handleVersionRollback: vi.fn(),
		isNewestVersion: true,
		versionContent: undefined,
		getVersionContentForCompare: vi.fn(),
	}),
}))

vi.mock("../../../contents/HTML/htmlProcessor", () => ({
	processHtmlContent: async ({ content }: { content: string }) => ({
		processedContent: content,
	}),
}))

vi.mock("../PPTSlideError", () => ({
	default: () => <div data-testid="ppt-slide-error" />,
}))

vi.mock("../../versioning/VersionCompareDialog", () => ({
	default: ({ open }: { open: boolean }) =>
		open ? <div data-testid="version-compare-dialog" /> : null,
}))

vi.mock("../components/HistoryVersionCompareDialog", () => ({
	default: ({ open }: { open: boolean }) =>
		open ? <div data-testid="history-version-compare-dialog" /> : null,
}))

vi.mock("@/components/base", () => ({
	CodeEditor: ({
		content,
		onChange,
	}: {
		content: string
		onChange?: (value: string) => void
	}) => (
		<textarea
			data-testid="code-editor"
			value={content}
			onChange={(event) => onChange?.(event.target.value)}
		/>
	),
}))

vi.mock("@/utils/shadow", () => ({
	shadow: (value: string) => value,
}))

vi.mock("../../EditToolbar", () => ({
	default: ({
		isEditMode,
		onEdit,
		onSave,
		onSaveAndExit,
		onCancel,
		onViewModeChange,
	}: {
		isEditMode?: boolean
		onEdit?: () => void
		onSave?: () => void | Promise<void>
		onSaveAndExit?: () => void | Promise<void>
		onCancel?: () => void
		onViewModeChange?: (mode: "code" | "desktop" | "phone") => void
	}) => (
		<div data-testid="ppt-edit-toolbar">
			{!isEditMode ? (
				<button type="button" data-testid="ppt-edit-button" onClick={onEdit}>
					edit
				</button>
			) : (
				<>
					<button
						type="button"
						data-testid="ppt-save-button"
						onClick={() => void onSave?.()}
					>
						save
					</button>
					<button
						type="button"
						data-testid="ppt-save-and-exit-button"
						onClick={() => void onSaveAndExit?.()}
					>
						save and exit
					</button>
					<button type="button" data-testid="ppt-cancel-button" onClick={onCancel}>
						cancel
					</button>
					<button
						type="button"
						data-testid="ppt-code-mode-button"
						onClick={() => onViewModeChange?.("code")}
					>
						code mode
					</button>
				</>
			)}
		</div>
	),
}))

vi.mock("@/pages/superMagic/hooks/useShareRoute", () => ({
	default: () => ({
		isShareRoute: false,
	}),
}))

vi.mock("@/components/shadcn-ui/alert-dialog", async () => {
	const React = await import("react")

	interface DialogContextValue {
		onOpenChange?: (open: boolean) => void
	}

	const AlertDialogContext = React.createContext<DialogContextValue>({})

	function wrapButton(
		props: React.ButtonHTMLAttributes<HTMLButtonElement>,
		children?: ReactNode,
		onOpenChange?: (open: boolean) => void,
	) {
		return (
			<button
				type="button"
				{...props}
				onClick={(event) => {
					props.onClick?.(event)
					if (!event.defaultPrevented) {
						onOpenChange?.(false)
					}
				}}
			>
				{children}
			</button>
		)
	}

	return {
		AlertDialog: ({
			children,
			open,
			onOpenChange,
		}: {
			children?: ReactNode
			open?: boolean
			onOpenChange?: (open: boolean) => void
		}) =>
			open ? (
				<AlertDialogContext.Provider value={{ onOpenChange }}>
					<div>{children}</div>
				</AlertDialogContext.Provider>
			) : null,
		AlertDialogContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
			<div {...props}>{children}</div>
		),
		AlertDialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
		AlertDialogFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
		AlertDialogTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
		AlertDialogDescription: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
		AlertDialogCancel: ({
			children,
			...props
		}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) => (
			<AlertDialogContext.Consumer>
				{({ onOpenChange }) => wrapButton(props, children, onOpenChange)}
			</AlertDialogContext.Consumer>
		),
		AlertDialogAction: ({
			children,
			...props
		}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) => (
			<AlertDialogContext.Consumer>
				{({ onOpenChange }) => wrapButton(props, children, onOpenChange)}
			</AlertDialogContext.Consumer>
		),
	}
})

function renderPPTSlide(overrides: Partial<React.ComponentProps<typeof PPTSlide>> = {}) {
	return render(
		<PPTSlide
			index={0}
			isActive={true}
			content="<div>slide</div>"
			rawContent="<div>slide</div>"
			isFullscreen={false}
			fileId="slide-1"
			filePathMapping={new Map()}
			openNewTab={vi.fn()}
			updateSlideContents={vi.fn()}
			allowEdit={true}
			loadingState="loaded"
			attachmentList={[]}
			saveEditContent={mockState.saveEditContent}
			onManualSave={mockState.onManualSave}
			onDeactivate={mockState.onDeactivate}
			{...overrides}
		/>,
	)
}

describe("PPTSlide", () => {
	beforeEach(() => {
		mockState.triggerSave.mockReset()
		mockState.triggerSave.mockResolvedValue({
			success: true,
			cleanContent: "<div>saved</div>",
			rawContent: "<div>saved</div>",
			fileId: "slide-1",
		})
		mockState.updateContent.mockReset()
		mockState.resetContent.mockReset()
		mockState.getContent.mockReset()
		mockState.getContent.mockResolvedValue("<div>editing</div>")
		mockState.clearServerUpdate.mockReset()
		mockState.applyServerUpdate.mockReset()
		mockState.onManualSave.mockReset()
		mockState.saveEditContent.mockReset()
		mockState.saveEditContent.mockResolvedValue(undefined)
		mockState.onDeactivate.mockReset()
		mockState.renderedIsolatedProps.mockReset()
	})

	it("向 HTML renderer 传入 PPT 固定缩放尺寸", () => {
		renderPPTSlide({
			content: '<div class="slide-container" data-width="1600" data-height="900"></div>',
			rawContent: '<div class="slide-container" data-width="1920" data-height="1080"></div>',
		})

		expect(mockState.renderedIsolatedProps).toHaveBeenCalledWith(
			expect.objectContaining({
				content: '<div class="slide-container" data-width="1600" data-height="900"></div>',
				rawSourceCode:
					'<div class="slide-container" data-width="1920" data-height="1080"></div>',
				scaleContentDimensions: { width: 1600, height: 900 },
			}),
		)
	})

	it("点击保存后保持编辑态", async () => {
		renderPPTSlide()

		fireEvent.click(screen.getByTestId("ppt-save-button"))

		await waitFor(() => {
			expect(mockState.triggerSave).toHaveBeenCalledTimes(1)
		})

		expect(screen.getByTestId("ppt-save-button")).toBeInTheDocument()
		expect(screen.queryByTestId("ppt-edit-button")).not.toBeInTheDocument()
	})

	it("点击保存并退出后退出编辑态", async () => {
		renderPPTSlide()

		fireEvent.click(screen.getByTestId("ppt-save-and-exit-button"))

		await waitFor(() => {
			expect(mockState.triggerSave).toHaveBeenCalledTimes(1)
		})

		await waitFor(() => {
			expect(screen.getByTestId("ppt-edit-button")).toBeInTheDocument()
		})
	})

	it("服务端冲突确认后仍保持原始保存意图", async () => {
		renderPPTSlide({
			serverUpdatedContent: "<div>server-update</div>",
		})

		fireEvent.click(screen.getByTestId("ppt-save-button"))

		expect(screen.getByTestId("ppt-slide-save-with-update-dialog")).toBeInTheDocument()
		expect(mockState.triggerSave).not.toHaveBeenCalled()

		fireEvent.click(screen.getByText("ppt.saveChanges"))

		await waitFor(() => {
			expect(mockState.triggerSave).toHaveBeenCalledTimes(1)
		})

		expect(screen.getByTestId("ppt-save-button")).toBeInTheDocument()
		expect(screen.queryByTestId("ppt-edit-button")).not.toBeInTheDocument()
	})

	it("切换幻灯片时在代码模式保存并继续切换", async () => {
		const { rerender } = renderPPTSlide()

		fireEvent.click(screen.getByTestId("ppt-code-mode-button"))

		await waitFor(() => {
			expect(screen.getByTestId("code-editor")).toBeInTheDocument()
		})

		fireEvent.change(screen.getByTestId("code-editor"), {
			target: { value: "<div>updated code</div>" },
		})

		rerender(
			<PPTSlide
				index={0}
				isActive={false}
				content="<div>slide</div>"
				rawContent="<div>slide</div>"
				isFullscreen={false}
				fileId="slide-1"
				filePathMapping={new Map()}
				openNewTab={vi.fn()}
				updateSlideContents={vi.fn()}
				allowEdit={true}
				loadingState="loaded"
				attachmentList={[]}
				saveEditContent={mockState.saveEditContent}
				onManualSave={mockState.onManualSave}
				onDeactivate={mockState.onDeactivate}
			/>,
		)

		expect(screen.getByTestId("ppt-slide-save-dialog")).toBeInTheDocument()

		fireEvent.click(screen.getByTestId("ppt-slide-save-dialog-save"))

		await waitFor(() => {
			expect(mockState.saveEditContent).toHaveBeenCalledWith(
				"<div>updated code</div>",
				"slide-1",
				true,
				expect.any(Function),
				true,
			)
		})

		await waitFor(() => {
			expect(mockState.onDeactivate).toHaveBeenCalledTimes(1)
		})

		await waitFor(() => {
			expect(screen.getByTestId("ppt-edit-button")).toBeInTheDocument()
		})
	})

	it("注册给导航确认的保存处理器会保存并退出当前 slide 编辑态", async () => {
		const registerNavigateSaveHandler = vi.fn()

		renderPPTSlide({
			onRegisterSaveHandler: registerNavigateSaveHandler,
		})

		const navigateSaveHandler = registerNavigateSaveHandler.mock.calls.at(-1)?.[0]

		expect(navigateSaveHandler).toEqual(expect.any(Function))

		let didSave = false

		await act(async () => {
			didSave = await navigateSaveHandler()
		})

		expect(didSave).toBe(true)
		expect(mockState.triggerSave).toHaveBeenCalledTimes(1)

		await waitFor(() => {
			expect(screen.getByTestId("ppt-edit-button")).toBeInTheDocument()
		})
	})

	it("注册给外部关闭流程的放弃处理器会退出编辑态", async () => {
		const registerDiscardHandler = vi.fn()

		renderPPTSlide({
			onRegisterDiscardHandler: registerDiscardHandler,
		})

		const discardHandler = registerDiscardHandler.mock.calls.at(-1)?.[0]

		expect(discardHandler).toEqual(expect.any(Function))

		let didDiscard = false

		await act(async () => {
			didDiscard = await discardHandler()
		})

		expect(didDiscard).toBe(true)
		expect(mockState.applyServerUpdate).toHaveBeenCalledTimes(1)

		await waitFor(() => {
			expect(screen.getByTestId("ppt-edit-button")).toBeInTheDocument()
		})
	})
})
