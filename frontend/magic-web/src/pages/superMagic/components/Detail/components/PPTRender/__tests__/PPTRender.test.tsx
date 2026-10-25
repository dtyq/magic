import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import PPTRender, { reconcilePPTSlideToolbarModels } from "../index"
import { TAILWIND_Z_INDEX_CLASSES } from "../../../contents/HTML/constants/z-index"
import type { PPTSlideStructureAdapter } from "../types"
import { pptNotesPreferenceStore } from "@/stores/layout/PPTNotesPreferenceStore"

vi.mock("../../../contents/HTML/IsolatedHTMLRenderer", async () => {
	const { useEffect } = await import("react")
	return {
		default: function MockIsolatedHTMLRenderer({
			content,
			onRenderReady,
		}: {
			content: string
			onRenderReady: () => void
		}) {
			useEffect(() => onRenderReady(), [content, onRenderReady])
			return <div data-testid="transition-preview-html">{content}</div>
		},
	}
})

const mockState = vi.hoisted(() => ({
	isMobile: false,
	store: {
		activeIndex: 0,
		get currentSlide() {
			return this.slides[this.activeIndex]
		},
		slidePaths: ["slide-1.html"],
		slideUrls: ["slide-1.html"],
		slides: [
			{
				id: "slide-1",
				path: "slide-1.html",
				content: "<div>slide</div>",
				rawContent: "<div>slide</div>",
				loadingState: "loaded",
				loadingError: undefined,
			},
		],
		visibleSlides: [
			{
				index: 0,
				slide: {
					id: "slide-1",
					path: "slide-1.html",
					content: "<div>slide</div>",
					rawContent: "<div>slide</div>",
					loadingState: "loaded",
					loadingError: undefined,
				},
			},
		],
		isReady: true,
		loadingProgress: 0,
		isTransitioning: false,
		isAutomaticLoadingEnabled: true,
		setFullscreen: vi.fn(),
		getConfigForExport: vi.fn(() => ({ displayConfig: {} })),
		setActiveIndex: vi.fn(),
		ensureSlideContent: vi.fn(async () => true),
		getFileIdByPath: vi.fn(() => "slide-file-id"),
		getFullRelativePath: vi.fn((path: string) => `project/deck/${path}`),
		getSlideEditingState: vi.fn(() => false),
		getSlideServerUpdate: vi.fn(() => undefined),
		clearSlideServerUpdate: vi.fn(),
		updateSlideContent: vi.fn(),
		updateSlideNotes: vi.fn(),
		generateSlideScreenshot: vi.fn(),
		markSlideAsManuallySaved: vi.fn(),
		updateSlideContents: vi.fn(),
	},
	navigateSaveHandler: vi.fn(async () => true),
	closeSaveHandler: vi.fn(async () => true),
	discardHandler: vi.fn(async () => true),
	confirmConfig: null as null | Record<string, unknown>,
	lastStoreConfig: null as null | Record<string, any>,
	pptControlBarProps: vi.fn(),
	pptSlideProps: vi.fn(),
	toolbarMounted: vi.fn(),
	toolbarUnmounted: vi.fn(),
	sidebarPreviewEffect: vi.fn(),
	nativeIsFullscreen: false,
	nativeIsPresenterView: false,
	toggleFullscreen: vi.fn(async () => undefined),
	presenterIsOpen: false,
	changeSlide: vi.fn(),
	firstPage: vi.fn(async () => true),
	jumpToPage: vi.fn(),
	presenterFallbackOnly: false,
	presenterOpen: vi.fn(async () => "opened" as const),
	presenterContainer: null as HTMLElement | null,
	presenterClose: vi.fn(),
	presenterMove: vi.fn(async () => true),
	isSlideEditing: true,
	deckBusy: false,
	navigationCheck: undefined as
		| undefined
		| ((type: "prev" | "next" | "first" | "jump", targetIndex?: number) => Promise<boolean>),
	navigationCloseAutoFocus: undefined as
		undefined | ((event: { preventDefault: () => void }) => void),
	fullscreenBeforeEnter: undefined as undefined | (() => boolean | Promise<boolean>),
}))

vi.mock("react-i18next", async (importOriginal) => ({
	...(await importOriginal<typeof import("react-i18next")>()),
	useTranslation: () => ({
		t: (key: string) => key,
	}),
}))

vi.mock("@/hooks/useIsMobile", () => ({
	useIsMobile: () => mockState.isMobile,
}))

vi.mock("@/models/user/hooks/useOrganization", () => ({
	useOrganization: () => ({
		organizationCode: "org",
	}),
}))

vi.mock("@/utils/cn", () => ({
	cn: (...classNames: Array<string | false | null | undefined>) =>
		classNames.filter(Boolean).join(" "),
}))

vi.mock("@/hooks/useContainerShowButtonText", () => ({
	useContainerShowButtonText: () => true,
}))

vi.mock("@/utils/pubsub", () => ({
	default: {
		publish: vi.fn(),
		subscribe: vi.fn(),
		unsubscribe: vi.fn(),
	},
	PubSubEvents: {
		Super_Magic_Detail_Refresh: "Super_Magic_Detail_Refresh",
	},
}))

vi.mock("../contexts/PPTContext", () => ({
	PPTProvider: ({
		children,
		storeConfig,
	}: {
		children?: ReactNode
		storeConfig?: Record<string, any>
	}) => {
		mockState.lastStoreConfig = storeConfig || null
		return <>{children}</>
	},
}))

vi.mock("../PPTSidebar/index", async () => {
	const React = await import("react")
	function MockPPTSidebar({
		allowEdit,
		isPreviewLoadingEnabled,
		onCollapsedChange,
		onOpenTransitions,
	}: {
		allowEdit?: boolean
		isPreviewLoadingEnabled?: boolean
		onCollapsedChange?: (collapsed: boolean) => void
		onOpenTransitions?: () => void
	}) {
		React.useEffect(() => {
			mockState.sidebarPreviewEffect(isPreviewLoadingEnabled)
		}, [isPreviewLoadingEnabled])
		return (
			<div data-testid="ppt-sidebar" data-allow-edit={String(allowEdit)}>
				{onOpenTransitions && (
					<button onClick={onOpenTransitions}>sidebar transitions</button>
				)}
				<button
					type="button"
					data-testid="ppt-sidebar-collapse-button"
					onClick={() => onCollapsedChange?.(true)}
				>
					collapse
				</button>
			</div>
		)
	}
	return {
		default: MockPPTSidebar,
	}
})

vi.mock("../PPTControlBar", () => ({
	PPTControlBar: ({
		scaleRatio,
		onScaleChange,
		onReplaceTemplate,
		notesVisible,
		onToggleNotes,
		onToggleFullscreen,
		onOpenTransitions,
		onToggleBuildPanel,
		buildPanelOpen,
		animationOnly,
	}: {
		scaleRatio: number
		onScaleChange: (scale: number) => void
		onReplaceTemplate?: () => void
		notesVisible?: boolean
		onToggleNotes?: () => void
		onToggleFullscreen: () => void
		onOpenTransitions?: () => void
		onToggleBuildPanel?: () => void
		buildPanelOpen?: boolean
		animationOnly?: boolean
	}) => {
		mockState.pptControlBarProps({
			scaleRatio,
			onScaleChange,
			onReplaceTemplate,
			animationOnly,
		})
		return (
			<div data-testid="ppt-control-bar">
				{onOpenTransitions && <button onClick={onOpenTransitions}>open transitions</button>}
				{onToggleBuildPanel && (
					<button onClick={onToggleBuildPanel} aria-expanded={buildPanelOpen}>
						open builds
					</button>
				)}
				<button onClick={onToggleNotes} aria-expanded={notesVisible}>
					toggle notes
				</button>
				<span data-testid="ppt-control-bar-scale">{scaleRatio}</span>
				<button type="button" onClick={() => onScaleChange(0.44)}>
					change scale
				</button>
				<button type="button" onClick={onToggleFullscreen}>
					present
				</button>
			</div>
		)
	},
}))

