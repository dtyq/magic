import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import PPTSlide from "../PPTSlide"

const mockState = vi.hoisted(() => ({
	triggerSave: vi.fn(),
	updateContent: vi.fn(),
	resetContent: vi.fn(),
	restartDocument: vi.fn(),
	holdAnimations: vi.fn(),
	prepareAnimations: vi.fn(),
	renewAnimationHold: vi.fn(),
	releaseAnimations: vi.fn(),
	initialEditMode: true,
	getContent: vi.fn(),
	clearServerUpdate: vi.fn(),
	applyServerUpdate: vi.fn(),
	onManualSave: vi.fn(),
	onDeactivate: vi.fn(),
	saveEditContent: vi.fn(),
	renderedIsolatedProps: vi.fn(),
	fileVersion: undefined as number | undefined,
	versionContent: undefined as string | null | undefined,
	isLoadingVersion: false,
	fetchFileVersions: vi.fn(),
	flushFileSaves: vi.fn(async () => true),
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

vi.mock("ahooks", async () => {
	const React = await import("react")

	// Keep the real hook contract: a stable identity that always calls the latest closure.
	function useMemoizedFn<T extends (...args: never[]) => unknown>(fn: T): T {
		const fnRef = React.useRef(fn)
		fnRef.current = fn
		return React.useCallback(((...args: never[]) => fnRef.current(...args)) as T, [])
	}

	return { useMemoizedFn }
})

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => false,
}))

vi.mock("../../../services/fileSaveQueue", async (importOriginal) => ({
	...(await importOriginal<typeof import("../../../services/fileSaveQueue")>()),
	flushFileSaves: mockState.flushFileSaves,
}))

vi.mock("@/utils/cn", () => ({
	cn: (...classNames: Array<string | false | null | undefined>) =>
		classNames.filter(Boolean).join(" "),
}))

vi.mock("../utils/pptAnimationHold", () => ({
	injectPPTAnimationHoldBridge: (content: string) => content,
	holdIframeAnimations: mockState.holdAnimations,
	prepareIframeAnimations: mockState.prepareAnimations,
	renewIframeAnimationHold: mockState.renewAnimationHold,
	releaseIframeAnimations: mockState.releaseAnimations,
}))

