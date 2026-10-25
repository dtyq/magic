import { HtmlAppPermissionContext } from "../hooks/HtmlAppPermissionContext"
import {
	useHtmlAppPermissions,
	type HtmlAppPermissionController,
} from "../hooks/useHtmlAppPermissions"
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import type { ButtonHTMLAttributes, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
	isDashboardTemplateShellReferencePath,
	resolveHtmlPreviewBundledTemplate,
} from "../html-preview-bundled-shell"
import { HTML_PREVIEW_IMAGE_PROCESS } from "../previewImageProcess"
import HTML from "../index"

const mockIsolatedHTMLRendererProps = vi.hoisted(() => vi.fn())
const mockResetContent = vi.hoisted(() => vi.fn())
const fileLoadState = vi.hoisted(() => ({
	status: undefined as undefined | "loading" | "ready" | "error",
	revision: 0,
}))

const mockGetFileContentById = vi.fn()
const mockProcessHtmlContent = vi.fn(async ({ content }: { content?: string }) => ({
	processedContent: content || "",
	filePathMapping: new Map(),
	hasSlides: false,
	slidesMap: new Map(),
	originalSlidesPaths: [],
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

vi.mock("@dtyq/es6-template-strings", () => ({
	resolveToString: (value: string) => value,
}))

vi.mock("@/utils/http", () => ({
	genRequestUrl: vi.fn(),
	isValidUrl: vi.fn(),
}))

vi.mock("@/utils/env", () => ({
	isDev: false,
	env: vi.fn(() => "/packages"),
	isPrivateDeployment: vi.fn(() => false),
	isInternationalEnv: vi.fn(() => false),
	isProductionEnv: vi.fn(() => false),
	isTestEnv: vi.fn(() => true),
	isCommercial: vi.fn(() => true),
	getPrivateDeploymentConfig: vi.fn(() => null),
}))

vi.mock("@/pages/superMagic/pages/Workspace/types", () => ({}))

vi.mock("@dtyq/magic-admin", () => ({
	RouteName: {
		Admin: "admin",
		AdminPlatformAIModel: "admin-platform-ai-model",
		AdminPlatformPackage: "admin-platform-package",
	},
	RoutePath: {
		Admin: "/admin",
	},
	PlatformPackageRoutes: {
		path: "/admin/platform-package",
		element: null,
	},
	AiManageRoutes: {
		path: "/admin/ai-manage",
		element: null,
	},
	otherRoutes: [],
}))
vi.mock("@dtyq/magic-admin/components", () => ({}))
vi.mock("@dtyq/magic-admin/provider", () => ({}))

vi.mock("antd", async (importOriginal) => {
	const actual = await importOriginal<typeof import("antd")>()

	return {
		...actual,
		Flex: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
		Tour: () => null,
		message: {
			...actual.message,
			config: vi.fn(),
		},
	}
})

vi.mock("../styles", () => ({
	useStyles: () => ({
		styles: {
			htmlContainer: "html-container",
			htmlBody: "html-body",
			previewContainerBase: "preview-container-base",
			phoneModeContainer: "phone-mode-container",
			previewInnerBase: "preview-inner-base",
			phoneModeInner: "phone-mode-inner",
		},
		cx: (...classNames: Array<string | Record<string, boolean> | undefined>) =>
			classNames
				.flatMap((className) => {
					if (!className) return []
					if (typeof className === "string") return [className]
					return Object.entries(className)
						.filter(([, isActive]) => Boolean(isActive))
						.map(([key]) => key)
				})
				.join(" "),
	}),
}))

vi.mock("@/pages/superMagic/hooks/useFileData", () => ({
	useFileData: ({ file_id, content }: { file_id?: string; content?: string }) => ({
		fileData: file_id ? "<html><body>base</body></html>" : content || "",
		refreshFile: vi.fn(),
		loadStatus: fileLoadState.status,
		loadRevision: fileLoadState.revision,
		loadError: fileLoadState.status === "error" ? "offline" : null,
		fileVersion: 1,
		changeFileVersion: vi.fn(),
		loading: false,
		fetchFileVersions: vi.fn(),
		fileVersionsList: [{ version: 1 }],
		handleVersionRollback: vi.fn(),
		isNewestVersion: true,
		isDeleted: false,
	}),
}))

vi.mock("./dashboard/useDashboardVersioning", () => ({
	useDashboardVersioning: ({
		attachmentList,
		displayConfig,
	}: {
		attachmentList?: unknown[]
		displayConfig?: { type?: string }
	}) => ({
		allAttachmentItems: attachmentList || [],
		flattenedAttachmentList: attachmentList || [],
		isDataAnalysis: displayConfig?.type === "dashboard",
		dashboardDataJsFile: null,
		dashboardDataJsContent: "",
		activeHistory: {
			fileVersion: 1,
			changeFileVersion: vi.fn(),
			fileVersionsList: [{ version: 1 }],
			handleVersionRollback: vi.fn(),
			isNewestVersion: true,
			loading: false,
			previewRevision: 0,
			isPreviewReady: true,
		},
		resourceFileVersions: {},
		fetchDashboardDataJsFileVersions: vi.fn(),
	}),
}))

vi.mock("../htmlProcessor", () => ({
	processHtmlContent: (input: { content?: string }) => mockProcessHtmlContent(input),
}))

vi.mock("../utils/fetchInterceptor", () => ({
	createParentMessageHandler: () => vi.fn(),
	injectFetchInterceptorScript: (content: string) => content,
	createKeyboardMessageHandler: () => vi.fn(),
	KEYBOARD_MESSAGE_TYPES: {
		CANCEL: "MAGIC_KEYBOARD_CANCEL",
		SOURCE: "magic-html-iframe",
	},
	POST_MESSAGE_TARGET_STRATEGIES: {
		CROSS_ORIGIN_PARENT: "cross-origin-parent",
		SAME_ORIGIN_ANCESTOR: "same-origin-ancestor",
	},
}))

vi.mock("../utils/nested-iframe-content", () => ({
	createNestedIframeContentHandler: () => vi.fn(),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("../useExportMenuItems", () => ({
	default: () => ({
		ExportDropdownButton: null,
	}),
}))

vi.mock("../../../hooks/useShareButtonVisibility", () => ({
	default: () => ({
		showDownloadButton: false,
		showExportButton: false,
	}),
}))

vi.mock("../../../hooks/useSaveHandlerRegistration", () => ({
	default: () => undefined,
}))

vi.mock("@/pages/superMagic/hooks/useHTMLGuideTour", () => ({
	HTMLGuideTourElementId: {
		HTMLFileEditButton: "HTMLFileEditButton",
		AIOptimizationButton: "AIOptimizationButton",
	},
	useHTMLGuideTour: () => ({
		guideTourOpen: false,
		setGuideTourOpen: vi.fn(),
		guideTourSteps: [],
	}),
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		subscribe: vi.fn(),
		unsubscribe: vi.fn(),
		publish: vi.fn(),
	},
	PubSubEvents: {
		Super_Magic_Detail_Refresh: "Super_Magic_Detail_Refresh",
		GuideTourHTMLElementReady: "GuideTourHTMLElementReady",
	},
}))

vi.mock("@/components/base/MagicSpin", () => ({
	default: () => <div data-testid="magic-spin" />,
}))

vi.mock("../../../components/EditToolbar/AIEditButton", () => ({
	default: (props: {
		maxItems?: number
		onPrimaryAction?: () => void
		testIdPrefix?: string
	}) => (
		<div
			data-testid="ai-edit-button"
			data-max-items={props.maxItems}
			data-has-primary-action={Boolean(props.onPrimaryAction)}
			data-test-id-prefix={props.testIdPrefix}
		/>
	),
}))

vi.mock("../../../components/EditToolbar/FileEditButtons", () => ({
	default: ({
		onEdit,
		onSave,
		onSaveAndExit,
		onCancel,
		editLabel,
		testIdPrefix,
	}: {
		onEdit?: () => void
		onSave?: () => void
		onSaveAndExit?: () => void
		onCancel?: () => void
		editLabel?: string
		testIdPrefix?: string
	}) => (
		<div data-testid="file-edit-buttons" data-test-id-prefix={testIdPrefix}>
			<button type="button" data-testid="html-edit-button" onClick={onEdit}>
				{editLabel ?? "edit"}
			</button>
			<button type="button" data-testid="html-save-button" onClick={onSave}>
				save
			</button>
			<button type="button" data-testid="html-save-and-exit-button" onClick={onSaveAndExit}>
				save and exit
			</button>
			<button type="button" data-testid="html-cancel-button" onClick={onCancel}>
				cancel
			</button>
		</div>
	),
}))

vi.mock("../../../components/Deleted", () => ({
	default: () => <div data-testid="deleted" />,
}))

vi.mock("../../../components/CommonFooter", () => ({
	default: () => <div data-testid="common-footer" />,
}))

vi.mock("./dashboard/DashboardIsolatedHTMLRenderer", () => ({
	default: () => <div data-testid="dashboard-isolated-html-renderer" />,
}))

vi.mock("@/components/base/CodeEditor", () => ({
	default: ({ content, onChange }: { content: string; onChange?: (value: string) => void }) => (
		<textarea
			data-testid="code-editor"
			defaultValue={content}
			onChange={(event) => onChange?.(event.target.value)}
		/>
	),
}))

vi.mock("../../../components/versioning/CodeVersionCompareDialog", () => ({
	default: ({
		open,
		onUseMyVersion,
		onUseServerVersion,
	}: {
		open: boolean
		onUseMyVersion?: () => void
		onUseServerVersion?: () => void
	}) =>
		open ? (
			<div data-testid="code-version-compare-dialog">
				<button
					type="button"
					data-testid="code-version-compare-use-my-version-button"
					onClick={onUseMyVersion}
				>
					use my version
				</button>
				<button
					type="button"
					data-testid="code-version-compare-use-server-version-button"
					onClick={onUseServerVersion}
				>
					use server version
				</button>
			</div>
		) : null,
}))

vi.mock("../../../components/versioning/VersionCompareDialog", () => ({
	default: ({
		open,
		onUseMyVersion,
		onUseServerVersion,
	}: {
		open: boolean
		onUseMyVersion?: () => void
		onUseServerVersion?: (content?: string) => void
	}) =>
		open ? (
			<div data-testid="visual-version-compare-dialog">
				<button
					type="button"
					data-testid="visual-version-compare-use-my-version-button"
					onClick={onUseMyVersion}
				>
					use my version
				</button>
				<button
					type="button"
					data-testid="visual-version-compare-use-server-version-button"
					onClick={() =>
						onUseServerVersion?.("<html><body>normalized server</body></html>")
					}
				>
					use server version
				</button>
			</div>
		) : null,
}))

vi.mock("@/pages/superMagic/utils/api", () => ({
	getFileContentById: (...args: unknown[]) => mockGetFileContentById(...args),
}))

vi.mock("@/utils/shadow", () => ({
	shadow: (value: string) => value,
}))

vi.mock("@/utils/slug", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/utils/slug")>()),
	parseAnchorLink: (path: string) => ({
		filePath: path,
		anchor: "",
	}),
	scrollToAnchor: vi.fn(),
}))

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
		<button {...props}>{children}</button>
	),
}))