vi.mock("../../EditToolbar", async () => {
	const React = await import("react")

	function MockEditToolbar({
		fileId,
		isFullscreen,
		interactionDisabled,
		testIdsEnabled,
	}: {
		fileId?: string
		isFullscreen?: boolean
		interactionDisabled?: boolean
		testIdsEnabled?: boolean
	}) {
		React.useEffect(() => {
			mockState.toolbarMounted()
			return () => mockState.toolbarUnmounted()
		}, [])

		return (
			<div
				data-testid="ppt-edit-toolbar"
				data-file-id={fileId}
				data-fullscreen={String(isFullscreen)}
				data-interaction-disabled={String(Boolean(interactionDisabled))}
				data-test-ids-enabled={String(testIdsEnabled !== false)}
			>
				<button type="button" data-testid="mock-toolbar-action">
					Edit
				</button>
			</div>
		)
	}

	return {
		default: MockEditToolbar,
	}
})

vi.mock("../PPTSlide", async () => {
	const React = await import("react")

	function MockPPTSlide({
		fileId,
		buildPanelOpen,
		onSwipe,
		allowEdit,
		isActive,
		isPresented,
		isFullscreen,
		manualScale,
		onScaleRatioChange,
		onRenderReadyChange,
		onEditModeChange,
		onRegisterSaveHandler,
		onRegisterCloseSaveHandler,
		onRegisterDiscardHandler,
		onManualSave,
		toolbarOwnerKey,
		onToolbarModelChange,
		openNewTab,
	}: {
		openNewTab?: (fileId: string, path: string) => void
		fileId?: string
		buildPanelOpen?: boolean
		onSwipe?: (direction: "prev" | "next") => void
		allowEdit?: boolean
		isActive?: boolean
		isPresented?: boolean
		isFullscreen?: boolean
		manualScale?: number | null
		onScaleRatioChange?: (scale: number) => void
		onRenderReadyChange?: (ready: boolean) => void
		onEditModeChange?: (isEditing: boolean) => void
		onRegisterSaveHandler?: (handler: (() => Promise<boolean>) | null) => void
		onRegisterCloseSaveHandler?: (handler: (() => Promise<boolean>) | null) => void
		onRegisterDiscardHandler?: (handler: (() => Promise<boolean>) | null) => void
		toolbarOwnerKey?: string
		onToolbarModelChange?: (
			ownerKey: string,
			model: { token: object; props: { fileId?: string } } | null,
			token: object,
		) => void
		onManualSave?: (
			saveResult: {
				fileId?: string
				buildPanelOpen?: boolean
				success?: boolean
				cleanContent?: string
				rawContent?: string
			},
			index: number,
		) => Promise<void>
	}) {
		const toolbarToken = React.useRef({}).current
		const toolbarModel = React.useMemo(
			() =>
				isFullscreen
					? null
					: {
							token: toolbarToken,
							props: { fileId },
						},
			[fileId, isFullscreen, toolbarToken],
		)

		mockState.pptSlideProps({
			buildPanelOpen,
			openNewTab,
			allowEdit,
			fileId,
			isActive,
			isPresented,
			manualScale,
			isFullscreen,
		})

		React.useLayoutEffect(() => {
			if (!toolbarOwnerKey || !onToolbarModelChange) return
			onToolbarModelChange(toolbarOwnerKey, toolbarModel, toolbarToken)

			return () => {
				onToolbarModelChange(toolbarOwnerKey, null, toolbarToken)
			}
		}, [onToolbarModelChange, toolbarModel, toolbarOwnerKey, toolbarToken])

		React.useEffect(() => {
			if (!isActive) return

			onScaleRatioChange?.(0.39)
			if (mockState.isSlideEditing) {
				onEditModeChange?.(true)
			}
			onRegisterSaveHandler?.(mockState.navigateSaveHandler)
			onRegisterCloseSaveHandler?.(mockState.closeSaveHandler)
			onRegisterDiscardHandler?.(mockState.discardHandler)
		}, [
			isActive,
			onEditModeChange,
			onRegisterSaveHandler,
			onRegisterCloseSaveHandler,
			onRegisterDiscardHandler,
			onScaleRatioChange,
		])

		return (
			<button
				type="button"
				data-testid={fileId ? `ppt-slide-${fileId}` : "ppt-slide-manual-save"}
				onTouchEnd={() => onSwipe?.("next")}
				data-active={String(Boolean(isActive))}
				data-presented={String(Boolean(isPresented))}
				onClick={() => {
					onRenderReadyChange?.(true)
					if (fileId === "slide-file-id") {
						void onManualSave?.(
							{
								fileId: "slide-file-id",
								success: true,
								cleanContent:
									'<div class="slide-container" style="background-image:url(assets/bg.png)">raw</div>',
								rawContent: "<html>raw editor content</html>",
							},
							0,
						)
					}
				}}
			>
				ppt-slide
			</button>
		)
	}

	return {
		default: MockPPTSlide,
	}
})

vi.mock("../hooks", () => ({
	usePPTSidebar: () => ({
		handleSlideClick: vi.fn(),
		handleSortChange: vi.fn(),
		handleInsertSlide: vi.fn(),
		handleDeleteSlide: vi.fn(),
		handleRenameSlide: vi.fn(),
		handleAddToCurrentChat: vi.fn(),
		handleAddToNewChat: vi.fn(),
		isDeleteModalOpen: false,
	}),
	useFullscreen: (options: { beforeEnter?: () => boolean | Promise<boolean> }) => {
		mockState.fullscreenBeforeEnter = options.beforeEnter
		return {
			isFullscreen: mockState.nativeIsFullscreen,
			isPresenterView: mockState.nativeIsPresenterView,
			toggleFullscreen: mockState.toggleFullscreen,
		}
	},
	usePPTPresenterWindow: () => ({
		isOpen: mockState.presenterIsOpen,
		isFallbackOnly: mockState.presenterFallbackOnly,
		screens: [],
		selectedScreen: null,
		open: mockState.presenterOpen,
		consoleContainer: mockState.presenterIsOpen ? mockState.presenterContainer : null,
		close: mockState.presenterClose,
		moveToScreen: mockState.presenterMove,
	}),
	useSlideFileLocator: () => undefined,
	useCheckBeforeNavigate: () => ({
		checkBeforeNavigate: vi.fn(async () => true),
		registerSaveHandler: vi.fn(),
		registerDiscardHandler: vi.fn(),
		showNavigationDialog: false,
		setShowNavigationDialog: vi.fn(),
		isSavingForNavigation: false,
		targetPageNumber: 2,
		handleSaveAndNavigate: vi.fn(),
		handleDiscardAndNavigate: vi.fn(),
		handleCancelNavigation: vi.fn(),
	}),
	useScrollActiveSlideIntoView: () => undefined,
	usePPTEventBus: () => ({
		onDownloadRequest: () => () => undefined,
		onFullscreenToggle: () => () => undefined,
		emitFullscreenStateChange: vi.fn(),
	}),
	usePPTStore: () => mockState.store,
	useSyncActiveState: () => undefined,
	useSlideSync: () => undefined,
	useSlideNavigation: (options: {
		checkBeforeNavigate: NonNullable<typeof mockState.navigationCheck>
	}) => {
		mockState.navigationCheck = options.checkBeforeNavigate
		return {
			changeSlide: mockState.changeSlide,
			goToFirstSlide: mockState.firstPage,
			handleJumpToPage: mockState.jumpToPage,
			preparePresentation: () => mockState.store.activeIndex,
		}
	},
	useSlideHandlers: ({
		setIsAnySlideEditing,
		setIsSidebarCollapsed,
	}: {
		setIsAnySlideEditing: (value: boolean) => void
		setIsSidebarCollapsed: (collapsed: boolean) => void
	}) => ({
		handleEditModeChange: (_fileId: string, isEditing: boolean) =>
			setIsAnySlideEditing(isEditing),
		handleRefreshSlide: vi.fn(),
		handleRefreshAllSlides: vi.fn(),
		handleRegenerateScreenshot: vi.fn(),
		handleSidebarCollapsedChange: (collapsed: boolean) => setIsSidebarCollapsed(collapsed),
	}),
}))