vi.mock("../../../hooks/useEditMode", async () => {
	const React = await import("react")

	function useMockEditMode() {
		const [isEditMode, setIsEditMode] = React.useState(mockState.initialEditMode)
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
				restartDocument: mockState.restartDocument,
				getContent: mockState.getContent,
				getIframeElement: () => null,
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
		fileVersion: mockState.fileVersion,
		changeFileVersion: vi.fn(),
		fileVersionsList: [],
		fetchFileVersions: mockState.fetchFileVersions,
		handleVersionRollback: vi.fn(),
		isNewestVersion: true,
		versionContent: mockState.versionContent ?? null,
		isLoadingVersion: mockState.isLoadingVersion,
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

function rerenderSlide(
	view: ReturnType<typeof renderPPTSlide>,
	overrides: Partial<React.ComponentProps<typeof PPTSlide>> = {},
) {
	view.rerender(
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
	it("opens the build sidebar without entering the visual editor", async () => {
		mockState.initialEditMode = false
		renderPPTSlide({ buildPanelOpen: true })
		await waitFor(() =>
			expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
				expect.objectContaining({ isEditMode: false, buildPanelOpen: true }),
			),
		)
	})
	it("saves animation metadata through the existing slide boundary while browsing", async () => {
		mockState.initialEditMode = false
		renderPPTSlide({ buildPanelOpen: true })
		const props = mockState.renderedIsolatedProps.mock.calls.at(-1)?.[0]
		await act(async () => {
			expect(await props.onBuildSave()).toBe(true)
		})
		expect(mockState.triggerSave).toHaveBeenCalledOnce()
		expect(mockState.onManualSave).toHaveBeenCalledWith(
			expect.objectContaining({ success: true }),
			0,
		)
		expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
			expect.objectContaining({ isEditMode: false }),
		)
	})

	it("removes preview spacing from fullscreen on every device", () => {
		renderPPTSlide({ isFullscreen: true })
		expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
			expect.objectContaining({ autoFitVerticalPadding: 0 }),
		)
	})

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
		mockState.restartDocument.mockReset()
		mockState.holdAnimations.mockReset()
		mockState.holdAnimations.mockResolvedValue(undefined)
		mockState.prepareAnimations.mockReset()
		mockState.prepareAnimations.mockResolvedValue(true)
		mockState.renewAnimationHold.mockReset()
		mockState.releaseAnimations.mockReset()
		mockState.initialEditMode = true
		mockState.getContent.mockReset()
		mockState.getContent.mockResolvedValue("<div>editing</div>")
		mockState.clearServerUpdate.mockReset()
		mockState.applyServerUpdate.mockReset()
		mockState.onManualSave.mockReset()
		mockState.saveEditContent.mockReset()
		mockState.saveEditContent.mockResolvedValue(undefined)
		mockState.onDeactivate.mockReset()
		mockState.renderedIsolatedProps.mockReset()
		mockState.fileVersion = undefined
		mockState.versionContent = undefined
		mockState.isLoadingVersion = false
		mockState.fetchFileVersions.mockReset()
		mockState.flushFileSaves.mockReset()
		mockState.flushFileSaves.mockResolvedValue(true)
	})

	it("preserves the source project for a shared slide without a conversation host", () => {
		renderPPTSlide({ projectId: "shared-source", selectedProject: undefined, allowEdit: false })
		expect(mockState.renderedIsolatedProps).toHaveBeenCalledWith(
			expect.objectContaining({ projectId: "shared-source", isPptRender: true }),
		)
	})

	it("refreshes versions when an optimistic notes save finishes without replacing the preview", async () => {
		mockState.initialEditMode = false
		let finishSave!: (saved: boolean) => void
		mockState.flushFileSaves.mockReturnValue(
			new Promise<boolean>((resolve) => {
				finishSave = resolve
			}),
		)
		const original = "<main>Slide</main><template data-magic-slide-notes>Old</template>"
		const updated = original.replace("Old", "Saved note")
		const view = renderPPTSlide({ content: original, rawContent: original })
		const renderer = screen.getByTestId("isolated-html-renderer")
		rerenderSlide(view, { content: original, rawContent: updated })
		await waitFor(() => expect(mockState.flushFileSaves).toHaveBeenCalledWith(["slide-1"]))
		expect(mockState.fetchFileVersions).not.toHaveBeenCalled()
		await act(async () => {
			finishSave(true)
		})
		await waitFor(() =>
			expect(mockState.fetchFileVersions).toHaveBeenCalledWith("slide-1", true),
		)
		expect(screen.getByTestId("isolated-html-renderer")).toBe(renderer)
	})

	it("does not publish a new version when the queued notes save fails", async () => {
		mockState.flushFileSaves.mockResolvedValue(false)
		const original = "<main>Slide</main><template data-magic-slide-notes>Old</template>"
		const view = renderPPTSlide({ content: original, rawContent: original })
		rerenderSlide(view, { content: original, rawContent: original.replace("Old", "New") })
		await act(async () => {
			await Promise.resolve()
		})
		expect(mockState.flushFileSaves).toHaveBeenCalledWith(["slide-1"])
		expect(mockState.fetchFileVersions).not.toHaveBeenCalled()
	})

	it("ignores a pending notes version refresh after the slide unmounts", async () => {
		let finishSave!: (saved: boolean) => void
		mockState.flushFileSaves.mockReturnValue(
			new Promise<boolean>((resolve) => {
				finishSave = resolve
			}),
		)
		const original = "<main>Slide</main><template data-magic-slide-notes>Old</template>"
		const view = renderPPTSlide({ content: original, rawContent: original })
		rerenderSlide(view, { content: original, rawContent: original.replace("Old", "New") })
		view.unmount()
		await act(async () => {
			finishSave(true)
		})
		expect(mockState.fetchFileVersions).not.toHaveBeenCalled()
	})

	it("refreshes versions even when the optimistic save has already completed", async () => {
		const original = "<main>Slide</main><template data-magic-slide-notes>Old</template>"
		const view = renderPPTSlide({ content: original, rawContent: original })
		rerenderSlide(view, { content: original, rawContent: original.replace("Old", "New") })
		await waitFor(() =>
			expect(mockState.fetchFileVersions).toHaveBeenCalledWith("slide-1", true),
		)
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
				autoFitVerticalPadding: 64,
			}),
		)
	})

	it("updates the raw notes baseline without remounting the slide renderer", async () => {
		const original = "<main>Slide</main><template data-magic-slide-notes>Old note</template>"
		const updated =
			"<main>Slide</main><template data-magic-slide-notes>Updated note with more text</template>"
		const view = renderPPTSlide({
			content: "<main>Processed slide</main>",
			rawContent: original,
			renderRevision: "visual-revision-1",
		})
		const renderer = screen.getByTestId("isolated-html-renderer")

		view.rerender(
			<PPTSlide
				index={0}
				isActive={true}
				content="<main>Processed slide</main>"
				rawContent={updated}
				renderRevision="visual-revision-1"
				isFullscreen={false}
				fileId="slide-1"
				filePathMapping={new Map()}
				openNewTab={vi.fn()}
				updateSlideContents={vi.fn()}
				allowEdit={true}
				loadingState="loaded"
				attachmentList={[]}
				saveEditContent={mockState.saveEditContent}
			/>,
		)

		await waitFor(() => {
			expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
				expect.objectContaining({
					content: "<main>Processed slide</main>",
					rawSourceCode: updated,
				}),
			)
		})
		expect(screen.getByTestId("isolated-html-renderer")).toBe(renderer)
		expect(screen.queryByTestId("ppt-slide-content-updating")).not.toBeInTheDocument()
	})

	it("does not blank the preview overlay when only speaker notes change", async () => {
		const original = "<main>Slide</main><template data-magic-slide-notes>Old note</template>"
		const updated =
			"<main>Slide</main><template data-magic-slide-notes>Updated note with more text</template>"
		const onRenderReadyChange = vi.fn()
		const view = renderPPTSlide({
			content: "<main>Processed slide</main>",
			rawContent: original,
			renderRevision: "visual-revision-1",
			onRenderReadyChange,
		})

		await waitFor(() => {
			expect(onRenderReadyChange).toHaveBeenCalledWith(false)
		})
		const isolatedProps = mockState.renderedIsolatedProps.mock.calls.at(-1)?.[0] as
			{ onRenderReady?: () => void } | undefined
		act(() => isolatedProps?.onRenderReady?.())
		expect(onRenderReadyChange).toHaveBeenCalledWith(true)
		onRenderReadyChange.mockClear()

		view.rerender(
			<PPTSlide
				index={0}
				isActive={true}
				content="<main>Processed slide</main>"
				rawContent={updated}
				renderRevision="visual-revision-1"
				isFullscreen={false}
				fileId="slide-1"
				filePathMapping={new Map()}
				openNewTab={vi.fn()}
				updateSlideContents={vi.fn()}
				allowEdit={true}
				loadingState="loaded"
				attachmentList={[]}
				saveEditContent={mockState.saveEditContent}
				onRenderReadyChange={onRenderReadyChange}
			/>,
		)

		await waitFor(() => {
			expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
				expect.objectContaining({
					rawSourceCode: updated,
				}),
			)
		})
		expect(onRenderReadyChange).not.toHaveBeenCalledWith(false)
	})

	it("re-acknowledges readiness when only the revision changes", async () => {
		const onRenderReadyChange = vi.fn()
		const view = renderPPTSlide({
			content: "<main>Processed slide</main>",
			rawContent: "<main>Slide</main>",
			renderRevision: "visual-revision-1",
			onRenderReadyChange,
		})

		await waitFor(() => {
			expect(onRenderReadyChange).toHaveBeenCalledWith(false)
		})
		const isolatedProps = mockState.renderedIsolatedProps.mock.calls.at(-1)?.[0] as
			{ onRenderReady?: () => void } | undefined
		act(() => isolatedProps?.onRenderReady?.())
		expect(onRenderReadyChange).toHaveBeenCalledWith(true)
		onRenderReadyChange.mockClear()

		rerenderSlide(view, {
			content: "<main>Processed slide</main>",
			rawContent: "<main>Slide</main>",
			renderRevision: "visual-revision-2",
			onRenderReadyChange,
		})

		expect(onRenderReadyChange).toHaveBeenCalledWith(true)
		expect(onRenderReadyChange).not.toHaveBeenCalledWith(false)
	})

	it("updates a rendered slide in place without a blocking loading state", async () => {
		const view = renderPPTSlide({
			content: "<main>Old</main>",
			rawContent: "<main>Old raw</main>",
			renderRevision: "visual-revision-1",
		})
		const renderer = screen.getByTestId("isolated-html-renderer")
		const isolatedProps = mockState.renderedIsolatedProps.mock.calls.at(-1)?.[0] as
			{ onRenderReady?: () => void } | undefined
		act(() => isolatedProps?.onRenderReady?.())
		const renderContent = screen.getByTestId("ppt-slide-render-content")
		expect(renderContent.querySelector(".z-10")).toBeNull()

		rerenderSlide(view, {
			content: "<main>New</main>",
			rawContent: "<main>New raw</main>",
			renderRevision: "visual-revision-2",
		})

		expect(screen.queryByTestId("ppt-slide-content-updating")).not.toBeInTheDocument()
		expect(screen.getByTestId("isolated-html-renderer")).toBe(renderer)
		expect(screen.getByTestId("ppt-slide-render-content").querySelector(".z-10")).toBeNull()

		await waitFor(() => {
			expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
				expect.objectContaining({ content: "<main>New raw</main>" }),
			)
		})
		expect(screen.getByTestId("isolated-html-renderer")).toBe(renderer)
		expect(screen.getByTestId("ppt-slide-render-content").querySelector(".z-10")).toBeNull()
	})

	it("leaves the preview alone while the animation panel is open and syncs once it closes", async () => {
		const processSource = vi.fn(async (source: string) => `processed:${source}`)
		const withStep = '<p data-ppt-step="1">a</p>'
		const view = renderPPTSlide({
			content: "<p>a</p>",
			rawContent: "<p>a</p>",
			buildPanelOpen: true,
			processSource,
		})
		rerenderSlide(view, {
			content: "<p>a</p>",
			rawContent: withStep,
			buildPanelOpen: true,
			processSource,
		})
		await act(async () => undefined)
		expect(processSource).not.toHaveBeenCalled()

		rerenderSlide(view, {
			content: "<p>a</p>",
			rawContent: withStep,
			buildPanelOpen: false,
			processSource,
		})
		await waitFor(() => expect(processSource).toHaveBeenCalledWith(withStep))
	})

	it("renders the saved source after saving its own edit", async () => {
		const view = renderPPTSlide({
			content: "<main>Processed</main>",
			rawContent: "<main>Before</main>",
			renderRevision: "visual-revision-1",
		})
		mockState.triggerSave.mockResolvedValue({
			success: true,
			cleanContent: "<main>After</main>",
			rawContent: "<main>After</main>",
			fileId: "slide-1",
		})

		fireEvent.click(screen.getByTestId("ppt-save-button"))
		await waitFor(() => {
			expect(mockState.onManualSave).toHaveBeenCalled()
		})
		mockState.renderedIsolatedProps.mockClear()

		rerenderSlide(view, {
			content: "<main>Processed after</main>",
			rawContent: "<main>After</main>",
			renderRevision: "visual-revision-2",
		})

		// The test processor echoes raw HTML, so the preview must follow the saved source.
		await waitFor(() => {
			expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
				expect.objectContaining({
					rawSourceCode: "<main>After</main>",
					content: "<main>After</main>",
				}),
			)
		})
		expect(screen.queryByTestId("ppt-slide-content-updating")).not.toBeInTheDocument()
	})

	it("converges to the latest source after rapid successive updates", async () => {
		const view = renderPPTSlide({ content: "<p>v0</p>", rawContent: "<p>v0</p>" })
		const renderer = screen.getByTestId("isolated-html-renderer")

		for (const version of ["v1", "v2", "v3"]) {
			rerenderSlide(view, {
				content: `<p>${version}</p>`,
				rawContent: `<p>${version}</p>`,
				renderRevision: version,
			})
		}

		await waitFor(() => {
			expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
				expect.objectContaining({ content: "<p>v3</p>", rawSourceCode: "<p>v3</p>" }),
			)
		})
		expect(screen.getByTestId("isolated-html-renderer")).toBe(renderer)
	})

	it("shows the first-paint overlay again after a code view round trip", () => {
		renderPPTSlide({ content: "<p>slide</p>", rawContent: "<p>slide</p>" })
		const isolatedProps = mockState.renderedIsolatedProps.mock.calls.at(-1)?.[0] as
			{ onRenderReady?: () => void } | undefined
		act(() => isolatedProps?.onRenderReady?.())
		expect(screen.getByTestId("ppt-slide-render-content").querySelector(".z-10")).toBeNull()

		fireEvent.click(screen.getByTestId("ppt-code-mode-button"))
		expect(screen.queryByTestId("ppt-slide-render-content")).not.toBeInTheDocument()
	})

	it("shows the first-paint overlay when a slide recovers from an error", () => {
		const view = renderPPTSlide({ content: "<p>slide</p>", rawContent: "<p>slide</p>" })
		const isolatedProps = mockState.renderedIsolatedProps.mock.calls.at(-1)?.[0] as
			{ onRenderReady?: () => void } | undefined
		act(() => isolatedProps?.onRenderReady?.())

		rerenderSlide(view, {
			content: "<p>slide</p>",
			rawContent: "<p>slide</p>",
			loadingState: "error",
		})
		expect(screen.getByTestId("ppt-slide-error")).toBeInTheDocument()

		rerenderSlide(view, {
			content: "<p>slide</p>",
			rawContent: "<p>slide</p>",
			loadingState: "loaded",
		})
		expect(screen.getByTestId("ppt-slide-render-content").querySelector(".z-10")).not.toBeNull()
	})

	it("编辑工具栏显示时，渲染区域只占用剩余高度", () => {
		renderPPTSlide()

		expect(screen.getByTestId("ppt-edit-toolbar")).toBeInTheDocument()
		expect(screen.getByTestId("ppt-slide-render-content")).toHaveClass("min-h-0", "flex-1")
		expect(mockState.renderedIsolatedProps).toHaveBeenCalledWith(
			expect.objectContaining({
				className: expect.stringContaining("h-full"),
			}),
		)
	})

	it("registers its toolbar model for a shared host without mounting a duplicate toolbar", () => {
		const onToolbarModelChange = vi.fn()
		const { unmount } = renderPPTSlide({
			toolbarOwnerKey: "deck::slide-1",
			onToolbarModelChange,
		})

		expect(screen.queryByTestId("ppt-edit-toolbar")).toBeNull()
		expect(onToolbarModelChange).toHaveBeenCalledWith(
			"deck::slide-1",
			expect.objectContaining({
				props: expect.objectContaining({ fileId: "slide-1" }),
			}),
			expect.any(Object),
		)

		const registrationToken = onToolbarModelChange.mock.calls[0]?.[2]
		expect(onToolbarModelChange.mock.calls[0]?.[1]?.token).toBe(registrationToken)
		unmount()

		expect(onToolbarModelChange).toHaveBeenLastCalledWith(
			"deck::slide-1",
			null,
			registrationToken,
		)
	})

	it("向 HTML renderer 传入竖版 PPT 的缩放尺寸", () => {
		renderPPTSlide({
			content: '<div class="slide-container" data-width="1080" data-height="1920"></div>',
		})

		expect(mockState.renderedIsolatedProps).toHaveBeenCalledWith(
			expect.objectContaining({
				scaleContentDimensions: { width: 1080, height: 1920 },
			}),
		)
	})

	it("向 HTML renderer 传入运行时画布的缩放尺寸", () => {
		renderPPTSlide({
			content: '<main class="ft-canvas" style="width: 1080px; height: 1080px"></main>',
		})

		expect(mockState.renderedIsolatedProps).toHaveBeenCalledWith(
			expect.objectContaining({
				scaleContentDimensions: { width: 1080, height: 1080 },
			}),
		)
	})

	it("only exposes the presented live iframe while a target prepares in the background", () => {
		const { rerender } = renderPPTSlide({ isActive: true })

		expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
			expect.objectContaining({
				isVisible: true,
			}),
		)

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

		expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
			expect.objectContaining({
				isVisible: false,
			}),
		)

		rerender(
			<PPTSlide
				index={0}
				isActive={true}
				isPresented={false}
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

		expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
			expect.objectContaining({
				isVisible: false,
				isTabActive: false,
			}),
		)
		expect(screen.getByTestId("ppt-slide-item-slide-1")).toHaveStyle({
			visibility: "hidden",
			pointerEvents: "none",
		})

		rerender(
			<PPTSlide
				index={0}
				isActive={false}
				isPresented={true}
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

		expect(screen.getByTestId("ppt-slide-item-slide-1")).toHaveStyle({
			visibility: "visible",
			pointerEvents: "none",
		})
		expect(screen.getByTestId("ppt-slide-item-slide-1")).toHaveAttribute(
			"data-interactive",
			"false",
		)
		expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
			expect.objectContaining({
				isVisible: true,
				isTabActive: false,
			}),
		)
	})

	it("hides the live renderer when the cached file tab is inactive", () => {
		renderPPTSlide({ isActive: true, isPresented: true, isTabActive: false })

		expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
			expect.objectContaining({
				isVisible: false,
				isTabActive: false,
			}),
		)
	})

	it.each(["incoming", "outgoing"] as const)(
		"paints the %s transition layer while keeping its iframe inert and paused",
		(transitionRole) => {
			const register = vi.fn()
			const { unmount } = renderPPTSlide({
				isActive: transitionRole === "incoming",
				isPresented: transitionRole === "outgoing",
				transitionRole,
				toolbarOwnerKey: "deck::slide-1",
				onTransitionLayerChange: register,
			})
			const wrapper = screen.getByTestId("ppt-slide-item-slide-1")
			expect(wrapper).toHaveStyle({ visibility: "visible", pointerEvents: "none" })
			expect((wrapper as HTMLDivElement & { inert: boolean }).inert).toBe(true)
			expect(wrapper).toHaveAttribute("aria-hidden", "true")
			expect(register).toHaveBeenCalledWith("deck::slide-1", wrapper)
			expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
				expect.objectContaining({
					isVisible: true,
					isTabActive: false,
					isPlaybackPaused: true,
				}),
			)
			unmount()
			expect(register).toHaveBeenLastCalledWith("deck::slide-1", null)
		},
	)

	it("pauses both saved and live preview frames when a page transition begins", async () => {
		mockState.initialEditMode = false
		const view = renderPPTSlide({ content: "<p>old</p>", rawContent: "<p>old</p>" })
		const initialProps = mockState.renderedIsolatedProps.mock.calls.at(-1)?.[0] as
			{ onRenderReady?: () => void } | undefined
		act(() => initialProps?.onRenderReady?.())
		rerenderSlide(view, { content: "<p>new</p>", rawContent: "<p>new</p>" })
		await waitFor(() => expect(screen.getAllByTestId("isolated-html-renderer")).toHaveLength(2))
		mockState.renderedIsolatedProps.mockClear()
		rerenderSlide(view, {
			content: "<p>new</p>",
			rawContent: "<p>new</p>",
			isActive: false,
			isPresented: true,
			transitionRole: "outgoing",
		})
		const frames = mockState.renderedIsolatedProps.mock.calls.slice(-2).map(([props]) => props)
		expect(frames).toHaveLength(2)
		expect(frames.every((props) => props.isPlaybackPaused)).toBe(true)
		expect(screen.getByTestId("ppt-slide-item-slide-1")).toHaveStyle({
			visibility: "visible",
			pointerEvents: "none",
		})
	})

	it("reports real iframe readiness to the double-buffer owner", async () => {
		const onRenderReadyChange = vi.fn()
		renderPPTSlide({ onRenderReadyChange, renderRevision: "slide-1:1" })

		await waitFor(() => {
			expect(onRenderReadyChange).toHaveBeenCalledWith(false)
		})

		const isolatedProps = mockState.renderedIsolatedProps.mock.calls.at(-1)?.[0] as
			| {
					onRenderReady?: () => void
			  }
			| undefined
		act(() => isolatedProps?.onRenderReady?.())

		expect(onRenderReadyChange).toHaveBeenCalledWith(true)
	})

	it("does not promote a hidden target from the four-second local loading fallback", () => {
		vi.useFakeTimers()
		try {
			const onRenderReadyChange = vi.fn()
			renderPPTSlide({
				isActive: true,
				isPresented: false,
				onRenderReadyChange,
				renderRevision: "slide-1:slow",
			})

			expect(onRenderReadyChange).toHaveBeenCalledWith(false)
			act(() => {
				vi.advanceTimersByTime(4000)
			})

			expect(onRenderReadyChange).not.toHaveBeenCalledWith(true)
		} finally {
			vi.useRealTimers()
		}
	})

	describe("entrance animation replay", () => {
		const scriptedSlide = "<div>slide</div><script>window.counter = 0</script>"
		function markRendered() {
			const props = mockState.renderedIsolatedProps.mock.calls.at(-1)?.[0] as
				{ onRenderReady?: () => void } | undefined
			act(() => props?.onRenderReady?.())
		}

		function renderRenderedBackgroundSlide(onRenderReadyChange = vi.fn()) {
			mockState.initialEditMode = false
			const view = renderPPTSlide({
				content: scriptedSlide,
				rawContent: scriptedSlide,
				isActive: false,
				isPresented: false,
				onRenderReadyChange,
				renderRevision: "slide-1:1",
			})
			markRendered()
			onRenderReadyChange.mockClear()
			return view
		}

		it("recreates a rendered hidden slide and paints it behind before the swap", async () => {
			const onRenderReadyChange = vi.fn()
			const view = renderRenderedBackgroundSlide(onRenderReadyChange)
			expect(screen.getByTestId("ppt-slide-item-slide-1")).toHaveStyle({
				visibility: "hidden",
			})

			rerenderSlide(view, {
				content: scriptedSlide,
				rawContent: scriptedSlide,
				isActive: true,
				isPresented: false,
				onRenderReadyChange,
				renderRevision: "slide-1:1",
			})

			expect(mockState.restartDocument).toHaveBeenCalledTimes(1)
			expect(onRenderReadyChange).toHaveBeenLastCalledWith(false)
			// Laid out and painted under the presented page so the swap never shows a blank iframe.
			expect(screen.getByTestId("ppt-slide-item-slide-1")).toHaveStyle({
				visibility: "visible",
				zIndex: "0",
			})
			expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
				expect.objectContaining({ isVisible: true }),
			)

			markRendered()
			expect(mockState.holdAnimations).toHaveBeenCalledTimes(1)
			expect(onRenderReadyChange).toHaveBeenLastCalledWith(false)
			await waitFor(() => {
				expect(onRenderReadyChange).toHaveBeenLastCalledWith(true)
			})

			// The frozen entrance is released only once the page is actually shown.
			expect(mockState.releaseAnimations).not.toHaveBeenCalled()
			rerenderSlide(view, {
				content: scriptedSlide,
				rawContent: scriptedSlide,
				isActive: true,
				isPresented: true,
				onRenderReadyChange,
				renderRevision: "slide-1:1",
			})
			expect(mockState.releaseAnimations).toHaveBeenCalledTimes(1)
		})

		it("does not swap while the frozen first frame is not acknowledged yet", async () => {
			let acknowledge: () => void = () => undefined
			mockState.holdAnimations.mockReturnValue(
				new Promise<void>((resolve) => {
					acknowledge = resolve
				}),
			)
			const onRenderReadyChange = vi.fn()
			const view = renderRenderedBackgroundSlide(onRenderReadyChange)
			rerenderSlide(view, {
				content: scriptedSlide,
				rawContent: scriptedSlide,
				isActive: true,
				isPresented: false,
				onRenderReadyChange,
				renderRevision: "slide-1:1",
			})

			markRendered()
			await act(async () => {
				await new Promise((resolve) => setTimeout(resolve, 60))
			})
			expect(onRenderReadyChange).not.toHaveBeenCalledWith(true)

			await act(async () => acknowledge())
			await waitFor(() => {
				expect(onRenderReadyChange).toHaveBeenLastCalledWith(true)
			})
		})

		it("does not recreate a slide that is already presented", () => {
			mockState.initialEditMode = false
			const view = renderPPTSlide({ isActive: false, isPresented: true })
			markRendered()

			rerenderSlide(view, { isActive: true, isPresented: true })

			expect(mockState.restartDocument).not.toHaveBeenCalled()
		})

		it("does not recreate a slide that has not rendered yet", () => {
			mockState.initialEditMode = false
			const view = renderPPTSlide({ isActive: false, isPresented: false })

			rerenderSlide(view, { isActive: true, isPresented: false })

			expect(mockState.restartDocument).not.toHaveBeenCalled()
		})

		it("releases the swap when the recreated document never reports back", () => {
			vi.useFakeTimers()
			try {
				const onRenderReadyChange = vi.fn()
				const view = renderRenderedBackgroundSlide(onRenderReadyChange)
				rerenderSlide(view, {
					content: scriptedSlide,
					rawContent: scriptedSlide,
					isActive: true,
					isPresented: false,
					onRenderReadyChange,
					renderRevision: "slide-1:1",
				})
				expect(onRenderReadyChange).toHaveBeenLastCalledWith(false)

				act(() => {
					vi.advanceTimersByTime(4000)
				})

				expect(onRenderReadyChange).toHaveBeenLastCalledWith(true)
			} finally {
				vi.useRealTimers()
			}
		})

		it("prepares a declarative resident page before navigation and reuses its iframe", async () => {
			mockState.initialEditMode = false
			const ready = vi.fn()
			const view = renderPPTSlide({
				isActive: false,
				isPresented: false,
				onRenderReadyChange: ready,
			})
			markRendered()
			expect(mockState.prepareAnimations).toHaveBeenCalledTimes(1)
			expect(mockState.renderedIsolatedProps).toHaveBeenLastCalledWith(
				expect.objectContaining({ isPlaybackPaused: true }),
			)
			await waitFor(() => expect(ready).toHaveBeenLastCalledWith(true))
			rerenderSlide(view, { isActive: true, isPresented: false, onRenderReadyChange: ready })
			expect(mockState.restartDocument).not.toHaveBeenCalled()
			expect(mockState.prepareAnimations).toHaveBeenCalledTimes(1)
			expect(mockState.releaseAnimations).not.toHaveBeenCalled()
			expect(mockState.renewAnimationHold).toHaveBeenCalledTimes(1)
			rerenderSlide(view, { isActive: true, isPresented: true, onRenderReadyChange: ready })
			expect(mockState.releaseAnimations).toHaveBeenCalledTimes(1)
		})

		it("falls back to document replay when the cached animation bridge cannot acknowledge", async () => {
			mockState.initialEditMode = false
			mockState.prepareAnimations.mockResolvedValue(false)
			const ready = vi.fn()
			const view = renderPPTSlide({
				isActive: false,
				isPresented: false,
				onRenderReadyChange: ready,
			})
			markRendered()
			await waitFor(() => expect(ready).toHaveBeenLastCalledWith(true))
			expect(mockState.restartDocument).not.toHaveBeenCalled()
			rerenderSlide(view, { isActive: true, isPresented: false, onRenderReadyChange: ready })
			expect(mockState.restartDocument).toHaveBeenCalledTimes(1)
			expect(ready).toHaveBeenLastCalledWith(false)
		})

		it("does not acknowledge a prepared frame after its source changes", async () => {
			mockState.initialEditMode = false
			let acknowledge!: (ready: boolean) => void
			mockState.prepareAnimations.mockReturnValue(
				new Promise<boolean>((resolve) => {
					acknowledge = resolve
				}),
			)
			const ready = vi.fn()
			const view = renderPPTSlide({
				isActive: false,
				isPresented: false,
				onRenderReadyChange: ready,
			})
			markRendered()
			rerenderSlide(view, {
				isActive: false,
				isPresented: false,
				content: "<div>updated</div>",
				rawContent: "<div>updated</div>",
				onRenderReadyChange: ready,
			})
			ready.mockClear()
			await act(async () => acknowledge(true))
			expect(ready).not.toHaveBeenCalledWith(true)
		})
	})

	it("waits for the selected history version content before mounting its iframe", async () => {
		mockState.fileVersion = 2
		mockState.isLoadingVersion = true
		const { rerender } = renderPPTSlide()

		expect(screen.getByTestId("ppt-slide-content-updating")).toBeInTheDocument()
		expect(mockState.renderedIsolatedProps).not.toHaveBeenCalled()

		mockState.isLoadingVersion = false
		mockState.versionContent = "<div>history version 2</div>"
		rerender(
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
			/>,
		)

		await waitFor(() => {
			expect(mockState.renderedIsolatedProps).toHaveBeenCalledWith(
				expect.objectContaining({
					content: "<div>history version 2</div>",
					rawSourceCode: "<div>history version 2</div>",
				}),
			)
		})
	})

	it("mounts copied content when a loading slide receives its first HTML payload", async () => {
		const { rerender } = renderPPTSlide({
			content: "",
			rawContent: "",
			loadingState: "loading",
		})

		rerender(
			<PPTSlide
				index={0}
				isActive={true}
				content="<div>processed copied slide</div>"
				rawContent="<div>copied slide</div>"
				isFullscreen={false}
				fileId="slide-copy"
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

		await waitFor(() => {
			expect(mockState.renderedIsolatedProps).toHaveBeenCalledWith(
				expect.objectContaining({
					content: "<div>copied slide</div>",
					rawSourceCode: "<div>copied slide</div>",
				}),
			)
		})
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

	it("keeps the preview live when save and exit leaves the content unchanged", async () => {
		renderPPTSlide()
		const lastProps = () =>
			mockState.renderedIsolatedProps.mock.calls.at(-1)?.[0] as {
				onRenderReady?: () => void
			}
		act(() => lastProps().onRenderReady?.())
		mockState.triggerSave.mockResolvedValue({
			success: true,
			cleanContent: "<div>slide</div>",
			rawContent: "<div>slide</div>",
			fileId: "slide-1",
		})

		fireEvent.click(screen.getByTestId("ppt-save-and-exit-button"))

		await waitFor(() => {
			expect(screen.getByTestId("ppt-edit-button")).toBeInTheDocument()
		})
		await waitFor(() => {
			expect(mockState.onManualSave).toHaveBeenCalled()
		})
		await waitFor(() => {
			expect(lastProps().onRenderReady).toBeDefined()
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

	it("asks before saving animation steps over a newer server version", async () => {
		mockState.initialEditMode = false
		renderPPTSlide({
			buildPanelOpen: true,
			serverUpdatedContent: "<div>server-update</div>",
		})
		const props = mockState.renderedIsolatedProps.mock.calls.at(-1)?.[0]
		let saved: boolean | undefined
		await act(async () => {
			void props.onBuildSave().then((result: boolean) => {
				saved = result
			})
		})
		expect(screen.getByTestId("ppt-slide-save-with-update-dialog")).toBeInTheDocument()
		expect(mockState.triggerSave).not.toHaveBeenCalled()

		fireEvent.click(screen.getByText("ppt.saveChanges"))
		await waitFor(() => expect(saved).toBe(true))
		expect(mockState.triggerSave).toHaveBeenCalledTimes(1)
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
				false,
				{ silent: true },
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