vi.mock("@/components/shadcn-ui/alert-dialog", async () => {
	const React = await import("react")

	const AlertDialogContext = React.createContext<{
		onOpenChange?: (open: boolean) => void
	}>({})

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
		AlertDialogContent: ({
			children,
			...props
		}: {
			children?: ReactNode
		} & ButtonHTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
		AlertDialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
		AlertDialogTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
		AlertDialogDescription: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
		AlertDialogFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
		AlertDialogCancel: ({
			children,
			onClick,
			...props
		}: ButtonHTMLAttributes<HTMLButtonElement>) => {
			const { onOpenChange } = React.useContext(AlertDialogContext)

			return (
				<button
					{...props}
					onClick={(event) => {
						onClick?.(event)
						onOpenChange?.(false)
					}}
				>
					{children}
				</button>
			)
		},
		AlertDialogAction: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
			<button {...props}>{children}</button>
		),
	}
})

vi.mock("../IsolatedHTMLRenderer", async () => {
	const React = await import("react")

	return {
		default: React.forwardRef(function MockIsolatedHTMLRenderer(
			props: Record<string, unknown>,
			ref: React.ForwardedRef<{
				getContent: () => Promise<string>
				updateContent: () => void
				resetContent: () => void
				getFetchInterceptedCallback: () => () => void
			}>,
		) {
			mockIsolatedHTMLRendererProps(props)

			React.useImperativeHandle(ref, () => ({
				getContent: async () => "<html><body>local-visual</body></html>",
				updateContent: () => undefined,
				resetContent: mockResetContent,
				getFetchInterceptedCallback: () => () => undefined,
			}))

			React.useEffect(() => {
				const onSaveReady = props.onSaveReady as
					| ((
							triggerSave: () => Promise<{ success: boolean; cleanContent: string }>,
					  ) => void)
					| undefined

				onSaveReady?.(async () => ({
					success: true,
					cleanContent: "<html><body>normalized server</body></html>",
				}))
			}, [props.onSaveReady])

			return <div data-testid="isolated-html-renderer" />
		}),
	}
})