vi.mock("../hooks/usePPTDeckTools", async (importOriginal) => {
	const actual = await importOriginal<typeof import("../hooks/usePPTDeckTools")>()
	return {
		usePPTDeckTools: (options: Parameters<typeof actual.usePPTDeckTools>[0]) => {
			const result = actual.usePPTDeckTools(options)
			return { ...result, busy: mockState.deckBusy || result.busy }
		},
	}
})

vi.mock("../components/PPTSpeakerNotesPanel", async (importOriginal) => {
	const { default: Panel } =
		await importOriginal<typeof import("../components/PPTSpeakerNotesPanel")>()
	return {
		default: (props: React.ComponentProps<typeof Panel>) => (
			<>
				<Panel {...props} />
				<button
					data-testid="simulate-notes-draft"
					onClick={() => props.onPendingChangesChange?.(true)}
				/>
			</>
		),
	}
})

vi.mock("../hooks/useResizableSidebar", () => ({
	useResizableSidebar: () => ({
		sidebarWidth: 200,
		isResizing: false,
		handleResizeStart: vi.fn(),
	}),
}))

vi.mock("@/components/base", () => ({
	MagicTooltip: ({ children }: { children?: ReactNode }) => <>{children}</>,
	MagicDropdown: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/base/MagicModal", () => ({
	default: {
		confirm: (config: Record<string, unknown>) => {
			mockState.confirmConfig = config
			return {
				destroy: vi.fn(),
			}
		},
	},
}))

vi.mock("@/components/shadcn-ui/button", async () => {
	const { forwardRef } = await import("react")
	return {
		Button: forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
			function MockButton({ children, ...props }, ref) {
				return (
					<button ref={ref} type="button" {...props}>
						{children}
					</button>
				)
			},
		),
	}
})

vi.mock("@/components/shadcn-ui/alert-dialog", () => ({
	AlertDialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
	AlertDialogContent: ({
		children,
		onCloseAutoFocus,
	}: {
		children?: ReactNode
		onCloseAutoFocus?: typeof mockState.navigationCloseAutoFocus
	}) => {
		mockState.navigationCloseAutoFocus = onCloseAutoFocus
		return <div>{children}</div>
	},
	AlertDialogHeader: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
	AlertDialogFooter: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
	AlertDialogTitle: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
	AlertDialogDescription: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
	AlertDialogCancel: ({ children }: { children?: ReactNode }) => (
		<button type="button">{children}</button>
	),
	AlertDialogAction: ({ children }: { children?: ReactNode }) => (
		<button type="button">{children}</button>
	),
}))

function renderPPTRender(input?: {
	onRegisterCheckBeforeClose?: (fileId: string, callback: () => Promise<boolean>) => void
	onUnregisterCheckBeforeClose?: (fileId: string) => void
	isTabActive?: boolean
	isPlaybackMode?: boolean
	allowEdit?: boolean
	slideStructureAdapter?: PPTSlideStructureAdapter
	openNewTab?: (fileId: string, path: string) => void
}) {
	return render(
		<PPTRender
			slidePaths={["slide-1.html"]}
			filePathMapping={new Map()}
			mainFileId="ppt-root-file"
			mainFileName="Deck.html"
			allowEdit={input?.allowEdit ?? true}
			openNewTab={input?.openNewTab}
			isPlaybackMode={input?.isPlaybackMode}
			isTabActive={input?.isTabActive}
			onRegisterCheckBeforeClose={input?.onRegisterCheckBeforeClose}
			onUnregisterCheckBeforeClose={input?.onUnregisterCheckBeforeClose}
			slideStructureAdapter={input?.slideStructureAdapter}
		/>,
	)
}

