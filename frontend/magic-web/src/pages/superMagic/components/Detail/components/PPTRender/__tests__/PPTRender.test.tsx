import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import PPTRender from "../index"

const mockState = vi.hoisted(() => ({
	store: {
		activeIndex: 0,
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
		setFullscreen: vi.fn(),
		setActiveIndex: vi.fn(),
		getFileIdByPath: vi.fn(() => "slide-file-id"),
		getSlideServerUpdate: vi.fn(() => undefined),
		clearSlideServerUpdate: vi.fn(),
		updateSlideContent: vi.fn(),
		generateSlideScreenshot: vi.fn(),
		markSlideAsManuallySaved: vi.fn(),
		updateSlideContents: vi.fn(),
	},
	navigateSaveHandler: vi.fn(async () => true),
	closeSaveHandler: vi.fn(async () => true),
	discardHandler: vi.fn(async () => true),
	confirmConfig: null as null | Record<string, unknown>,
}))

vi.mock("react-i18next", () => ({
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

vi.mock("@/models/user/hooks/useOrganization", () => ({
	useOrganization: () => ({
		organizationCode: "org",
	}),
}))

vi.mock("@/lib/utils", () => ({
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
	PPTProvider: ({ children }: { children?: ReactNode }) => <>{children}</>,
}))

vi.mock("../PPTSidebar/index", () => ({
	default: () => <div data-testid="ppt-sidebar" />,
}))

vi.mock("../PPTControlBar", () => ({
	PPTControlBar: () => <div data-testid="ppt-control-bar" />,
}))

vi.mock("../PPTSlide", async () => {
	const React = await import("react")

	function MockPPTSlide({
		isActive,
		onEditModeChange,
		onRegisterSaveHandler,
		onRegisterCloseSaveHandler,
		onRegisterDiscardHandler,
	}: {
		isActive?: boolean
		onEditModeChange?: (isEditing: boolean) => void
		onRegisterSaveHandler?: (handler: (() => Promise<boolean>) | null) => void
		onRegisterCloseSaveHandler?: (handler: (() => Promise<boolean>) | null) => void
		onRegisterDiscardHandler?: (handler: (() => Promise<boolean>) | null) => void
	}) {
		React.useEffect(() => {
			if (!isActive) return

			onEditModeChange?.(true)
			onRegisterSaveHandler?.(mockState.navigateSaveHandler)
			onRegisterCloseSaveHandler?.(mockState.closeSaveHandler)
			onRegisterDiscardHandler?.(mockState.discardHandler)
		}, [
			isActive,
			onEditModeChange,
			onRegisterSaveHandler,
			onRegisterCloseSaveHandler,
			onRegisterDiscardHandler,
		])

		return <div data-testid="ppt-slide" />
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
	useFullscreen: () => ({
		isFullscreen: false,
		toggleFullscreen: vi.fn(),
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
	useSlideNavigation: () => ({
		changeSlide: vi.fn(),
		goToFirstSlide: vi.fn(),
		handleJumpToPage: vi.fn(),
	}),
	useSlideHandlers: ({
		setIsAnySlideEditing,
	}: {
		setIsAnySlideEditing: (value: boolean) => void
	}) => ({
		handleEditModeChange: (_fileId: string, isEditing: boolean) =>
			setIsAnySlideEditing(isEditing),
		handleRefreshSlide: vi.fn(),
		handleRefreshAllSlides: vi.fn(),
		handleRegenerateScreenshot: vi.fn(),
		handleSidebarCollapsedChange: vi.fn(),
	}),
}))

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

vi.mock("@/components/shadcn-ui/button", () => ({
	Button: ({
		children,
		...props
	}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) => (
		<button type="button" {...props}>
			{children}
		</button>
	),
}))

vi.mock("@/components/shadcn-ui/alert-dialog", () => ({
	AlertDialog: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
	AlertDialogContent: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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
}) {
	return render(
		<PPTRender
			slidePaths={["slide-1.html"]}
			filePathMapping={new Map()}
			mainFileId="ppt-root-file"
			mainFileName="Deck.html"
			allowEdit={true}
			onRegisterCheckBeforeClose={input?.onRegisterCheckBeforeClose}
			onUnregisterCheckBeforeClose={input?.onUnregisterCheckBeforeClose}
		/>,
	)
}

describe("PPTRender", () => {
	beforeEach(() => {
		mockState.confirmConfig = null
		mockState.store.setFullscreen.mockReset()
		mockState.store.setActiveIndex.mockReset()
		mockState.store.getFileIdByPath.mockClear()
		mockState.store.getSlideServerUpdate.mockClear()
		mockState.navigateSaveHandler.mockReset()
		mockState.navigateSaveHandler.mockResolvedValue(true)
		mockState.closeSaveHandler.mockReset()
		mockState.closeSaveHandler.mockResolvedValue(true)
		mockState.discardHandler.mockReset()
		mockState.discardHandler.mockResolvedValue(true)
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