vi.mock("../../../components/CommonHeaderV2", () => ({
	default: (props: {
		actionConfig?: {
			customActions?: Array<{
				key: string
				visible?: boolean | ((context: Record<string, unknown>) => boolean)
				render: (context: Record<string, unknown>) => ReactNode
			}>
		}
		viewMode?: string
		isEditMode?: boolean
		showDownload?: boolean
		showRefreshButton?: boolean
		isNewestFileVersion?: boolean
		allowEdit?: boolean
		currentFile?: Record<string, unknown>
		attachments?: unknown[]
		fileContent?: string
		fileVersion?: number
		fileVersionsList?: unknown[]
		type?: string
		detailMode?: string
		isFromNode?: boolean
		isFullscreen?: boolean
	}) => {
		const context = {
			type: props.type,
			viewMode: props.viewMode || "desktop",
			isMobile: false,
			showButtonText: true,
			isShareRoute: false,
			isFromNode: Boolean(props.isFromNode),
			isFullscreen: Boolean(props.isFullscreen),
			isEditMode: Boolean(props.isEditMode),
			detailMode: props.detailMode,
			showDownload: Boolean(props.showDownload),
			showRefreshButton: Boolean(props.showRefreshButton),
			isNewestFileVersion: Boolean(props.isNewestFileVersion),
			allowEdit: Boolean(props.allowEdit),
			currentFile: props.currentFile,
			attachments: props.attachments,
			fileContent: props.fileContent,
			fileVersion: props.fileVersion,
			fileVersionsList: props.fileVersionsList,
		}

		return (
			<div
				data-testid="common-header"
				data-show-refresh={String(Boolean(props.showRefreshButton))}
			>
				{props.actionConfig?.customActions
					?.filter((action) => {
						if (typeof action.visible === "function") return action.visible(context)
						return action.visible ?? true
					})
					.map((action) => (
						<div key={action.key}>{action.render(context)}</div>
					))}
			</div>
		)
	},
}))

const baseProps = {
	data: {
		file_id: "file-1",
		file_name: "index.html",
		content: "<html><body>base</body></html>",
	},
	attachments: [],
	attachmentList: [],
	isEditMode: true,
	allowEdit: false,
	showFileHeader: true,
	updatedAt: "2026-03-20T10:00:00.000Z",
	viewMode: "code" as const,
}