describe("PPTRender", () => {
	it("previews the selected page from the preceding visible page without navigating the deck", async () => {
		mockState.isSlideEditing = false
		mockState.store.slidePaths = ["slide-1.html", "slide-2.html", "slide-3.html"]
		mockState.store.slideUrls = [...mockState.store.slidePaths]
		mockState.store.slides = mockState.store.slidePaths.map((path, index) => ({
			id: path,
			path,
			index,
			content: `Real page ${index + 1}`,
			rawContent: `Real page ${index + 1}`,
			loadingState: "loaded",
			loadingError: undefined,
		}))
		mockState.store.activeIndex = 2
		mockState.store.getConfigForExport.mockReturnValue({
			displayConfig: { hidden_slides: ["slide-2.html"] },
		})
		renderPPTRender()
		fireEvent.click(screen.getByRole("button", { name: "open transitions" }))
		const panel = await screen.findByRole("complementary", { name: "ppt.transitions.title" })
		expect(within(panel).getByText("Real page 3")).toBeInTheDocument()
		expect(within(panel).getByText("Real page 1")).toBeInTheDocument()
		expect(within(panel).queryByText("Real page 2")).not.toBeInTheDocument()
		expect(mockState.store.ensureSlideContent).toHaveBeenCalledWith(2, "preview")
		expect(mockState.store.ensureSlideContent).toHaveBeenCalledWith(0, "preview")
		expect(mockState.store.setActiveIndex).not.toHaveBeenCalled()
	})
	it("keeps the animation entry available after closing the panel in edit mode", async () => {
		mockState.isSlideEditing = true
		renderPPTRender()
		const button = await screen.findByRole("button", { name: "open builds" })
		expect(mockState.pptControlBarProps).toHaveBeenLastCalledWith(
			expect.objectContaining({ animationOnly: true }),
		)
		fireEvent.click(button)
		await waitFor(() => expect(button).toHaveAttribute("aria-expanded", "true"))
		fireEvent.click(button)
		await waitFor(() => expect(button).toHaveAttribute("aria-expanded", "false"))
		fireEvent.click(button)
		await waitFor(() => expect(button).toHaveAttribute("aria-expanded", "true"))
	})

	it("opens the build queue on the active slide and switches back to transitions", async () => {
		mockState.isSlideEditing = false
		renderPPTRender()
		const button = screen.getByRole("button", { name: "open builds" })
		fireEvent.click(button)
		await waitFor(() => expect(button).toHaveAttribute("aria-expanded", "true"))
		expect(mockState.pptSlideProps).toHaveBeenLastCalledWith(
			expect.objectContaining({ buildPanelOpen: true, isActive: true }),
		)
		fireEvent.click(screen.getByRole("button", { name: "open transitions" }))
		await screen.findByRole("complementary", { name: "ppt.transitions.title" })
		expect(button).toHaveAttribute("aria-expanded", "false")
	})

	it.each([{ allowEdit: false }, { isPlaybackMode: true }])(
		"hides build editing for read-only entry %j",
		(input) => {
			mockState.isSlideEditing = false
			renderPPTRender(input)
			expect(screen.queryByRole("button", { name: "open builds" })).not.toBeInTheDocument()
		},
	)

	it("opens the real transition panel from the editable control bar", async () => {
		mockState.isSlideEditing = false
		renderPPTRender()
		const canvas = screen.getByTestId("ppt-render-div")
		const liveSlide = screen.getByTestId("ppt-slide-slide-file-id")
		fireEvent.click(screen.getByRole("button", { name: "open transitions" }))
		const panel = await screen.findByRole("complementary", { name: "ppt.transitions.title" })
		expect(within(panel).getByTestId("transition-preview-html")).toHaveTextContent(
			"<div>slide</div>",
		)
		expect(mockState.store.ensureSlideContent).toHaveBeenCalledWith(0, "preview")
		expect(screen.getByTestId("ppt-render-slide-content")).toContainElement(panel)
		expect(screen.getByTestId("ppt-render-div")).toBe(canvas)
		expect(screen.getByTestId("ppt-slide-slide-file-id")).toBe(liveSlide)
		expect(
			within(panel).getByRole("button", { name: "ppt.transitions.fade" }),
		).toBeInTheDocument()
		fireEvent.click(within(panel).getByRole("button", { name: "ppt.transitions.close" }))
		expect(
			screen.queryByRole("complementary", { name: "ppt.transitions.title" }),
		).not.toBeInTheDocument()
		expect(screen.getByTestId("ppt-render-div")).toBe(canvas)
		expect(screen.getByTestId("ppt-slide-slide-file-id")).toBe(liveSlide)
	})

	it.each([{ isPlaybackMode: true }, { allowEdit: false }])(
		"hides transition settings in read-only entry %j",
		(input) => {
			mockState.isSlideEditing = false
			renderPPTRender(input)
			expect(
				screen.queryByRole("button", { name: "open transitions" }),
			).not.toBeInTheDocument()
			expect(
				screen.queryByRole("complementary", { name: "ppt.transitions.title" }),
			).not.toBeInTheDocument()
		},
	)

	it("hides transition configuration on mobile while keeping notes and presentation", () => {
		mockState.isMobile = true
		mockState.isSlideEditing = false
		renderPPTRender()
		expect(screen.queryByRole("button", { name: "open transitions" })).not.toBeInTheDocument()
		expect(
			screen.queryByRole("button", { name: "sidebar transitions" }),
		).not.toBeInTheDocument()
		expect(screen.getByRole("button", { name: "toggle notes" })).toBeInTheDocument()
		expect(screen.getByRole("button", { name: "present" })).toBeInTheDocument()
	})

	it("cancels navigation when a transition draft is kept", async () => {
		mockState.isSlideEditing = false
		renderPPTRender()
		fireEvent.click(screen.getByRole("button", { name: "open transitions" }))
		const panel = await screen.findByRole("complementary", { name: "ppt.transitions.title" })
		fireEvent.click(within(panel).getByRole("button", { name: "ppt.transitions.push" }))
		let navigate = Promise.resolve(true)
		act(() => {
			navigate = mockState.navigationCheck?.("next") ?? Promise.resolve(true)
		})
		fireEvent.click(within(panel).getByRole("button", { name: "common.cancel" }))
		expect(await navigate).toBe(false)
		expect(within(panel).getByRole("button", { name: "ppt.transitions.push" })).toHaveAttribute(
			"aria-pressed",
			"true",
		)
	})

	it("connects slide swipes to deck navigation", () => {
		renderPPTRender()
		fireEvent.touchEnd(screen.getByTestId("ppt-slide-slide-file-id"))
		expect(mockState.changeSlide).toHaveBeenCalledWith("next")
	})

	beforeEach(() => {
		mockState.isMobile = false
		mockState.presenterContainer?.remove()
		mockState.presenterContainer = document.createElement("div")
		document.body.appendChild(mockState.presenterContainer)
		pptNotesPreferenceStore.setVisible(false)
		pptNotesPreferenceStore.setHeight(144)
		mockState.confirmConfig = null
		mockState.lastStoreConfig = null
		mockState.deckBusy = false
		mockState.store.getConfigForExport.mockReturnValue({ displayConfig: {} })
		mockState.store.setFullscreen.mockReset()
		mockState.store.setActiveIndex.mockReset()
		mockState.store.ensureSlideContent.mockReset()
		mockState.store.ensureSlideContent.mockResolvedValue(true)
		mockState.store.getFileIdByPath.mockReset()
		mockState.store.getFileIdByPath.mockImplementation((path: string) =>
			path === "slide-1.html" ? "slide-file-id" : path.replace(/\.html$/, "-file-id"),
		)
		mockState.store.getSlideEditingState.mockReset()
		mockState.store.getSlideEditingState.mockReturnValue(false)
		mockState.store.getSlideServerUpdate.mockClear()
		mockState.store.updateSlideContent.mockReset()
		mockState.store.updateSlideContent.mockResolvedValue(
			'<div class="slide-container" style="background-image:url(blob:processed-bg)">processed</div>',
		)
		mockState.store.generateSlideScreenshot.mockReset()
		mockState.store.generateSlideScreenshot.mockResolvedValue(undefined)
		mockState.store.markSlideAsManuallySaved.mockReset()
		mockState.pptControlBarProps.mockReset()
		mockState.pptSlideProps.mockReset()
		mockState.toolbarMounted.mockReset()
		mockState.toolbarUnmounted.mockReset()
		mockState.sidebarPreviewEffect.mockReset()
		mockState.nativeIsFullscreen = false
		mockState.nativeIsPresenterView = false
		mockState.toggleFullscreen.mockReset()
		mockState.changeSlide.mockReset()
		mockState.jumpToPage.mockReset()
		mockState.presenterIsOpen = false
		mockState.presenterFallbackOnly = false
		mockState.presenterOpen.mockReset()
		mockState.presenterOpen.mockResolvedValue("opened")
		mockState.presenterClose.mockReset()
		mockState.presenterMove.mockReset()
		mockState.isSlideEditing = true
		mockState.navigateSaveHandler.mockReset()
		mockState.navigateSaveHandler.mockResolvedValue(true)
		mockState.closeSaveHandler.mockReset()
		mockState.closeSaveHandler.mockResolvedValue(true)
		mockState.discardHandler.mockReset()
		mockState.discardHandler.mockResolvedValue(true)
		mockState.store.activeIndex = 0
		mockState.store.slidePaths = ["slide-1.html"]
		mockState.store.slideUrls = ["slide-1.html"]
		mockState.store.slides = [
			{
				id: "slide-1",
				path: "slide-1.html",
				content: "<div>slide</div>",
				rawContent: "<div>slide</div>",
				loadingState: "loaded",
				loadingError: undefined,
			},
		]
	})

	it("ignores a stale toolbar cleanup after a newer model takes over the same owner", () => {
		const ownerKey = "deck::slide-1"
		const oldToken = {}
		const newToken = {}
		const oldModel = { token: oldToken, props: { fileId: "old-file" } }
		const newModel = { token: newToken, props: { fileId: "new-file" } }

		let models = reconcilePPTSlideToolbarModels(new Map(), ownerKey, oldModel, oldToken)
		models = reconcilePPTSlideToolbarModels(models, ownerKey, newModel, newToken)
		const afterStaleCleanup = reconcilePPTSlideToolbarModels(models, ownerKey, null, oldToken)

		expect(afterStaleCleanup).toBe(models)
		expect(afterStaleCleanup.get(ownerKey)).toBe(newModel)
	})

	it("routes normalized PPT file links to the slide instead of opening a file tab", () => {
		const openNewTab = vi.fn()
		mockState.store.slides.push({
			...mockState.store.slides[0],
			id: "slide-2",
			path: "section/slide-2.html",
		})
		renderPPTRender({ openNewTab })
		const slideProps = mockState.pptSlideProps.mock.calls.at(-1)?.[0]
		slideProps.openNewTab("slide-file-id", "/project/deck/section/slide-2.html")
		expect(mockState.jumpToPage).toHaveBeenCalledWith(1)
		expect(openNewTab).not.toHaveBeenCalled()
		slideProps.openNewTab("slide-file-id", "/other/deck/slide-1.html")
		expect(openNewTab).toHaveBeenCalledWith("slide-file-id", "/other/deck/slide-1.html")
		slideProps.openNewTab("slide-file-id", "/reference.html")
		expect(openNewTab).toHaveBeenCalledWith("slide-file-id", "/reference.html")
	})

	it("does not present a cached hidden page in playback mode", async () => {
		mockState.isSlideEditing = false
		mockState.store.getConfigForExport.mockReturnValue({
			displayConfig: { hidden_slides: ["slide-1.html"] },
		})
		renderPPTRender({ isPlaybackMode: true })
		fireEvent.click(screen.getByTestId("ppt-slide-slide-file-id"))
		await waitFor(() =>
			expect(screen.getByTestId("ppt-slide-slide-file-id")).toHaveAttribute(
				"data-presented",
				"false",
			),
		)
	})

	it("closes an external presentation when every slide is hidden", async () => {
		mockState.isSlideEditing = false
		mockState.presenterIsOpen = true
		mockState.store.getConfigForExport.mockReturnValue({
			displayConfig: { hidden_slides: ["slide-1.html"] },
		})
		renderPPTRender()
		await waitFor(() => expect(mockState.presenterClose).toHaveBeenCalled())
	})

	it("follows file viewer fullscreen state without remounting the toolbar", async () => {
		const props = {
			slidePaths: ["slide-1.html"],
			filePathMapping: new Map(),
			mainFileId: "ppt-root-file",
			mainFileName: "Deck.html",
			allowEdit: true,
			onFullscreen: vi.fn(),
		}
		const { rerender } = render(<PPTRender {...props} isFileFullscreen={false} />)
		const toolbar = await screen.findByTestId("ppt-edit-toolbar")
		expect(toolbar).toHaveAttribute("data-fullscreen", "false")
		rerender(<PPTRender {...props} isFileFullscreen />)
		expect(toolbar).toHaveAttribute("data-fullscreen", "true")
		rerender(<PPTRender {...props} isFileFullscreen={false} />)
		expect(toolbar).toHaveAttribute("data-fullscreen", "false")
		expect(mockState.toolbarMounted).toHaveBeenCalledOnce()
	})

	it.each([true, false])("keeps toolbar actions visible with busy=%s", async (busy) => {
		mockState.isSlideEditing = false
		mockState.deckBusy = busy
		renderPPTRender()
		const action = await screen.findByTestId("mock-toolbar-action")
		expect(action).toBeVisible()
		if (busy) expect(action).toBeDisabled()
		else expect(action).toBeEnabled()
		expect(screen.getByTestId("ppt-edit-toolbar")).toHaveAttribute(
			"data-interaction-disabled",
			String(busy),
		)
		expect(mockState.pptSlideProps).toHaveBeenLastCalledWith(
			expect.objectContaining({ allowEdit: true }),
		)
		expect(screen.getByTestId("ppt-sidebar")).toHaveAttribute("data-allow-edit", "true")
	})

	it.each(["notes", "busy"])(
		"blocks presenter and fullscreen entry during %s protection",
		async (kind) => {
			mockState.isSlideEditing = false
			mockState.deckBusy = kind === "busy"
			renderPPTRender()
			if (kind === "notes") fireEvent.click(screen.getByTestId("simulate-notes-draft"))
			fireEvent.click(screen.getByText("present"))
			expect(mockState.presenterOpen).not.toHaveBeenCalled()
			expect(mockState.toggleFullscreen).not.toHaveBeenCalled()
			expect(await mockState.fullscreenBeforeEnter?.()).toBe(false)
		},
	)

	it("hides the audience slide while a hidden page is being replaced", async () => {
		mockState.isSlideEditing = false
		mockState.presenterIsOpen = true
		mockState.store.slides.push({
			...mockState.store.slides[0],
			id: "slide-2",
			path: "slide-2.html",
			content: "<main>Visible</main>",
		})
		mockState.store.slidePaths.push("slide-2.html")
		mockState.store.slideUrls.push("slide-2.html")
		mockState.store.getConfigForExport.mockReturnValue({
			displayConfig: { hidden_slides: ["slide-1.html"] },
		})
		renderPPTRender()
		expect(screen.getByTestId("ppt-render-slide-stage")).toHaveAttribute(
			"data-hidden-slide",
			"true",
		)
		expect(mockState.presenterClose).not.toHaveBeenCalled()
	})

	it("restores root navigation dialog focus to the control captured by its guard wrapper", async () => {
		mockState.isSlideEditing = false
		renderPPTRender()
		const initiator = screen.getByText("present")
		initiator.focus()
		await mockState.navigationCheck?.("jump", 0)
		screen.getByText("toggle notes").focus()
		const preventDefault = vi.fn()
		mockState.navigationCloseAutoFocus?.({ preventDefault })
		expect(preventDefault).toHaveBeenCalledOnce()
		expect(initiator).toHaveFocus()
	})

	it("connects the toolbar toggle to notes visibility and preserves the choice on remount", async () => {
		mockState.isSlideEditing = false
		const { unmount } = renderPPTRender()
		expect(screen.getByTestId("ppt-speaker-notes-panel")).not.toBeVisible()
		fireEvent.click(screen.getByText("toggle notes"))
		expect(screen.getByTestId("ppt-speaker-notes-panel")).toBeVisible()
		expect(screen.getByText("toggle notes")).toHaveAttribute("aria-expanded", "true")
		unmount()
		renderPPTRender()
		expect(screen.getByTestId("ppt-speaker-notes-panel")).toBeVisible()
		fireEvent.click(screen.getByText("toggle notes"))
		expect(screen.getByTestId("ppt-speaker-notes-panel")).not.toBeVisible()
	})

	it("uses only PPT presentation fullscreen to hide viewer controls", async () => {
		mockState.isSlideEditing = false
		mockState.nativeIsFullscreen = true
		const { rerender } = renderPPTRender()

		await waitFor(() => {
			expect(mockState.store.setFullscreen).toHaveBeenCalledWith(true)
			expect(mockState.sidebarPreviewEffect).toHaveBeenCalledWith(false)
		})
		expect(screen.getByTestId("ppt-render-container")).toHaveClass("fixed")
		expect(screen.getByTestId("ppt-render-sidebar")).toHaveStyle({ width: "0px" })
		expect(screen.getByTestId("ppt-render-slide-content").className).not.toContain(
			TAILWIND_Z_INDEX_CLASSES.BASE.SLIDE_CANVAS,
		)
		expect(screen.queryByTestId("ppt-render-sidebar-resize-handle")).toBeNull()
		expect(screen.queryByTestId("ppt-control-bar")).toBeNull()
		expect(mockState.pptSlideProps).toHaveBeenLastCalledWith(
			expect.objectContaining({ isFullscreen: true }),
		)
		const liveSlideNode = screen.getByTestId("ppt-slide-slide-file-id")

		mockState.store.setFullscreen.mockClear()
		mockState.sidebarPreviewEffect.mockClear()
		mockState.nativeIsFullscreen = false
		rerender(
			<PPTRender
				slidePaths={["slide-1.html"]}
				filePathMapping={new Map()}
				mainFileId="ppt-root-file"
				mainFileName="Deck.html"
				allowEdit={true}
			/>,
		)

		await waitFor(() => {
			expect(mockState.store.setFullscreen).toHaveBeenCalledWith(false)
			expect(mockState.sidebarPreviewEffect).toHaveBeenCalledWith(true)
		})
		expect(mockState.store.setFullscreen.mock.invocationCallOrder[0]).toBeLessThan(
			mockState.sidebarPreviewEffect.mock.invocationCallOrder[0],
		)
		expect(screen.getByTestId("ppt-render-container")).not.toHaveClass("fixed")
		expect(screen.getByTestId("ppt-render-sidebar")).toHaveStyle({ width: "200px" })
		expect(screen.getByTestId("ppt-render-sidebar-resize-handle")).toBeInTheDocument()
		expect(screen.getByTestId("ppt-control-bar")).toBeInTheDocument()
		expect(screen.getByTestId("ppt-control-bar").parentElement).toHaveAttribute(
			"data-testid",
			"ppt-render-slide-stage",
		)
		expect(mockState.pptSlideProps).toHaveBeenLastCalledWith(
			expect.objectContaining({ isFullscreen: false }),
		)
		expect(screen.getByTestId("ppt-slide-slide-file-id")).toBe(liveSlideNode)
		expect(screen.getByTestId("ppt-render-slide-content")).toHaveClass(
			"relative",
			TAILWIND_Z_INDEX_CLASSES.BASE.SLIDE_CANVAS,
		)
	})

	it("keeps notes and navigation visible while the slide stage presents externally", async () => {
		mockState.isSlideEditing = false
		mockState.nativeIsFullscreen = true
		mockState.nativeIsPresenterView = true
		pptNotesPreferenceStore.setVisible(false)

		renderPPTRender()

		await waitFor(() => {
			expect(mockState.store.setFullscreen).toHaveBeenCalledWith(true)
			expect(mockState.sidebarPreviewEffect).toHaveBeenCalledWith(true)
		})
		expect(screen.getByTestId("ppt-render-container")).not.toHaveClass("fixed")
		expect(screen.getByTestId("ppt-render-sidebar")).toHaveStyle({ width: "200px" })
		expect(screen.getByTestId("ppt-render-sidebar-resize-handle")).toBeInTheDocument()
		expect(screen.getByTestId("ppt-speaker-notes-panel")).toBeVisible()
		expect(screen.queryByTestId("ppt-control-bar")).toBeNull()
		expect(screen.getByTestId("ppt-render-slide-stage")).toHaveClass("bg-black")
		expect(mockState.pptSlideProps).toHaveBeenLastCalledWith(
			expect.objectContaining({ isFullscreen: true }),
		)
	})

	it("uses ordinary fullscreen after a single-display presenter fallback", async () => {
		mockState.isSlideEditing = false
		mockState.presenterOpen.mockImplementation(async () => {
			mockState.presenterFallbackOnly = true
			return "fallback"
		})
		const { rerender } = renderPPTRender()

		fireEvent.click(screen.getByRole("button", { name: "present" }))
		await waitFor(() => expect(mockState.presenterOpen).toHaveBeenCalledTimes(1))
		await waitFor(() => expect(mockState.toggleFullscreen).toHaveBeenCalledTimes(1))

		rerender(
			<PPTRender
				slidePaths={["slide-1.html"]}
				filePathMapping={new Map()}
				mainFileId="ppt-root-file"
				mainFileName="Deck.html"
				allowEdit
			/>,
		)
		fireEvent.click(screen.getByRole("button", { name: "present" }))
		await waitFor(() => expect(mockState.toggleFullscreen).toHaveBeenCalledTimes(2))
		expect(mockState.presenterOpen).toHaveBeenCalledTimes(1)
	})

	it("waits for a fresh click when presenter fallback consumes user activation", async () => {
		mockState.isSlideEditing = false
		const activation = { isActive: false }
		const originalActivation = Object.getOwnPropertyDescriptor(navigator, "userActivation")
		Object.defineProperty(navigator, "userActivation", {
			configurable: true,
			value: activation,
		})
		try {
			mockState.presenterOpen.mockImplementation(async () => {
				mockState.presenterFallbackOnly = true
				return "fallback"
			})
			const { rerender } = renderPPTRender()
			fireEvent.click(screen.getByRole("button", { name: "present" }))
			await waitFor(() => expect(mockState.presenterOpen).toHaveBeenCalledTimes(1))
			expect(mockState.toggleFullscreen).not.toHaveBeenCalled()
			activation.isActive = true
			rerender(
				<PPTRender
					slidePaths={["slide-1.html"]}
					filePathMapping={new Map()}
					mainFileId="ppt-root-file"
					mainFileName="Deck.html"
					allowEdit
				/>,
			)
			fireEvent.click(screen.getByRole("button", { name: "present" }))
			await waitFor(() => expect(mockState.toggleFullscreen).toHaveBeenCalledTimes(1))
			expect(mockState.presenterOpen).toHaveBeenCalledTimes(1)
		} finally {
			if (originalActivation)
				Object.defineProperty(navigator, "userActivation", originalActivation)
			else Reflect.deleteProperty(navigator, "userActivation")
		}
	})

	it("does not start a late fullscreen fallback after presenter cancellation", async () => {
		mockState.isSlideEditing = false
		mockState.presenterOpen.mockResolvedValue("cancelled")
		renderPPTRender()

		fireEvent.click(screen.getByRole("button", { name: "present" }))

		await waitFor(() => expect(mockState.presenterOpen).toHaveBeenCalledTimes(1))
		expect(mockState.toggleFullscreen).not.toHaveBeenCalled()
	})

	it("portals notes and controls outside the fullscreen audience stage", () => {
		mockState.isSlideEditing = false
		mockState.presenterIsOpen = true

		renderPPTRender()

		expect(screen.getByTestId("ppt-render-container")).toHaveClass("fixed", "inset-0")
		expect(screen.getByTestId("ppt-render-container")).toHaveAttribute(
			"data-presenter-console",
			"true",
		)
		expect(screen.queryByTestId("ppt-render-sidebar")).not.toBeInTheDocument()
		expect(screen.queryByTestId("ppt-render-edit-toolbar")).not.toBeInTheDocument()
		expect(screen.queryByTestId("ppt-control-bar")).not.toBeInTheDocument()
		expect(mockState.presenterContainer).toContainElement(
			screen.getByTestId("ppt-presenter-console-controls"),
		)
		expect(screen.getByTestId("ppt-render-slide-stage")).not.toContainElement(
			screen.getByTestId("ppt-speaker-notes-panel"),
		)
		expect(screen.getByTestId("ppt-speaker-notes-panel")).toBeVisible()
		expect(screen.getByTestId("ppt-speaker-notes-panel")).toHaveAttribute(
			"data-layout",
			"presenter",
		)
		expect(mockState.pptSlideProps).toHaveBeenLastCalledWith(
			expect.objectContaining({ isFullscreen: false }),
		)

		fireEvent.click(screen.getByTestId("ppt-presenter-console-exit-button"))
		expect(mockState.presenterClose).toHaveBeenCalledTimes(1)
	})

	it("advances non-fullscreen playback with Space and jumps with Home", () => {
		mockState.isSlideEditing = false
		renderPPTRender({ isPlaybackMode: true })
		fireEvent.keyDown(window, { key: " " })
		expect(mockState.changeSlide).toHaveBeenCalledWith("next")
		fireEvent.keyDown(window, { key: "Home" })
		expect(mockState.firstPage).toHaveBeenCalledOnce()
	})

	it("supports presenter keyboard navigation and exit without intercepting controls", () => {
		mockState.isSlideEditing = false
		mockState.presenterIsOpen = true
		mockState.store.slideUrls = ["slide-1.html", "slide-2.html"]
		mockState.store.slides = [
			...mockState.store.slides,
			{ ...mockState.store.slides[0], id: "slide-2", path: "slide-2.html" },
		]
		renderPPTRender()
		fireEvent.keyDown(window, { key: " " })
		expect(mockState.changeSlide).toHaveBeenCalledWith("next")
		mockState.changeSlide.mockClear()
		fireEvent.keyDown(window, { key: "Escape" })
		expect(mockState.presenterClose).toHaveBeenCalledTimes(1)
		fireEvent.keyDown(screen.getByTestId("ppt-presenter-console-exit-button"), { key: " " })
		expect(mockState.presenterClose).toHaveBeenCalledTimes(1)
		expect(mockState.changeSlide).not.toHaveBeenCalled()
		fireEvent.keyDown(screen.getByTestId("ppt-presenter-console-exit-button"), {
			key: "ArrowRight",
		})
		expect(mockState.changeSlide).toHaveBeenCalledWith("next")
		fireEvent.keyDown(screen.getByTestId("ppt-presenter-console-exit-button"), {
			key: "Escape",
		})
		expect(mockState.presenterClose).toHaveBeenCalledTimes(2)
		expect(screen.getByTestId("ppt-presenter-next-slide")).toBeInTheDocument()
		expect(mockState.store.ensureSlideContent).toHaveBeenCalledWith(1)
	})

	it("opens the presenter without copying slide HTML into a popup payload", async () => {
		mockState.isSlideEditing = false
		mockState.store.slides[0] = {
			...mockState.store.slides[0],
			content:
				'<main class="slide-container" data-width="1600" data-height="900">slide</main>',
			rawContent:
				'<main class="slide-container" data-width="1600" data-height="900">slide</main>',
		}

		renderPPTRender()
		fireEvent.click(screen.getByRole("button", { name: "present" }))

		await waitFor(() => {
			expect(mockState.presenterOpen).toHaveBeenCalledWith()
		})
	})

	it("keeps presenter controls and notes available in read-only playback mode", () => {
		mockState.isSlideEditing = false
		pptNotesPreferenceStore.setVisible(true)

		renderPPTRender({ isPlaybackMode: true })

		expect(screen.getByTestId("ppt-control-bar")).toBeInTheDocument()
		expect(screen.getByTestId("ppt-speaker-notes-panel")).toBeVisible()
		expect(screen.getByText("ppt.speakerNotes.empty")).toBeInTheDocument()
	})

	it("keeps overlay speaker notes above the slide control bar", async () => {
		mockState.isSlideEditing = false
		pptNotesPreferenceStore.setVisible(true)
		pptNotesPreferenceStore.setHeight(300)
		renderPPTRender()

		expect(screen.getByTestId("ppt-render-slide-stage")).toHaveClass("z-0")
		expect(screen.getByTestId("ppt-speaker-notes-panel")).toHaveAttribute(
			"data-overlay",
			"true",
		)
	})

	it("stacks the slide canvas above the sidebar so selection chrome is visible", async () => {
		renderPPTRender()

		expect(await screen.findByTestId("ppt-render-slide-content")).toHaveClass(
			"relative",
			TAILWIND_Z_INDEX_CLASSES.BASE.SLIDE_CANVAS,
		)

		fireEvent.click(screen.getByTestId("ppt-sidebar-collapse-button"))

		expect(screen.getByTestId("ppt-render-slide-content").className).not.toContain(
			TAILWIND_Z_INDEX_CLASSES.BASE.SLIDE_CANVAS,
		)
		expect(screen.getByTestId("ppt-render-expand-sidebar-button")).toBeInTheDocument()
	})

	it("keeps the sidebar resize strip below the slide canvas", async () => {
		renderPPTRender()

		const resizeHandle = await screen.findByTestId("ppt-render-sidebar-resize-handle")
		expect(resizeHandle).toHaveClass(TAILWIND_Z_INDEX_CLASSES.BASE.SIDEBAR_RESIZE)
		expect(resizeHandle.className).not.toContain("z-20")
		expect(screen.getByTestId("ppt-render-slide-content")).toHaveClass(
			TAILWIND_Z_INDEX_CLASSES.BASE.SLIDE_CANVAS,
		)
	})

	it("registers a before-close confirmation callback for the PPT file", async () => {
		const registerCheckBeforeClose = vi.fn()

		renderPPTRender({
			onRegisterCheckBeforeClose: registerCheckBeforeClose,
		})

		await waitFor(() => {
			expect(registerCheckBeforeClose).toHaveBeenCalledWith(
				"ppt-root-file",
				expect.any(Function),
			)
		})
	})

	it("passes slidePaths through displayConfig so the store sees fresh magic.project.js slides", () => {
		render(
			<PPTRender
				slidePaths={["fresh-1.html", "fresh-2.html"]}
				displayConfig={{
					type: "slide",
					slides: ["stale-1.html"],
				}}
				filePathMapping={new Map()}
				mainFileId="ppt-root-file"
				mainFileName="Deck.html"
			/>,
		)

		expect(mockState.lastStoreConfig?.displayConfig?.slides).toEqual([
			"fresh-1.html",
			"fresh-2.html",
		])
	})

	it("uses one manual scale for every PPT page", async () => {
		mockState.isSlideEditing = false
		renderPPTRender()

		await waitFor(() => {
			expect(screen.getByTestId("ppt-control-bar-scale")).toHaveTextContent("0.39")
		})

		fireEvent.click(screen.getByText("change scale"))

		await waitFor(() => {
			expect(mockState.pptSlideProps).toHaveBeenLastCalledWith(
				expect.objectContaining({ manualScale: 0.44 }),
			)
		})
	})

	it("passes template replacement through the bottom control bar", async () => {
		mockState.isSlideEditing = false
		renderPPTRender()

		await waitFor(() => {
			expect(mockState.pptControlBarProps).toHaveBeenCalledWith(
				expect.objectContaining({ onReplaceTemplate: expect.any(Function) }),
			)
		})
	})

	it("hides template replacement for slide template projects", async () => {
		mockState.isSlideEditing = false
		renderPPTRender({ slideStructureAdapter: {} })

		await waitFor(() => {
			expect(mockState.pptControlBarProps).toHaveBeenCalledWith(
				expect.objectContaining({ onReplaceTemplate: undefined }),
			)
		})
	})

	it("regenerates the saved slide thumbnail from processed content", async () => {
		renderPPTRender()

		fireEvent.click(screen.getByTestId("ppt-slide-slide-file-id"))

		await waitFor(() => {
			expect(mockState.store.generateSlideScreenshot).toHaveBeenCalledWith(
				0,
				'<div class="slide-container" style="background-image:url(blob:processed-bg)">processed</div>',
			)
		})
		expect(mockState.store.updateSlideContent).toHaveBeenCalledWith(
			0,
			'<div class="slide-container" style="background-image:url(assets/bg.png)">raw</div>',
		)
		expect(mockState.store.markSlideAsManuallySaved).toHaveBeenCalledWith("slide-file-id")
	})

	it("keeps the old real slide visible until a cold target iframe is ready", async () => {
		mockState.isSlideEditing = false
		const slidePaths = Array.from({ length: 6 }, (_, index) => `slide-${index + 1}.html`)
		mockState.store.slidePaths = slidePaths
		mockState.store.slideUrls = slidePaths
		mockState.store.slides = slidePaths.map((path, index) => ({
			id: `slide-${index + 1}`,
			path,
			content: `<div>slide ${index + 1}</div>`,
			rawContent: `<div>slide ${index + 1}</div>`,
			loadingState: "loaded" as const,
			loadingError: undefined,
			lastLoadedAt: index + 1,
		}))

		const renderDeck = () => (
			<PPTRender
				slidePaths={slidePaths}
				filePathMapping={new Map()}
				mainFileId="ppt-root-file"
				mainFileName="Deck.html"
			/>
		)
		const { rerender } = render(renderDeck())

		await waitFor(() => {
			expect(screen.getByTestId("ppt-slide-slide-file-id")).toHaveAttribute(
				"data-presented",
				"true",
			)
		})
		const firstSlideNode = screen.getByTestId("ppt-slide-slide-file-id")

		mockState.store.activeIndex = 4
		rerender(renderDeck())

		await waitFor(() => {
			expect(screen.getByTestId("ppt-slide-slide-5-file-id")).toHaveAttribute(
				"data-active",
				"true",
			)
		})
		expect(screen.getByTestId("ppt-slide-slide-file-id")).toBe(firstSlideNode)
		expect(screen.getByTestId("ppt-slide-slide-file-id")).toHaveAttribute(
			"data-presented",
			"true",
		)
		expect(screen.getByTestId("ppt-slide-slide-5-file-id")).toHaveAttribute(
			"data-presented",
			"false",
		)

		fireEvent.click(screen.getByTestId("ppt-slide-slide-5-file-id"))

		await waitFor(() => {
			expect(screen.getByTestId("ppt-slide-slide-5-file-id")).toHaveAttribute(
				"data-presented",
				"true",
			)
		})
		expect(screen.getByTestId("ppt-slide-slide-file-id")).toHaveAttribute(
			"data-presented",
			"false",
		)
	})

	it("keeps one stable toolbar instance while the presented slide changes", async () => {
		mockState.isSlideEditing = false
		const slidePaths = Array.from({ length: 6 }, (_, index) => `slide-${index + 1}.html`)
		mockState.store.slidePaths = slidePaths
		mockState.store.slideUrls = slidePaths
		mockState.store.slides = slidePaths.map((path, index) => ({
			id: `slide-${index + 1}`,
			path,
			content: `<div>slide ${index + 1}</div>`,
			rawContent: `<div>slide ${index + 1}</div>`,
			loadingState: "loaded" as const,
			loadingError: undefined,
			lastLoadedAt: index + 1,
		}))

		const renderDeck = () => (
			<PPTRender
				slidePaths={slidePaths}
				filePathMapping={new Map()}
				mainFileId="ppt-root-file"
				mainFileName="Deck.html"
			/>
		)
		const { rerender } = render(renderDeck())

		const toolbar = await screen.findByTestId("ppt-edit-toolbar")
		expect(toolbar).toHaveAttribute("data-file-id", "slide-file-id")
		expect(toolbar).toHaveAttribute("data-test-ids-enabled", "true")
		expect(screen.getAllByTestId("ppt-edit-toolbar")).toHaveLength(1)
		expect(mockState.toolbarMounted).toHaveBeenCalledTimes(1)
		expect(mockState.toolbarUnmounted).not.toHaveBeenCalled()

		// A resident page that has already reported ready should switch immediately
		// without replacing the shared toolbar instance.
		fireEvent.click(await screen.findByTestId("ppt-slide-slide-2-file-id"))
		mockState.store.activeIndex = 1
		rerender(renderDeck())

		await waitFor(() => {
			expect(screen.getByTestId("ppt-edit-toolbar")).toHaveAttribute(
				"data-file-id",
				"slide-2-file-id",
			)
		})
		expect(screen.getByTestId("ppt-edit-toolbar")).toBe(toolbar)
		expect(mockState.toolbarMounted).toHaveBeenCalledTimes(1)
		expect(mockState.toolbarUnmounted).not.toHaveBeenCalled()

		mockState.store.activeIndex = 4
		rerender(renderDeck())

		await waitFor(() => {
			expect(screen.getByTestId("ppt-slide-slide-5-file-id")).toHaveAttribute(
				"data-active",
				"true",
			)
		})
		expect(screen.getByTestId("ppt-edit-toolbar")).toBe(toolbar)
		expect(toolbar).toHaveAttribute("data-file-id", "slide-2-file-id")
		expect(screen.getByTestId("ppt-render-edit-toolbar")).toHaveAttribute("aria-busy", "true")
		expect(screen.getByTestId("ppt-render-edit-toolbar")).toHaveStyle({
			pointerEvents: "none",
		})
		expect(toolbar).toHaveAttribute("data-interaction-disabled", "true")

		fireEvent.click(screen.getByTestId("ppt-slide-slide-5-file-id"))

		await waitFor(() => {
			expect(screen.getByTestId("ppt-edit-toolbar")).toHaveAttribute(
				"data-file-id",
				"slide-5-file-id",
			)
		})
		expect(screen.getByTestId("ppt-edit-toolbar")).toBe(toolbar)
		expect(screen.getAllByTestId("ppt-edit-toolbar")).toHaveLength(1)
		expect(screen.getByTestId("ppt-render-edit-toolbar")).toHaveAttribute("aria-busy", "false")
		expect(toolbar).toHaveAttribute("data-interaction-disabled", "false")
		expect(mockState.toolbarMounted).toHaveBeenCalledTimes(1)
		expect(mockState.toolbarUnmounted).not.toHaveBeenCalled()
	})

	it("disables fixed toolbar test ids for an inactive cached preview", async () => {
		mockState.isSlideEditing = false
		renderPPTRender({ isTabActive: false })

		expect(await screen.findByTestId("ppt-edit-toolbar")).toHaveAttribute(
			"data-test-ids-enabled",
			"false",
		)
	})

	it("ignores a stale ready callback after rapid navigation chooses a newer target", async () => {
		mockState.isSlideEditing = false
		const slidePaths = Array.from({ length: 6 }, (_, index) => `slide-${index + 1}.html`)
		mockState.store.slidePaths = slidePaths
		mockState.store.slideUrls = slidePaths
		mockState.store.slides = slidePaths.map((path, index) => ({
			id: `slide-${index + 1}`,
			path,
			content: `<div>slide ${index + 1}</div>`,
			rawContent: `<div>slide ${index + 1}</div>`,
			loadingState: "loaded" as const,
			lastLoadedAt: index + 1,
		}))

		const renderDeck = () => (
			<PPTRender
				slidePaths={slidePaths}
				filePathMapping={new Map()}
				mainFileId="ppt-root-file"
				mainFileName="Deck.html"
			/>
		)
		const { rerender } = render(renderDeck())
		await screen.findByTestId("ppt-slide-slide-file-id")

		mockState.store.activeIndex = 4
		rerender(renderDeck())
		await screen.findByTestId("ppt-slide-slide-5-file-id")

		mockState.store.activeIndex = 2
		rerender(renderDeck())
		await screen.findByTestId("ppt-slide-slide-3-file-id")

		fireEvent.click(screen.getByTestId("ppt-slide-slide-5-file-id"))
		expect(screen.getByTestId("ppt-slide-slide-file-id")).toHaveAttribute(
			"data-presented",
			"true",
		)
		expect(screen.getByTestId("ppt-slide-slide-5-file-id")).toHaveAttribute(
			"data-presented",
			"false",
		)

		fireEvent.click(screen.getByTestId("ppt-slide-slide-3-file-id"))
		await waitFor(() => {
			expect(screen.getByTestId("ppt-slide-slide-3-file-id")).toHaveAttribute(
				"data-presented",
				"true",
			)
		})
	})

	it("shows the save-and-close confirmation and calls the active slide close-save handler", async () => {
		const registerCheckBeforeClose = vi.fn()

		renderPPTRender({
			onRegisterCheckBeforeClose: registerCheckBeforeClose,
		})

		await waitFor(() => {
			expect(registerCheckBeforeClose).toHaveBeenCalled()
		})

		const checkBeforeClose = registerCheckBeforeClose.mock.calls.at(-1)?.[1]
		const closePromise = checkBeforeClose()

		expect(mockState.confirmConfig).not.toBeNull()

		const footer = mockState.confirmConfig?.footer as
			| ((originNode: unknown, actions: { CancelBtn: () => ReactNode }) => ReactNode)
			| undefined

		expect(footer).toEqual(expect.any(Function))
		if (!footer) throw new Error("footer should be defined")

		const footerContent = footer(null, {
			CancelBtn: () => <button type="button">cancel</button>,
		})

		render(<>{footerContent}</>)

		fireEvent.click(screen.getByText("detail.saveAndClose"))

		await expect(closePromise).resolves.toBe(true)
		expect(mockState.closeSaveHandler).toHaveBeenCalledTimes(1)
	})
})