describe("HTML", () => {
	beforeEach(() => {
		fileLoadState.status = undefined
		fileLoadState.revision = 0
		mockGetFileContentById.mockReset()
		mockProcessHtmlContent.mockClear()
		mockIsolatedHTMLRendererProps.mockClear()
		mockResetContent.mockClear()
	})

	it("reuses MicroApp permissions while hiding the file toolbar manager", async () => {
		let shared: HtmlAppPermissionController
		const permissionFiles: [] = []
		function SharedPermissions({ children }: { children: ReactNode }) {
			const controller = useHtmlAppPermissions({
				content: "",
				projectId: "app-project",
				relativeFilePath: "index.html",
				fileList: permissionFiles,
				enabled: false,
			})
			shared = { ...controller, hasHtmlPermissionDeclarations: true }
			return (
				<HtmlAppPermissionContext.Provider value={shared}>
					{children}
				</HtmlAppPermissionContext.Provider>
			)
		}
		const onManagerChange = vi.fn()
		render(
			<SharedPermissions>
				<HTML
					{...baseProps}
					viewMode="desktop"
					isEditMode={false}
					onHtmlPermissionManagerChange={onManagerChange}
				/>
			</SharedPermissions>,
		)
		await waitFor(() =>
			expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].permissionController).toBe(
				shared,
			),
		)
		expect(screen.queryByText("htmlEditor.permissionManager.open")).not.toBeInTheDocument()
		expect(onManagerChange).toHaveBeenCalledWith(
			expect.objectContaining({ open: expect.any(Function) }),
		)
	})

	it("checks unrelated attachments without showing loading or replacing the preview", async () => {
		const props = { ...baseProps, viewMode: "desktop" as const, isEditMode: false }
		const { rerender } = render(<HTML {...props} />)
		await waitFor(() =>
			expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].content).toContain("base"),
		)
		act(() => mockIsolatedHTMLRendererProps.mock.lastCall?.[0].onRenderReady())
		const originalProcessor = mockProcessHtmlContent.getMockImplementation()
		if (!originalProcessor) throw new Error("Missing HTML processor fixture")
		let finish = () => {
			throw new Error("Processing did not start")
		}
		mockProcessHtmlContent.mockImplementation(
			(input) =>
				new Promise((resolve) => {
					finish = () => {
						void originalProcessor(input).then(resolve)
					}
				}),
		)
		rerender(
			<HTML
				{...props}
				attachmentList={[
					{ file_id: "test-data", relative_file_path: "test.txt", updated_at: "new" },
				]}
			/>,
		)
		expect(screen.queryByRole("status")).toBeNull()
		await act(async () => finish())
		expect(screen.queryByRole("status")).toBeNull()
		expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].content).toContain("base")
		mockProcessHtmlContent.mockImplementation(originalProcessor)
	})

	it("keeps the last working preview on processing failure and retries explicitly", async () => {
		const data = {
			...baseProps.data,
			content: "<html>working</html>",
			display_config: { previewPolicy: { keepLocalContent: true } },
		}
		const { rerender } = render(
			<HTML {...baseProps} data={data} viewMode="desktop" isEditMode={false} />,
		)
		await waitFor(() =>
			expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].content).toContain("working"),
		)
		act(() => mockIsolatedHTMLRendererProps.mock.lastCall?.[0].onRenderReady())
		const originalProcessor = mockProcessHtmlContent.getMockImplementation()
		if (!originalProcessor) throw new Error("Missing HTML processor fixture")
		mockProcessHtmlContent.mockRejectedValue(new Error("resource unavailable"))
		rerender(
			<HTML
				{...baseProps}
				data={{ ...data, content: "<html>newest</html>" }}
				viewMode="desktop"
				isEditMode={false}
			/>,
		)
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("htmlEditor.previewRefreshFailed"),
		)
		expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].content).toContain("working")
		mockProcessHtmlContent.mockImplementation(originalProcessor)
		fireEvent.click(screen.getByRole("button", { name: "htmlEditor.previewRetry" }))
		await waitFor(() =>
			expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].content).toContain("newest"),
		)
		act(() => mockIsolatedHTMLRendererProps.mock.lastCall?.[0].onRenderReady())
		expect(screen.queryByRole("status")).toBeNull()
	})

	it("ignores slow processing from an older file update", async () => {
		const originalProcessor = mockProcessHtmlContent.getMockImplementation()
		if (!originalProcessor) throw new Error("Missing HTML processor fixture")
		const finishSlow: Array<() => void> = []
		mockProcessHtmlContent.mockImplementation((input) => {
			if (input.content?.includes("slow"))
				return new Promise((resolve) => {
					finishSlow.push(() => {
						void originalProcessor(input).then(resolve)
					})
				})
			return originalProcessor(input)
		})
		const data = {
			...baseProps.data,
			content: "<html>slow</html>",
			display_config: { previewPolicy: { keepLocalContent: true } },
		}
		const { rerender } = render(
			<HTML {...baseProps} data={data} viewMode="desktop" isEditMode={false} />,
		)
		await waitFor(() => expect(finishSlow.length).toBeGreaterThan(0))
		rerender(
			<HTML
				{...baseProps}
				data={{ ...data, content: "<html>latest</html>" }}
				viewMode="desktop"
				isEditMode={false}
			/>,
		)
		await waitFor(() =>
			expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].content).toContain("latest"),
		)
		await act(async () => {
			finishSlow.forEach((finish) => finish())
		})
		expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].content).toContain("latest")
		mockProcessHtmlContent.mockImplementation(originalProcessor)
	})

	it("clears a previously rendered preview when the accepted file becomes empty", async () => {
		const data = {
			...baseProps.data,
			content: "<html>previous</html>",
			display_config: { previewPolicy: { keepLocalContent: true } },
		}
		const { rerender } = render(
			<HTML {...baseProps} data={data} viewMode="desktop" isEditMode={false} />,
		)
		await waitFor(() =>
			expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].content).toContain("previous"),
		)
		rerender(
			<HTML
				{...baseProps}
				data={{ ...data, content: "" }}
				viewMode="desktop"
				isEditMode={false}
			/>,
		)
		await waitFor(() =>
			expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].content).toBe(""),
		)
		expect(screen.queryByTestId("magic-spin")).toBeNull()
		expect(screen.queryByRole("status")).toBeNull()
	})

	it("keeps the editing baseline when remote props change during editing", async () => {
		const data = {
			...baseProps.data,
			content: "<html>editing baseline</html>",
			display_config: { previewPolicy: { keepLocalContent: true } },
		}
		const { rerender } = render(
			<HTML {...baseProps} data={data} viewMode="desktop" isEditMode />,
		)
		await waitFor(() =>
			expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].content).toContain(
				"editing baseline",
			),
		)
		rerender(
			<HTML
				{...baseProps}
				data={{ ...data, content: "<html>remote update</html>" }}
				viewMode="desktop"
				isEditMode
			/>,
		)
		await act(async () => {
			await Promise.resolve()
		})
		expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].content).toContain(
			"editing baseline",
		)
	})

	it("shows a remote load failure even if attachment metadata changed during the request", async () => {
		const props = { ...baseProps, viewMode: "desktop" as const, isEditMode: false }
		const { rerender } = render(<HTML {...props} />)
		await waitFor(() =>
			expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].content).toContain("base"),
		)
		act(() => mockIsolatedHTMLRendererProps.mock.lastCall?.[0].onRenderReady())
		fileLoadState.status = "loading"
		const attachments = [
			{ file_id: "resource", relative_file_path: "data.json", updated_at: "new" },
		]
		rerender(<HTML {...props} attachmentList={attachments} updatedAt="new" />)
		await act(async () => {
			await Promise.resolve()
		})
		fileLoadState.status = "error"
		rerender(<HTML {...props} attachmentList={attachments} updatedAt="new" />)
		await waitFor(() =>
			expect(screen.getByRole("status")).toHaveTextContent("htmlEditor.previewRefreshFailed"),
		)
		expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].content).toContain("base")
	})

	it("waits for the new file acknowledgement even when its content matches the previous file", async () => {
		const props = { ...baseProps, viewMode: "desktop" as const, isEditMode: false }
		const { rerender } = render(<HTML {...props} />)
		await waitFor(() =>
			expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].content).toContain("base"),
		)
		const previousReady = mockIsolatedHTMLRendererProps.mock.lastCall?.[0].onRenderReady
		act(() => previousReady())
		rerender(<HTML {...props} data={{ ...props.data, file_id: "different-file" }} />)
		await waitFor(() =>
			expect(mockIsolatedHTMLRendererProps.mock.lastCall?.[0].fileId).toBe("different-file"),
		)
		act(() => previousReady())
		expect(screen.getByTestId("magic-spin")).toBeInTheDocument()
		act(() => mockIsolatedHTMLRendererProps.mock.lastCall?.[0].onRenderReady())
		expect(screen.queryByTestId("magic-spin")).toBeNull()
	})

	it("should use the HTML-specific edit label and show only three AI edit items", async () => {
		render(
			<HTML
				{...baseProps}
				viewMode="desktop"
				isEditMode={false}
				setIsEditMode={vi.fn()}
				allowEdit
			/>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("html-preview")).toHaveAttribute("data-edit-mode", "false")
			expect(screen.getByTestId("html-preview-container")).toBeInTheDocument()
			expect(screen.getByTestId("html-preview-content")).toBeInTheDocument()
			expect(screen.getByTestId("html-design-style-button")).toBeInTheDocument()
			expect(screen.getByTestId("file-edit-buttons")).toHaveAttribute(
				"data-test-id-prefix",
				"html-editor",
			)
			expect(screen.getByTestId("html-ai-pick-button")).toBeInTheDocument()
			expect(screen.getByTestId("html-edit-button")).toHaveTextContent("common.edit")
		})
	})

	it("should hide the AI pick button in code preview mode", async () => {
		render(
			<HTML
				{...baseProps}
				viewMode="code"
				isEditMode={false}
				setIsEditMode={vi.fn()}
				allowEdit
			/>,
		)

		await waitFor(() => {
			expect(screen.queryByTestId("html-ai-pick-button")).not.toBeInTheDocument()
		})
	})

	it("should expose fixed HTML test ids only for the active cached preview", async () => {
		render(
			<HTML
				{...baseProps}
				viewMode="desktop"
				isEditMode={false}
				setIsEditMode={vi.fn()}
				allowEdit
				isTabActive={false}
			/>,
		)

		await waitFor(() => {
			expect(screen.queryByTestId("html-preview")).not.toBeInTheDocument()
			expect(screen.queryByTestId("html-editor-toolbar-actions")).not.toBeInTheDocument()
			expect(mockIsolatedHTMLRendererProps).toHaveBeenLastCalledWith(
				expect.objectContaining({ isVisible: false, isTabActive: false }),
			)
			expect(screen.getByTestId("file-edit-buttons")).not.toHaveAttribute(
				"data-test-id-prefix",
			)
		})
	})

	it("should stop preview loading when the html file is empty", async () => {
		const { rerender } = render(
			<HTML
				{...baseProps}
				data={{
					...baseProps.data,
					content: "",
					display_config: {
						previewPolicy: { keepLocalContent: true },
					},
				}}
				viewMode="desktop"
				isEditMode={false}
			/>,
		)

		await waitFor(() => {
			expect(screen.queryByTestId("magic-spin")).not.toBeInTheDocument()
		})
		expect(screen.getByTestId("isolated-html-renderer")).toBeInTheDocument()
	})

	it("should use bundled dashboard template for dashboard index entry html", async () => {
		render(
			<HTML
				{...baseProps}
				viewMode="desktop"
				isEditMode={false}
				displayConfig={{ type: "dashboard" }}
				attachmentList={[
					{
						file_id: "file-1",
						file_name: "index.html",
						relative_file_path: "index.html",
					},
				]}
			/>,
		)

		await waitFor(() => {
			expect(mockProcessHtmlContent).toHaveBeenCalled()
		})

		expect(mockProcessHtmlContent).toHaveBeenCalledWith(
			expect.objectContaining({
				htmlPreviewBundledTemplate: "dashboard",
				xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS,
			}),
		)
	})

	it("should not use bundled dashboard template for non-entry dashboard html", async () => {
		render(
			<HTML
				{...baseProps}
				data={{
					...baseProps.data,
					file_name: "about.html",
				}}
				viewMode="desktop"
				isEditMode={false}
				displayConfig={{ type: "dashboard" }}
				attachmentList={[
					{
						file_id: "file-1",
						file_name: "about.html",
						relative_file_path: "pages/about.html",
					},
				]}
			/>,
		)

		await waitFor(() => {
			expect(mockProcessHtmlContent).toHaveBeenCalled()
		})

		expect(mockProcessHtmlContent).toHaveBeenCalledWith(
			expect.objectContaining({
				htmlPreviewBundledTemplate: undefined,
				xMagicImageProcess: HTML_PREVIEW_IMAGE_PROCESS,
			}),
		)
	})

	it("should pass html base directory with an explicit prop name", async () => {
		render(
			<HTML
				{...baseProps}
				viewMode="desktop"
				attachmentList={[
					{
						file_id: "file-1",
						file_name: "index.html",
						relative_file_path: "magic-api-devtools/index.html",
					},
				]}
			/>,
		)

		await waitFor(() => {
			expect(mockIsolatedHTMLRendererProps).toHaveBeenCalled()
		})

		expect(mockIsolatedHTMLRendererProps).toHaveBeenLastCalledWith(
			expect.objectContaining({
				htmlRelativeFolderPath: "magic-api-devtools/",
			}),
		)
	})

	it("opens UTF-8 encoded paths from a Chinese folder", async () => {
		const openFileTab = vi.fn()
		const currentFile = {
			file_id: "file-1",
			file_name: "index.html",
			relative_file_path: "中文场景/index.html",
		}
		const targetFile = {
			file_id: "file-2",
			file_name: "目标页面.html",
			relative_file_path: "中文场景/目标页面.html",
		}
		const nestedFile = {
			file_id: "file-3",
			file_name: "深层页面.html",
			relative_file_path: "中文场景/子文件夹/深层页面.html",
		}
		const rootDetail = {
			file_id: "file-4",
			file_name: "detail.html",
			relative_file_path: "detail.html",
		}
		const rootIndex = {
			file_id: "file-5",
			file_name: "index.html",
			relative_file_path: "index.html",
		}
		render(
			<HTML
				{...baseProps}
				viewMode="desktop"
				isEditMode={false}
				attachmentList={[currentFile, targetFile, nestedFile, rootDetail, rootIndex]}
				openFileTab={openFileTab}
			/>,
		)
		await waitFor(() => expect(mockIsolatedHTMLRendererProps).toHaveBeenCalled())
		const props = mockIsolatedHTMLRendererProps.mock.lastCall?.[0]
		const encodedTarget =
			"/%E4%B8%AD%E6%96%87%E5%9C%BA%E6%99%AF/%E7%9B%AE%E6%A0%87%E9%A1%B5%E9%9D%A2.html?keyword=%E6%B5%8B%E8%AF%95#section-a"

		act(() => props.openNewTab("file-1", encodedTarget, false))
		expect(openFileTab).toHaveBeenCalledWith(
			{
				...targetFile,
				htmlNavigation: {
					filePath:
						"/%E4%B8%AD%E6%96%87%E5%9C%BA%E6%99%AF/%E7%9B%AE%E6%A0%87%E9%A1%B5%E9%9D%A2.html",
					search: "?keyword=%E6%B5%8B%E8%AF%95",
					hash: "#section-a",
					anchor: "section-a",
					target: "_self",
					background: false,
					history: "push",
				},
			},
			false,
		)

		act(() =>
			props.openNewTab(
				"file-1",
				"/%E4%B8%AD%E6%96%87%E5%9C%BA%E6%99%AF/%E5%AD%90%E6%96%87%E4%BB%B6%E5%A4%B9/%E6%B7%B1%E5%B1%82%E9%A1%B5%E9%9D%A2.html",
				false,
			),
		)
		expect(openFileTab).toHaveBeenLastCalledWith(
			expect.objectContaining({ file_id: "file-3" }),
			false,
		)

		act(() => props.openNewTab("file-1", "/detail.html", false))
		expect(openFileTab).toHaveBeenLastCalledWith(
			expect.objectContaining({ file_id: "file-4" }),
			false,
		)

		act(() => props.openNewTab("file-3", "/index.html", false))
		expect(openFileTab).toHaveBeenLastCalledWith(
			expect.objectContaining({ file_id: "file-5" }),
			false,
		)

		act(() =>
			props.openNewTab(
				"file-1",
				"/%E4%B8%AD%E6%96%87%E5%9C%BA%E6%99%AF/index.html?from=chinese-folder",
				false,
			),
		)
		expect(openFileTab).toHaveBeenLastCalledWith(
			expect.objectContaining({
				file_id: "file-1",
				htmlNavigation: expect.objectContaining({
					search: "?from=chinese-folder",
				}),
			}),
			false,
		)
	})

	it("opens the resolved file through the host callback with query and hash intact", async () => {
		const openFileTab = vi.fn()
		const currentFile = {
			file_id: "file-1",
			file_name: "index.html",
			relative_file_path: "pages/index.html",
		}
		const targetFile = {
			file_id: "file-2",
			file_name: "detail.html",
			relative_file_path: "detail.html",
		}
		render(
			<HTML
				{...baseProps}
				viewMode="desktop"
				isEditMode={false}
				attachmentList={[currentFile, targetFile]}
				openFileTab={openFileTab}
			/>,
		)
		await waitFor(() => expect(mockIsolatedHTMLRendererProps).toHaveBeenCalled())
		const props = mockIsolatedHTMLRendererProps.mock.lastCall?.[0]
		act(() =>
			props.openNewTab("file-1", "/detail.html?mode=preview#summary", false, {
				target: "report",
				background: true,
				history: "replace",
			}),
		)
		expect(openFileTab).toHaveBeenCalledExactlyOnceWith(
			{
				...targetFile,
				htmlNavigation: {
					filePath: "/detail.html",
					search: "?mode=preview",
					hash: "#summary",
					anchor: "summary",
					target: "report",
					background: true,
					history: "replace",
				},
			},
			false,
		)
	})

	it("does not scroll the opener when an anchored page opens in a new context", async () => {
		const { scrollToAnchor } = await import("@/utils/slug")
		const openFileTab = vi.fn()
		render(
			<HTML
				{...baseProps}
				viewMode="desktop"
				isEditMode={false}
				attachmentList={[
					{
						file_id: "file-1",
						file_name: "index.html",
						relative_file_path: "index.html",
					},
					{
						file_id: "file-2",
						file_name: "detail.html",
						relative_file_path: "detail.html",
					},
				]}
				openFileTab={openFileTab}
			/>,
		)
		await waitFor(() => expect(mockIsolatedHTMLRendererProps).toHaveBeenCalled())
		vi.useFakeTimers()
		try {
			vi.mocked(scrollToAnchor).mockClear()
			act(() =>
				mockIsolatedHTMLRendererProps.mock.lastCall?.[0].openNewTab(
					"file-1",
					"/detail.html#summary",
					false,
					{ target: "report" },
				),
			)
			act(() => vi.advanceTimersByTime(300))
			expect(openFileTab).toHaveBeenCalledOnce()
			expect(scrollToAnchor).not.toHaveBeenCalled()
		} finally {
			vi.useRealTimers()
		}
	})

	it("does not fall back to nested index.html when root index.html is missing", async () => {
		const openFileTab = vi.fn()
		const currentFile = {
			file_id: "file-1",
			file_name: "detail.html",
			relative_file_path: "detail.html",
		}
		const nestedFile = {
			file_id: "nested-admin",
			file_name: "index.html",
			relative_file_path: "admin/index.html",
		}
		render(
			<HTML
				{...baseProps}
				viewMode="desktop"
				isEditMode={false}
				attachmentList={[currentFile, nestedFile]}
				openFileTab={openFileTab}
			/>,
		)
		await waitFor(() => expect(mockIsolatedHTMLRendererProps).toHaveBeenCalled())
		const props = mockIsolatedHTMLRendererProps.mock.lastCall?.[0]
		act(() => props.openNewTab("file-1", "/index.html", false))
		expect(openFileTab).not.toHaveBeenCalled()

		act(() => props.openNewTab("file-1", "/", false))
		expect(openFileTab).not.toHaveBeenCalled()
	})

	it("resolves root index.html instead of earlier nested index.html when both exist", async () => {
		const openFileTab = vi.fn()
		const currentFile = {
			file_id: "file-1",
			file_name: "detail.html",
			relative_file_path: "detail.html",
		}
		const nestedFile = {
			file_id: "nested-admin",
			file_name: "index.html",
			relative_file_path: "admin/index.html",
		}
		const rootFile = {
			file_id: "root-index",
			file_name: "index.html",
			relative_file_path: "index.html",
		}
		render(
			<HTML
				{...baseProps}
				viewMode="desktop"
				isEditMode={false}
				attachmentList={[currentFile, nestedFile, rootFile]}
				openFileTab={openFileTab}
			/>,
		)
		await waitFor(() => expect(mockIsolatedHTMLRendererProps).toHaveBeenCalled())
		const props = mockIsolatedHTMLRendererProps.mock.lastCall?.[0]
		act(() => props.openNewTab("file-1", "/index.html", false))
		expect(openFileTab).toHaveBeenCalledWith(
			expect.objectContaining({ file_id: "root-index" }),
			false,
		)
	})

	it("does not fall back to an index.html with an empty relative path", async () => {
		const openFileTab = vi.fn()
		const currentFile = {
			file_id: "file-1",
			file_name: "detail.html",
			relative_file_path: "detail.html",
		}
		const nestedFile = {
			file_id: "nested-admin",
			file_name: "index.html",
			relative_file_path: "admin/index.html",
		}
		const rootFileWithoutPath = {
			file_id: "root-without-path",
			file_name: "index.html",
			relative_file_path: "",
		}
		render(
			<HTML
				{...baseProps}
				viewMode="desktop"
				isEditMode={false}
				attachmentList={[currentFile, nestedFile, rootFileWithoutPath]}
				openFileTab={openFileTab}
			/>,
		)
		await waitFor(() => expect(mockIsolatedHTMLRendererProps).toHaveBeenCalled())
		const props = mockIsolatedHTMLRendererProps.mock.lastCall?.[0]
		act(() => props.openNewTab("file-1", "/index.html", false))
		expect(openFileTab).not.toHaveBeenCalled()
	})

	it("hides the HTML refresh action when showRefresh is false", async () => {
		render(<HTML {...baseProps} viewMode="desktop" isEditMode={false} showRefresh={false} />)

		await waitFor(() => {
			expect(screen.getByTestId("common-header")).toHaveAttribute(
				"data-show-refresh",
				"false",
			)
		})
	})

	it("does not fall back to nested entry even with backslash paths", async () => {
		const openFileTab = vi.fn()
		const currentFile = {
			file_id: "file-1",
			file_name: "detail.html",
			relative_file_path: "detail.html",
		}
		const nestedWinFile = {
			file_id: "nested-win",
			file_name: "index.html",
			relative_file_path: "admin\\index.html",
		}
		render(
			<HTML
				{...baseProps}
				viewMode="desktop"
				isEditMode={false}
				attachmentList={[currentFile, nestedWinFile]}
				openFileTab={openFileTab}
			/>,
		)
		await waitFor(() => expect(mockIsolatedHTMLRendererProps).toHaveBeenCalled())
		const props = mockIsolatedHTMLRendererProps.mock.lastCall?.[0]
		act(() => props.openNewTab("file-1", "/", false))
		expect(openFileTab).not.toHaveBeenCalled()
	})

	it("should pass HTML navigation state to the isolated renderer", async () => {
		const htmlNavigation = {
			filePath: "page1.html",
			search: "?name=%E5%BC%A0%E4%B8%89&mode=preview",
			hash: "#summary",
			anchor: "summary",
			target: "report",
			background: true,
			history: "replace",
		}

		render(
			<HTML
				{...baseProps}
				data={{ ...baseProps.data, htmlNavigation }}
				viewMode="desktop"
				isEditMode={false}
			/>,
		)

		await waitFor(() => {
			expect(mockIsolatedHTMLRendererProps).toHaveBeenLastCalledWith(
				expect.objectContaining({ htmlNavigation }),
			)
		})
	})

	it("should update the isolated renderer when only the query changes", async () => {
		const oldNavigation = {
			filePath: "page1.html",
			search: "?mode=old",
			hash: "",
			anchor: "",
		}
		const newNavigation = {
			filePath: "page1.html",
			search: "?mode=new",
			hash: "",
			anchor: "",
		}

		const { rerender } = render(
			<HTML
				{...baseProps}
				data={{ ...baseProps.data, htmlNavigation: oldNavigation }}
				viewMode="desktop"
				isEditMode={false}
			/>,
		)

		await waitFor(() => {
			expect(mockIsolatedHTMLRendererProps).toHaveBeenLastCalledWith(
				expect.objectContaining({ htmlNavigation: oldNavigation }),
			)
		})

		rerender(
			<HTML
				{...baseProps}
				data={{ ...baseProps.data, htmlNavigation: newNavigation }}
				viewMode="desktop"
				isEditMode={false}
			/>,
		)

		await waitFor(() => {
			expect(mockIsolatedHTMLRendererProps).toHaveBeenLastCalledWith(
				expect.objectContaining({ htmlNavigation: newNavigation }),
			)
		})
	})

	it("should require an exact relative path match for bundled template entry html", () => {
		expect(
			resolveHtmlPreviewBundledTemplate({
				relativeFilePath: "nested/index.html",
				displayConfigType: "dashboard",
			}),
		).toBe("dashboard")

		expect(
			resolveHtmlPreviewBundledTemplate({
				relativeFilePath: "index.html",
				displayConfigType: "dashboard",
			}),
		).toBe("dashboard")
	})

	it("should resolve bundled template for index html inside business folder", () => {
		expect(
			resolveHtmlPreviewBundledTemplate({
				relativeFilePath: "/销售数据分析看板/index.html",
				displayConfigType: "dashboard",
			}),
		).toBe("dashboard")
	})

	it("should only resolve bundled template from displayConfig.type", () => {
		expect(
			resolveHtmlPreviewBundledTemplate({
				relativeFilePath: "index.html",
			}),
		).toBeUndefined()

		expect(
			resolveHtmlPreviewBundledTemplate({
				relativeFilePath: "index.html",
				displayConfigType: "audio",
			}),
		).toBe("audio")
	})

	it("should strictly map dashboard shell css and js only", () => {
		expect(isDashboardTemplateShellReferencePath("./index.css")).toBe(true)
		expect(isDashboardTemplateShellReferencePath("./dashboard.js")).toBe(true)
		expect(isDashboardTemplateShellReferencePath("nested/index.css")).toBe(false)
		expect(isDashboardTemplateShellReferencePath("./config.js")).toBe(false)
	})

	it("should show server update button after updatedAt changes in code mode without saving", async () => {
		mockGetFileContentById.mockResolvedValue("<html><body>server</body></html>")

		const { rerender } = render(<HTML {...baseProps} />)

		expect(screen.queryByTestId("html-server-update-button")).not.toBeInTheDocument()

		rerender(<HTML {...baseProps} updatedAt="2026-03-20T10:00:01.000Z" />)

		await waitFor(() => {
			expect(screen.getByTestId("html-server-update-button")).toBeInTheDocument()
		})
	})

	it("should open code version compare dialog in code mode", async () => {
		mockGetFileContentById.mockResolvedValue("<html><body>server</body></html>")

		const { rerender } = render(<HTML {...baseProps} />)

		rerender(<HTML {...baseProps} updatedAt="2026-03-20T10:00:01.000Z" />)

		await waitFor(() => {
			expect(screen.getByTestId("html-server-update-button")).toBeInTheDocument()
		})

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-server-update-button"))
		})

		expect(screen.getByTestId("code-version-compare-dialog")).toBeInTheDocument()
		expect(screen.queryByTestId("visual-version-compare-dialog")).not.toBeInTheDocument()
	})

	it("should open visual version compare dialog in non-code mode", async () => {
		mockGetFileContentById.mockResolvedValue("<html><body>server</body></html>")

		const { rerender } = render(<HTML {...baseProps} viewMode="desktop" />)

		rerender(<HTML {...baseProps} viewMode="desktop" updatedAt="2026-03-20T10:00:01.000Z" />)

		await waitFor(() => {
			expect(screen.getByTestId("html-server-update-button")).toBeInTheDocument()
		})

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-server-update-button"))
		})

		expect(screen.getByTestId("visual-version-compare-dialog")).toBeInTheDocument()
		expect(screen.queryByTestId("code-version-compare-dialog")).not.toBeInTheDocument()
	})

	it("should show save-with-update dialog when save detects server conflict", async () => {
		const mockSaveEditContent = vi.fn().mockResolvedValue(undefined)

		mockGetFileContentById.mockResolvedValue("<html><body>server</body></html>")

		render(
			<HTML
				{...baseProps}
				allowEdit
				saveEditContent={mockSaveEditContent}
				setIsEditMode={vi.fn()}
			/>,
		)

		fireEvent.change(screen.getByTestId("code-editor"), {
			target: { value: "<html><body>local edit</body></html>" },
		})

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-save-button"))
		})

		await waitFor(() => {
			expect(screen.getByTestId("html-save-with-update-dialog")).toBeInTheDocument()
		})
		expect(screen.getByTestId("html-save-with-update-cancel-button")).toBeInTheDocument()
		expect(screen.getByTestId("html-save-with-update-confirm-button")).toBeInTheDocument()
		expect(mockSaveEditContent).not.toHaveBeenCalled()
	})

	it("should save after confirming conflict dialog", async () => {
		const mockSaveEditContent = vi.fn().mockResolvedValue(undefined)

		mockGetFileContentById.mockResolvedValue("<html><body>server</body></html>")

		const { rerender } = render(
			<HTML
				{...baseProps}
				allowEdit
				saveEditContent={mockSaveEditContent}
				setIsEditMode={vi.fn()}
			/>,
		)

		fireEvent.change(screen.getByTestId("code-editor"), {
			target: { value: "<html><body>confirm branch</body></html>" },
		})

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-save-button"))
		})

		await waitFor(() => {
			expect(screen.getByTestId("html-save-with-update-dialog")).toBeInTheDocument()
		})

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-save-with-update-confirm-button"))
		})

		await waitFor(() => {
			expect(mockSaveEditContent).toHaveBeenCalledWith(
				"<html><body>confirm branch</body></html>",
				"file-1",
				true,
				expect.any(Function),
				undefined,
				false,
				{ silent: true },
			)
		})
		expect(screen.queryByTestId("html-save-with-update-dialog")).not.toBeInTheDocument()
	})

	it("should close conflict dialog without saving after canceling", async () => {
		const mockSaveEditContent = vi.fn().mockResolvedValue(undefined)

		mockGetFileContentById.mockResolvedValue("<html><body>server</body></html>")

		render(
			<HTML
				{...baseProps}
				allowEdit
				saveEditContent={mockSaveEditContent}
				setIsEditMode={vi.fn()}
			/>,
		)

		fireEvent.change(screen.getByTestId("code-editor"), {
			target: { value: "<html><body>cancel branch</body></html>" },
		})

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-save-button"))
		})

		await waitFor(() => {
			expect(screen.getByTestId("html-save-with-update-dialog")).toBeInTheDocument()
		})

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-save-with-update-cancel-button"))
		})

		expect(screen.queryByTestId("html-save-with-update-dialog")).not.toBeInTheDocument()
		expect(mockSaveEditContent).not.toHaveBeenCalled()
	})

	it("should save without re-prompting after accepting the server version", async () => {
		const mockSaveEditContent = vi.fn().mockResolvedValue(undefined)

		mockGetFileContentById.mockResolvedValue("<html><body>server</body></html>")

		const { rerender } = render(
			<HTML
				{...baseProps}
				allowEdit
				saveEditContent={mockSaveEditContent}
				setIsEditMode={vi.fn()}
			/>,
		)

		fireEvent.change(screen.getByTestId("code-editor"), {
			target: { value: "<html><body>local edit</body></html>" },
		})

		rerender(
			<HTML
				{...baseProps}
				allowEdit
				saveEditContent={mockSaveEditContent}
				updatedAt="2026-03-20T10:00:01.000Z"
				setIsEditMode={vi.fn()}
			/>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("html-server-update-button")).toBeInTheDocument()
		})

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-server-update-button"))
		})

		await act(async () => {
			fireEvent.click(screen.getByTestId("code-version-compare-use-server-version-button"))
		})

		expect(screen.queryByTestId("code-version-compare-dialog")).not.toBeInTheDocument()

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-save-button"))
		})

		await waitFor(() => {
			expect(mockSaveEditContent).toHaveBeenCalledWith(
				"<html><body>server</body></html>",
				"file-1",
				true,
				expect.any(Function),
				undefined,
				false,
				{ silent: true },
			)
		})
		expect(screen.queryByTestId("html-save-with-update-dialog")).not.toBeInTheDocument()
	})

	it("should not re-prompt in visual mode after accepting the latest server version", async () => {
		mockGetFileContentById.mockResolvedValue("<html><body>server</body></html>")

		const { rerender } = render(
			<HTML {...baseProps} viewMode="desktop" allowEdit setIsEditMode={vi.fn()} />,
		)

		rerender(
			<HTML
				{...baseProps}
				viewMode="desktop"
				allowEdit
				setIsEditMode={vi.fn()}
				updatedAt="2026-03-20T10:00:01.000Z"
			/>,
		)

		await waitFor(() => {
			expect(screen.getByTestId("html-server-update-button")).toBeInTheDocument()
		})

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-server-update-button"))
		})

		await act(async () => {
			fireEvent.click(screen.getByTestId("visual-version-compare-use-server-version-button"))
		})

		expect(screen.queryByTestId("visual-version-compare-dialog")).not.toBeInTheDocument()

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-save-button"))
		})

		expect(screen.queryByTestId("html-save-with-update-dialog")).not.toBeInTheDocument()
	})

	it("should exit without remounting the tab after save and exit succeeds", async () => {
		const mockSaveEditContent = vi.fn().mockResolvedValue(undefined)
		const mockSetIsEditMode = vi.fn()
		const mockOnRefreshFile = vi.fn()

		mockGetFileContentById.mockResolvedValue("<html><body>base</body></html>")

		render(
			<HTML
				{...baseProps}
				allowEdit
				saveEditContent={mockSaveEditContent}
				setIsEditMode={mockSetIsEditMode}
				onRefreshFile={mockOnRefreshFile}
			/>,
		)
		mockSetIsEditMode.mockClear()
		mockOnRefreshFile.mockClear()

		fireEvent.change(screen.getByTestId("code-editor"), {
			target: { value: "<html><body>saved and exit</body></html>" },
		})

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-save-and-exit-button"))
		})

		await waitFor(() => {
			expect(mockSaveEditContent).toHaveBeenCalledWith(
				"<html><body>saved and exit</body></html>",
				"file-1",
				true,
				expect.any(Function),
				undefined,
				false,
				{ silent: true },
			)
			expect(mockSetIsEditMode).toHaveBeenCalledWith(false)
		})
		expect(mockOnRefreshFile).not.toHaveBeenCalled()
	})

	it("should reset the iframe content when canceling visual edit", async () => {
		const mockSetIsEditMode = vi.fn()
		const mockOnRefreshFile = vi.fn()

		render(
			<HTML
				{...baseProps}
				viewMode="desktop"
				allowEdit
				setIsEditMode={mockSetIsEditMode}
				onRefreshFile={mockOnRefreshFile}
			/>,
		)

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-cancel-button"))
		})

		expect(mockResetContent).toHaveBeenCalledOnce()
		expect(mockSetIsEditMode).toHaveBeenCalledWith(false)
		expect(mockOnRefreshFile).toHaveBeenCalledOnce()
	})

	it("should not refresh file after regular save succeeds", async () => {
		const mockSaveEditContent = vi.fn().mockResolvedValue(undefined)
		const mockSetIsEditMode = vi.fn()
		const mockOnRefreshFile = vi.fn()

		mockGetFileContentById.mockResolvedValue("<html><body>base</body></html>")

		render(
			<HTML
				{...baseProps}
				allowEdit
				saveEditContent={mockSaveEditContent}
				setIsEditMode={mockSetIsEditMode}
				onRefreshFile={mockOnRefreshFile}
			/>,
		)
		mockSetIsEditMode.mockClear()
		mockOnRefreshFile.mockClear()

		fireEvent.change(screen.getByTestId("code-editor"), {
			target: { value: "<html><body>saved only</body></html>" },
		})

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-save-button"))
		})

		await waitFor(() => {
			expect(mockSaveEditContent).toHaveBeenCalledWith(
				"<html><body>saved only</body></html>",
				"file-1",
				true,
				expect.any(Function),
				undefined,
				false,
				{ silent: true },
			)
		})

		expect(mockSetIsEditMode).not.toHaveBeenCalledWith(false)
		expect(mockOnRefreshFile).not.toHaveBeenCalled()
	})

	it("should exit without remounting the tab after confirming save and exit conflict flow", async () => {
		const mockSaveEditContent = vi.fn().mockResolvedValue(undefined)
		const mockSetIsEditMode = vi.fn()
		const mockOnRefreshFile = vi.fn()

		mockGetFileContentById.mockResolvedValue("<html><body>server</body></html>")

		render(
			<HTML
				{...baseProps}
				allowEdit
				saveEditContent={mockSaveEditContent}
				setIsEditMode={mockSetIsEditMode}
				onRefreshFile={mockOnRefreshFile}
			/>,
		)
		mockSetIsEditMode.mockClear()
		mockOnRefreshFile.mockClear()

		fireEvent.change(screen.getByTestId("code-editor"), {
			target: { value: "<html><body>conflict exit</body></html>" },
		})

		await act(async () => {
			fireEvent.click(screen.getByTestId("html-save-and-exit-button"))
		})

		await waitFor(() => {
			expect(screen.getByTestId("html-save-with-update-dialog")).toBeInTheDocument()
		})

		await act(async () => {
			fireEvent.click(screen.getByText("common.save"))
		})

		await waitFor(() => {
			expect(mockSaveEditContent).toHaveBeenCalledWith(
				"<html><body>conflict exit</body></html>",
				"file-1",
				true,
				expect.any(Function),
				undefined,
				false,
				{ silent: true },
			)
			expect(mockSetIsEditMode).toHaveBeenCalledWith(false)
		})
		expect(mockOnRefreshFile).not.toHaveBeenCalled()
	})
})
